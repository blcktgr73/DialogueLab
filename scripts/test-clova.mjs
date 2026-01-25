import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const INVOKE_URL = process.env.NAVER_CLOVA_INVOKE_URL;
const SECRET_KEY = process.env.NAVER_CLOVA_SECRET_KEY;

if (!INVOKE_URL || !SECRET_KEY) {
    console.error('Error: NAVER_CLOVA_INVOKE_URL or NAVER_CLOVA_SECRET_KEY is missing in .env.local');
    process.exit(1);
}

// Helper: Convert WebM to M4A (Clova friendly) using ffmpeg
function convertToM4a(inputPath) {
    const outputPath = inputPath.replace(/\.webm$/, '.m4a');
    console.log(`[FFmpeg] Converting ${inputPath} to ${outputPath}...`);

    // Check if output already exists (optional, could overwrite)
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }

    const args = [
        '-i', inputPath,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        outputPath
    ];

    const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });

    if (result.status !== 0) {
        throw new Error('FFmpeg conversion failed.');
    }

    return outputPath;
}

async function main() {
    const args = process.argv.slice(2);
    const inputFilename = args[0] || 'recordings01.webm';
    const inputPath = path.resolve(process.cwd(), inputFilename);

    if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        console.log('Usage: node scripts/test-clova.mjs <filepath>');
        process.exit(1);
    }

    // 1. Convert if necessary (Clova supports: mp3, aac, ac3, ogg, flac, wav, m4a)
    // WebM is often OPUS, which might not be directly supported or just safer to convert.
    let targetPath = inputPath;
    if (inputPath.endsWith('.webm')) {
        try {
            targetPath = convertToM4a(inputPath);
        } catch (e) {
            console.error('Conversion failed, trying original file (might fail if format unsupported).');
        }
    }

    console.log(`[Clova] Using file: ${targetPath}`);

    // 2. Prepare Form Data
    const fileData = fs.readFileSync(targetPath);
    const blob = new Blob([fileData], { type: 'audio/m4a' }); // or auto-detect

    const params = {
        language: 'ko-KR',
        completion: 'sync',
        callback: null,
        userdata: { _ncp_DomainCode: '14335' }, // Sometimes needed, usually inferred from URL
        forbidden: null,
        boostings: null,
        wordAlignment: true,
        fullText: true,
        diarization: {
            enable: true,
            speakerCountMin: 2,
            speakerCountMax: 4
        },
    };

    const formData = new FormData();
    formData.append('media', blob, path.basename(targetPath));
    formData.append('params', JSON.stringify(params));

    // 3. Send Request
    const fullUrl = `${INVOKE_URL}/recognizer/upload`;
    console.log(`[Clova] Sending request to ${fullUrl}...`);
    console.log(`[Clova] Params:`, JSON.stringify(params, null, 2));

    try {
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'X-CLOVASPEECH-API-KEY': SECRET_KEY,
            },
            body: formData,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Request Failed: ${response.status} ${response.statusText}\n${text}`);
        }

        const result = await response.json();
        console.log('\n--- Result Success ---');

        // Print Summary
        if (result.segments) {
            console.log(`Total Segments: ${result.segments.length}`);
            console.log(`--- Diarization Preview ---`);

            const lines = [];
            result.segments.forEach(seg => {
                const line = `[${seg.speaker.label}] ${seg.text} (${seg.start} - ${seg.end})`;
                console.log(line);
                lines.push(line);
            });
            fs.writeFileSync('scripts/clova_output.txt', lines.join('\n'), 'utf8');
        } else {
            console.log('No segments found. Raw result:', JSON.stringify(result, null, 2));
        }

    } catch (error) {
        console.error('\n[Clova] Error:', error.message);
    }
}

main();
