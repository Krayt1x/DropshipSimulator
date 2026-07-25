export function buildInviteLink(param, code) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#connect?${param}=${encodeURIComponent(code)}`;
}

export function readHashParam(param) {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return null;
  return new URLSearchParams(hash.slice(queryIndex + 1)).get(param);
}

// Accepts either a bare code or a full invite link pasted by the user, so
// the join/answer boxes work regardless of which one they copied.
export function extractCode(pastedValue, param) {
  const trimmed = pastedValue.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    const hashQuery = url.hash.split('?')[1] ?? '';
    const fromUrl = new URLSearchParams(hashQuery).get(param);
    if (fromUrl) return fromUrl;
  } catch {
    // not a URL — fall through and treat the whole value as a raw code
  }
  return trimmed;
}
