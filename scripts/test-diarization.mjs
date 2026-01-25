import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { SpeechClient } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Credential Logic ---
function getCredentials() {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    privateKey = privateKey.replace(/\\n/g, '\n');
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) privateKey = privateKey.slice(1, -1);
    privateKey = privateKey.trim();

    if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_CLIENT_EMAIL || !privateKey) {
        return null;
    }

    return {
        projectId: process.env.GOOGLE_PROJECT_ID,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
    };
}

function getSpeechClient() {
    const credentials = getCredentials();
    if (!credentials) {
        console.error('Missing credentials in .env.local');
        return null;
    }
    try {
        return new SpeechClient({ credentials });
    } catch (error) {
        console.error("Failed to initialize Speech client:", error);
        return null;
    }
}

function getStorageClient() {
    const credentials = getCredentials();
    if (!credentials) return null;
    try {
        return new Storage({ credentials });
    } catch (error) {
        console.error("Failed to initialize Storage client:", error);
        return null;
    }
}

// --- Main Test Function ---
async function main() {
    const args = process.argv.slice(2);
    const filename = args[0] || 'recordings01.webm';
    const filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        console.log('Usage: node scripts/test-diarization.mjs <filename>');
        return;
    }

    const speechClient = getSpeechClient();
    const storageClient = getStorageClient();
    if (!speechClient || !storageClient) process.exit(1);

    // 1. Prepare Bucket
    // 1. Prepare Bucket
    // Use explicit bucket from env, or fallback to project-based name (which requires creation perms)
    const bucketName = process.env.GCS_BUCKET_NAME || `${process.env.GOOGLE_PROJECT_ID || 'dialoguelab'}-stt-test`;
    const bucket = storageClient.bucket(bucketName);

    console.log(`[Setup] Target bucket: ${bucketName}`);

    let bucketExists = false;
    try {
        const [exists] = await bucket.exists();
        if (exists) {
            console.log(`[Setup] Bucket ${bucketName} exists.`);
            bucketExists = true;
        } else {
            console.log(`[Setup] Bucket ${bucketName} does not exist. Attempting to create...`);
            await bucket.create({ location: 'asia-northeast3' }); // Try Seoul region for speed
            console.log(`[Setup] Bucket created successfully.`);
            bucketExists = true;
        }
    } catch (e) {
        console.warn(`[Setup] Warning: Checked/Creation of bucket failed (${e.message}).`);
        console.warn(`[Setup] This usually means the Service Account lacks 'Storage Admin' role.`);
        console.warn(`[Setup] Attempting to proceed assuming bucket MIGHT exist or is accessible...`);
        // We won't return here, we'll try to upload. If that fails, we'll catch it at the upload step.
        bucketExists = true;
    }

    // 2. Upload File
    const destFileName = `test-audio-${Date.now()}.webm`;
    console.log(`[Upload] Uploading ${filename} to gs://${bucketName}/${destFileName}...`);

    try {
        // Warning: if bucket is in a different region, this might be slow or incur costs, but fine for test.
        await bucket.upload(filePath, {
            destination: destFileName,
        });
    } catch (e) {
        console.error('Upload failed:', e.message);
        return;
    }

    const gcsUri = `gs://${bucketName}/${destFileName}`;
    console.log(`[Upload] Success: ${gcsUri}`);

    // 3. STT Request
    // Detect encoding based on file extension
    const ext = path.extname(filename).toLowerCase();
    let encoding = 'WEBM_OPUS';
    let sampleRateHertz = 48000;

    if (ext === '.flac') {
        encoding = 'FLAC';
        // For FLAC, Google often detects sample rate from header but good to match
    } else if (ext === '.wav') {
        encoding = 'LINEAR16';
        // LINEAR16 usually requires sampleRateHertz to match exactly if not in header, 
        // but for Wav files with headers, Google can sometimes auto-detect or we should trust the file prop.
        // Assuming 48000 (from ffmpeg default often matching input) or 44100.
        // Let's stick to 48000 as default or maybe remove sampleRateHertz for FLAC/WAV if possible to let backend detect? 
        // Google Cloud Speech strictly requires sampleRateHertz for LINEAR16 if not using headerless.
        // Actually, for WAV (RIFF), the header has it. For 'LINEAR16' (raw PCM), we need it. 
        // But Google API 'LINEAR16' usually usually means raw PCM or WAV container? 
        // Actually for WAV container, just providing audio bytes is often enough but encoding 'LINEAR16' + correct sample rate is safest.
        // Let's guess 48000 as typical. If ffmpeg preserved input rate, it might vary.
        // Safer: don't specify sampleRateHertz if we are unsure? Check docs.
        // Docs: "sampleRateHertz" is optional for FLAC and WAV (if header present).
        sampleRateHertz = 48000;
    }

    const config = {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz, // Providing it for now, might need adjustment if mismatched
        languageCode: 'ko-KR',
        audioChannelCount: 1,
        enableWordTimeOffsets: true,
        model: 'telephony', // Testing telephony model for better diarization
        diarizationConfig: {
            enableSpeakerDiarization: true,
            minSpeakerCount: 2,
            maxSpeakerCount: 4,
        },
    };

    // Remove sampleRateHertz if it causes issues for FLAC/WAV with headers?
    // Let's keep it for now but if error occurs, we know why.
    if (ext === '.flac' || ext === '.wav') {
        delete config.sampleRateHertz; // Rely on header for these formats
    }

    const request = {
        audio: {
            uri: gcsUri, // Use URI instead of content
        },
        config: config,
    };

    console.log('[STT] Sending longRunningRecognize request...');
    console.log('Config:', JSON.stringify(config, null, 2));

    try {
        const [operation] = await speechClient.longRunningRecognize(request);
        console.log('[STT] Operation started. Waiting for completion...');
        const [response] = await operation.promise();

        // Summary Output to avoid encoding issues
        console.log(`\n--- Diarization Summary ---`);
        console.log(`Total Results/Segments: ${response.results.length}`);

        // DEBUG: Print each result's metadata
        console.log('--- Result Breakdowns ---');
        response.results.forEach((result, idx) => {
            const alt = result.alternatives[0];
            const words = alt.words || [];
            const transcript = alt.transcript || "";
            let startTime = "N/A";
            let endTime = "N/A";

            if (words.length > 0) {
                startTime = words[0].startTime ? (parseInt(words[0].startTime.seconds || 0) + (words[0].startTime.nanos || 0) / 1e9).toFixed(2) : "N/A";
                const lastWord = words[words.length - 1];
                endTime = lastWord.endTime ? (parseInt(lastWord.endTime.seconds || 0) + (lastWord.endTime.nanos || 0) / 1e9).toFixed(2) : "N/A";
            }
            console.log(`Result ${idx}: Words=${words.length}, Time=${startTime}s-${endTime}s, Transcript="${transcript.substring(0, 30)}..."`);
        });

        const allWords = [];

        // Fix for duplication: Use ONLY the last result if it covers the full duration, 
        // or simplistic approach: just use the last result as it often contains the full diarized output in this mode.
        if (response.results.length > 0) {
            const lastResult = response.results[response.results.length - 1];
            const words = lastResult.alternatives[0].words;
            if (words) allWords.push(...words);
            console.log(`\n(Using only the last result [Result ${response.results.length - 1}] for speaker breakdown, assuming it contains the full merged output)`);
        }

        console.log(`Total Words: ${allWords.length}`);

        if (allWords.length > 0) {
            let currentSpeaker = null;
            let currentUtteranceCount = 0;
            let speakerChanges = 0;
            const speakerWordCounts = {};

            console.log('\n--- Speaker Segments (First 5 words each) ---');

            allWords.forEach((wordInfo, index) => {
                const speakerTag = wordInfo.speakerTag;
                const word = wordInfo.word;

                // Track total words per speaker
                speakerWordCounts[speakerTag] = (speakerWordCounts[speakerTag] || 0) + 1;

                if (currentSpeaker === null) {
                    currentSpeaker = speakerTag;
                    process.stdout.write(`Speaker ${currentSpeaker}: ${word}`);
                    currentUtteranceCount = 1;
                } else if (speakerTag !== currentSpeaker) {
                    console.log(` ... (${currentUtteranceCount} words)`);
                    speakerChanges++;
                    currentSpeaker = speakerTag;
                    currentUtteranceCount = 1;
                    process.stdout.write(`Speaker ${currentSpeaker}: ${word}`);
                } else {
                    currentUtteranceCount++;
                    if (currentUtteranceCount <= 5) {
                        process.stdout.write(` ${word}`);
                    }
                }
            });
            // End last line
            console.log(` ... (${currentUtteranceCount} words)`);

            console.log('\n--- Statistics ---');
            console.log(`Total Speaker Changes: ${speakerChanges}`);
            console.log('Word Counts per Speaker:', JSON.stringify(speakerWordCounts, null, 2));

        } else {
            console.log('No word-level details or speaker tags found.');
        }

    } catch (err) {
        console.log('ERROR_OCCURRED');
        console.error(err);
    } finally {
        // 4. Cleanup
        console.log(`\n[Cleanup] Deleting ${destFileName}...`);
        try {
            await bucket.file(destFileName).delete();
            console.log('File deleted.');
        } catch (e) {
            console.error('Failed to delete file:', e.message);
        }
    }
}

main();
