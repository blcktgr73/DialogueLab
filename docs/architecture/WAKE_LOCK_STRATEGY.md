# Browser Screen Wake Lock Strategy

## Overview

In web-based long-running applications like audio recorders or video conferencing tools, preventing the device's screen from turning off (sleeping) is critical. If the screen turns off, the browser often throttles CPU usage or kills network connections, leading to interrupted recordings or failures.

This document outlines the **Hybrid Wake Lock Strategy** used in DialogueLab to ensure the application stays active across various devices (Desktop, iOS, Android) and browser environments.

## The Challenge

Browsers aggressively conserve power on mobile devices. There is no single API that guarantees keeping the screen awake on all platforms:
1.  **Screen Wake Lock API**: The modern standard, but not supported on all browsers (e.g., older Firefox, some WebViews).
2.  **Autoplay Policies**: Browsers block media playback unless initiated by a user gesture (click/tap), making fallback solutions tricky.

## Hybrid Solution

We employ a "Belt and Suspenders" approach, executing two strategies **in parallel** to maximize reliability.

### 1. Primary Strategy: Screen Wake Lock API

The [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) is the standard method to prevent the screen from dimming/locking.

-   **Mechanism**: Request a lock via `navigator.wakeLock.request('screen')`.
-   **Pros**: Efficient, native, doesn't require media hack.
-   **Cons**:
    -   Can be released automatically by the OS when the user switches tabs or minimizes the app.
    -   Not universally supported.

### 2. Fallback Strategy: Invisible Video Loop

For browsers that don't support the Wake Lock API or where it fails (commonly iOS Safari in certain contexts), playing a video is a reliable way to keep the screen awake.

-   **Mechanism**: Play a tiny, muted, looping video file. The browser perceives this as "user watching media" and keeps the screen on.
-   **Implementation Requirements**:
    -   **Hidden Element**: The `<video>` element is rendered but visually hidden (`playsInline`, `hidden`).
    -   **Source**: A base64 encoded dummy video snippet is sufficient.
    -   **Looping**: Must be set to `loop`.

### 3. Critical Requirement: User Interaction (User Gesture)

**This is the most important architectural constraint.**
Modern browsers (especially Chrome and Safari) enforce strict Autoplay Policies. You cannot start a video or request a Wake Lock programmatically (e.g., inside a `useEffect`) without a direct user interaction.

**Architecture for Success:**
1.  **Trigger Point**: The wake lock request **MUST** be tied directly to the user's "Start Recording" click event.
2.  **Synchronous/Parallel Execution**: Even though the Wake Lock API is asynchronous, the fallback video's `.play()` method should be called as close to the event as possible.

## Implementation Details

The logic is encapsulated in the `useWakeLock` hook (`src/hooks/use-wake-lock.ts`).

### Workflow

1.  **Initialization**:
    -   On mount, a hidden `<video>` element is created and attached to the DOM.
2.  **Activation (`requestWakeLock` function)**:
    -   This function is called immediately when the user clicks "Start".
    -   **Step A (API)**: Calls `navigator.wakeLock.request('screen')`.
    -   **Step B (Fallback, Parallel)**: Calls `videoElement.play()`.
    -   **Handling Failures**: We suppress `AbortError` (common if user clicks stop quickly) but log other errors.
3.  **Deactivation (`releaseWakeLock` function)**:
    -   Releases the API lock (`wakeLockConfig.release()`).
    -   Pauses the video (`videoElement.pause()`).

### Code snippet (Conceptual)

```typescript
const requestWakeLock = useCallback(async () => {
    // 1. Try Native API (Async)
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch((err) => {
            console.warn('Wake Lock API failed:', err);
        });
    }

    // 2. Try Video Fallback (Sync-like, tied to gesture)
    if (videoRef.current) {
        try {
            // Must be called during the click handler stack
            await videoRef.current.play();
        } catch (err) {
            // Ignore AbortError (interrupted by pause), log others
            if (err.name !== 'AbortError') console.error(err);
        }
    }
}, []);
```

## Best Practices & Gotchas

*   **Do not use `await` blindly**: If you `await` the Wake Lock API request *before* calling `video.play()`, the browser might decide the "User Gesture" context has expired by the time the video tries to play. It's safer to fire `video.play()` immediately.
*   **Re-acquire on Visibility Change**: The Wake Lock API releases the lock when the tab becomes invisible. The application must listen to `visibilitychange` events and re-request the lock when the user returns.
*   **Cleanup**: Always ensure locks are released and video is paused on component unmount to save battery.
