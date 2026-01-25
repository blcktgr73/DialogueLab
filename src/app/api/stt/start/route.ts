import { NextRequest, NextResponse } from 'next/server';
import { getSpeechClient, checkSpeechConfig } from '@/lib/google-speech';
import { getSttRequestConfig } from '@/lib/stt-config';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const workerToken = process.env.STT_WORKER_TOKEN;
    if (!workerToken) {
        console.error('[STT Start] Missing STT_WORKER_TOKEN');
        return NextResponse.json(
            { error: 'STT 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.' },
            { status: 500 }
        );
    }

    const providedToken = req.headers.get('x-stt-worker-token');
    if (!providedToken || providedToken !== workerToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configStatus = checkSpeechConfig();
    if (!configStatus.ok) {
        console.error('[STT Start] Configuration Error:', configStatus.error);
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
        const body = await req.json();
        const gcsUri = body?.gcsUri as string | undefined;
        if (!gcsUri) {
            return NextResponse.json(
                { error: 'gcsUri가 필요합니다.' },
                { status: 400 }
            );
        }

        const request = {
            audio: { uri: gcsUri },
            config: getSttRequestConfig('long'),
        };

        const [operation] = await speechClient.longRunningRecognize(request);

        return NextResponse.json({
            operationName: operation?.name,
        });
    } catch (error: unknown) {
        console.error('[STT Start] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'STT 시작 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
