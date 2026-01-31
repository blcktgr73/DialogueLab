'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { uploadBlobInChunks } from '@/lib/stt-upload';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { Copy } from 'lucide-react';

interface AudioRecorderProps {
    onTranscriptionComplete?: (text: string, rawData?: any) => void;
}

import { AudioVisualizer } from '@/components/audio-visualizer';

import { useWakeLock } from '@/hooks/use-wake-lock';

export function AudioRecorder({ onTranscriptionComplete }: AudioRecorderProps) {
    const { requestWakeLock, releaseWakeLock } = useWakeLock();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [longformUploadId, setLongformUploadId] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    const workerUrl = process.env.NEXT_PUBLIC_STT_WORKER_URL || '';

    // Debugging / Logging
    const [sessionId, setSessionId] = useState<string>("");

    // Generate a fresh session ID on mount for initial state, 
    // but typically we want one per recording attempt? 
    // Let's generate one when recording starts or when file is ready.
    // Actually, one per "Attempt" is best.

    // Helper to copy debug info
    const copyDebugInfo = () => {
        if (!sessionId) return;
        navigator.clipboard.writeText(sessionId);
        toast.info('디버그 ID가 복사되었습니다.', { description: sessionId });
    };

    // Timer Logic: Dependent on isRecording state to be robust
    useEffect(() => {
        if (isRecording) {
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isRecording]);

    // Cleanup stream on unmount
    // Cleanup stream on change/unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Cleanup wake lock ONLY on unmount
    useEffect(() => {
        return () => {
            releaseWakeLock();
        };
    }, [releaseWakeLock]);

    useEffect(() => {
        const getDevices = async () => {
            try {
                // Request media devices to get labels
                await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                const devs = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devs.filter(d => d.kind === 'audioinput');
                setDevices(audioInputs);

                // Set default device if available
                if (audioInputs.length > 0) {
                    // If we can identify the 'default' or a preferred one, good. 
                    // Otherwise just leave empty to let browser decide or pick first.
                    // Usually browser default is deviceId 'default' or empty string.
                    const defaultDevice = audioInputs.find(d => d.deviceId === 'default');
                    if (defaultDevice) setSelectedDeviceId(defaultDevice.deviceId);
                    else setSelectedDeviceId(audioInputs[0].deviceId);
                }
            } catch (err) {
                console.error("Error fetching devices:", err);
            }
        };
        getDevices();
    }, []);



    const startRecording = async () => {
        // Generate new session ID for this recording session
        const newSessionId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        setSessionId(newSessionId);
        logger.info(newSessionId, 'Recording started', { userAgent: navigator.userAgent });

        requestWakeLock(); // Request Wake Lock (Async, don't block recording start)

        try {
            const constraints: MediaStreamConstraints = {
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            logger.info(newSessionId, 'Requesting user media', { constraints });
            console.log('[Recorder] Requesting user media with constraints:', constraints);
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);

            // Debugging: Log active device details
            const track = mediaStream.getAudioTracks()[0];
            if (track) {
                logger.info(newSessionId, 'Audio track acquired', { label: track.label, settings: track.getSettings() });
                console.log(`[Recorder] Active Device: ${track.label}`);
            }

            // Let browser choose the best mimeType automatically
            const mediaRecorder = new MediaRecorder(mediaStream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            logger.info(newSessionId, 'MediaRecorder initialized', { mimeType: mediaRecorder.mimeType });
            console.log('[Recorder] Initialized with auto-selected mimeType:', mediaRecorder.mimeType);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Use the actual mimeType from the recorder for the Blob
                const recordedType = mediaRecorder.mimeType || 'audio/webm';
                logger.info(newSessionId, 'Recording stopped', {
                    chunkCount: chunksRef.current.length,
                    mimeType: recordedType
                });
                console.log('[Recorder] Creating Blob with type:', recordedType);

                const blob = new Blob(chunksRef.current, { type: recordedType });
                const url = URL.createObjectURL(blob);
                setMediaBlobUrl(url);

                // Stop all tracks to release microphone
                mediaStream.getTracks().forEach(track => track.stop());
                setStream(null);
                releaseWakeLock(); // Release Wake Lock
            };

            mediaRecorder.start(100); // 100ms timeslice
            setIsRecording(true);
            setMediaBlobUrl(null);

        } catch (error: any) {
            console.error('[Recorder] Error starting recording:', error);
            logger.error(newSessionId, 'Failed to start recording', { error: error.message });
            toast.error('마이크 권한을 확인해주시거나, 다른 마이크를 선택해주세요.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const clearBlobUrl = () => {
        if (mediaBlobUrl) {
            URL.revokeObjectURL(mediaBlobUrl);
        }
        setMediaBlobUrl(null);
        setRecordingTime(0);
    };

    const startWorker = async (uploadId: string, options?: { completion: 'sync' | 'async' }) => {
        if (!workerUrl) return null;
        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ prefix: uploadId, ...options }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || '워커 실행 실패');
        }
        return response.json();
    };

    const handleTranscribe = async () => {
        if (!mediaBlobUrl) return;

        try {
            setIsUploading(true);
            setUploadProgress(null);

            const blob = await fetch(mediaBlobUrl).then(r => r.blob());
            const safeType = blob.type || 'audio/webm';
            const file = new File([blob], 'recording.webm', { type: safeType });

            const inlineLimitBytes = 4 * 1024 * 1024;
            const isLongform = recordingTime > 60;
            if (isLongform || file.size > inlineLimitBytes) {
                toast.loading('대용량 업로드를 시작합니다...');
                logger.info(sessionId, 'Starting longform upload', { size: file.size, isLongform });

                // Use sessionId as part of the directory structure: recordings/sessionId
                const uploadPrefix = `recordings/${sessionId}`;

                const { uploadId } = await uploadBlobInChunks({
                    blob: file,
                    prefix: uploadPrefix, // Pass explicitly so we match our logging ID
                    onProgress: ({ completedChunks, totalChunks }) => {
                        const ratio = totalChunks === 0 ? 0 : completedChunks / totalChunks;
                        setUploadProgress(Math.round(ratio * 100));
                        // Log sporadic progress? Maybe 0, 50, 100
                        if (ratio === 0 || ratio === 0.5 || ratio === 1) {
                            logger.info(sessionId, 'Upload progress', { completedChunks, totalChunks });
                        }
                    },
                });

                toast.dismiss();
                toast.success('업로드 완료. 워커 실행을 시작합니다.');
                console.log('[Recorder] Longform upload completed:', uploadId);
                logger.info(sessionId, 'Upload completed', { uploadId });

                setLongformUploadId(uploadId);

                if (workerUrl) {
                    try {
                        logger.info(sessionId, 'Triggering worker', { workerUrl });
                        // NOTE: We pass prefix=uploadId. The worker uses this to find chunks.
                        // Pass completion: 'async' if longform to avoid timeouts
                        const workerResult = await startWorker(uploadId, {
                            completion: isLongform || file.size > inlineLimitBytes ? 'async' : 'sync'
                        });
                        logger.info(sessionId, 'Worker accepted task', { result: workerResult });

                        if (workerResult?.result) {
                            await handleCompleteLongform({ clovaResult: workerResult.result });
                        } else if (workerResult?.operationName) {
                            await handleCompleteLongform({ operationName: workerResult.operationName });
                        } else {
                            toast.error('워커 결과를 받지 못했습니다.');
                            logger.error(sessionId, 'Worker returned empty result');
                        }
                    } catch (error: any) {
                        console.error(error);
                        const msg = error instanceof Error ? error.message : '워커 실행 실패';
                        toast.error(msg);
                        logger.error(sessionId, 'Worker invocation failed', { error: msg });
                    }
                } else {
                    toast.info('worker URL이 없어 자동 전사를 진행할 수 없습니다.');
                    logger.warn(sessionId, 'Worker URL missing');
                }
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/stt', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Transcription failed');
            }

            toast.success('음성 인식이 완료되었습니다.');

            if (onTranscriptionComplete) {
                onTranscriptionComplete(data.text, data);
            }

        } catch (error: unknown) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : '변환 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    const pollLongformStatus = async (opName: string) => {
        const response = await fetch(`/api/stt/status?name=${encodeURIComponent(opName)}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || '상태 조회 실패');
        }
        return response.json() as Promise<{
            done: boolean;
            text?: string | null;
            metadata?: unknown;
        }>;
    };

    const handleCompleteLongform = async (payload: { operationName?: string; clovaResult?: any }) => {
        try {
            if (payload.operationName) {
                toast.loading('전사 상태를 확인 중입니다...');
                let done = false;
                while (!done) {
                    const status = await pollLongformStatus(payload.operationName);
                    if (status.done) {
                        done = true;
                        break;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }

            const completeResponse = await fetch('/api/stt/complete', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await completeResponse.json();
            if (!completeResponse.ok) {
                throw new Error(data.error || '완료 처리 실패');
            }
            toast.dismiss();
            toast.success('전사 완료. 세션으로 이동합니다.');
            if (data.sessionId) {
                router.push(`/sessions/${data.sessionId}`);
            } else if (onTranscriptionComplete && data.text) {
                onTranscriptionComplete(data.text, data);
            }
        } catch (error: unknown) {
            console.error(error);
            toast.dismiss();
            toast.error(error instanceof Error ? error.message : '완료 처리 중 오류가 발생했습니다.');
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full flex flex-col items-center gap-6">

            {/* Device Selector */}
            {!isRecording && devices.length > 0 && (
                <div className="w-64 mb-2">
                    <select
                        className="w-full p-2 text-sm border rounded-md bg-transparent text-center focus:ring-2 focus:ring-primary opacity-70 hover:opacity-100 transition-opacity"
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                    >
                        {devices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex flex-col items-center gap-4">
                {/* Mic Button & Visualizer Wrapper */}
                <div className="relative flex items-center justify-center">
                    {/* Visualizer Background */}
                    {isRecording && <AudioVisualizer stream={stream} />}

                    {/* Main Mic Button */}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isUploading}
                        className={`
                            relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 z-10
                            ${isRecording
                                ? 'bg-red-50 text-red-500 shadow-lg ring-4 ring-red-100'
                                : 'bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105 active:scale-95'
                            }
                        `}
                    >
                        {isRecording ? (
                            <Square className="w-8 h-8 fill-current relative z-10" />
                        ) : (
                            <Mic className="w-10 h-10" />
                        )}
                    </button>
                </div>

                {/* Status Label */}
                <div className="space-y-1 text-center z-10">
                    <p className="font-medium text-lg">
                        {isRecording ? "녹음 중..." : "녹음 시작"}
                    </p>
                    {isRecording && (
                        <p className="text-xs text-muted-foreground animate-pulse font-mono">
                            {formatTime(recordingTime)}
                        </p>
                    )}
                </div>
            </div>

            {/* Post-Recording Actions (Preview & Transcribe) */}
            {!isRecording && mediaBlobUrl && (
                <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <audio src={mediaBlobUrl} controls className="w-full h-10" />

                    <div className="flex gap-2 w-full px-4 mb-2">
                        <Button
                            onClick={handleTranscribe}
                            disabled={isUploading}
                            className="flex-1"
                            size="lg"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {uploadProgress !== null ? `업로드 중... ${uploadProgress}%` : '분석 중...'}
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-4 h-4 mr-2" />
                                    전사 및 세션 생성
                                </>
                            )}
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={clearBlobUrl}
                            disabled={isUploading}
                            size="icon"
                            className="shrink-0"
                        >
                            <Square className="w-4 h-4" />
                            <span className="sr-only">초기화</span>
                        </Button>
                    </div>
                </div>
            )}

            {!isRecording && longformUploadId && (
                <div className="w-full space-y-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <span>Ref: <span className="font-mono text-primary/80">{sessionId}</span></span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={copyDebugInfo}
                            title="디버그 ID 복사"
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                    {!workerUrl && (
                        <div className="text-xs text-muted-foreground">
                            워커 URL이 없어 수동 완료 처리를 사용할 수 없습니다.
                        </div>
                    )}
                </div>
            )}

            {/* Debug ID Indicator (Always visible if exists) */}
            {sessionId && !longformUploadId && (
                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/80 transition-colors cursor-pointer" onClick={copyDebugInfo}>
                    ID: {sessionId}
                </div>
            )}
        </div>
    );
}
