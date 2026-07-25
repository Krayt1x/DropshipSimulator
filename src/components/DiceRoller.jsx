import { useState } from 'react';
import { DIE_TYPES, rollDie } from '../lib/dice.js';

function DiceRoller({ onRoll }) {
  const [pool, setPool] = useState({});
  const [results, setResults] = useState(null);

  function adjust(id, delta) {
    setPool((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] ?? 0) + delta),
    }));
  }

  function roll() {
    const rolled = [];
    DIE_TYPES.forEach((die) => {
      const count = pool[die.id] ?? 0;
      for (let i = 0; i < count; i++) {
        rolled.push({ label: die.label, value: rollDie(die) });
      }
    });
    if (rolled.length === 0) return;
    setResults(rolled);
    onRoll(rolled);
  }

  function clearPool() {
    setPool({});
    setResults(null);
  }

  const poolTotal = Object.values(pool).reduce((sum, n) => sum + n, 0);

  return (
    <div className="card">
      <p className="unit-name">Dice roller</p>
      <div className="dice-pool-grid">
        {DIE_TYPES.map((die) => (
          <div className="dice-pool-row" key={die.id}>
            <span className={`dice-pool-label dice-pool-label-${die.id}`}>
              {die.label}
            </span>
            <button
              type="button"
              className="ghost"
              aria-label={`Remove ${die.label} from pool`}
              disabled={!pool[die.id]}
              onClick={() => adjust(die.id, -1)}
            >
              −
            </button>
            <span className="dice-pool-count">{pool[die.id] ?? 0}</span>
            <button
              type="button"
              className="ghost"
              aria-label={`Add ${die.label} to pool`}
              onClick={() => adjust(die.id, 1)}
            >
              +
            </button>
          </div>
        ))}
      </div>
      <div className="token-owner-row" style={{ marginTop: 10 }}>
        <button type="button" disabled={poolTotal === 0} onClick={roll}>
          Roll{poolTotal > 0 ? ` (${poolTotal})` : ''}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={poolTotal === 0 && !results}
          onClick={clearPool}
        >
          Clear
        </button>
      </div>
      {results && (
        <div className="dice-results">
          {results.map((r, i) => (
            <span className="dice-result-chip" key={i}>
              {r.label}: {r.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default DiceRoller;
