import { SpeechClient } from '@google-cloud/speech';

let client: SpeechClient | null = null;

export function getSpeechClient() {
    if (client) return client;

    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

    // Sanitize the key
    // 1. Replace literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    // 2. Remove surrounding quotes if they exist (handling potential double escaping)
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1);
    }

    // 3. Trim any whitespace
    privateKey = privateKey.trim();

    // Debug logging (Safe: only shows structure)
    const keyHeader = privateKey.substring(0, 35).replace(/\n/g, '[NL]');
    const keyFooter = privateKey.substring(Math.max(0, privateKey.length - 35)).replace(/\n/g, '[NL]');

    console.log(`[Google Speech] Initializing... ProjectId: ${process.env.GOOGLE_PROJECT_ID}`);
    console.log(`[Google Speech] Private Key Check: Length=${privateKey.length}`);
    console.log(`[Google Speech] Key Header: '${keyHeader}...'`);
    console.log(`[Google Speech] Key Footer: '...${keyFooter}'`);

    const credentials = {
        projectId: process.env.GOOGLE_PROJECT_ID,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
    };

    // Basic validation
    if (!credentials.projectId || !credentials.client_email || !credentials.private_key) {
        console.error('[Google Speech] Missing credentials');
        return null;
    }

    try {
        client = new SpeechClient({ credentials });
        return client;
    } catch (error) {
        console.error("[Google Speech] Failed to initialize client:", error);
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
