import { ownerColor } from '../lib/tokens.js';

function ReserveList({ tokens, units, selectedTokenId, onSelect }) {
  if (tokens.length === 0) return null;

  return (
    <div className="card">
      <p className="unit-name">Reserve ({tokens.length})</p>
      <p className="unit-meta" style={{ marginBottom: 8 }}>
        Not yet deployed. Select one, then place it on the board.
      </p>
      <div className="tile-palette-list">
        {tokens.map((token) => {
          const unit = units.find((u) => Number(u.id) === Number(token.unitId));
          return (
            <button
              type="button"
              key={token.id}
              className={`tile-swatch-btn ${token.id === selectedTokenId ? 'selected' : ''}`}
              onClick={() => onSelect(token.id)}
            >
              <span
                className="tile-swatch"
                style={{ background: ownerColor(token.owner) }}
              />
              {unit?.name ?? 'Unknown unit'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ReserveList;
