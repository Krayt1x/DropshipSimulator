import { useState } from 'react';
import { makeKey } from '../lib/storage.js';
import {
  DIE_TYPES,
  rollDie,
  summarizeRollResults,
  isWordDie,
} from '../lib/dice.js';

function DiceRoller({ onRoll, usedDice, onUseDie }) {
  const [pool, setPool] = useState({});
  const [results, setResults] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

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
        rolled.push({
          id: makeKey('die'),
          label: die.label,
          value: rollDie(die),
        });
      }
    });
    if (rolled.length === 0) return;
    setResults(rolled);
    setSelectedId(null);
    onRoll(rolled);
  }

  function clearPool() {
    setPool({});
    setResults(null);
    setSelectedId(null);
  }

  function useSelectedDie() {
    const die = results?.find((r) => r.id === selectedId);
    if (!die) return;
    setResults((current) => current.filter((r) => r.id !== selectedId));
    setSelectedId(null);
    onUseDie(die);
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
      {results &&
        results.length > 0 &&
        (() => {
          const { words, numbers } = summarizeRollResults(results);
          return (
            <>
              <div className="dice-results">
                {results.map((r) => {
                  const usable = isWordDie(r.label);
                  return (
                    <button
                      type="button"
                      key={r.id}
                      disabled={!usable}
                      className={`dice-result-chip ${r.id === selectedId ? 'selected' : ''}`}
                      onClick={() =>
                        setSelectedId((current) =>
                          current === r.id ? null : r.id,
                        )
                      }
                    >
                      {r.label}: {r.value}
                    </button>
                  );
                })}
              </div>
              <div className="token-owner-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  disabled={!selectedId}
                  onClick={useSelectedDie}
                >
                  Use Dice
                </button>
              </div>
              {(words.length > 0 || numbers.length > 0) && (
                <div className="dice-summary">
                  {words.map(([value, count]) => (
                    <span className="dice-summary-chip" key={value}>
                      {count} {value}
                    </span>
                  ))}
                  {numbers.map(([value, count]) => (
                    <span className="dice-summary-chip" key={value}>
                      {count} x {value}&apos;s
                    </span>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      {usedDice.length > 0 && (
        <div className="dice-used-section">
          <p className="unit-meta" style={{ marginBottom: 6 }}>
            Dice used this turn
          </p>
          <div className="dice-results">
            {usedDice.map((r) => (
              <span className="dice-result-chip used" key={r.id}>
                {r.label}: {r.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DiceRoller;
