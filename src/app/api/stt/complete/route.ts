import { NextRequest, NextResponse } from 'next/server';
import { getSpeechClient, checkSpeechConfig } from '@/lib/google-speech';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

type TranscriptRow = {
    session_id: string;
    speaker: string;
    content: string;
    timestamp: number;
    transcript_index: number;
};

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object') {
        return value as Record<string, unknown>;
    }
    return {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function getNumber(value: unknown): number | null {
    return typeof value === 'number' ? value : null;
}

function extractTranscription(results: unknown[]): string {
    const lines: string[] = [];
    for (const result of results) {
        const alternatives = asArray(asRecord(result).alternatives);
        const firstAlt = alternatives[0];
        const transcript = getString(asRecord(firstAlt).transcript);
        if (transcript) lines.push(transcript);
    }
    return lines.join('\n');
}

function extractWords(results: unknown[]): { word: string; speakerTag: string }[] {
    if (results.length === 0) return [];
    const lastResult = results[results.length - 1];
    const alternatives = asArray(asRecord(lastResult).alternatives);
    const firstAlt = alternatives[0];
    const words = asArray(asRecord(firstAlt).words);
    const extracted: { word: string; speakerTag: string }[] = [];

    for (const wordInfo of words) {
        const record = asRecord(wordInfo);
        const word = getString(record.word) ?? '';
        const speakerTagNum = getNumber(record.speakerTag);
        const speakerTag = speakerTagNum ? String(speakerTagNum) : '1';
        if (word) {
            extracted.push({ word, speakerTag });
        }
    }
    return extracted;
}

function extractAllWords(results: unknown[]): { word: string; speakerTag: string }[] {
    const extracted: { word: string; speakerTag: string }[] = [];
    for (const result of results) {
        const alternatives = asArray(asRecord(result).alternatives);
        const firstAlt = alternatives[0];
        const words = asArray(asRecord(firstAlt).words);
        for (const wordInfo of words) {
            const record = asRecord(wordInfo);
            const word = getString(record.word) ?? '';
            const speakerTagNum = getNumber(record.speakerTag);
            const speakerTag = speakerTagNum ? String(speakerTagNum) : '1';
            if (word) {
                extracted.push({ word, speakerTag });
            }
        }
    }
    return extracted;
}

function buildTranscriptRows(sessionId: string, fullText: string, words: { word: string; speakerTag: string }[]) {
    const rows: TranscriptRow[] = [];
    if (words.length === 0) {
        rows.push({
            session_id: sessionId,
            speaker: '참석자',
            content: fullText,
            timestamp: 0,
            transcript_index: 0,
        });
        return rows;
    }

    const detokenize = (tokens: string[]) => {
        let text = '';
        for (const token of tokens) {
            if (!token) continue;
            if (token === '▁') {
                text += ' ';
                continue;
            }
            if (token.startsWith('▁')) {
                text += ` ${token.slice(1)}`;
            } else {
                text += token;
            }
        }
        return text.replace(/\s+/g, ' ').trim();
    };

    let currentSpeaker = words[0].speakerTag;
    let currentContent: string[] = [];
    let transcriptIndex = 0;

    for (const wordInfo of words) {
        if (wordInfo.speakerTag !== currentSpeaker && currentContent.length > 0) {
            rows.push({
                session_id: sessionId,
                speaker: `참석자 ${currentSpeaker}`,
                content: detokenize(currentContent),
                timestamp: 0,
                transcript_index: transcriptIndex++,
            });
            currentSpeaker = wordInfo.speakerTag;
            currentContent = [wordInfo.word];
        } else {
            currentContent.push(wordInfo.word);
        }
    }

    if (currentContent.length > 0) {
        rows.push({
            session_id: sessionId,
            speaker: `참석자 ${currentSpeaker}`,
            content: detokenize(currentContent),
            timestamp: 0,
            transcript_index: transcriptIndex,
        });
    }

    return rows;
}

function extractClovaSegments(result: Record<string, unknown>) {
    const segments = asArray(result.segments);
    return segments
        .map((segment) => asRecord(segment))
        .map((segment) => {
            const speaker = asRecord(segment.speaker);
            return {
                speakerLabel: getString(speaker.label) ?? getString(segment.speakerLabel) ?? '1',
                text: getString(segment.text) ?? '',
                start: getNumber(segment.start) ?? 0,
                end: getNumber(segment.end) ?? 0,
            };
        })
        .filter((segment) => segment.text);
}

function normalizeSpeakerLabel(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return '참석자 1';
    if (/^\d+$/.test(trimmed)) return `참석자 ${trimmed}`;
    if (trimmed.startsWith('SPEAKER')) {
        const suffix = trimmed.replace(/SPEAKER\s*/i, '').trim();
        return suffix ? `참석자 ${suffix}` : '참석자';
    }
    return trimmed;
}

function buildClovaRows(sessionId: string, segments: { speakerLabel: string; text: string; start: number; end: number }[]) {
    return segments.map((segment, index) => ({
        session_id: sessionId,
        speaker: normalizeSpeakerLabel(segment.speakerLabel),
        content: segment.text.trim(),
        timestamp: Math.round(segment.start),
        transcript_index: index,
    }));
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json(
            { error: 'User is not authenticated' },
            { status: 401 }
        );
    }

    try {
        const body = await req.json();
        const name = body?.operationName as string | undefined;
        const clovaResult = body?.clovaResult as Record<string, unknown> | undefined;
        const title = body?.title as string | undefined;
        if (!name && !clovaResult) {
            return NextResponse.json(
                { error: 'operationName 또는 clovaResult가 필요합니다.' },
                { status: 400 }
            );
        }

        let fullText = '';
        let transcriptRows: TranscriptRow[] = [];
        if (clovaResult) {
            const segments = extractClovaSegments(asRecord(clovaResult));
            fullText = segments.map((segment) => segment.text).join('\n');
            transcriptRows = buildClovaRows('placeholder', segments);
        } else {
            const configStatus = checkSpeechConfig();
            if (!configStatus.ok) {
                console.error('[STT Complete] Configuration Error:', configStatus.error);
                return NextResponse.json(
                    { error: 'STT 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.' },
                    { status: 500 }
                );
            }

            const speechClient = getSpeechClient();
            if (!speechClient) {
                return NextResponse.json(
                    { error: 'STT 클라이언트 초기화에 실패했습니다. 자격 증명을 확인해주세요.' },
                    { status: 500 }
                );
            }

            const progress = await speechClient.checkLongRunningRecognizeProgress(name);
            if (!progress) {
                return NextResponse.json(
                    { error: 'STT 상태를 조회할 수 없습니다.' },
                    { status: 500 }
                );
            }

            if (!progress.done) {
                return NextResponse.json({
                    done: false,
                    metadata: progress.metadata ?? null,
                });
            }

            const resultRecord = asRecord(progress.result);
            const results = asArray(resultRecord.results);
            fullText = extractTranscription(results);
            const words = extractWords(results);

            if (process.env.STT_DEBUG === '1') {
                const allWords = extractAllWords(results);
                const speakerTagCounts: Record<string, number> = {};
                let underscoreCount = 0;
                const wordSamples: string[] = [];
                for (const wordInfo of allWords) {
                    const tag = wordInfo.speakerTag || 'unknown';
                    speakerTagCounts[tag] = (speakerTagCounts[tag] || 0) + 1;
                    if (wordInfo.word.includes('_')) underscoreCount += 1;
                    if (wordInfo.word && wordSamples.length < 12) wordSamples.push(wordInfo.word);
                }
                console.error('[STT Complete][Debug] results', results.length,
                    'words(all)', allWords.length,
                    'words(last)', words.length,
                    'speakerTags', speakerTagCounts,
                    'underscoreWords', underscoreCount,
                    'samples', wordSamples
                );
            }

            transcriptRows = buildTranscriptRows('placeholder', fullText, words);
        }

        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .insert([
                {
                    title: title || `음성 대화 (${new Date().toLocaleDateString()})`,
                    mode: 'free',
                    user_id: user.id,
                },
            ])
            .select()
            .single();

        if (sessionError || !session) {
            console.error('[STT Complete] Session create error:', sessionError);
            return NextResponse.json(
                { error: '세션 생성 실패' },
                { status: 500 }
            );
        }

        const rows = transcriptRows.map((row) => ({ ...row, session_id: session.id }));
        const { error: transcriptError } = await supabase
            .from('transcripts')
            .insert(rows);

        if (transcriptError) {
            console.error('[STT Complete] Transcripts insert error:', transcriptError);
        }

        return NextResponse.json({
            done: true,
            sessionId: session.id,
            text: fullText,
        });
    } catch (error: unknown) {
        console.error('[STT Complete] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'STT 완료 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
