import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { Storage } from '@google-cloud/storage';

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

function sanitizePrivateKey(key) {
    return key.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
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

    const copyResult = tryMerge([...baseArgs, '-c', 'copy', outputPath], 'copy');
    if (copyResult.ok) return;

    const reencodeResult = tryMerge(
        [
            ...baseArgs,
            '-c:a',
            'flac',
            '-ar',
            '16000',
            '-ac',
            '1',
            outputPath,
        ],
        'reencode'
    );
    if (!reencodeResult.ok) {
        throw new Error(`ffmpeg merge failed: ${copyResult.error}\n${reencodeResult.error}`);
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

async function uploadToGcs({ bucketName, filePath, destination, credentials, projectId }) {
    const keyHeader = credentials.private_key?.split('\n')[0] || '';
    const keyFooter = credentials.private_key?.split('\n').slice(-1)[0] || '';
    console.error(`[stt-worker] GCS creds: project=${projectId}, keyHeader=${keyHeader}, keyFooter=${keyFooter}`);
    let storage;
    try {
        storage = new Storage({ credentials, projectId });
    } catch (error) {
        throw new Error(`gcs client init failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await storage.bucket(bucketName).upload(filePath, {
        destination,
        resumable: true,
    });
    return `gs://${bucketName}/${destination}`;
}

async function startSttIfRequested({ startUrl, gcsUri }) {
    if (!startUrl) return null;
    const workerToken = process.env.STT_WORKER_TOKEN;
    const response = await fetch(startUrl, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(workerToken ? { 'x-stt-worker-token': workerToken } : {}),
        },
        body: JSON.stringify({ gcsUri }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`STT start failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    if (data?.debug?.config) {
        console.error('[stt-worker] stt config', JSON.stringify(data.debug.config));
    }
    return data?.operationName || null;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const prefix = args.prefix;
    const startUrl = args['start-url'];
    if (!prefix) {
        throw new Error('Usage: node scripts/stt-worker.mjs --prefix <storage-prefix>');
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseBucket = process.env.SUPABASE_STT_BUCKET || 'audio-uploads';
    const gcsBucket = requireEnv('GCS_BUCKET_NAME');
    const projectId = requireEnv('GOOGLE_PROJECT_ID');
    const clientEmail = requireEnv('GOOGLE_CLIENT_EMAIL');
    const privateKey = sanitizePrivateKey(requireEnv('GOOGLE_PRIVATE_KEY'));

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-worker-'));
    ensureDir(tempDir);

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
    });

    console.error(`[stt-worker] downloading chunks from ${supabaseBucket}/${prefix}`);
    const chunks = await downloadChunks({
        supabase,
        bucket: supabaseBucket,
        prefix,
        tempDir,
    });

    console.error(`[stt-worker] merging ${chunks.length} chunks`);
    const outputPath = path.join(tempDir, 'merged.webm');
    mergeWithFfmpeg({ chunks, outputPath, tempDir });
    inspectAudio(outputPath);

    const keyHeader = privateKey.split('\n')[0] || '';
    const keyFooter = privateKey.split('\n').slice(-1)[0] || '';
    console.error(`[stt-worker] GCS key check: header=${keyHeader}, footer=${keyFooter}, length=${privateKey.length}`);
    console.error('[stt-worker] uploading merged file to GCS');
    const destination = `${prefix.replace(/\/$/, '')}/merged.webm`;
    const gcsUri = await uploadToGcs({
        bucketName: gcsBucket,
        filePath: outputPath,
        destination,
        credentials: { client_email: clientEmail, private_key: privateKey },
        projectId,
    });

    console.error('[stt-worker] uploaded to GCS:', gcsUri);
    const operationName = await startSttIfRequested({ startUrl, gcsUri });

    process.stdout.write(
        JSON.stringify(
            {
                gcsUri,
                operationName,
                mergedPath: outputPath,
                chunkCount: chunks.length,
                prefix,
            },
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error('[stt-worker] Failed:', getErrorMessage(error));
    process.exit(1);
});
