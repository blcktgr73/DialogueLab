import { SpeechClient } from '@google-cloud/speech';

let client: SpeechClient | null = null;

export function getSpeechClient() {
    if (client) return client;

    const credentials = {
        projectId: process.env.GOOGLE_PROJECT_ID,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    // Basic validation
    if (!credentials.projectId || !credentials.client_email || !credentials.private_key) {
        return null;
    }

    try {
        client = new SpeechClient({ credentials });
        return client;
    } catch (error) {
        console.error("Failed to initialize Google Speech Client:", error);
        return null;
    }
}

export function checkSpeechConfig() {
    const credentials = {
        projectId: process.env.GOOGLE_PROJECT_ID,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
    };

    if (!credentials.projectId || !credentials.client_email || !credentials.private_key) {
        return {
            ok: false,
            error: 'Google Cloud STT 환경변수(GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)가 설정되지 않았습니다.',
        };
    }
    return { ok: true };
}
