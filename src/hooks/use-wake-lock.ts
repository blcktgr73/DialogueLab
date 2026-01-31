
import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/logger';

export function useWakeLock() {
    const [isLocked, setIsLocked] = useState(false);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // We need to track if we *want* to be locked, to re-acquire if dropped.
    const desiredLockState = useRef(false);


    // Backup strategy: Play a tiny, loop video to trick the browser/OS into thinking media is playing
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Initialize Video Element (Run once)
    useEffect(() => {
        if (!videoRef.current) {
            const video = document.createElement('video');

            // Proven base64 strings from NoSleep.js
            const webmSource = document.createElement('source');
            webmSource.type = 'video/webm';
            webmSource.src = 'data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmRBfX17GBrnACAytBS1t7T1t7MTCBc3ZnQoaBAf4BA4KCh4ECQoWBAhhTgGdAjRVJqWZEXP///+BAWqBAf4BA4KCh4ECQoWBAhhTgGdAjRVJqWZEXP///+BAWqBAf4BA4KCh4ECQoWBAhhTgGdAjRVJqWZEXP///+BAWqBAf4BA4KCh4ECQoWBAhhTgGdAjRVJqWZEXP///+BAWqBAf4BA4KCh4ECQoWBAhhTgGdAjRVJqWZEXP///+BAWt7';

            const mp4Source = document.createElement('source');
            mp4Source.type = 'video/mp4';
            mp4Source.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAACQm1kYXQAAAKABX//4GCAgIAAAADwAAAAEAAAAAAAeAAAAAAA8AAAAAAH4AAAAAADwAAAAAAfgAAAAAAPAAAAAAB+AAAAAAABAAAB3XbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIgZnJlZQAAABdtZHRhAAAAAAAAAAAAAAAAAAAAAAA6GBgA';

            video.appendChild(webmSource);
            video.appendChild(mp4Source);

            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.muted = true;
            video.loop = true;

            // Positioning just off-screen might be safer than opacity trick for some browsers
            video.style.height = '1px';
            video.style.width = '1px';
            video.style.position = 'fixed';
            video.style.left = '-100px';
            video.style.top = '-100px';
            video.style.pointerEvents = 'none';
            // Some browsers require the element to be "visible" (opacity > 0)
            video.style.opacity = '1';
            video.style.zIndex = '-9999';

            document.body.appendChild(video);
            videoRef.current = video;
        }

        return () => {
            // Clean up on unmount
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.remove();
                videoRef.current = null;
            }
        };
    }, []);

    // 1. Request Lock
    // 1. Request Lock
    const requestWakeLock = useCallback(async () => {
        desiredLockState.current = true;

        let videoPromise: Promise<void> | undefined;
        let wakeLockPromise: Promise<void> | undefined;

        // B. Try Video Fallback (Execute IMMEDIATELY to capture User Gesture)
        // We do this BEFORE the API check to ensure we use the gesture token before it expires.
        if (videoRef.current) {
            try {
                if (videoRef.current.currentTime > 0) {
                    videoRef.current.currentTime = 0;
                }
                const p = videoRef.current.play();
                if (p !== undefined) {
                    videoPromise = p.then(() => {
                        logger.info('WakeLock', 'Fallback video started');
                    }).catch(err => {
                        if (err.name !== 'AbortError') {
                            console.warn('[WakeLock] Video play failed:', err);
                            logger.error('WakeLock', 'Fallback video failed', { error: err.message });
                        }
                    });
                }
            } catch (err: any) {
                console.warn('[WakeLock] Video error:', err);
            }
        }

        // A. Try API
        if ('wakeLock' in navigator) {
            wakeLockPromise = navigator.wakeLock.request('screen')
                .then(sentinel => {
                    wakeLockRef.current = sentinel;

                    sentinel.addEventListener('release', () => {
                        if (desiredLockState.current) {
                            console.log('[WakeLock] Lock released by system');
                            if (!videoRef.current || videoRef.current.paused) {
                                setIsLocked(false);
                            }
                        } else {
                            console.log('[WakeLock] Lock released manually');
                        }
                    });
                    logger.info('WakeLock', 'Wake Lock acquired (API)');
                })
                .catch(err => {
                    logger.error('WakeLock', 'Failed to acquire Wake Lock API', { error: err.message });
                });
        } else {
            logger.warn('WakeLock', 'Wake Lock API not supported');
        }

        // Wait for attempts to resolve to update state
        await Promise.allSettled([videoPromise, wakeLockPromise]);

        // If either succeeded, we consider it locked (or at least we tried best effort)
        // Strictly speaking, we are locked if wakeLockRef is set OR video is playing.
        const isVideoPlaying = videoRef.current && !videoRef.current.paused && !videoRef.current.ended;
        const isApiLocked = !!wakeLockRef.current;

        setIsLocked(isVideoPlaying || isApiLocked);
    }, []);

    // 2. Release Lock
    const releaseWakeLock = useCallback(async () => {
        desiredLockState.current = false;

        // A. Release API
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                logger.info('WakeLock', 'Wake Lock API released');
            } catch (err: any) {
                logger.error('WakeLock', 'Failed to release Wake Lock API', { error: err.message });
            }
        }

        // B. Pause Video
        if (videoRef.current) {
            videoRef.current.pause();
            logger.info('WakeLock', 'Fallback video paused');
        }

        setIsLocked(false);
    }, []);

    // Re-acquire lock when page visibility changes to visible
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (desiredLockState.current && document.visibilityState === 'visible') {
                console.log('[WakeLock] Visibility restored, re-acquiring lock...');
                await requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [requestWakeLock]);

    return { isLocked, requestWakeLock, releaseWakeLock };
}
