'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    stream: MediaStream | null;
    width?: number;
    height?: number;
    color?: string; // e.g. "239, 68, 68" (RGB only)
}

export function AudioVisualizer({ stream, width = 200, height = 200, color = "124, 58, 237" }: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!stream) return;

        // Use AudioContext to analyze audio
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

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;

                // Visualization Logic:
                // Base radius 30, expands with volume
                const radius = 30 + (average * 0.8);

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                // Dynamic opacity based on volume
                ctx.fillStyle = `rgba(${color}, ${Math.min(0.8, Math.max(0.1, average / 40))})`;
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
    }, [stream, color]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        />
    );
};
