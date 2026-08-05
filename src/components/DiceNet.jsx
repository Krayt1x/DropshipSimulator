// Ported from DropshipBuilder's src/components/DiceNet.jsx (#199) — a
// hover preview of an action die's 6 faces, used read-only in the Manage
// page's Action Dice section.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACTION_DICE_SIDE_KEYS } from '../lib/dice.js';

const FACE_POSITIONS = [
  'dice-net-face-top',
  'dice-net-face-l1',
  'dice-net-face-l2',
  'dice-net-face-l3',
  'dice-net-face-l4',
  'dice-net-face-bottom',
];

export function DiceNet({ die }) {
  return (
    <div className="dice-net">
      {ACTION_DICE_SIDE_KEYS.map((key, i) => (
        <div
          key={key}
          className={`dice-net-face ${FACE_POSITIONS[i]}`}
          style={{ background: die.color }}
        >
          {die[key] || '—'}
        </div>
      ))}
    </div>
  );
}

export function DiceSwatch({ die }) {
  const iconRef = useRef(null);
  const [pos, setPos] = useState(null);

  function show() {
    const rect = iconRef.current.getBoundingClientRect();
    setPos({ top: rect.top - 10, left: rect.right + 8 });
  }

  return (
    <>
      <span
        ref={iconRef}
        className="die-swatch-icon"
        style={{ background: die.color }}
        aria-label={`${die.color} die faces`}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
      />
      {pos &&
        createPortal(
          <div
            className="dice-net-popover"
            style={{ top: pos.top, left: pos.left }}
          >
            <DiceNet die={die} />
          </div>,
          document.body,
        )}
    </>
  );
}
