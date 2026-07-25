const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const ICE_GATHERING_TIMEOUT_MS = 4000;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBytes(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function byteStream(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

// SDP text compresses well (lots of repeated tokens across ICE candidates and
// codec lines), which meaningfully shortens the host/join code.
async function compress(text) {
  const stream = byteStream(new TextEncoder().encode(text)).pipeThrough(
    new CompressionStream('gzip'),
  );
  const buffer = await new Response(stream).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(buffer));
}

async function decompress(code) {
  const stream = byteStream(base64UrlToBytes(code)).pipeThrough(
    new DecompressionStream('gzip'),
  );
  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

export async function encodeSignal(description) {
  return compress(JSON.stringify(description));
}

export async function decodeSignal(code) {
  return JSON.parse(await decompress(code.trim()));
}

function waitForIceGathering(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    function check() {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        clearTimeout(timeout);
        resolve();
      }
    }
    const timeout = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, ICE_GATHERING_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export function createPeerConnection() {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

export async function createOfferCode(pc) {
  const channel = pc.createDataChannel('game');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);
  return { channel, code: await encodeSignal(pc.localDescription) };
}

export async function createAnswerCode(pc, offerCode) {
  const remote = await decodeSignal(offerCode);
  await pc.setRemoteDescription(remote);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc);
  return encodeSignal(pc.localDescription);
}

export async function acceptAnswerCode(pc, answerCode) {
  const remote = await decodeSignal(answerCode);
  await pc.setRemoteDescription(remote);
}
