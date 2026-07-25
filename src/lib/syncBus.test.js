import { describe, it, expect, vi } from 'vitest';
import { publish, subscribe } from './syncBus.js';

describe('syncBus', () => {
  it('notifies subscribers of a key when published', () => {
    const cb = vi.fn();
    const unsubscribe = subscribe('k1', cb);
    publish('k1', { a: 1 });
    expect(cb).toHaveBeenCalledWith({ a: 1 });
    unsubscribe();
    publish('k1', { a: 2 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('keeps subscribers of different keys isolated', () => {
    const cbA = vi.fn();
    const cbB = vi.fn();
    subscribe('a', cbA);
    subscribe('b', cbB);
    publish('a', 1);
    expect(cbA).toHaveBeenCalledWith(1);
    expect(cbB).not.toHaveBeenCalled();
  });
});
