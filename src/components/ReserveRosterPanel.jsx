import { useState } from 'react';
import { OWNERS, ownerColor } from '../lib/tokens.js';

function statusLabel(token) {
  if (token.destroyed) return 'Destroyed';
  if (token.position) return 'Deployed';
  return 'Reserve';
}

function ReserveGroup({
  owner,
  tokens,
  units,
  selectedTokenId,
  canControl,
  onSelect,
  onDeploy,
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
          const draggable = canControl(token);
          return (
            <div className="tile-swatch-row" key={token.id}>
              <button
                type="button"
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
              {/* Selects, arms the move, and jumps straight to the Board tab
                  (#142) — previously deploying on mobile meant selecting here
                  then guessing you had to switch tabs yourself to place it. */}
              {draggable && (
                <button
                  type="button"
                  className="reserve-deploy-btn"
                  onClick={() => onDeploy(token.id)}
                >
                  Deploy to board
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Reserve (not-yet-deployed units, draggable onto the board) and Roster (the
// full deployed/reserve/destroyed list for a chosen player) used to be two
// separate always-open cards; #116 combines them into one card with a tab
// for each section, collapsible as a single unit.
function ReserveRosterPanel({
  reserveTokens,
  allTokens,
  units,
  myPlayer,
  selectedTokenId,
  canControl,
  onSelect,
  onDeploy,
}) {
  const [tab, setTab] = useState('reserve');
  const [collapsed, setCollapsed] = useState(false);
  const [activeOwner, setActiveOwner] = useState(
    () => myPlayer ?? OWNERS[0].id,
  );

  if (reserveTokens.length === 0 && allTokens.length === 0) return null;

  const ownerTokens = allTokens.filter((t) => t.owner === activeOwner);

  return (
    <div className="card">
      <div className="reserve-header">
        <div className="workspace-tabs">
          <button
            type="button"
            className={`workspace-tab ${tab === 'reserve' ? 'active' : ''}`}
            onClick={() => setTab('reserve')}
          >
            Reserve ({reserveTokens.length})
          </button>
          <button
            type="button"
            className={`workspace-tab ${tab === 'roster' ? 'active' : ''}`}
            onClick={() => setTab('roster')}
          >
            Roster
          </button>
        </div>
        <button
          type="button"
          className="ghost"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed && tab === 'reserve' && (
        <>
          {reserveTokens.length === 0 ? (
            <p className="unit-meta">No reserve units.</p>
          ) : (
            <>
              <p className="unit-meta" style={{ marginBottom: 8 }}>
                Not yet deployed. Select one and place it, or drag it onto the
                board.
              </p>
              {OWNERS.map((owner) => (
                <ReserveGroup
                  key={owner.id}
                  owner={owner}
                  tokens={reserveTokens.filter((t) => t.owner === owner.id)}
                  units={units}
                  selectedTokenId={selectedTokenId}
                  canControl={canControl}
                  onSelect={onSelect}
                  onDeploy={onDeploy}
                />
              ))}
            </>
          )}
        </>
      )}

      {!collapsed && tab === 'roster' && (
        <>
          <div className="workspace-tabs" style={{ marginTop: 8 }}>
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
        </>
      )}
    </div>
  );
}

export default ReserveRosterPanel;
