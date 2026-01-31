import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i];
        if (!key.startsWith('--')) continue;
        const value = argv[i + 1];
        args[key.slice(2)] = value;
        i += 1;
    }
    return args;
}

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing env: ${name}`);
    }
    return value;
}

function getErrorMessage(error) {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error';
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

async function withRetry(fn, { retries = 3, minDelayMs = 500, label = 'operation' } = {}) {
    let attempt = 0;
    // Simple exponential backoff for transient fetch errors.
    while (true) {
        try {
            return await fn();
        } catch (error) {
            attempt += 1;
            if (attempt > retries) {
                throw error;
            }
            const delay = minDelayMs * Math.pow(2, attempt - 1);
            console.error(`[stt-worker] ${label} failed (attempt ${attempt}/${retries}), retrying in ${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

async function downloadChunks({ supabase, bucket, prefix, tempDir }) {
    const { data: list, error } = await withRetry(
        () => supabase.storage.from(bucket).list(prefix, { limit: 1000, offset: 0 }),
        { label: 'supabase list' }
    );
    if (error) {
        throw error;
    }
    const chunks = (list || [])
        .map((entry) => entry.name)
        .filter((name) => name.startsWith('chunk-') && name.endsWith('.webm'))
        .sort()
        .map((name) => `${prefix}/${name}`);

    if (chunks.length === 0) {
        throw new Error(`No chunks found for prefix: ${prefix}`);
    }

    const localPaths = [];
    for (const chunkPath of chunks) {
        const { data, error: downloadError } = await withRetry(
            () => supabase.storage.from(bucket).download(chunkPath),
            { label: `supabase download ${chunkPath}` }
        );
        if (downloadError) {
            throw downloadError;
        }
        const buffer = Buffer.from(await data.arrayBuffer());
        const localPath = path.join(tempDir, path.basename(chunkPath));
        fs.writeFileSync(localPath, buffer);
        localPaths.push(localPath);
    }

    return localPaths;
}

function mergeWithFfmpeg({ chunks, outputPath, tempDir }) {
    const listPath = path.join(tempDir, 'concat.txt');
    const content = chunks.map((chunkPath) => `file '${chunkPath.replace(/'/g, `'\\''`)}'`).join('\n');
    fs.writeFileSync(listPath, content);

    const baseArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
    ];

    const tryMerge = (args, label) => {
        const result = spawnSync('ffmpeg', args, { stdio: 'pipe' });
        if (result.error) {
            throw new Error(`ffmpeg exec failed (${label}): ${result.error.message}`);
        }
        if (result.status !== 0) {
            const stderr = result.stderr?.toString() || '';
            return { ok: false, error: stderr || `ffmpeg merge failed (${label})` };
        }
        return { ok: true };
    };

    const aacResult = tryMerge(
        [
            ...baseArgs,
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            outputPath,
        ],
        'aac'
    );
    if (!aacResult.ok) {
        throw new Error(`ffmpeg merge failed: ${aacResult.error}`);
    }
}

function inspectAudio(filePath) {
    const result = spawnSync(
        'ffprobe',
        [
            '-hide_banner',
            '-loglevel',
            'error',
            '-show_entries',
            'format=format_name,duration:stream=index,codec_name,codec_type,channels,sample_rate,bit_rate',
            '-print_format',
            'json',
            filePath,
        ],
        { stdio: 'pipe' }
    );

    if (result.error) {
        console.error(`[stt-worker] ffprobe not available: ${result.error.message}`);
        return;
    }

    if (result.status !== 0) {
        const stderr = result.stderr?.toString() || '';
        console.error(`[stt-worker] ffprobe failed: ${stderr}`);
        return;
    }

    const output = result.stdout?.toString() || '';
    if (!output) {
        console.error('[stt-worker] ffprobe returned empty output');
        return;
    }

    console.error('[stt-worker] ffprobe', output.trim());
}

function normalizeInvokeUrl(invokeUrl) {
    if (!invokeUrl) return '';
    return invokeUrl.replace(/\/$/, '');
}

async function uploadToClova({ invokeUrl, secretKey, filePath, params }) {
    const fullUrl = `${normalizeInvokeUrl(invokeUrl)}/recognizer/upload`;
    const fileData = fs.readFileSync(filePath);
    const blob = new Blob([fileData], { type: 'audio/m4a' });
    const formData = new FormData();
    formData.append('media', blob, path.basename(filePath));
    formData.append('params', JSON.stringify(params));

    const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
            'X-CLOVASPEECH-API-KEY': secretKey,
        },
        body: formData,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Clova request failed: ${response.status} ${response.statusText}\n${text}`);
    }

    return response.json();
}


async function logSystem(supabase, sessionId, level, message, metadata = {}) {
    // Local logs to stderr (stdout is for result JSON)
    const prefix = `[STT-WORKER]`;
    if (level === 'error') {
        console.error(prefix, message, metadata);
    } else {
        console.error(prefix, message);
    }

    if (!supabase) return;

    try {
        await supabase.from('system_logs').insert({
            session_id: sessionId,
            source: 'stt-worker',
            level,
            message,
            metadata
        });
    } catch (error) {
        console.error('[stt-worker] Failed to send log:', error.message);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const prefix = args.prefix;
    if (!prefix) {
        throw new Error('Usage: node scripts/stt-worker.mjs --prefix <storage-prefix>');
    }

    // Extract sessionId from prefix (e.g. "recordings/req_123" -> "req_123")
    // Fallback to prefix if standard format isn't used
    const sessionId = prefix.includes('/') ? prefix.split('/').pop() : prefix;

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseBucket = process.env.SUPABASE_STT_BUCKET || 'audio-uploads';
    const clovaInvokeUrl = requireEnv('NAVER_CLOVA_INVOKE_URL');
    const clovaSecretKey = requireEnv('NAVER_CLOVA_SECRET_KEY');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-worker-'));
    ensureDir(tempDir);

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
    });

    await logSystem(supabase, sessionId, 'info', 'Worker started', { prefix, tempDir });

    try {
        console.error(`[stt-worker] downloading chunks from ${supabaseBucket}/${prefix}`);
        await logSystem(supabase, sessionId, 'info', 'Downloading chunks', { bucket: supabaseBucket });

        const chunks = await downloadChunks({
            supabase,
            bucket: supabaseBucket,
            prefix,
            tempDir,
        });

        await logSystem(supabase, sessionId, 'info', 'Chunks downloaded', { count: chunks.length });

        console.error(`[stt-worker] merging ${chunks.length} chunks`);
        const outputPath = path.join(tempDir, 'merged.m4a');

        try {
            mergeWithFfmpeg({ chunks, outputPath, tempDir });
            await logSystem(supabase, sessionId, 'info', 'Merge complete');
        } catch (mergeError) {
            await logSystem(supabase, sessionId, 'error', 'FFmpeg merge failed', { error: mergeError.message });
            throw mergeError;
        }

        inspectAudio(outputPath);

        const minSpeakerCount = Number.parseInt(process.env.STT_DIARIZATION_MIN_SPEAKER || '2', 10);
        const maxSpeakerCount = Number.parseInt(process.env.STT_DIARIZATION_MAX_SPEAKER || '4', 10);
        const languageCode = process.env.STT_LANGUAGE_CODE || 'ko-KR';
        const domainCode = process.env.NAVER_CLOVA_DOMAIN_CODE;

        const params = {
            language: languageCode,
            completion: args.completion || 'sync',
            callback: null,
            userdata: domainCode ? { _ncp_DomainCode: domainCode } : undefined,
            forbidden: null,
            boostings: null,
            wordAlignment: true,
            fullText: true,
            diarization: {
                enable: true,
                speakerCountMin: minSpeakerCount,
                speakerCountMax: maxSpeakerCount,
            },
        };

        console.error('[stt-worker] uploading merged file to Clova');
        console.error('[stt-worker] clova params', JSON.stringify(params));

        await logSystem(supabase, sessionId, 'info', 'Uploading to Clova', { params });

        const clovaResult = await uploadToClova({
            invokeUrl: clovaInvokeUrl,
            secretKey: clovaSecretKey,
            filePath: outputPath,
            params,
        });

        await logSystem(supabase, sessionId, 'info', 'Clova processing complete', { resultSummary: clovaResult.text ? 'Text found' : 'No text' });

        process.stdout.write(
            JSON.stringify(
                {
                    mergedPath: outputPath,
                    chunkCount: chunks.length,
                    prefix,
                    result: clovaResult,
                },
                null,
                2
            )
        );
    } catch (error) {
        await logSystem(supabase, sessionId, 'error', 'Worker failed', { error: getErrorMessage(error) });
        throw error;
    }
}

main().catch((error) => {
    console.error('[stt-worker] Failed:', getErrorMessage(error));
    process.exit(1);
});
