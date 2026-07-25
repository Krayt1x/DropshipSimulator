import { useState } from 'react';
import { OWNERS, ownerColor } from '../lib/tokens.js';

function ReserveGroup({ owner, tokens, units, selectedTokenId, canControl, onSelect }) {
  if (tokens.length === 0) return null;

  return (
    <div className="reserve-group">
      <p className="reserve-group-label">
        <span className="tile-swatch" style={{ background: ownerColor(owner.id) }} />
        {owner.label} ({tokens.length})
      </p>
      <div className="tile-palette-list">
        {tokens.map((token) => {
          const unit = units.find((u) => Number(u.id) === Number(token.unitId));
          const draggable = canControl(token);
          return (
            <button
              type="button"
              key={token.id}
              draggable={draggable}
              title={
                draggable
                  ? 'Drag onto the board to deploy'
                  : "You can't deploy another player's unit"
              }
              onDragStart={(e) => {
                if (!draggable) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData('text/plain', token.id);
              }}
              className={`tile-swatch-btn ${token.id === selectedTokenId ? 'selected' : ''} ${draggable ? 'reserve-draggable' : ''}`}
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

function ReserveList({ tokens, units, selectedTokenId, canControl, onSelect }) {
  const [collapsed, setCollapsed] = useState(false);
  if (tokens.length === 0) return null;

  return (
    <div className="card">
      <div className="reserve-header">
        <p className="unit-name">Reserve ({tokens.length})</p>
        <button
          type="button"
          className="ghost"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!collapsed && (
        <>
          <p className="unit-meta" style={{ marginBottom: 8 }}>
            Not yet deployed. Select one and place it, or drag it onto the
            board.
          </p>
          {OWNERS.map((owner) => (
            <ReserveGroup
              key={owner.id}
              owner={owner}
              tokens={tokens.filter((t) => t.owner === owner.id)}
              units={units}
              selectedTokenId={selectedTokenId}
              canControl={canControl}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default ReserveList;
