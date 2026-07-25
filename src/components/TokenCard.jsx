import { useState } from 'react';
import { groupEquipmentByType, parseHeatRating } from '../lib/tokens.js';
import HpBoxes from './HpBoxes.jsx';
import UnitCardHeader from './UnitCardHeader.jsx';

const HP_BOX_VARIANTS = [
  { id: 'pips', label: 'Pips' },
  { id: 'chunky', label: 'Chunky' },
  { id: 'numbered', label: 'Numbered' },
];

const CARD_STYLES = [
  { id: 'compact', label: 'Compact' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'minimal', label: 'Minimal' },
];

function TokenCard({
  token,
  unit,
  equipment,
  moving,
  canControl = true,
  onAdjustHp,
  onRotate,
  onArmMove,
  onSetHeat,
  onToggleBroken,
  onDestroy,
  onReturnToReserve,
  onDeselect,
}) {
  const [hpBoxVariant, setHpBoxVariant] = useState('pips');
  const [cardStyle, setCardStyle] = useState('compact');
  if (!unit) return null;

  const equippedItems = token.equippedIds
    .map((id) => equipment.find((e) => Number(e.id) === Number(id)))
    .filter(Boolean);
  const grouped = groupEquipmentByType(equippedItems);
  const weapons = grouped.Weapon ?? [];
  const augments = grouped.Augment ?? [];

  return (
    <div className="card token-card">
      <div className="token-card-header">
        <p className="unit-name">
          {unit.name}
          {token.destroyed && <span className="badge-destroyed">Destroyed</span>}
        </p>
        <button type="button" className="ghost" onClick={onDeselect}>
          Close
        </button>
      </div>

      <div className="card-style-row">
        {CARD_STYLES.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`workspace-tab ${cardStyle === s.id ? 'active' : ''}`}
            onClick={() => setCardStyle(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <UnitCardHeader
        variant={cardStyle}
        unit={unit}
        token={token}
        equippedItems={equippedItems}
      />

      <div className="token-card-section">
        <label>HP</label>
        <div className="token-stat-row">
          <button type="button" className="ghost" onClick={() => onAdjustHp(-1)}>
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
        <div className="hp-box-variant-row">
          {HP_BOX_VARIANTS.map((v) => (
            <button
              type="button"
              key={v.id}
              className={`workspace-tab ${hpBoxVariant === v.id ? 'active' : ''}`}
              onClick={() => setHpBoxVariant(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <HpBoxes
          currentHp={token.currentHp}
          maxHp={Number(unit.hp) || 0}
          variant={hpBoxVariant}
          onSetHp={(target) => onAdjustHp(target - token.currentHp)}
        />
      </div>

      <div className="token-card-section">
        <label>Facing</label>
        <div className="token-stat-row">
          <button type="button" className="ghost" onClick={() => onRotate(-1)}>
            ↺
          </button>
          <span>{token.facing} / 6</span>
          <button type="button" className="ghost" onClick={() => onRotate(1)}>
            ↻
          </button>
        </div>
      </div>

      {!token.destroyed && (
        <div className="token-card-section">
          {!canControl && (
            <p className="unit-meta">
              This unit belongs to another player — you can't move or deploy
              it.
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
            const state = token.weaponState[weapon.id] ?? {
              heat: 0,
              broken: false,
            };
            return (
              <div className="token-weapon-row" key={weapon.id}>
                <div>
                  <b>{weapon.name}</b>
                  <span className="unit-meta">
                    {' '}
                    · Range {weapon.range || '—'} · Heat {weapon.heat_rating || '—'} ·{' '}
                    {weapon.hit_dice || '—'}
                  </span>
                </div>
                <div className="token-stat-row">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      onSetHeat(weapon.id, Math.max(0, state.heat - 1))
                    }
                  >
                    −
                  </button>
                  <span>
                    Heat {state.heat}
                    {max ? ` / ${max}` : ''}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => onSetHeat(weapon.id, state.heat + 1)}
                  >
                    +
                  </button>
                  <label className="token-broken-toggle">
                    <input
                      type="checkbox"
                      checked={state.broken}
                      onChange={() => onToggleBroken(weapon.id)}
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
            <p key={item.id} className="unit-meta">
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
      ) : (
        <div className="token-stat-row">
          <button
            type="button"
            className="danger"
            disabled={!canControl}
            onClick={onDestroy}
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
