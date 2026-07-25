import { describe, it, expect } from 'vitest';
import { decodeSignal, encodeSignal } from './webrtc.js';

describe('webrtc signal encoding', () => {
  it('round-trips an SDP-like description through compressed, URL-safe text', async () => {
    const description = {
      type: 'offer',
      sdp: 'v=0\r\no=- 123 2 IN IP4 0.0.0.0\r\n',
    };
    const code = await encodeSignal(description);
    expect(typeof code).toBe('string');
    expect(code).not.toMatch(/[+/=]/);
    expect(await decodeSignal(code)).toEqual(description);
  });

  it('trims whitespace pasted around a code', async () => {
    const description = { type: 'answer', sdp: 'v=0' };
    const code = await encodeSignal(description);
    expect(await decodeSignal(`  ${code}\n`)).toEqual(description);
  });
});
