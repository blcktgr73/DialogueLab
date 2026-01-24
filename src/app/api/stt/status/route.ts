import { NextRequest, NextResponse } from 'next/server';
import { getSpeechClient, checkSpeechConfig } from '@/lib/google-speech';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
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
        if (!name) {
            return NextResponse.json(
                { error: 'name 쿼리 파라미터가 필요합니다.' },
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

        return NextResponse.json({
            done: progress.done,
            metadata: progress.metadata ?? null,
            text: transcription ?? null,
            details: results ?? null,
            words: wordsInfo,
        });
    } catch (error: unknown) {
        console.error('[STT Status] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'STT 상태 조회 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
