# STT Integration Design (Google Cloud Speech-to-Text)

## 1. Overview
This document outlines the architecture for implementing Multi-party Speech-to-Text (STT) functionality using Google Cloud STT API. The goal is to allow users to upload audio files (conversations) and receive speaker-separated text transcripts automatically.

## 2. Constraints & Technical Challenges
- **Vercel Serverless Limits**:
  - Request Body Size: 4.5MB. (Too small for audio files)
  - Execution Time: 10s (Hobby) / 60s (Pro). (Too short for STT processing)
- **Audio Processing**:
  - Google STT requires `gs://` (Google Cloud Storage) URI for files longer than 1 minute.
  - Processing time is approximately 50-100% of audio length.

## 3. Architecture Strategy

To bypass Vercel limits, we will implement the **"Direct-to-Cloud"** pattern.

### 3.1. Storage: Google Cloud Storage (GCS)
We need a dedicated GCS Bucket (private) to temporarily store audio files.
- **Why GCS?**: Google STT API reads most efficiently from GCS.

### 3.2. Data Flow
1.  **Client**: User selects file. Requests `Signed Upload URL` from Server.
2.  **Server**: Generates GCS Signed URL (PUT) and returns to Client.
3.  **Client**: Uploads file directly to GCS (bypassing Vercel).
4.  **Client**: Notifies Server "Upload Complete" with file path.
5.  **Server**:
    - Calls Google STT `longRunningRecognize` API with `enableSpeakerDiarization`.
    - Returns `operationName` (ID) to Client immediately.
6.  **Client**:
    - Enters "Processing" state.
    - Polls Server API (`/api/stt/status?id=...`) every 5-10 seconds.
7.  **Server (Status Check)**:
    - Checks Google Operation status.
    - If done, parses result, inserts into `transcripts` DB table.
    - Returns "Completed" to Client.

## 4. Implementation Details

### 4.1. Libraries
- `@google-cloud/speech`
- `@google-cloud/storage`

### 4.2. Environment Variables
```env
GOOGLE_PROJECT_ID=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GCS_BUCKET_NAME=dialoguelab-audio-upload
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

## 5. UI/UX
- **TranscriptUploader**:
  - Add "Audio" tab.
  - File Dropzone accepts `.mp3, .wav, .m4a`.
  - Progress Bar for Upload.
  - Spinner/Progress Bar for STT Processing.
- **Post-Processing**:
  - Map `Speaker 1` -> `화자 1`, `Speaker 2` -> `화자 2`.
  - Provide "Quick Renaming" feature (already implemented via US-017).

## 6. Action Plan
1.  Setup GCS Bucket & Service Account.
2.  Implement `upload-url` Server Action.
3.  Implement `start-transcription` Server Action.
4.  Implement `check-status` Server Action/Route.
5.  Update Frontend to handle the async flow.
