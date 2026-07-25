import { useEffect, useMemo, useState } from 'react';
import { OWNERS, groupEquipmentByType } from '../lib/tokens.js';

function TokenForm({
  manufacturers,
  units,
  equipment,
  onArm,
  armed,
  myPlayer,
}) {
  const [manufacturer, setManufacturer] = useState(manufacturers[0] ?? '');
  const [unitId, setUnitId] = useState('');
  const [equippedIds, setEquippedIds] = useState([]);
  const [owner, setOwner] = useState(myPlayer ?? OWNERS[0].id);
  const ownerOptions = myPlayer
    ? OWNERS.filter((o) => o.id === myPlayer)
    : OWNERS;

  useEffect(() => {
    if (myPlayer) setOwner(myPlayer);
  }, [myPlayer]);

  const unitOptions = useMemo(
    () => units.filter((u) => u.manufacturer === manufacturer),
    [units, manufacturer],
  );
  const equipmentOptions = useMemo(
    () => equipment.filter((e) => e.manufacturer === manufacturer),
    [equipment, manufacturer],
  );
  const grouped = useMemo(
    () => groupEquipmentByType(equipmentOptions),
    [equipmentOptions],
  );
  const unit = units.find((u) => Number(u.id) === Number(unitId));

  function toggleEquipped(id) {
    setEquippedIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id],
    );
  }

  function handleManufacturerChange(m) {
    setManufacturer(m);
    setUnitId('');
    setEquippedIds([]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!unit) return;
    onArm({ unit, equippedIds, owner });
  }

  return (
    <form className="card token-form" onSubmit={handleSubmit}>
      <p className="unit-name">Add unit</p>

      <div className="field">
        <label htmlFor="token-manufacturer">Manufacturer</label>
        <select
          id="token-manufacturer"
          value={manufacturer}
          onChange={(e) => handleManufacturerChange(e.target.value)}
        >
          {manufacturers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="token-unit">Mech</label>
        <select
          id="token-unit"
          value={unitId}
          onChange={(e) => {
            setUnitId(e.target.value);
            setEquippedIds([]);
          }}
        >
          <option value="">— Select —</option>
          {unitOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.size}, {u.hp} HP)
            </option>
          ))}
        </select>
      </div>

      {unit &&
        Object.entries(grouped).map(([type, items]) => (
          <div className="field" key={type}>
            <label>{type}</label>
            <div className="token-equipment-list">
              {items.map((item) => (
                <label className="token-equipment-row" key={item.id}>
                  <input
                    type="checkbox"
                    checked={equippedIds.includes(item.id)}
                    onChange={() => toggleEquipped(item.id)}
                  />
                  {item.name}
                  {item.range ? ` · Range ${item.range}` : ''}
                  {item.movement ? ` · ${item.movement} move` : ''}
                </label>
              ))}
              {items.length === 0 && <p className="empty">None available.</p>}
            </div>
          </div>
        ))}

      <div className="field">
        <label>Owner</label>
        {myPlayer && (
          <p className="unit-meta">You can only deploy units for yourself.</p>
        )}
        <div className="token-owner-row">
          {ownerOptions.map((o) => {
            const selected = owner === o.id;
            return (
              <button
                type="button"
                key={o.id}
                className={`token-owner-btn ${selected ? 'selected' : ''}`}
                style={{
                  borderColor: o.color,
                  background: selected ? o.color : undefined,
                }}
                onClick={() => setOwner(o.id)}
              >
                <span className="tile-swatch" style={{ background: o.color }} />
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <button type="submit" disabled={!unit}>
        {armed ? 'Click a hex to place' : 'Place on board'}
      </button>
    </form>
  );
}

export default TokenForm;
