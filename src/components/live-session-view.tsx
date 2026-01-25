'use client';

import { useEffect, useState } from 'react';
import { useGeminiLive } from '@/hooks/use-gemini-live';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioVisualizer } from '@/components/audio-visualizer';

import { useRouter } from 'next/navigation';

interface LiveSessionViewProps {
  sessionId: string;
  persona?: {
    name?: string;
    topic?: string;
    resistance?: number;
  };
}

export function LiveSessionView({ sessionId, persona }: LiveSessionViewProps) {
  const router = useRouter();
  const [duration, setDuration] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [autoConnectFailed, setAutoConnectFailed] = useState(false);
  const [lastCloseReason, setLastCloseReason] = useState<string | null>(null);
  const personaName = persona?.name?.trim() || '내담자';
  const personaTopic = persona?.topic?.trim() || '상담 주제';
  const personaResistance = typeof persona?.resistance === 'number' ? persona.resistance : 5;
  const systemInstruction = [
    `너는 동기면담(MI) 훈련을 위한 표준화 환자 역할이다.`,
    `이름: ${personaName}. 상담 주제: ${personaTopic}. 변화 저항 수준: ${personaResistance}/10.`,
    `상담가의 질문에 현실적인 환자처럼 반응하라.`,
    `상담가가 OARS(개방형 질문, 긍정, 반영, 요약)를 활용할 때 긍정적 변화 대화(Change Talk)를 보여줘.`,
    `상담가가 해결책을 먼저 제시하면 방어적/양가감정 반응을 보이고, 내면의 동기를 묻는 질문에는 진솔하게 답해라.`,
    `메타 대화를 피하고, "어떤 대화를 하고 싶은지" 같은 질문을 하지 말고 바로 역할에 집중하라.`,
    `응답은 한국어로 짧고 자연스럽게.`,
  ].join('\n');
  const { status, connect, resetAutoRetry, suspendAutoRetry, disconnect, finalizeSession, mediaStream } = useGeminiLive({
    systemInstruction,
    maxRetries: 0,
    retryDelayMs: 1500,
    onRetryExhausted: ({ code, reason }) => {
      const message = reason?.trim() || `연결 실패 (code ${code ?? 'unknown'})`;
      setAutoConnectFailed(true);
      setLastCloseReason(message);
    },
  });

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'connected') {
      interval = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleExit = async () => {
    if (isEnding) return;
    setIsEnding(true);
    suspendAutoRetry();
    try {
      await finalizeSession(sessionId, 'miti');
    } catch (error) {
      console.error(error);
    } finally {
      router.push(`/sessions/${sessionId}`);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] w-full max-w-md mx-auto p-4 animate-in fade-in zoom-in-95 duration-300 relative">
      {status === 'connected' && mediaStream && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
          <AudioVisualizer stream={mediaStream} width={300} height={300} color="139, 92, 246" />
        </div>
      )}

      <div className="mb-8 flex flex-col items-center gap-2 z-10">
        <div
          className={cn(
            'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 bg-white shadow-md border-4',
            status === 'connected' ? 'border-violet-100' : 'border-gray-100',
            status === 'error' && 'border-red-100 bg-red-50'
          )}
        >
          {status === 'connecting' ? (
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
          ) : status === 'connected' ? (
            <Mic className="w-10 h-10 text-violet-600" />
          ) : (
            <MicOff className="w-10 h-10 text-gray-400" />
          )}
        </div>

        <h2 className="text-xl font-semibold mt-4">
          {status === 'connecting' && 'AI 파트너 연결 중...'}
          {status === 'connected' && 'AI 파트너와 대화 중'}
          {status === 'disconnected' && '연결 끊김'}
          {status === 'error' && '연결 오류'}
        </h2>

        {status === 'connected' && (
          <p className="text-violet-600 font-mono text-lg font-medium">{formatTime(duration)}</p>
        )}
      </div>

      <div className="flex gap-4">
        {status === 'connected' ? (
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full h-14 px-8 shadow-lg hover:shadow-xl transition-all"
            onClick={handleExit}
            disabled={isEnding}
          >
            {isEnding ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <PhoneOff className="w-5 h-5 mr-2" />}
            {isEnding ? '분석 중...' : '통화 종료'}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleExit} disabled={isEnding}>
              나가기
            </Button>
            <Button
              onClick={() => {
                setAutoConnectFailed(false);
                setLastCloseReason(null);
                resetAutoRetry();
                connect(true);
              }}
              disabled={isEnding || status === 'connecting'}
            >
              {status === 'connecting' ? '연결 중...' : '연결하기'}
            </Button>
          </>
        )}
      </div>

      {autoConnectFailed && (
        <p className="mt-3 text-sm text-red-600 text-center">
          자동 연결 실패: {lastCloseReason || '원인을 확인할 수 없습니다.'}
        </p>
      )}

      <p className="mt-8 text-sm text-muted-foreground text-center max-w-xs">
        자유롭게 이야기해보세요. AI 파트너가 경청하고 응답합니다.
      </p>
    </div>
  );
}
