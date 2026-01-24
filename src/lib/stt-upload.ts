import { createClient } from '@/utils/supabase/client';

const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB to stay under Vercel limits per request
const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STT_BUCKET || 'audio-uploads';

export type SttUploadManifest = {
    version: 1;
    bucket: string;
    prefix: string;
    mimeType: string;
    size: number;
    chunkSize: number;
    chunkCount: number;
    createdAt: string;
};

export type UploadProgress = {
    completedChunks: number;
    totalChunks: number;
};

function generateUploadId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `upload_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export async function uploadBlobInChunks({
    blob,
    prefix,
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,
}: {
    blob: Blob;
    prefix?: string;
    chunkSize?: number;
    onProgress?: (progress: UploadProgress) => void;
}) {
    const supabase = createClient();
    const uploadId = prefix || `recordings/${generateUploadId()}`;
    const bucket = DEFAULT_BUCKET;
    const totalChunks = Math.ceil(blob.size / chunkSize);

    let completedChunks = 0;
    for (let index = 0; index < totalChunks; index++) {
        const start = index * chunkSize;
        const end = Math.min(blob.size, start + chunkSize);
        const chunk = blob.slice(start, end, blob.type || 'audio/webm');
        const chunkPath = `${uploadId}/chunk-${String(index).padStart(5, '0')}.webm`;

        const { error } = await supabase.storage.from(bucket).upload(chunkPath, chunk, {
            upsert: true,
            contentType: blob.type || 'audio/webm',
        });
        if (error) {
            throw error;
        }

        completedChunks += 1;
        onProgress?.({ completedChunks, totalChunks });
    }

    const manifest: SttUploadManifest = {
        version: 1,
        bucket,
        prefix: uploadId,
        mimeType: blob.type || 'audio/webm',
        size: blob.size,
        chunkSize,
        chunkCount: totalChunks,
        createdAt: new Date().toISOString(),
    };

    const manifestPath = `${uploadId}/manifest.json`;
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: 'application/json',
    });

    const { error: manifestError } = await supabase.storage.from(bucket).upload(manifestPath, manifestBlob, {
        upsert: true,
        contentType: 'application/json',
    });
    if (manifestError) {
        throw manifestError;
    }

    return {
        uploadId,
        bucket,
        manifestPath,
        manifest,
    };
}
