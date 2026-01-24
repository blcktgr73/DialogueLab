# STT Integration Design (Google Cloud Speech-to-Text)

## 1. Overview
This document outlines the architecture for implementing Multi-party Speech-to-Text (STT) functionality using Google Cloud STT API. The goal is to allow users to upload audio files (conversations) and receive speaker-separated text transcripts automatically.

## 2. Constraints & Technical Challenges
- **Vercel Serverless Limits**:
  - Request Body Size: 4.5MB. (Too small for audio files)
  - Execution Time: 10s (Hobby) / 60s (Pro). (Too short for STT processing)
- **Longform Audio (1~2 hours)**:
  - In-browser inline upload is infeasible at this size.
  - WebM chunks are not trivially concat-able without container-aware tooling.
- **Audio Processing**:
  - Google STT requires `gs://` (Google Cloud Storage) URI for files longer than 1 minute.
  - Processing time is approximately 50-100% of audio length.
  - Long-running recognition requires asynchronous flow and polling.

## 3. Architecture Strategy

To bypass Vercel limits and support longform audio while keeping recording quality, we will implement a **"Direct-to-Storage + GCS Bridge"** pattern.

### 3.1. Storage: Supabase (Primary) + GCS (Temporary)
- **Supabase Storage**: Primary upload target (cost-effective, local server).
- **GCS Bucket**: Temporary staging for Google STT (`gs://` URI requirement).
- **Why GCS?**: Google STT longRunningRecognize requires `gs://` for longform.

### 3.2. Data Flow (Longform)
1.  **Client**: User completes recording. Requests `Signed Upload URL` from Server.
2.  **Server**: Generates Supabase signed upload URL and returns to Client.
3.  **Client**: Uploads file directly to Supabase Storage (bypassing Vercel).
    - If resumable upload is unavailable, upload in chunks to `uploads/<sessionId>/<seq>.webm`.
4.  **Client**: Notifies Server "Upload Complete" with file path(s).
5.  **Worker (Local Server)**:
    - Downloads Supabase object(s).
    - Merges chunks into a single file (container-aware, e.g., ffmpeg remux).
    - Uploads the merged file to GCS (temporary).
6.  **Server**:
    - Calls Google STT `longRunningRecognize` with `gs://` URI and diarization config.
    - Returns `operationName` (ID) to Client immediately.
7.  **Client**:
    - Enters "Processing" state.
    - Polls Server API (`/api/stt/status?name=...`) every 5-10 seconds.
    - When done, POSTs `/api/stt/complete` to persist session/transcripts.
8.  **Server (Status Check)**:
    - Checks Google Operation status.
    - If done, parses result, inserts into `transcripts` DB table.
    - Deletes temporary GCS file (cost control).
    - Returns "Completed" to Client.

## 4. Implementation Details

### 4.1. Libraries
- `@google-cloud/speech`
- `@google-cloud/storage`
- `ffmpeg` (local worker for container-safe merge)

### 4.2. Environment Variables
```env
GOOGLE_PROJECT_ID=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GCS_BUCKET_NAME=dialoguelab-audio-upload
SUPABASE_STT_BUCKET=audio-uploads
NEXT_PUBLIC_SUPABASE_STT_BUCKET=audio-uploads
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4.3. Diarization Config
```javascript
const config = {
  encoding: 'LINEAR16', // or MP3 based on file
  languageCode: 'ko-KR',
  diarizationConfig: {
    enableSpeakerDiarization: true,
    minSpeakerCount: 2,
    maxSpeakerCount: 10,
  },
  uri: `gs://${bucketName}/${fileName}`
};
```

### 4.4. Failure Modes & Recovery
- **Upload interrupted**: Resume via Supabase resumable upload or retry missing chunks.
- **Chunk merge fails**: Re-run merge with container-aware pipeline (ffmpeg concat).
- **STT long-running time**: UI must show "Processing" with periodic polling.
- **Cost control**: Delete temporary GCS object after processing completes or fails.

## 5. UI/UX
- **Audio Upload / Recorder**:
  - Show longform upload state + progress.
  - If using chunk upload, show part-based progress.
- **TranscriptUploader**:
  - Add "Audio" tab.
  - File Dropzone accepts `.mp3, .wav, .m4a` (and `webm` for recorder).
  - Progress Bar for Upload.
  - Spinner/Progress Bar for STT Processing.
- **Post-Processing**:
  - Map `Speaker 1` -> `화자 1`, `Speaker 2` -> `화자 2`.
  - Provide "Quick Renaming" feature (already implemented via US-017).

## 6. Action Plan
1.  Setup GCS Bucket & Service Account (temporary storage).
2.  Create Supabase Storage bucket for audio uploads.
3.  Implement `upload-url` Server Action (Supabase signed URL).
4.  Implement local worker to merge chunks and upload to GCS.
5.  Implement `start-transcription` Server Action (longRunningRecognize).
6.  Implement `check-status` Server Action/Route.
7.  Implement `complete` endpoint to persist transcripts.
8.  Update Frontend to handle longform upload + async flow.

## 7. Local Worker Interface (CLI)
```bash
node scripts/stt-worker.mjs --prefix recordings/<upload-id> --start-url http://localhost:3000/api/stt/start
```

**Inputs (env)**:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STT_BUCKET`
- `GCS_BUCKET_NAME`
- `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`

**Output (stdout JSON)**:
```json
{
  "gcsUri": "gs://bucket/recordings/<upload-id>/merged.webm",
  "operationName": "projects/.../operations/...",
  "mergedPath": "/tmp/.../merged.webm",
  "chunkCount": 12,
  "prefix": "recordings/<upload-id>"
}
```
