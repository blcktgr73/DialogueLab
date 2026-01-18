import { NextRequest, NextResponse } from 'next/server';
import { getSpeechClient, checkSpeechConfig } from '@/lib/google-speech';

// Node.js 런타임 강제 (Google Cloud SDK 사용을 위해)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    // 1. 환경설정 체크
    const configStatus = checkSpeechConfig();
    if (!configStatus.ok) {
        console.error('[STT API] Configuration Error:', configStatus.error);
        return NextResponse.json(
            { error: 'STT 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.' },
            { status: 500 }
        );
    }

    // Client 초기화 시도
    const speechClient = getSpeechClient();
    if (!speechClient) {
        return NextResponse.json(
            { error: 'STT 클라이언트 초기화에 실패했습니다. 자격 증명을 확인해주세요.' },
            { status: 500 }
        );
    }

    try {
        // 2. 파일 수신
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: '오디오 파일이 제공되지 않았습니다.' },
                { status: 400 }
            );
        }

        // 3. 파일 버퍼 변환
        const arrayBuffer = await file.arrayBuffer();
        const audioBytes = Buffer.from(arrayBuffer).toString('base64');

        // 4. STT 요청 구성
        const request = {
            audio: {
                content: audioBytes,
            },
            config: {
                encoding: 'WEBM_OPUS' as const, // WebM Opus (Browser MediaRecorder Default)
                sampleRateHertz: 48000, // Opus 기본 샘플 레이트 (보통 48kHz)
                languageCode: 'ko-KR', // 한국어
                enableSpeakerDiarization: true, // 화자 분리 활성화
                minSpeakerCount: 2, // 최소 화자
                maxSpeakerCount: 4, // 최대 화자 (예상)
                model: 'latest_long', // 긴 대화 모델 (가능하다면)
            },
        };

        console.log('[STT API] Requesting recognition...');

        // 5. STT 호출 (Synchronous - 1분 제한 주의)
        // 긴 오디오는 longRunningRecognize + GCS 업로드가 필요하지만,
        // MVP에서는 짧은 연습(1분 이내)을 우선 지원하거나, 
        // Google이 제공하는 인라인 데이터 제한(10MB) 내에서 시도함.
        const [response] = await speechClient.recognize(request);

        // 6. 결과 파싱
        const transcription = response.results
            ?.map((result) => result.alternatives?.[0]?.transcript)
            .join('\n');

        // 화자 분리 결과 매핑 (Speakers)
        // note: recognize 결과에는 speaker_tag가 포함된 단어별 리스트가 results[].alternatives[].words에 있음.
        // 간단한 MVP 반환을 위해 일단 전체 텍스트와 원본 결과 반환

        // words에 speakerTag가 있는지 확인
        const wordsInfo = response.results?.[response.results.length - 1]?.alternatives?.[0]?.words ?? [];

        return NextResponse.json({
            text: transcription,
            details: response.results, // 디버깅/상세 처리를 위해 원본 포함
            words: wordsInfo, // 화자 태그 포함된 단어 정보
        });

    } catch (error: any) {
        console.error('[STT API] Error:', error);
        return NextResponse.json(
            { error: error.message || '음성 인식 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
