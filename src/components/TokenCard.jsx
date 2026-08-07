import { useState } from 'react';
import {
  groupEquipmentByType,
  parseHeatRating,
  slotForType,
  withTokenLabel,
  isDropPodUnit,
} from '../lib/tokens.js';
import { DICE_COLORS } from '../lib/dice.js';
import HpBoxes from './HpBoxes.jsx';
import UnitCardHeader from './UnitCardHeader.jsx';

function TokenCard({
  token,
  unit,
  equipment,
  moving,
  canControl = true,
  activeRangeIndex,
  onAdjustHp,
  onRotate,
  onSetHeat,
  onSetWeaponHp,
  onToggleBroken,
  onRollHitDice,
  onToggleRange,
  onDestroy,
  onReturnToReserve,
  onDeselect,
  deploymentPhase,
  hasActionDie,
  onArmDropPod,
  hasRepairTag,
  repairTargets = [],
  onRepair,
}) {
  const [confirmingDestroy, setConfirmingDestroy] = useState(false);
  const [pickedDieColor, setPickedDieColor] = useState(null);
  const [repairOpen, setRepairOpen] = useState(false);
  // Arms the destroy button on its first press (turning it red) rather than
  // destroying on one click (#206) — a chassis already at 0 HP is already a
  // wreck, so it skips straight to armed instead of needing that first press.
  const [armed, setArmed] = useState(false);

  if (!unit) return null;

  const equippedItems = token.equippedIds
    .map((id, instanceIndex) => {
      const item = equipment.find((e) => Number(e.id) === Number(id));
      return item ? { ...item, instanceIndex } : null;
    })
    .filter(Boolean);
  const grouped = groupEquipmentByType(equippedItems);
  const weapons = grouped.Weapon ?? [];
  const movementItems = grouped.Movement ?? [];
  const augments = grouped.Augment ?? [];
  // A model at 0 chassis HP is a wreck — it can't move or attack until
  // someone clicks "Model Destroyed" (#160).
  const wrecked = token.currentHp <= 0;
  const destroyArmed = armed || wrecked;
  const availableDiceColors = DICE_COLORS.filter(
    (color) => Number(unit[`dice_${color}`]) > 0,
  );

  function startDestroy() {
    if (availableDiceColors.length === 0) {
      onDestroy(null);
      return;
    }
    setPickedDieColor(availableDiceColors[0]);
    setConfirmingDestroy(true);
  }

  function pressDestroy() {
    if (!destroyArmed) {
      setArmed(true);
      return;
    }
    startDestroy();
  }

  function confirmDestroy() {
    onDestroy(pickedDieColor);
    setConfirmingDestroy(false);
    setPickedDieColor(null);
    setArmed(false);
  }

  function cancelDestroy() {
    setConfirmingDestroy(false);
    setPickedDieColor(null);
    setArmed(false);
  }

  function renderGearRow(item, { showRange }) {
    const { max } = parseHeatRating(item.heat_rating);
    const state = token.weaponState[item.instanceIndex] ?? {
      heat: 0,
      broken: false,
    };
    const rangeActive = showRange && activeRangeIndex === item.instanceIndex;
    const overheated = Boolean(max) && state.heat > max;
    const maxHp = Number(item.hp) || 0;
    const hp = state.hp ?? maxHp;
    return (
      <div
        className={`token-weapon-row ${overheated ? 'overheated' : ''}`}
        key={item.instanceIndex}
      >
        <div>
          {showRange ? (
            <button
              type="button"
              className={`weapon-name-btn ${rangeActive ? 'active' : ''}`}
              style={
                state.broken ? { textDecoration: 'line-through' } : undefined
              }
              title="Show this weapon's range on the board"
              onClick={() => onToggleRange(item.instanceIndex, item.range)}
            >
              {item.name}
            </button>
          ) : (
            <b
              style={
                state.broken ? { textDecoration: 'line-through' } : undefined
              }
            >
              {item.name}
            </b>
          )}
          {overheated && <span className="badge-overheated">OVERHEATED</span>}
          <span className="unit-meta">
            {' '}
            · Slot{' '}
            {showRange && state.side
              ? state.side === 'left'
                ? 'Left'
                : 'Right'
              : slotForType(item.type)}{' '}
            ·{' '}
            {showRange
              ? `Range ${item.range || '—'}`
              : `Move ${item.movement ?? '—'}`}{' '}
            · Heat {item.heat_rating || '—'}
            {showRange && (
              <>
                {' · '}
                {item.hit_dice ? (
                  <button
                    type="button"
                    className="hit-dice-btn"
                    title="Roll this weapon's hit dice and add heat"
                    onClick={() => onRollHitDice(item.instanceIndex, item)}
                  >
                    {item.hit_dice}
                  </button>
                ) : (
                  '—'
                )}
              </>
            )}
          </span>
        </div>
        <div className="token-stat-row">
          <button
            type="button"
            className="ghost"
            onClick={() =>
              onSetHeat(item.instanceIndex, Math.max(0, state.heat - 1))
            }
          >
            −
          </button>
          <span
            style={
              max && state.heat > max
                ? { color: '#dc2626', fontWeight: 700 }
                : max && state.heat === max
                  ? { color: '#f59e0b' }
                  : undefined
            }
          >
            Heat {state.heat}
            {max ? ` / ${max}` : ''}
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => onSetHeat(item.instanceIndex, state.heat + 1)}
          >
            +
          </button>
          <label className="token-broken-toggle">
            <input
              type="checkbox"
              checked={state.broken}
              onChange={() => onToggleBroken(item.instanceIndex)}
            />
            Broken
          </label>
        </div>
        {maxHp > 0 && (
          <>
            <div className="token-stat-row">
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  onSetWeaponHp(item.instanceIndex, Math.max(0, hp - 1))
                }
              >
                −
              </button>
              <span className={hp <= 0 ? 'token-hp-zero' : ''}>
                {`HP ${hp} / ${maxHp}`}
              </span>
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  onSetWeaponHp(item.instanceIndex, Math.min(maxHp, hp + 1))
                }
              >
                +
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => onSetWeaponHp(item.instanceIndex, maxHp)}
              >
                Reset
              </button>
            </div>
            <HpBoxes
              currentHp={hp}
              maxHp={maxHp}
              onSetHp={(target) => onSetWeaponHp(item.instanceIndex, target)}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card token-card">
      <div className="token-card-header">
        <p className="unit-name">
          {withTokenLabel(unit.name, token)}
          {token.destroyed && (
            <span className="badge-destroyed">Destroyed</span>
          )}
        </p>
        <button type="button" className="ghost" onClick={onDeselect}>
          Close
        </button>
      </div>

      <UnitCardHeader unit={unit} token={token} equippedItems={equippedItems} />

      <div className="token-card-section">
        <label>HP</label>
        <div className="token-stat-row">
          <button
            type="button"
            className="ghost"
            onClick={() => onAdjustHp(-1)}
          >
            −
          </button>
          <span
            className={token.currentHp <= 0 ? 'token-hp-zero' : ''}
          >{`${token.currentHp} / ${unit.hp}`}</span>
          <button type="button" className="ghost" onClick={() => onAdjustHp(1)}>
            +
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => onAdjustHp(Number(unit.hp) - token.currentHp)}
          >
            Reset
          </button>
        </div>
        <HpBoxes
          currentHp={token.currentHp}
          maxHp={Number(unit.hp) || 0}
          onSetHp={(target) => onAdjustHp(target - token.currentHp)}
        />
        {!token.destroyed &&
          (confirmingDestroy ? (
            <div className="destroy-dice-picker">
              <p className="unit-meta" style={{ marginBottom: 8 }}>
                Keep which die in this player's pool?
              </p>
              <div className="token-owner-row" style={{ marginBottom: 10 }}>
                {availableDiceColors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={`die-pick-btn ${pickedDieColor === color ? 'selected' : ''}`}
                    onClick={() => setPickedDieColor(color)}
                  >
                    <span className={`die-icon ${color}`} />
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </button>
                ))}
              </div>
              <div className="token-stat-row">
                <button
                  type="button"
                  className="danger"
                  onClick={confirmDestroy}
                >
                  Confirm Destroy
                </button>
                <button type="button" className="ghost" onClick={cancelDestroy}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={destroyArmed ? 'danger' : 'ghost'}
              disabled={!canControl}
              title={
                destroyArmed
                  ? 'Press again to destroy this model'
                  : 'Press to arm — press again to destroy'
              }
              onClick={pressDestroy}
            >
              Model Destroyed
            </button>
          ))}
      </div>

      <div className="token-card-section">
        <label>Facing</label>
        <div className="token-stat-row">
          <button type="button" className="ghost" onClick={() => onRotate(1)}>
            ↻
          </button>
          <span>{token.facing + 1} / 6</span>
          <button type="button" className="ghost" onClick={() => onRotate(-1)}>
            ↺
          </button>
        </div>
      </div>

      {(augments.length > 0 ||
        weapons.length > 0 ||
        movementItems.length > 0) && (
        <div className="token-card-section">
          <label>Equipment</label>
          {augments.length > 0 && (
            <>
              <p className="equipment-subheader">Head</p>
              {augments.map((item) => (
                <div className="token-weapon-row" key={item.instanceIndex}>
                  <b>{item.name}</b>
                  <span className="unit-meta">
                    {' '}
                    · Slot {slotForType(item.type)}
                  </span>
                  {item.effects && (
                    <p className="unit-meta" style={{ marginTop: 2 }}>
                      {item.effects}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
          {weapons.length > 0 && (
            <>
              <p className="equipment-subheader">Weapon</p>
              {weapons.map((weapon) =>
                renderGearRow(weapon, { showRange: true }),
              )}
            </>
          )}
          {movementItems.length > 0 && (
            <>
              <p className="equipment-subheader">Movement</p>
              {movementItems.map((item) =>
                renderGearRow(item, { showRange: false }),
              )}
            </>
          )}
        </div>
      )}

      {hasRepairTag && canControl && !token.destroyed && token.position && (
        <div className="token-card-section">
          <label>Repair</label>
          <button
            type="button"
            className={repairOpen ? '' : 'ghost'}
            disabled={!hasActionDie}
            title={
              hasActionDie
                ? "Roll 2d4 and repair a damaged chassis or weapon — its own or an adjacent ally's"
                : 'Needs an unused Action die'
            }
            onClick={() => setRepairOpen((current) => !current)}
          >
            Repair
          </button>
          {repairOpen &&
            (repairTargets.length === 0 ? (
              <p className="unit-meta" style={{ marginTop: 6 }}>
                Nothing in range needs repairing.
              </p>
            ) : (
              <div
                className="token-stat-row"
                style={{ flexWrap: 'wrap', marginTop: 6 }}
              >
                {repairTargets.map((target) => (
                  <button
                    key={`${target.tokenId}-${target.slot}`}
                    type="button"
                    className="ghost"
                    onClick={() => {
                      onRepair(target.tokenId, target.slot);
                      setRepairOpen(false);
                    }}
                  >
                    {target.label}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}

      {!token.destroyed && !token.position && isDropPodUnit(unit) ? (
        <div className="token-card-section">
          {!canControl && (
            <p className="unit-meta">
              This unit belongs to another player — you can't deploy it.
            </p>
          )}
          {canControl && deploymentPhase && (
            <p className="unit-meta">
              Drop pods are deployed during the game, not now — bring it in
              later with an unused Action die.
            </p>
          )}
          {canControl && !deploymentPhase && (
            <button
              type="button"
              className={moving ? '' : 'ghost'}
              disabled={!hasActionDie}
              title={
                hasActionDie
                  ? 'Aim it at a hex, then roll its deviation'
                  : 'Needs an unused Action die'
              }
              onClick={onArmDropPod}
            >
              {moving ? 'Click a hex to aim' : 'Drop Pod'}
            </button>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="ghost"
        disabled={!canControl}
        onClick={onReturnToReserve}
      >
        Return to reserve
      </button>
    </div>
  );
}

export default TokenCard;
