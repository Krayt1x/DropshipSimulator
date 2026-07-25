import { OWNERS, ownerColor } from '../lib/tokens.js';

function TurnTracker({ turn, onEndTurn }) {
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
