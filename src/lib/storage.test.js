import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSyncedTransientState } from './storage.js';

beforeEach(() => window.localStorage.clear());

describe('useSyncedTransientState (#117, #118, #119)', () => {
  it('mirrors state to every other hook instance on the same key', () => {
    const key = 'dropshipsimulator:battle:test-transient';
    const a = renderHook(() => useSyncedTransientState(key, null));
    const b = renderHook(() => useSyncedTransientState(key, null));

    act(() => {
      a.result.current[1]({ tokenId: 'x', position: { col: 1, row: 1 } });
    });

    // The second instance (standing in for the other player's own component,
    // wired the same way over the multiplayer data channel) picks it up too.
    expect(b.result.current[0]).toEqual({
      tokenId: 'x',
      position: { col: 1, row: 1 },
    });
  });

  it('never touches localStorage, so a stale value cannot survive a refresh', () => {
    const key = 'dropshipsimulator:battle:test-transient-2';
    const { result } = renderHook(() => useSyncedTransientState(key, null));

    act(() => {
      result.current[1]('mid-animation');
    });

    expect(window.localStorage.getItem(key)).toBeNull();
  });
});
