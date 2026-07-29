import { useEffect, useState } from 'react';
import { publish, subscribe } from './syncBus.js';

export function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage unavailable (private browsing, quota) — state still works in-memory
    }
    publish(key, value);
  }, [key, value]);

  useEffect(() => subscribe(key, setValue), [key]);

  return [value, setValue];
}

// Same wire-sync mechanism as useLocalStorageState (publish/subscribe over
// the multiplayer data channel via a key in MultiplayerContext's
// SYNCED_KEYS), but skips localStorage entirely — for transient UI events
// (a deploy puff, a movement animation, a dice roll's results) that should
// mirror to the other player live but must never persist or replay stale
// after a page refresh (#117, #118, #119).
export function useSyncedTransientState(key, initialValue) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    publish(key, value);
  }, [key, value]);

  useEffect(() => subscribe(key, setValue), [key]);

  return [value, setValue];
}

export function makeKey(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
