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
  onArmMove,
  onSetHeat,
  onSetWeaponHp,
  onToggleBroken,
  onRollHitDice,
  onToggleRange,
  onStartAttack,
  activeAttackIndex,
  onDestroy,
  onReturnToReserve,
  onDeselect,
  deploymentPhase,
  hasActionDie,
  onArmDropPod,
  hasMoveDie,
  hasAttackDie,
}) {
  const [confirmingDestroy, setConfirmingDestroy] = useState(false);
  const [pickedDieColor, setPickedDieColor] = useState(null);

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
  // Mirrors weapons' broken/overheated gate on Attack (#127) — a model can't
  // move on legs that are broken or too hot to use (#153).
  const movementBlocked = movementItems.some((item) => {
    const { max } = parseHeatRating(item.heat_rating);
    const state = token.weaponState[item.instanceIndex] ?? {
      heat: 0,
      broken: false,
    };
    return state.broken || (Boolean(max) && state.heat > max);
  });
  // A model at 0 chassis HP is a wreck — it can't move or attack until
  // someone clicks "Model Destroyed" (#160).
  const wrecked = token.currentHp <= 0;
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

  function confirmDestroy() {
    onDestroy(pickedDieColor);
    setConfirmingDestroy(false);
    setPickedDieColor(null);
  }

  function cancelDestroy() {
    setConfirmingDestroy(false);
    setPickedDieColor(null);
  }

  function renderGearRow(item, { showRange, showMoveButton }) {
    const { max } = parseHeatRating(item.heat_rating);
    const state = token.weaponState[item.instanceIndex] ?? {
      heat: 0,
      broken: false,
    };
    const rangeActive = showRange && activeRangeIndex === item.instanceIndex;
    const attackActive = showRange && activeAttackIndex === item.instanceIndex;
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
          {showRange && item.hit_dice && (
            <button
              type="button"
              className={`attack-btn ${attackActive ? 'active' : ''}`}
              style={{ marginLeft: 'auto' }}
              title={
                wrecked
                  ? 'Destroyed — this model can no longer attack'
                  : overheated
                    ? 'Overheated — let it cool down before firing again'
                    : !hasAttackDie
                      ? 'No Attack dice left in the action pool'
                      : "Show this weapon's arc and pick a target to attack"
              }
              disabled={
                state.broken || overheated || wrecked || !hasAttackDie
              }
              onClick={() => onStartAttack(item.instanceIndex, item)}
            >
              {attackActive ? 'Attacking…' : 'Attack'}
            </button>
          )}
          {!token.destroyed && showMoveButton && (
            <button
              type="button"
              className={`move-action-btn ${moving ? 'active' : ''}`}
              style={{ marginLeft: 'auto' }}
              disabled={
                !canControl ||
                movementBlocked ||
                wrecked ||
                (token.position && !hasMoveDie)
              }
              title={
                !canControl
                  ? "This unit belongs to another player — you can't move or deploy it."
                  : wrecked
                    ? 'Destroyed — this model can no longer move'
                    : movementBlocked
                      ? 'Overheated — let it cool down before moving again'
                      : token.position && !hasMoveDie
                        ? 'No Move dice left in the action pool'
                        : undefined
              }
              onClick={onArmMove}
            >
              {moving
                ? 'Click a hex to place'
                : token.position
                  ? 'Move'
                  : 'Place on board'}
            </button>
          )}
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
      </div>

      <div className="token-card-section">
        <label>Facing</label>
        <div className="token-stat-row">
          <button type="button" className="ghost" onClick={() => onRotate(-1)}>
            ↺
          </button>
          <span>{token.facing + 1} / 6</span>
          <button type="button" className="ghost" onClick={() => onRotate(1)}>
            ↻
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
              {movementItems.map((item, index) =>
                renderGearRow(item, {
                  showRange: false,
                  showMoveButton: index === 0,
                }),
              )}
            </>
          )}
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
      ) : (
        // A unit with movement gear gets its Move button inline in that
        // gear's row instead (#166); this fallback only covers a unit with
        // no movement equipment at all (still needs somewhere to deploy).
        !token.destroyed &&
        movementItems.length === 0 && (
          <div className="token-card-section">
            {!canControl && (
              <p className="unit-meta">
                This unit belongs to another player — you can't move or
                deploy it.
              </p>
            )}
            {wrecked && (
              <p className="unit-meta">
                Destroyed — this model can no longer move.
              </p>
            )}
            <button
              type="button"
              className={moving ? '' : 'ghost'}
              disabled={
                !canControl || wrecked || (token.position && !hasMoveDie)
              }
              title={
                wrecked
                  ? 'Destroyed — this model can no longer move'
                  : token.position && !hasMoveDie
                    ? 'No Move dice left in the action pool'
                    : undefined
              }
              onClick={onArmMove}
            >
              {moving
                ? 'Click a hex to place'
                : token.position
                  ? 'Move'
                  : 'Place on board'}
            </button>
          </div>
        )
      )}

      {token.destroyed ? (
        <button
          type="button"
          className="ghost"
          disabled={!canControl}
          onClick={onReturnToReserve}
        >
          Return to reserve
        </button>
      ) : confirmingDestroy ? (
        <div className="token-card-section destroy-dice-picker">
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
            <button type="button" className="danger" onClick={confirmDestroy}>
              Confirm Destroy
            </button>
            <button type="button" className="ghost" onClick={cancelDestroy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="token-stat-row">
          <button
            type="button"
            className="danger"
            disabled={!canControl}
            onClick={startDestroy}
          >
            Model Destroyed
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!canControl}
            onClick={onReturnToReserve}
          >
            Return to reserve
          </button>
        </div>
      )}
    </div>
  );
}

export default TokenCard;
