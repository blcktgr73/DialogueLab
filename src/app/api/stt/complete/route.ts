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

    let currentSpeaker = words[0].speakerTag;
    let currentContent: string[] = [];
    let transcriptIndex = 0;

    for (const wordInfo of words) {
        if (wordInfo.speakerTag !== currentSpeaker && currentContent.length > 0) {
            rows.push({
                session_id: sessionId,
                speaker: `참석자 ${currentSpeaker}`,
                content: currentContent.join(' '),
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
            content: currentContent.join(' '),
            timestamp: 0,
            transcript_index: transcriptIndex,
        });
    }

    return rows;
}

export async function POST(req: NextRequest) {
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
        const title = body?.title as string | undefined;
        if (!name) {
            return NextResponse.json(
                { error: 'operationName이 필요합니다.' },
                { status: 400 }
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
        const fullText = extractTranscription(results);
        const words = extractWords(results);

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

        const transcriptRows = buildTranscriptRows(session.id, fullText, words);
        const { error: transcriptError } = await supabase
            .from('transcripts')
            .insert(transcriptRows);

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
