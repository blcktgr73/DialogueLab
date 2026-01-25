# STT Migration Specification: Google Cloud STT to Naver Clova Speech

## 1. Overview
This document outlines the migration plan from Google Cloud Speech-to-Text (STT) to Naver Clova Speech for the DialogueLab project. The primary driver for this change is the superior Speaker Diarization performance observed with Naver Clova for Korean language dialogue.

## 2. Component Comparison

| Feature | Google Cloud STT (Current) | Naver Clova Speech (Target) |
| :--- | :--- | :--- |
| **API Endpoint** | `speech.googleapis.com` (via SDK) | `clovaspeech-gw.ncloud.com` (Invoke URL) |
| **Input Format** | WebM/Opus (Supported natively) | M4A, AAC, MP3, WAV (WebM/Opus weak/no support) |
| **Processing Mode** | `LongRunningRecognize` (Async) | `/recognizer/upload` (Sync or Async) |
| **File Storage** | **Mandatory GCS** for audio > 1 min | **Direct Upload** (multipart/form-data) supported |
| **Max Duration** | Inline: 1 min, GCS: 8 hours | Direct Upload: typically limit by size (e.g. 60MB Sync) |
| **Diarization** | Configuration in `RecognitionConfig` | Configuration in `params` JSON field |
| **Authentication** | Google Service Account (JSON Key) | X-CLOVASPEECH-API-KEY (Secret Key) |

## 3. Architecture Changes

### Current Flow (Google STT)
1.  **Client**: Records audio chunks -> Uploads to Supabase Storage.
2.  **Client**: Requests analysis -> Triggers `stt-worker`.
3.  **stt-worker**: 
    *   Downloads chunks from Supabase.
    *   Merges to `merged.webm` (WebM/Opus).
    *   **Uploads `merged.webm` to Google Cloud Storage (GCS) Bucket.**
    *   Calls Google STT API with `gs://...` URI.
    *   Returns `operationName`.
4.  **Server (`/api/stt/start`)**: Receives `operationName` and polls for results (not fully implemented/robust in current `stt-worker` output).

### Target Flow (Naver Clova)
1.  **Client**: Records audio chunks -> Uploads to Supabase Storage (No change).
2.  **Client**: Requests analysis -> Triggers `stt-worker`.
3.  **stt-worker**:
    *   Downloads chunks from Supabase.
    *   **Transcoding**: Merges chunks AND converts format from **WebM/Opus** to **M4A/AAC**.
    *   **Direct Upload**: Sends POST request to Naver Clova `invoke URL` with file (multipart/form-data).
    *   **GCS Removal**: Delete GCS upload logic.
    *   **Response**: Receives full JSON result immediately (Sync) or Job ID (Async) depending on file size policy. Use Sync for simplicity first if file size permits.

## 4. Implementation Details

### 4.1. Audio Conversion (FFmpeg)
The `stt-worker` currently uses `ffmpeg` for merging. We will modify the arguments to output AAC audio in an M4A container.
*   **Input**: List of `.webm` chunks.
*   **Command**: `ffmpeg -f concat ... -c:a aac -b:a 128k output.m4a`

### 4.2. STT Worker Update (`scripts/stt-worker.mjs`)
*   **Remove**: `@google-cloud/speech`, `@google-cloud/storage` imports and logic.
*   **Add**: `form-data` (or native `fetch` + `FormData` if Node version supports it, or manual boundary construction). Node 18+ supports `fetch` and `FormData` natively.
*   **Logic**:
    1.  Perform Merge & Convert.
    2.  Construct `FormData` with `media` (file stream) and `params` (JSON).
    3.  POST to `NAVER_CLOVA_INVOKE_URL`.
    4.  Output result JSON to stdout for the caller.

### 4.3. Environment Variables
*   **Keep**: `NEXT_PUBLIC_SUPABASE_URL`, `STT_WORKER_TOKEN`, `NAVER_CLOVA_INVOKE_URL`, `NAVER_CLOVA_SECRET_KEY`.
*   **Remove**: `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` (if not used for other Google services like Gemini - *Wait, Gemini is used, so keep credentials but remove STT specific usage*).

## 5. Migration Steps
1.  **Update `stt-worker.mjs`**: Implement FFmpeg conversion to m4a and direct Clova API call.
2.  **Verify `stt-worker-server.mjs`**: Ensure it passes through the correct response.
3.  **Update Client/Server API**: The Next.js API route currently handles the "Start STT" request. It needs to adapt to the new synchronous response (or async job id) returned by the worker.
    *   *Note*: If `stt-worker` runs long (processing + upload + analysis), the http request from Next.js to Worker might time out. We should ensure the worker returns a "Job Accepted" status or the Next.js API is designed to handle long waits (or use polling).
    *   *Simplification*: For now, let's keep the worker flow synchronous if possible (Request -> Analysis -> Return Result). Naver Clova Sync is fast.

## 6. Local Validation (Test Script)

Use the provided script to validate Clova diarization before wiring it into the pipeline.

**Script**: `scripts/test-clova.mjs`

**Prereqs**:
- `ffmpeg` installed (used to convert WebM -> M4A/AAC)
- `.env.local` contains:
  - `NAVER_CLOVA_INVOKE_URL`
  - `NAVER_CLOVA_SECRET_KEY`

**Run**:
```bash
node scripts/test-clova.mjs <path-to-audio.webm>
```

**What it does**:
- Converts `.webm` to `.m4a` (AAC) if needed.
- Sends `multipart/form-data` to `${NAVER_CLOVA_INVOKE_URL}/recognizer/upload`.
- Uses diarization params:
  - `diarization.enable: true`
  - `speakerCountMin: 2`, `speakerCountMax: 4`
- Writes preview output to `scripts/clova_output.txt`.

**Expected Output**:
- `result.segments[]` populated with speaker labels and text.

## 7. Risk Assessment
*   **File Size Limit**: Naver Clova Sync API has a body size limit (typically 60MB). `recordings01.webm` was ~2.5MB. Even converted to m4a, it should be well under 60MB. If sessions exceed ~30-60 mins, we may hit this limit and need to implement Object Storage based Async recognition.
*   **Latency**: Uploading large files directly might be slower than cloud-to-cloud, but eliminates GCS complexity.
