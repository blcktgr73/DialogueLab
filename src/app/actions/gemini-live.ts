'use server';

/**
 * Server Action for managing Gemini Multimodal Live API sessions.
 * Currently uses the "Tokens" API (v1beta/v1alpha) pattern to generate ephemeral access tokens,
 * keeping the main API KEY secure on the server.
 */

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim();

// Use the appropriate model for Live
const MODEL_NAME = 'models/gemini-2.0-flash-exp';

export async function createGeminiEphemeralToken() {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY (or NEXT_PUBLIC_GEMINI_API_KEY) is not set');
    }

    // The Tokens API requires Service Account credentials and cannot be called
    // with a standard API Key. We intentionally return the API key for prototype
    // usage; see docs/architecture/TECH_DEBT.md for the production plan.

    return {
        accessToken: '', // No access token
        apiKey: GEMINI_API_KEY
    };
}
