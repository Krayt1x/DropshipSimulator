import { forwardRef, useImperativeHandle, useState } from 'react';
import { makeKey } from '../lib/storage.js';
import {
  DIE_TYPES,
  rollDie,
  summarizeRollResults,
  isWordDie,
} from '../lib/dice.js';

const DiceRoller = forwardRef(function DiceRoller(
  {
    onRoll,
    actionPool,
    onRollToActionPool,
    onUseActionPoolDie,
    activeOwnerDice,
  },
  ref,
) {
  const [pool, setPool] = useState({});
  const [results, setResults] = useState(null);
  const [selectedPoolId, setSelectedPoolId] = useState(null);

  function adjust(id, delta) {
    setPool((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] ?? 0) + delta),
    }));
  }

  useImperativeHandle(ref, () => ({
    addDice(dieId, count) {
      setPool((current) => ({
        ...current,
        [dieId]: (current[dieId] ?? 0) + count,
      }));
    },
  }));

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
    onRoll(rolled);
    const colored = rolled.filter((r) => isWordDie(r.label));
    if (colored.length > 0) onRollToActionPool(colored);
  }

  function clearPool() {
    setPool({});
    setResults(null);
  }

  function addPlayerDiceToPool() {
    setPool((current) => ({
      ...current,
      blue: (current.blue ?? 0) + (activeOwnerDice?.blue ?? 0),
      red: (current.red ?? 0) + (activeOwnerDice?.red ?? 0),
    }));
  }

  const playerDiceTotal =
    (activeOwnerDice?.blue ?? 0) + (activeOwnerDice?.red ?? 0);

  function useSelectedPoolDie() {
    if (!selectedPoolId) return;
    onUseActionPoolDie(selectedPoolId);
    setSelectedPoolId(null);
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
          disabled={playerDiceTotal === 0}
          onClick={addPlayerDiceToPool}
        >
          Add Action Pool
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
          const groups = DIE_TYPES.map((die) => ({
            die,
            rolls: results.filter((r) => r.label === die.label),
          })).filter((group) => group.rolls.length > 0);
          return (
            <>
              {groups.map(({ die, rolls }) => (
                <div key={die.id}>
                  <p className="equipment-subheader">{die.label}</p>
                  <div className="dice-results">
                    {rolls.map((r) => (
                      <span className="dice-result-chip" key={r.id}>
                        {r.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
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
      {actionPool.length > 0 && (
        <div className="dice-action-pool">
          <p className="unit-meta" style={{ marginBottom: 6 }}>
            Action Pool
          </p>
          <div className="dice-results">
            {actionPool.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`dice-result-chip pooled ${r.used ? 'spent' : ''} ${r.id === selectedPoolId ? 'selected' : ''}`}
                onClick={() =>
                  setSelectedPoolId((current) =>
                    current === r.id ? null : r.id,
                  )
                }
              >
                {r.label}: {r.value}
              </button>
            ))}
          </div>
          {selectedPoolId && (
            <div className="token-owner-row" style={{ marginTop: 8 }}>
              <button type="button" onClick={useSelectedPoolDie}>
                Use Dice
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default DiceRoller;
