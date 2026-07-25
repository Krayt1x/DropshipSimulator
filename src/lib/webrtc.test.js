import { describe, it, expect } from 'vitest';
import { decodeSignal, encodeSignal } from './webrtc.js';

describe('webrtc signal encoding', () => {
  it('round-trips an SDP-like description through base64 JSON', () => {
    const description = {
      type: 'offer',
      sdp: 'v=0\r\no=- 123 2 IN IP4 0.0.0.0\r\n',
    };
    const code = encodeSignal(description);
    expect(typeof code).toBe('string');
    expect(decodeSignal(code)).toEqual(description);
  });

  it('trims whitespace pasted around a code', () => {
    const description = { type: 'answer', sdp: 'v=0' };
    const code = encodeSignal(description);
    expect(decodeSignal(`  ${code}\n`)).toEqual(description);
  });
});
