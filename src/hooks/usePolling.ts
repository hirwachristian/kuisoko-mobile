import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Calls `callback` repeatedly every `intervalMs` for as long as the app is in the foreground -
 * paused entirely while backgrounded (no reason to keep polling), and catches up with one
 * immediate call the moment it's foregrounded again, rather than waiting out the rest of the
 * interval. Ports frontend/hooks/usePolling.ts, swapping the browser's visibilitychange for
 * React Native's AppState. Does not call `callback` on mount - the caller is expected to already
 * do its own initial fetch; this only adds the repeat.
 */
export function usePolling(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const startPolling = () => {
      if (intervalId !== undefined) return;
      intervalId = setInterval(() => callbackRef.current(), intervalMs);
    };
    const stopPolling = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };
    const handleAppStateChange = (state: string) => {
      if (state === 'active') {
        callbackRef.current();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (AppState.currentState === 'active') startPolling();
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [intervalMs]);
}
