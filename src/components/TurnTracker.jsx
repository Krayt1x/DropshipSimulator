import { OWNERS, ownerColor } from '../lib/tokens.js';
import { DICE_COLORS } from '../lib/dice.js';

function DiceSummary({ dice }) {
  const shown = DICE_COLORS.filter((color) => dice?.[color] > 0);
  if (shown.length === 0) return null;

  return (
    <span className="turn-dice-summary">
      {shown.map((color) => (
        <span className="turn-dice-chip" key={color}>
          <span className={`die-icon ${color}`} />
          {dice[color]}
        </span>
      ))}
    </span>
  );
}

function TurnTracker({ turn, onEndTurn, playerDice }) {
  const [top, bottom] = OWNERS;

  function segmentStyle(owner) {
    return turn.active === owner.id
      ? { background: ownerColor(owner.id), color: '#fff' }
      : undefined;
  }

  return (
    <div className="turn-tracker-row">
      <div className="split-tracker">
        <span
          className={`turn-segment ${turn.active === top.id ? 'active' : ''}`}
          style={segmentStyle(top)}
        >
          {turn.active === top.id ? '▲ ' : ''}
          {top.label}
          <DiceSummary dice={playerDice?.[top.id]} />
        </span>
        <span className="turn-mid">
          Turn {turn.number}
          <span className="turn-mid-sub">
            active: {turn.active === top.id ? 'top' : 'bottom'}
          </span>
        </span>
        <span
          className={`turn-segment ${turn.active === bottom.id ? 'active' : ''}`}
          style={segmentStyle(bottom)}
        >
          {bottom.label}
          <DiceSummary dice={playerDice?.[bottom.id]} />
          {turn.active === bottom.id ? ' ▼' : ''}
        </span>
      </div>
      <button type="button" onClick={onEndTurn}>
        End Turn
      </button>
    </div>
  );
}

export default TurnTracker;
