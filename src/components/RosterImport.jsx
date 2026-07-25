import { useEffect, useState } from 'react';
import { parseRosterExport } from '../lib/rosterImport.js';
import { OWNERS } from '../lib/tokens.js';

const DEFAULT_ROSTERS = [
  {
    name: 'Default A Corp List',
    text: [
      'Default A Corp List (Corp A)',
      'Weight: 99t / 100t',
      '',
      'A30 - 41t',
      '  Head: Synchronized Firing Pattern',
      '  Left: Artillery',
      '  Right: Artillery',
      '  Movement: Quad Legs',
      '',
      'A10 - 14t',
      '  Left: Flame Thrower',
      '  Right: Light Assault',
      '  Movement: Chicken Legs',
      '',
      'A10 - 14t',
      '  Left: Light Assault',
      '  Right: Flame Thrower',
      '  Movement: Chicken Legs',
      '',
      'A20 - 26t',
      '  Head: Weapon Slot Recalibration',
      '  Left: Light Assault',
      '  Right: Long Range Bolt',
      '  Movement: Legs',
      '',
      'Delivery Capsule - 2t',
      '',
      'Delivery Capsule - 2t',
    ].join('\n'),
  },
];

function RosterImport({ manufacturers, units, equipment, onImport, myPlayer }) {
  const [text, setText] = useState('');
  const [owner, setOwner] = useState(myPlayer ?? OWNERS[0].id);
  const [result, setResult] = useState(null);
  const ownerOptions = myPlayer
    ? OWNERS.filter((o) => o.id === myPlayer)
    : OWNERS;

  useEffect(() => {
    if (myPlayer) setOwner(myPlayer);
  }, [myPlayer]);

  function parse() {
    setResult(parseRosterExport(text, { manufacturers, units, equipment }));
  }

  function loadDefaultRoster(rosterText) {
    setText(rosterText);
    setResult(
      parseRosterExport(rosterText, { manufacturers, units, equipment }),
    );
  }

  function importRoster() {
    if (!result || result.entries.length === 0) return;
    onImport({ entries: result.entries, owner });
    setText('');
    setResult(null);
  }

  return (
    <div className="card token-form">
      <p className="unit-name">Import roster</p>
      <p className="unit-meta">
        Paste the text from DropshipBuilder's "Share" button on the list builder
        page.
      </p>

      <div className="field">
        <label>Default rosters</label>
        <div className="token-owner-row">
          {DEFAULT_ROSTERS.map((roster) => (
            <button
              type="button"
              className="ghost"
              key={roster.name}
              onClick={() => loadDefaultRoster(roster.text)}
            >
              {roster.name}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="roster-import-text">Roster export</label>
        <textarea
          id="roster-import-text"
          rows={8}
          placeholder="Paste your exported list here"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
        />
      </div>

      <button
        type="button"
        className="ghost"
        disabled={!text.trim()}
        onClick={parse}
      >
        Preview import
      </button>

      {result && (
        <div className="token-card-section">
          {result.entries.length > 0 && (
            <>
              <label>
                {result.listName} ({result.manufacturer}) —{' '}
                {result.entries.length} unit
                {result.entries.length === 1 ? '' : 's'}
              </label>
              <ul className="roster-import-preview">
                {result.entries.map((entry, i) => (
                  <li key={`${entry.unit.id}-${i}`}>
                    {entry.unit.name}
                    {entry.equippedIds.length > 0
                      ? ` (${entry.equippedIds.length} item${entry.equippedIds.length === 1 ? '' : 's'})`
                      : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.warnings.length > 0 && (
            <div className="roster-import-warnings">
              {result.warnings.map((warning, i) => (
                <p key={i} className="unit-meta">
                  ⚠️ {warning}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {result && result.entries.length > 0 && (
        <>
          <div className="field">
            <label>Owner</label>
            {myPlayer && (
              <p className="unit-meta">
                You can only import units for yourself.
              </p>
            )}
            <div className="token-owner-row">
              {ownerOptions.map((o) => {
                const selected = owner === o.id;
                return (
                  <button
                    type="button"
                    key={o.id}
                    className={`token-owner-btn ${selected ? 'selected' : ''}`}
                    style={{
                      borderColor: o.color,
                      background: selected ? o.color : undefined,
                    }}
                    onClick={() => setOwner(o.id)}
                  >
                    <span
                      className="tile-swatch"
                      style={{ background: o.color }}
                    />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={importRoster}>
            Import {result.entries.length} unit
            {result.entries.length === 1 ? '' : 's'} to reserve
          </button>
        </>
      )}
    </div>
  );
}

export default RosterImport;
