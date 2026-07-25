const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const ICE_GATHERING_TIMEOUT_MS = 4000;

export function encodeSignal(description) {
  return btoa(JSON.stringify(description));
}

export function decodeSignal(code) {
  return JSON.parse(atob(code.trim()));
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
  return { channel, code: encodeSignal(pc.localDescription) };
}

export async function createAnswerCode(pc, offerCode) {
  const remote = decodeSignal(offerCode);
  await pc.setRemoteDescription(remote);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc);
  return encodeSignal(pc.localDescription);
}

export async function acceptAnswerCode(pc, answerCode) {
  const remote = decodeSignal(answerCode);
  await pc.setRemoteDescription(remote);
}
