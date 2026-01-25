import { v2 } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const BUCKET_NAME = 'dl_stt_bucket';

// Clients
function getClients() {
    const creds = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        project_id: GOOGLE_PROJECT_ID,
    };
    return {
        speech: new v2.SpeechClient({
            credentials: creds,
            apiEndpoint: 'us-central1-speech.googleapis.com', // Must point to regional endpoint for non-global locations
        }),
        storage: new Storage({ credentials: creds }),
    };
}

async function main() {
    const args = process.argv.slice(2);
    const localFilename = args[0] || 'scripts/recordings04.wav'; // Default to WAV

    if (!fs.existsSync(localFilename)) {
        console.error(`File not found: ${localFilename}`);
        return;
    }

    const { speech, storage } = getClients();

    // 1. Upload
    console.log(`[V2] Uploading ${localFilename}...`);
    const destFileName = `v2-test-${Date.now()}${path.extname(localFilename)}`;
    const bucket = storage.bucket(BUCKET_NAME);

    try {
        await bucket.upload(localFilename, { destination: destFileName });
    } catch (e) {
        console.error("Upload failed (permissions?):", e.message);
        return;
    }
    const gcsUri = `gs://${BUCKET_NAME}/${destFileName}`;
    console.log(`[V2] Uploaded: ${gcsUri}`);

    // 2. Transcribe using V2 BatchRecognize (usually for long files)
    // For V2, we need a Recognizer. We can create a temporary one or use a standard one.
    // 'chirp' model is only available in US regions usually? Let's try global.
    // Chirp 2 is 'chirp_2'? Or 'chirp'?
    // Docs say: model='chirp', 'long', 'short', 'telephony'.

    const location = 'us-central1'; // Chirp often requires regional endpoint (us-central1)
    const recognizerId = `temp-recognizer-${Date.now()}`;
    const parent = `projects/${GOOGLE_PROJECT_ID}/locations/${location}`;
    const recognizerName = `${parent}/recognizers/${recognizerId}`;

    console.log(`[V2] Creating Recognizer ${recognizerName} with model 'chirp'...`);

    try {
        const [recognizer] = await speech.createRecognizer({
            parent: parent,
            recognizerId: recognizerId,
            recognizer: {
                displayName: 'Temp Chirp Recognizer',
                model: 'chirp',
                languageCodes: ['ko-KR'],
                // Leave default config empty to avoid creation errors, apply config at request time if possible
                // OR minimal config
            },
        });
        console.log(`[V2] Recognizer created: ${recognizer.name}`);

        // 3. Batch Recognize
        console.log(`[V2] Starting BatchRecognize...`);
        const [operation] = await speech.batchRecognize({
            recognizer: recognizer.name,
            files: [{ uri: gcsUri }],
            config: {
                features: {
                    enableSpeakerDiarization: true,
                    diarizationConfig: {
                        minSpeakerCount: 2,
                        maxSpeakerCount: 4,
                    }
                },
                autoDecodingConfig: {},
            },
            recognitionOutputConfig: {
                inlineResponseConfig: {}, // Get result inline
            },
        });

        console.log(`[V2] Waiting for operation...`);
        const [response] = await operation.promise();

        // 4. Parse Results
        console.log("\n--- V2 Batch Results ---");
        // Structure: response.results[uri].transcript...
        // Actually response.results is a map of uri -> BatchRecognizeFileResult

        for (const [uri, fileResult] of Object.entries(response.results)) {
            console.log(`File: ${uri}`);
            if (fileResult.error) {
                console.error(`Error: ${fileResult.error.message}`);
                continue;
            }

            // Inline response
            // fileResult.inlineResult.transcript.results[] 
            // V2 result structure is different
            if (fileResult.inlineResult && fileResult.inlineResult.transcript) {
                const results = fileResult.inlineResult.transcript.results || [];
                console.log(`Total Results: ${results.length}`);

                // Collect words and speakers
                const allWords = [];
                results.forEach(r => {
                    // r.alternatives[0].words
                    if (r.alternatives?.[0]?.words) {
                        allWords.push(...r.alternatives[0].words);
                    }
                });

                console.log(`Total Words detected: ${allWords.length}`);

                if (allWords.length > 0) {
                    let currentSpeaker = null;
                    let buffer = [];

                    allWords.forEach(w => {
                        const speaker = w.speakerLabel; // V2 uses speakerLabel
                        const word = w.word;

                        if (currentSpeaker === null) currentSpeaker = speaker;
                        if (speaker !== currentSpeaker) {
                            console.log(`[${currentSpeaker}]: ${buffer.join(' ')}`);
                            buffer = [];
                            currentSpeaker = speaker;
                        }
                        buffer.push(word);
                    });
                    if (buffer.length > 0) console.log(`[${currentSpeaker}]: ${buffer.join(' ')}`);
                } else {
                    // Maybe transcript only?
                    const transcript = results.map(r => r.alternatives[0].transcript).join(' ');
                    console.log("Transcript:", transcript);
                    console.log("(No word-level/speaker details found)");
                }
            }
        }

    } catch (e) {
        console.error("[V2] Error:", e);
    } finally {
        // Cleanup
        console.log("\n[Cleanup] Deleting file and recognizer...");
        try { await bucket.file(destFileName).delete(); } catch (e) { }
        try {
            // Use specific delete method if client has it
            await speech.deleteRecognizer({ name: recognizerName });
            console.log("Recognizer deleted.");
        } catch (e) { console.error("Failed to delete recognizer:", e.message); }
    }
}

main();
