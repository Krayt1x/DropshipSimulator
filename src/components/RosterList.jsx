import { useState } from 'react';
import { OWNERS, ownerColor } from '../lib/tokens.js';

function statusLabel(token) {
  if (token.destroyed) return 'Destroyed';
  if (token.position) return 'Deployed';
  return 'Reserve';
}

function RosterList({ tokens, units, myPlayer, selectedTokenId, onSelect }) {
  const [activeOwner, setActiveOwner] = useState(
    () => myPlayer ?? OWNERS[0].id,
  );
  if (tokens.length === 0) return null;

  const ownerTokens = tokens.filter((t) => t.owner === activeOwner);

  return (
    <div className="card">
      <p className="unit-name" style={{ marginBottom: 8 }}>
        Roster
      </p>
      <div className="workspace-tabs">
        {OWNERS.map((owner) => (
          <button
            type="button"
            key={owner.id}
            className={`workspace-tab ${activeOwner === owner.id ? 'active' : ''}`}
            onClick={() => setActiveOwner(owner.id)}
          >
            {owner.label}
          </button>
        ))}
      </div>
      {ownerTokens.length === 0 ? (
        <p className="unit-meta">No models yet.</p>
      ) : (
        <div className="tile-palette-list">
          {ownerTokens.map((token) => {
            const unit = units.find(
              (u) => Number(u.id) === Number(token.unitId),
            );
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
                <span
                  style={
                    token.destroyed
                      ? { textDecoration: 'line-through' }
                      : undefined
                  }
                >
                  {unit?.name ?? 'Unknown unit'}
                </span>
                <span className="unit-meta" style={{ marginLeft: 'auto' }}>
                  {statusLabel(token)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RosterList;
