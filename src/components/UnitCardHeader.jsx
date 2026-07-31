import DiceIcons from './DiceIcons.jsx';
import { healthBarColor, sizeNumber } from '../lib/tokens.js';

function UnitCardHeader({ unit, token, equippedItems }) {
  const maxHp = Number(unit.hp) || 1;
  const fraction = Math.max(0, Math.min(1, token.currentHp / maxHp));
  const size = sizeNumber(unit.size);

  return (
    <>
      <div className="card-badge-row">
        <span className="pill-badge">{unit.manufacturer}</span>
        <span className="pill-badge">
          {unit.size}
          {size !== null ? ` (${size})` : ''}
        </span>
        <span className="pill-badge">Armor {unit.armor || '—'}</span>
      </div>
      <p className="unit-meta" style={{ margin: '4px 0' }}>
        Size: {size ?? '—'} · Armor: {unit.armor || '—'}
      </p>
      <p className="unit-stats" style={{ margin: '6px 0' }}>
        <DiceIcons unit={unit} />
      </p>
      <div className="stat-bar-track">
        <div
          className="stat-bar-fill"
          style={{
            width: `${fraction * 100}%`,
            background: healthBarColor(fraction),
          }}
        />
      </div>
      {equippedItems.length > 0 && (
        <ul className="roster-import-preview" style={{ marginTop: 8 }}>
          {equippedItems.map((item, index) => {
            const maxItemHp = Number(item.hp) || 0;
            // Matches TokenCard's own equipment HP readout: current damage
            // taken lives in weaponState, not the static equipment stat.
            const currentItemHp =
              token.weaponState?.[item.instanceIndex]?.hp ?? maxItemHp;
            return (
              <li key={item.instanceIndex ?? item.id ?? index}>
                {item.name}
                {item.range ? ` · Range ${item.range}` : ''}
                {item.hit_dice ? ` · Hit ${item.hit_dice}` : ''}
                {item.heat_rating ? ` · Heat ${item.heat_rating}` : ''}
                {item.movement ? ` · ${item.movement} move` : ''}
                {maxItemHp > 0 ? ` · HP ${currentItemHp} / ${maxItemHp}` : ''}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default UnitCardHeader;
