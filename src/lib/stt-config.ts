type SttMode = 'short' | 'long';

type SttRequestConfig = {
    encoding: 'WEBM_OPUS';
    sampleRateHertz: number;
    languageCode: string;
    enableWordTimeOffsets: boolean;
    model: string;
    diarizationConfig?: {
        enableSpeakerDiarization: boolean;
        minSpeakerCount: number;
        maxSpeakerCount: number;
    };
};

function parseEnvInt(name: string) {
    const raw = process.env[name];
    if (!raw) return undefined;
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value)) {
        console.warn(`[STT Config] Invalid integer for ${name}: ${raw}`);
        return undefined;
    }
    return value;
}

function parseEnvBool(name: string, fallback: boolean) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    console.warn(`[STT Config] Invalid boolean for ${name}: ${raw}`);
    return fallback;
}

export function getSttRequestConfig(mode: SttMode): SttRequestConfig {
    const diarizationEnabled = parseEnvBool('STT_DIARIZATION_ENABLED', true);
    const minSpeakerDefault = 2;
    const maxSpeakerDefault = mode === 'long' ? 10 : 4;
    let minSpeakerCount = parseEnvInt('STT_DIARIZATION_MIN_SPEAKER') ?? minSpeakerDefault;
    let maxSpeakerCount = parseEnvInt('STT_DIARIZATION_MAX_SPEAKER') ?? maxSpeakerDefault;

    if (minSpeakerCount < 1) minSpeakerCount = minSpeakerDefault;
    if (maxSpeakerCount < 1) maxSpeakerCount = maxSpeakerDefault;
    if (minSpeakerCount > maxSpeakerCount) {
        console.warn('[STT Config] minSpeakerCount is greater than maxSpeakerCount; adjusting max to match min.');
        maxSpeakerCount = minSpeakerCount;
    }

    const model = process.env.STT_MODEL ?? 'latest_long';
    const sampleRateHertz = parseEnvInt('STT_SAMPLE_RATE_HERTZ') ?? 48000;
    const languageCode = process.env.STT_LANGUAGE_CODE ?? 'ko-KR';

    const config: SttRequestConfig = {
        encoding: 'WEBM_OPUS',
        sampleRateHertz,
        languageCode,
        enableWordTimeOffsets: diarizationEnabled,
        model,
    };

    if (diarizationEnabled) {
        config.diarizationConfig = {
            enableSpeakerDiarization: true,
            minSpeakerCount,
            maxSpeakerCount,
        };
    }

    return config;
}
