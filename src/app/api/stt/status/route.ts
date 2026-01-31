import { NextRequest, NextResponse } from 'next/server';
import { getSpeechClient, checkSpeechConfig } from '@/lib/google-speech';

import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const configStatus = checkSpeechConfig();
    if (!configStatus.ok) {
        console.error('[STT Status] Configuration Error:', configStatus.error);
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

    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');
        const provider = searchParams.get('provider');

        if (!name) {
            return NextResponse.json(
                { error: 'name 쿼리 파라미터가 필요합니다.' },
                { status: 400 }
            );
        }

        if (provider === 'clova') {
            const secretKey = process.env.NAVER_CLOVA_SECRET_KEY;
            const invokeUrl = process.env.NAVER_CLOVA_INVOKE_URL;
            if (!secretKey || !invokeUrl) {
                return NextResponse.json({ error: 'Clova 설정이 누락되었습니다.' }, { status: 500 });
            }

            // Clova polling URL: {invokeUrl}/recognizer/{token}
            const baseUrl = invokeUrl.endsWith('/') ? invokeUrl.slice(0, -1) : invokeUrl;
            const statusUrl = `${baseUrl}/recognizer/${name}`;

            const response = await fetch(statusUrl, {
                headers: { 'X-CLOVASPEECH-API-KEY': secretKey },
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('[STT Status] Clova failed:', text);
                throw new Error(`Clova status check failed: ${text}`);
            }

            const data = await response.json();
            console.log('[STT Status] Clova response:', { token: name, result: data.result, message: data.message });

            if (data.result === 'COMPLETED') {
                // Log full completion data for debugging
                await supabase.from('system_logs').insert({
                    session_id: 'debug-clova-status',
                    source: 'api/stt/status',
                    level: 'info',
                    message: 'Clova polling completed',
                    metadata: {
                        token: name,
                        resultSummary: data
                    }
                });

                return NextResponse.json({
                    done: true,
                    text: data.text,
                    details: data,
                });
            } else if (data.result === 'FAILED') {
                await supabase.from('system_logs').insert({
                    session_id: 'debug-clova-status-fail',
                    source: 'api/stt/status',
                    level: 'error',
                    message: 'Clova polling failed',
                    metadata: { token: name, error: data.message, fullData: data }
                });
                throw new Error(data.message || 'Clova processing failed');
            } else {
                // Processing...
                // Optionally log keep-alive for debugging
                await supabase.from('system_logs').insert({
                    session_id: 'debug-clova-status-processing',
                    source: 'api/stt/status',
                    level: 'info',
                    message: 'Clova processing...',
                    metadata: { token: name, result: data.result }
                });
                return NextResponse.json({ done: false });
            }
        }

        const progress = await speechClient.checkLongRunningRecognizeProgress(name);
        if (!progress) {
            return NextResponse.json(
                { error: 'STT 상태를 조회할 수 없습니다.' },
                { status: 500 }
            );
        }

        const response = (progress.result && typeof progress.result === 'object')
            ? (progress.result as Record<string, unknown>)
            : {};
        const results = Array.isArray(response.results) ? response.results : [];
        const transcription = results
            .map((result) => {
                if (!result || typeof result !== 'object') return '';
                const alternatives = (result as Record<string, unknown>).alternatives;
                if (!Array.isArray(alternatives) || alternatives.length === 0) return '';
                const firstAlt = alternatives[0] as Record<string, unknown>;
                return typeof firstAlt.transcript === 'string' ? firstAlt.transcript : '';
            })
            .filter((line) => line)
            .join('\n');
        const lastResult = results.length > 0 ? results[results.length - 1] : null;
        const lastAlt = lastResult && typeof lastResult === 'object'
            ? (lastResult as Record<string, unknown>).alternatives
            : null;
        const firstAlt = Array.isArray(lastAlt) ? lastAlt[0] : null;
        const wordsInfo = firstAlt && typeof firstAlt === 'object'
            ? ((firstAlt as Record<string, unknown>).words as unknown[] | undefined) ?? []
            : [];

        if (process.env.STT_DEBUG === '1') {
            const allWords = results.flatMap((result) => {
                if (!result || typeof result !== 'object') return [];
                const alternatives = (result as Record<string, unknown>).alternatives;
                if (!Array.isArray(alternatives) || alternatives.length === 0) return [];
                const alt = alternatives[0] as Record<string, unknown>;
                const words = alt.words as unknown[] | undefined;
                return Array.isArray(words) ? words : [];
            });
            const speakerTagCounts: Record<string, number> = {};
            let underscoreCount = 0;
            const wordSamples: string[] = [];
            for (const wordInfo of allWords) {
                if (!wordInfo || typeof wordInfo !== 'object') continue;
                const record = wordInfo as Record<string, unknown>;
                const word = typeof record.word === 'string' ? record.word : '';
                const tag = record.speakerTag ? String(record.speakerTag) : 'unknown';
                speakerTagCounts[tag] = (speakerTagCounts[tag] || 0) + 1;
                if (word.includes('_')) underscoreCount += 1;
                if (word && wordSamples.length < 12) wordSamples.push(word);
            }
            console.error('[STT Status][Debug] results', results.length,
                'words(all)', allWords.length,
                'words(last)', Array.isArray(wordsInfo) ? wordsInfo.length : 0,
                'speakerTags', speakerTagCounts,
                'underscoreWords', underscoreCount,
                'samples', wordSamples
            );
        }

        return NextResponse.json({
            done: progress.done,
            metadata: progress.metadata ?? null,
            text: transcription ?? null,
            details: results ?? null,
            words: wordsInfo,
            ...(process.env.STT_DEBUG === '1'
                ? { debug: { resultsCount: results.length, lastWordsCount: Array.isArray(wordsInfo) ? wordsInfo.length : 0 } }
                : {}),
        });
    } catch (error: unknown) {
        console.error('[STT Status] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'STT 상태 조회 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
