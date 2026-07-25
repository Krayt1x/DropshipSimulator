import DiceIcons from './DiceIcons.jsx';
import { healthBarColor } from '../lib/tokens.js';

const TYPE_BADGES = { Weapon: 'W', Movement: 'M', Augment: 'A' };

function ConciseTile({ item }) {
  return (
    <div className="condensed-tile">
      <span className="condensed-badge">{TYPE_BADGES[item.type] ?? '?'}</span>
      <span className="condensed-name">{item.name}</span>
    </div>
  );
}

function HpTrackBar({ token, unit }) {
  const maxHp = Number(unit.hp) || 1;
  const fraction = Math.max(0, Math.min(1, token.currentHp / maxHp));
  return (
    <div className="stat-bar-track">
      <div
        className="stat-bar-fill"
        style={{
          width: `${fraction * 100}%`,
          background: healthBarColor(fraction),
        }}
      />
    </div>
  );
}

function UnitCardHeader({ variant, unit, token, equippedItems }) {
  if (variant === 'detailed') {
    return (
      <>
        <div className="card-badge-row">
          <span className="pill-badge">{unit.manufacturer}</span>
          <span className="pill-badge">{unit.size}</span>
          <span className="pill-badge">Armor {unit.armor || '—'}</span>
        </div>
        <p className="unit-stats" style={{ margin: '6px 0' }}>
          <DiceIcons unit={unit} />
        </p>
        <HpTrackBar token={token} unit={unit} />
        {equippedItems.length > 0 && (
          <ul className="roster-import-preview" style={{ marginTop: 8 }}>
            {equippedItems.map((item) => (
              <li key={item.id}>
                {item.name}
                {item.range ? ` · Range ${item.range}` : ''}
                {item.heat_rating ? ` · Heat ${item.heat_rating}` : ''}
                {item.movement ? ` · ${item.movement} move` : ''}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className="card-badge-row">
        <span className="pill-badge">{unit.size}</span>
        <span className="pill-badge">Armor {unit.armor || '—'}</span>
        <span className="pill-badge">{unit.hp} HP</span>
        <DiceIcons unit={unit} />
      </div>
    );
  }

  // 'compact' (default): mirrors DropshipBuilder's roster list item
  return (
    <>
      <p className="unit-meta">{unit.manufacturer}</p>
      <HpTrackBar token={token} unit={unit} />
      <p className="unit-stats" style={{ margin: '6px 0' }}>
        {unit.size} · Armor {unit.armor || '—'}
      </p>
      <p className="unit-stats" style={{ marginBottom: 8 }}>
        <DiceIcons unit={unit} />
      </p>
      {equippedItems.length > 0 && (
        <div className="condensed-grid">
          {equippedItems.map((item) => (
            <ConciseTile item={item} key={item.id} />
          ))}
        </div>
      )}
    </>
  );
}

export default UnitCardHeader;
