import { useState } from 'react';
import { groupEquipmentByType, parseHeatRating } from '../lib/tokens.js';
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
  onToggleBroken,
  onToggleRange,
  onDestroy,
  onReturnToReserve,
  onDeselect,
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
  const augments = grouped.Augment ?? [];
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

  return (
    <div className="card token-card">
      <div className="token-card-header">
        <p className="unit-name">
          {unit.name}
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

      {!token.destroyed && (
        <div className="token-card-section">
          {!canControl && (
            <p className="unit-meta">
              This unit belongs to another player — you can't move or deploy it.
            </p>
          )}
          <button
            type="button"
            className={moving ? '' : 'ghost'}
            disabled={!canControl}
            onClick={onArmMove}
          >
            {moving
              ? 'Click a hex to place'
              : token.position
                ? 'Move token'
                : 'Place on board'}
          </button>
        </div>
      )}

      {weapons.length > 0 && (
        <div className="token-card-section">
          <label>Weapons</label>
          {weapons.map((weapon) => {
            const { max } = parseHeatRating(weapon.heat_rating);
            const state = token.weaponState[weapon.instanceIndex] ?? {
              heat: 0,
              broken: false,
            };
            const rangeActive = activeRangeIndex === weapon.instanceIndex;
            return (
              <div className="token-weapon-row" key={weapon.instanceIndex}>
                <div>
                  <button
                    type="button"
                    className={`weapon-name-btn ${rangeActive ? 'active' : ''}`}
                    title="Show this weapon's range on the board"
                    onClick={() =>
                      onToggleRange(weapon.instanceIndex, weapon.range)
                    }
                  >
                    {weapon.name}
                  </button>
                  <span className="unit-meta">
                    {' '}
                    · Range {weapon.range || '—'} · Heat{' '}
                    {weapon.heat_rating || '—'} · {weapon.hit_dice || '—'}
                  </span>
                </div>
                <div className="token-stat-row">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      onSetHeat(
                        weapon.instanceIndex,
                        Math.max(0, state.heat - 1),
                      )
                    }
                  >
                    −
                  </button>
                  <span
                    style={
                      max && state.heat > max
                        ? { color: '#dc2626', fontWeight: 700 }
                        : undefined
                    }
                  >
                    Heat {state.heat}
                    {max ? ` / ${max}` : ''}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      onSetHeat(weapon.instanceIndex, state.heat + 1)
                    }
                  >
                    +
                  </button>
                  <label className="token-broken-toggle">
                    <input
                      type="checkbox"
                      checked={state.broken}
                      onChange={() => onToggleBroken(weapon.instanceIndex)}
                    />
                    Broken
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {augments.length > 0 && (
        <div className="token-card-section">
          <label>Augments</label>
          {augments.map((item) => (
            <p key={item.instanceIndex} className="unit-meta">
              <b>{item.name}</b>
              {item.effects ? `: ${item.effects}` : ''}
            </p>
          ))}
        </div>
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
