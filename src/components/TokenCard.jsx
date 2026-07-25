import { groupEquipmentByType, parseHeatRating } from '../lib/tokens.js';

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
  onRemove,
  onDeselect,
}) {
  if (!unit) return null;

  const equippedItems = token.equippedIds
    .map((id) => equipment.find((e) => Number(e.id) === Number(id)))
    .filter(Boolean);
  const grouped = groupEquipmentByType(equippedItems);
  const weapons = grouped.Weapon ?? [];
  const augments = grouped.Augment ?? [];
  const movementItem = (grouped.Movement ?? [])[0];

  return (
    <div className="card token-card">
      <div className="token-card-header">
        <p className="unit-name">{unit.name}</p>
        <button type="button" className="ghost" onClick={onDeselect}>
          Close
        </button>
      </div>
      <p className="unit-meta">
        {unit.manufacturer} · {unit.size} · Armor {unit.armor || '—'}
        {movementItem ? ` · ${movementItem.movement} move` : ''}
      </p>

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

      <button
        type="button"
        className="danger"
        disabled={!canControl}
        onClick={onRemove}
      >
        Remove from board
      </button>
    </div>
  );
}

export default TokenCard;
