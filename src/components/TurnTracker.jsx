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

function VpChip({ vp }) {
  return (
    <span className="turn-vp-chip" title="Victory points">
      🏆 {vp ?? 0}
    </span>
  );
}

function TurnTracker({
  turn,
  onEndTurn,
  playerDice,
  victoryPoints,
  ownerLabel,
  endTurnLabel = 'End Turn',
  endTurnClassName = '',
  deploymentPhase = false,
}) {
  const [top, bottom] = OWNERS;
  const labelFor = (owner) => ownerLabel?.(owner.id) ?? owner.label;

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
          {labelFor(top)}
          <DiceSummary dice={playerDice?.[top.id]} />
          <VpChip vp={victoryPoints?.[top.id]} />
        </span>
        <span className="turn-mid">
          {/* Reads "Deployment" during the shared placement window instead
              of a misleading "Turn 1" — deployment isn't really turn 1 yet,
              and neither side is more "active" than the other while both
              are still placing models (#279). */}
          {deploymentPhase ? 'Deployment' : `Turn ${turn.number}`}
          {!deploymentPhase && (
            <span className="turn-mid-sub">
              active: {turn.active === top.id ? 'top' : 'bottom'}
            </span>
          )}
        </span>
        <span
          className={`turn-segment ${turn.active === bottom.id ? 'active' : ''}`}
          style={segmentStyle(bottom)}
        >
          {labelFor(bottom)}
          <DiceSummary dice={playerDice?.[bottom.id]} />
          <VpChip vp={victoryPoints?.[bottom.id]} />
          {turn.active === bottom.id ? ' ▼' : ''}
        </span>
      </div>
      <button type="button" className={endTurnClassName} onClick={onEndTurn}>
        {endTurnLabel}
      </button>
    </div>
  );
}

export default TurnTracker;
