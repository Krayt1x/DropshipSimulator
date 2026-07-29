import { useEffect, useRef, useState } from 'react';
import { OWNERS } from '../lib/tokens.js';
import { playTurnChangeDing } from '../lib/audio.js';

const AUTO_DISMISS_MS = 3000;

// A toast announcing whose turn it now is (#131) — mirrored to both players
// over the same synced-transient-state channel as the deploy/move effects
// (#117, #118), so it shows up for whoever's screen it now is, ding included.
function TurnNotificationToast({ notice, myPlayer }) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef(null);
  const lastIdRef = useRef(null);

  useEffect(() => {
    if (!notice || notice.id === lastIdRef.current) return;
    lastIdRef.current = notice.id;
    playTurnChangeDing();
    setVisible(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
  }, [notice]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  if (!visible || !notice) return null;

  const owner = OWNERS.find((o) => o.id === notice.active);
  const label = owner?.label ?? notice.active;
  const isMe = !myPlayer || myPlayer === notice.active;

  return (
    <div
      className="turn-toast"
      style={{ background: owner?.color ?? '#16a34a' }}
    >
      <span className="turn-toast-dot" />
      {isMe ? `Your turn — ${label}` : `${label}'s turn`}
    </div>
  );
}

export default TurnNotificationToast;
