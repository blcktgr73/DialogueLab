# Technical Debt Register

## 2026-01-25 — Gemini Live authentication (API key exposure)
- **Context**: Live WebSocket currently authenticates via API key passed to the client (query param). This enables fast iteration but exposes the key in the browser.
- **Risk**: API key leakage, quota abuse, and inability to rotate securely.
- **Recommended Fix**: Implement server-side token issuance (Tokens API) using a Google Service Account. Client should connect with short-lived access tokens instead of raw API keys.
- **Scope**: Replace `createGeminiEphemeralToken()` placeholder in `src/app/actions/gemini-live.ts` with real token generation; update client to use access token only.
- **Status**: Open (intentional technical debt for prototyping).
