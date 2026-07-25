import { useEffect, useState } from 'react';
import { parseRosterExport } from '../lib/rosterImport.js';
import { OWNERS } from '../lib/tokens.js';

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
              {ownerOptions.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  className={`token-owner-btn ${owner === o.id ? 'selected' : ''}`}
                  style={{ borderColor: o.color }}
                  onClick={() => setOwner(o.id)}
                >
                  <span
                    className="tile-swatch"
                    style={{ background: o.color }}
                  />
                  {o.label}
                </button>
              ))}
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
