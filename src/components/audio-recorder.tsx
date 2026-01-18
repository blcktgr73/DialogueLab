'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AudioRecorderProps {
    onTranscriptionComplete?: (text: string, rawData?: any) => void;
}

const AudioVisualizer = ({ stream }: { stream: MediaStream | null }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!stream) return;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        let source: MediaStreamAudioSourceNode | null = null;
        let animationId: number;

        try {
            source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                animationId = requestAnimationFrame(draw);

                analyser.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;

                if (average > 10 && Math.random() < 0.05) {
                    console.log('[Visualizer] Input volume detected:', average.toFixed(1));
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                // Make the circle more responsive
                const radius = 30 + (average * 0.8);

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.8, Math.max(0.1, average / 40))})`;
                ctx.fill();
            };

            draw();
        } catch (err) {
            console.error('[Visualizer] Error:', err);
        }

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (source) source.disconnect();
            if (audioContext.state !== 'closed') audioContext.close();
        };
    }, [stream]);

    return <canvas ref={canvasRef} width={200} height={200} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />;
};

export function AudioRecorder({ onTranscriptionComplete }: AudioRecorderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

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
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

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
        try {
            const constraints: MediaStreamConstraints = {
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            console.log('[Recorder] Requesting user media with constraints:', constraints);
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);

            // Debugging: Log active device details
            const track = mediaStream.getAudioTracks()[0];
            if (track) {
                console.log(`[Recorder] Active Device: ${track.label}`);
                console.log(`[Recorder] Track State: readyState=${track.readyState}, muted=${track.muted}, enabled=${track.enabled}`);
            }

            // Debugging: List all available devices (already done in useEffect, but good for context)
            // const devices = await navigator.mediaDevices.enumerateDevices();
            // const audioInputs = devices.filter(d => d.kind === 'audioinput');
            // console.log('[Recorder] Available Audio Inputs:', audioInputs.map(d => `${d.label} (${d.deviceId})`));

            // Let browser choose the best mimeType automatically
            const mediaRecorder = new MediaRecorder(mediaStream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            console.log('[Recorder] Initialized with auto-selected mimeType:', mediaRecorder.mimeType);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Use the actual mimeType from the recorder for the Blob
                const recordedType = mediaRecorder.mimeType || 'audio/webm';
                console.log('[Recorder] Creating Blob with type:', recordedType);

                const blob = new Blob(chunksRef.current, { type: recordedType });
                const url = URL.createObjectURL(blob);
                setMediaBlobUrl(url);

                // Stop all tracks to release microphone
                mediaStream.getTracks().forEach(track => track.stop());
                setStream(null);
            };

            mediaRecorder.start(100); // 100ms timeslice
            setIsRecording(true);
            setMediaBlobUrl(null);

        } catch (error) {
            console.error('[Recorder] Error starting recording:', error);
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

    const handleTranscribe = async () => {
        if (!mediaBlobUrl) return;

        try {
            setIsUploading(true);

            const blob = await fetch(mediaBlobUrl).then(r => r.blob());
            const file = new File([blob], 'recording.webm', { type: 'audio/webm' });

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

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || '변환 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
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
                                    분석 중...
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
        </div>
    );
}
