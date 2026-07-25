import { OWNERS, ownerColor } from '../lib/tokens.js';

function DestroyedGroup({
  owner,
  tokens,
  units,
  selectedTokenId,
  canControl,
  onSelect,
  onReturnToReserve,
}) {
  if (tokens.length === 0) return null;

  return (
    <div className="reserve-group">
      <p className="reserve-group-label">
        <span
          className="tile-swatch"
          style={{ background: ownerColor(owner.id) }}
        />
        {owner.label} ({tokens.length})
      </p>
      <div className="tile-palette-list">
        {tokens.map((token) => {
          const unit = units.find((u) => Number(u.id) === Number(token.unitId));
          return (
            <div className="destroyed-row" key={token.id}>
              <button
                type="button"
                className={`tile-swatch-btn ${token.id === selectedTokenId ? 'selected' : ''}`}
                onClick={() => onSelect(token.id)}
              >
                <span
                  className="tile-swatch"
                  style={{ background: ownerColor(token.owner) }}
                />
                {unit?.name ?? 'Unknown unit'}
              </button>
              <button
                type="button"
                className="ghost destroyed-restore"
                disabled={!canControl(token)}
                onClick={() => onReturnToReserve(token.id)}
              >
                Return to reserve
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DestroyedList({
  tokens,
  units,
  selectedTokenId,
  canControl,
  onSelect,
  onReturnToReserve,
}) {
  if (tokens.length === 0) return null;

  return (
    <div className="card">
      <p className="unit-name">Destroyed Models ({tokens.length})</p>
      {OWNERS.map((owner) => (
        <DestroyedGroup
          key={owner.id}
          owner={owner}
          tokens={tokens.filter((t) => t.owner === owner.id)}
          units={units}
          selectedTokenId={selectedTokenId}
          canControl={canControl}
          onSelect={onSelect}
          onReturnToReserve={onReturnToReserve}
        />
      ))}
    </div>
  );
}

export default DestroyedList;
