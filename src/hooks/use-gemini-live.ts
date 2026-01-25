'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createGeminiEphemeralToken } from '@/app/actions/gemini-live';
import { bulkAddTranscripts } from '@/app/actions/transcript';
import { analyzeSession } from '@/app/actions/analysis';
import { toast } from 'sonner';

export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseGeminiLiveOptions {
  onMessage?: (text: string) => void;
  systemInstruction?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  onRetryExhausted?: (info: { code?: number; reason?: string }) => void;
}

interface TranscriptEntry {
  speaker: string;
  content: string;
}

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const MODEL_NAME = 'models/gemini-2.0-flash-exp';
const USER_SPEAKER = '사용자';
const AI_SPEAKER = 'AI 파트너';

export function useGeminiLive(options: UseGeminiLiveOptions = {}) {
  const [status, setStatus] = useState<LiveStatus>('disconnected');
  const statusRef = useRef<LiveStatus>('disconnected');
  const optionsRef = useRef<UseGeminiLiveOptions>(options);
  const wsRef = useRef<WebSocket | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const disableAutoRetryRef = useRef(false);
  const setupCompleteRef = useRef(false);

  const captureContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const playheadRef = useRef(0);

  const transcriptsRef = useRef<TranscriptEntry[]>([]);
  const shouldFinalizeRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const appendTranscript = useCallback((speaker: string, text: string) => {
    const cleaned = (text || '').trim();
    if (!cleaned) return;
    const entries = transcriptsRef.current;
    const last = entries[entries.length - 1];
    if (last && last.speaker === speaker) {
      last.content = `${last.content} ${cleaned}`.trim();
    } else {
      entries.push({ speaker, content: cleaned });
    }
  }, []);

  const sendJson = useCallback((payload: object) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }, []);

  const closePlaybackContext = useCallback(() => {
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close();
    }
    playbackContextRef.current = null;
    playheadRef.current = 0;
  }, []);

  const stopCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (captureContextRef.current && captureContextRef.current.state !== 'closed') {
      captureContextRef.current.close();
    }
    captureContextRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setMediaStream(null);
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const suspendAutoRetry = useCallback(() => {
    disableAutoRetryRef.current = true;
    clearRetryTimer();
  }, [clearRetryTimer]);

  const playAudioChunk = useCallback((base64: string) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: OUTPUT_SAMPLE_RATE,
      });
    }
    const ctx = playbackContextRef.current;
    const pcmBuffer = base64ToArrayBuffer(base64);
    const pcm16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i += 1) {
      float32[i] = pcm16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, playheadRef.current);
    source.start(startTime);
    playheadRef.current = startTime + audioBuffer.duration;
  }, []);

  const startCapture = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: INPUT_SAMPLE_RATE,
      },
    });

    mediaStreamRef.current = stream;
    setMediaStream(stream);

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: INPUT_SAMPLE_RATE,
    });
    captureContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    gainRef.current = gainNode;

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleBuffer(input, audioContext.sampleRate, INPUT_SAMPLE_RATE);
      if (!downsampled) return;
      const pcm16 = floatTo16BitPCM(downsampled);
      const base64 = arrayBufferToBase64(pcm16.buffer);

      sendJson({
        realtimeInput: {
          audio: {
            data: base64,
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
          },
        },
      });
    };

    source.connect(processor);
    processor.connect(gainNode);
    gainNode.connect(audioContext.destination);
  }, [sendJson]);

  const connect = useCallback(async (force = false) => {
    try {
      if (disableAutoRetryRef.current && !force) return;
      if (statusRef.current === 'connected' || statusRef.current === 'connecting') return;
      setStatus('connecting');

      const baseUrl = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
      let url = '';

      try {
        const tokenData = await createGeminiEphemeralToken();
        if (tokenData?.accessToken) {
          url = `${baseUrl}?access_token=${tokenData.accessToken}`;
        } else if ((tokenData as any)?.apiKey) {
          url = `${baseUrl}?key=${(tokenData as any).apiKey}`;
        }
      } catch (err) {
        console.log('[GeminiLive] Server token creation unavailable, using client fallback if present.');
      }

      if (!url) {
        const fallbackKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
        if (!fallbackKey) {
          throw new Error('No valid authentication available (server token failed + no client key).');
        }
        url = `${baseUrl}?key=${fallbackKey}`;
      }

      const socket = new WebSocket(url);
      wsRef.current = socket;
      setupCompleteRef.current = false;

      socket.onopen = async () => {
        setStatus('connected');
        clearRetryTimer();
        if (transcriptsRef.current.length === 0) {
          transcriptsRef.current = [];
        }

        console.log('[GeminiLive] socket open');
        const instruction = optionsRef.current.systemInstruction?.trim()
          || 'You are a concise test assistant. Reply in Korean.'

        sendJson({
          setup: {
            model: MODEL_NAME,
            systemInstruction: {
              parts: [{ text: instruction }],
            },
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0.2,
            },
            outputAudioTranscription: {},
            inputAudioTranscription: {},
          },
        });

        try {
          await startCapture();
        } catch (err) {
          console.error(err);
          toast.error('마이크 권한을 확인해주세요.');
        }
      };

      socket.onmessage = async (event) => {
        let raw = '';
        if (typeof event.data === 'string') {
          raw = event.data;
        } else if (event.data instanceof Blob) {
          raw = await event.data.text();
        } else if (event.data instanceof ArrayBuffer) {
          raw = new TextDecoder('utf-8').decode(event.data);
        } else {
          raw = String(event.data);
        }

        let data: any;
        try {
          data = JSON.parse(raw);
        } catch (err) {
          console.warn('[GeminiLive] Unable to parse message', err);
          return;
        }

        if (data.serverContent?.modelTurn?.parts) {
          for (const part of data.serverContent.modelTurn.parts) {
            if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('audio')) {
              playAudioChunk(part.inlineData.data);
            }
            if (part.text) {
              optionsRef.current.onMessage?.(part.text);
            }
          }
        }

        if (data.serverContent?.outputTranscription?.text) {
          appendTranscript(AI_SPEAKER, data.serverContent.outputTranscription.text);
          optionsRef.current.onMessage?.(data.serverContent.outputTranscription.text);
        }

        if (data.serverContent?.inputTranscription?.text) {
          appendTranscript(USER_SPEAKER, data.serverContent.inputTranscription.text);
        }

        if (data.setupComplete && !setupCompleteRef.current) {
          setupCompleteRef.current = true;
          retryCountRef.current = 0;
          disableAutoRetryRef.current = false;
          console.log('[GeminiLive] setup complete');
        }

        if (data.serverContent?.turnComplete && shouldFinalizeRef.current) {
          shouldFinalizeRef.current = false;
        }
      };

      socket.onclose = (event) => {
        setStatus('disconnected');
        stopCapture();
        closePlaybackContext();

        console.warn('[GeminiLive] socket closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        if (event.code === 1011 || event.reason.includes('quota')) {
          toast.error('Gemini API quota exceeded. Please try again later.');
          disableAutoRetryRef.current = true;
          optionsRef.current.onRetryExhausted?.({ code: event.code, reason: event.reason });
          return;
        }

        const maxRetries = optionsRef.current.maxRetries ?? 3;
        const retryDelayMs = optionsRef.current.retryDelayMs ?? 1500;
        if (disableAutoRetryRef.current) {
          return;
        }
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          clearRetryTimer();
          retryTimerRef.current = window.setTimeout(() => {
            connect();
          }, retryDelayMs);
        } else {
          disableAutoRetryRef.current = true;
          optionsRef.current.onRetryExhausted?.({ code: event.code, reason: event.reason });
        }
      };

      socket.onerror = (event) => {
        setStatus('error');
        console.error('[GeminiLive] socket error', event);
        toast.error('Gemini Live connection error');
      };
    } catch (error) {
      console.error(error);
      setStatus('error');
      toast.error('Failed to start Live session');
    }
  }, [appendTranscript, clearRetryTimer, closePlaybackContext, sendJson, startCapture, stopCapture]);

  const disconnect = useCallback(() => {
    sendJson({ realtimeInput: { audioStreamEnd: true } });
    suspendAutoRetry();
    wsRef.current?.close();
    stopCapture();
  }, [sendJson, stopCapture, suspendAutoRetry]);

  const finalizeSession = useCallback(async (sessionId: string, lensType = 'miti') => {
    shouldFinalizeRef.current = true;
    sendJson({ realtimeInput: { audioStreamEnd: true } });
    stopCapture();

    await new Promise((resolve) => setTimeout(resolve, 800));
    wsRef.current?.close();

    const transcripts = transcriptsRef.current;
    if (transcripts.length === 0) {
      return;
    }

    await bulkAddTranscripts(sessionId, transcripts);
    await analyzeSession(sessionId, lensType);
  }, [disconnect]);

  useEffect(() => () => {
    disconnect();
  }, [disconnect]);

  return {
    status,
    connect,
    resetAutoRetry: () => {
      disableAutoRetryRef.current = false;
      retryCountRef.current = 0;
    },
    suspendAutoRetry,
    disconnect,
    finalizeSession,
    mediaStream,
    retryCount: retryCountRef.current,
  };
}

function floatTo16BitPCM(input: Float32Array) {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i += 1) {
    let sample = Math.max(-1, Math.min(1, input[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, sample, true);
  }
  return new Int16Array(buffer);
}

function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number) {
  if (outputRate === inputRate) {
    return buffer;
  }
  if (outputRate > inputRate) {
    console.warn('[GeminiLive] Output sample rate is higher than input sample rate.');
    return buffer;
  }
  const sampleRateRatio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }
    result[offsetResult] = accum / count;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
