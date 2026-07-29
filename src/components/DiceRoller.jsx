import { forwardRef, useImperativeHandle, useState } from 'react';
import { makeKey, useSyncedTransientState } from '../lib/storage.js';
import {
  DIE_TYPES,
  DICE_COLORS,
  WORD_ORDER,
  rollDie,
  summarizeRollResults,
  isWordDie,
} from '../lib/dice.js';

// Colored action dice vs numerical hit dice, shown as two side-by-side
// columns rather than one flat list (#139).
const actionDieTypes = DIE_TYPES.filter((die) => die.faces);
const hitDieTypes = DIE_TYPES.filter((die) => !die.faces);

const DiceRoller = forwardRef(function DiceRoller(
  {
    onRoll,
    actionPool,
    onRollToActionPool,
    onUseActionPoolDie,
    onExchangeActionDice,
    activeOwnerDice,
    canRoll = true,
    turn,
  },
  ref,
) {
  const [pool, setPool] = useState({});
  // Gates Roll Action Pool to once per active-player turn segment (#140) —
  // derived from `turn` rather than a separate reset effect, since it
  // naturally changes every time endTurn() advances the active player.
  const [rolledActionPoolTurnKey, setRolledActionPoolTurnKey] = useState(null);
  const turnKey = turn ? `${turn.active}:${turn.number}` : null;
  const usedActionPoolThisTurn =
    turnKey !== null && rolledActionPoolTurnKey === turnKey;
  // Mirrored to the other player over the multiplayer data channel (#119) —
  // without this, only the log's text summary of a roll reached the peer,
  // not the actual dice roller display.
  const [results, setResults] = useSyncedTransientState(
    'dropshipsimulator:battle:diceResults',
    null,
  );
  const [selectedAction, setSelectedAction] = useState(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [spendId, setSpendId] = useState('');
  const [targetId, setTargetId] = useState('');

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

  function performRoll(sourcePool) {
    const rolled = [];
    DIE_TYPES.forEach((die) => {
      const count = sourcePool[die.id] ?? 0;
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

  function roll() {
    performRoll(pool);
  }

  function clearPool() {
    setPool({});
    setResults(null);
  }

  // Adds the player's own action dice to the pool and rolls them immediately
  // (#140) — replaces the old two-click "Add Action Pool" then "Roll" flow.
  // Limited to once per turn since it's meant to represent that turn's single
  // Action Pool roll, not a repeatable way to reroll it.
  function rollActionPool() {
    const merged = { ...pool };
    DICE_COLORS.forEach((color) => {
      merged[color] = (merged[color] ?? 0) + (activeOwnerDice?.[color] ?? 0);
    });
    setPool(merged);
    performRoll(merged);
    setRolledActionPoolTurnKey(turnKey);
  }

  const playerDiceTotal = DICE_COLORS.reduce(
    (sum, color) => sum + (activeOwnerDice?.[color] ?? 0),
    0,
  );

  // Counts of each action still unused in the pool (#120) — the player picks
  // an action type here rather than a specific die, and "Use Dice" spends
  // whichever pooled die of that type comes first.
  const actionCounts = WORD_ORDER.map((value) => ({
    value,
    count: actionPool.filter((d) => !d.used && d.value === value).length,
  }));

  function useSelectedAction() {
    if (!selectedAction) return;
    const match = actionPool.find((d) => !d.used && d.value === selectedAction);
    if (match) onUseActionPoolDie(match.id);
    setSelectedAction(null);
  }

  // Only unused colored (action) dice can take part in an Exchange (#134) —
  // spending one re-rolls a different one's outcome.
  const unusedActionDice = actionPool.filter((d) => !d.used);

  function toggleExchange() {
    if (exchangeOpen) {
      setExchangeOpen(false);
      return;
    }
    setSpendId(unusedActionDice[0]?.id ?? '');
    setTargetId(unusedActionDice[1]?.id ?? '');
    setExchangeOpen(true);
  }

  function confirmExchange() {
    const targetDie = actionPool.find((d) => d.id === targetId);
    if (!targetDie) return;
    const dieType = DIE_TYPES.find((dt) => dt.label === targetDie.label);
    const newValue = dieType ? rollDie(dieType) : targetDie.value;
    onExchangeActionDice(spendId, targetId, newValue);
    setExchangeOpen(false);
    setSpendId('');
    setTargetId('');
  }

  const poolTotal = Object.values(pool).reduce((sum, n) => sum + n, 0);

  return (
    <div className="card">
      <p className="unit-name">Dice roller</p>
      {!canRoll && (
        <p className="unit-meta">Wait for your turn to roll dice.</p>
      )}
      <div className="dice-split-columns">
        <div className="dice-split-col">
          <p className="dice-split-col-title">Action Dice</p>
          <div className="dice-pool-grid">
            {actionDieTypes.map((die) => (
              <div className="dice-pool-row" key={die.id}>
                <span className={`dice-pool-label dice-pool-label-${die.id}`}>
                  {die.label}
                </span>
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Remove ${die.label} from pool`}
                  disabled={!pool[die.id] || !canRoll}
                  onClick={() => adjust(die.id, -1)}
                >
                  −
                </button>
                <span className="dice-pool-count">{pool[die.id] ?? 0}</span>
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Add ${die.label} to pool`}
                  disabled={!canRoll}
                  onClick={() => adjust(die.id, 1)}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="dice-split-divider" />
        <div className="dice-split-col">
          <p className="dice-split-col-title">Hit Dice</p>
          <div className="dice-pool-grid">
            {hitDieTypes.map((die) => (
              <div className="dice-pool-row" key={die.id}>
                <span className={`dice-pool-label dice-pool-label-${die.id}`}>
                  {die.label}
                </span>
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Remove ${die.label} from pool`}
                  disabled={!pool[die.id] || !canRoll}
                  onClick={() => adjust(die.id, -1)}
                >
                  −
                </button>
                <span className="dice-pool-count">{pool[die.id] ?? 0}</span>
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Add ${die.label} to pool`}
                  disabled={!canRoll}
                  onClick={() => adjust(die.id, 1)}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="token-owner-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          disabled={poolTotal === 0 || !canRoll}
          onClick={roll}
        >
          Roll{poolTotal > 0 ? ` (${poolTotal})` : ''}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={playerDiceTotal === 0 || !canRoll || usedActionPoolThisTurn}
          onClick={rollActionPool}
        >
          Roll Action Pool
        </button>
        <button
          type="button"
          className="ghost"
          disabled={(poolTotal === 0 && !results) || !canRoll}
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
          <div className="dice-summary">
            {actionCounts.map(({ value, count }) => (
              <button
                type="button"
                key={value}
                className={`dice-summary-chip pooled ${value === selectedAction ? 'selected' : ''}`}
                disabled={count === 0 || !canRoll}
                onClick={() =>
                  setSelectedAction((current) =>
                    current === value ? null : value,
                  )
                }
              >
                {count} {value}
              </button>
            ))}
          </div>
          {selectedAction && (
            <div className="token-owner-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                disabled={!canRoll}
                onClick={useSelectedAction}
              >
                Use Dice
              </button>
            </div>
          )}
          <div className="token-owner-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="ghost"
              disabled={unusedActionDice.length < 2 || !canRoll}
              onClick={toggleExchange}
            >
              Exchange
            </button>
          </div>
          {exchangeOpen && (
            <div className="dice-exchange-panel">
              <label className="field">
                Spend
                <select
                  value={spendId}
                  onChange={(e) => setSpendId(e.target.value)}
                >
                  {unusedActionDice.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}: {d.value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Change
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  {unusedActionDice.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}: {d.value}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!spendId || !targetId || spendId === targetId}
                onClick={confirmExchange}
              >
                Exchange
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default DiceRoller;
