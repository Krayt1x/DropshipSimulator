// Ported from DropshipBuilder's src/components/EquipmentForm.jsx (#199).
import { useState } from 'react';
import {
  EQUIPMENT_TYPES,
  WEAPON_SIZES,
  EFFECT_STATS,
  EQUIPMENT_TAGS,
  effectStatChipText,
} from '../lib/builderConstants.js';
import { DICE_COLORS } from '../lib/dice.js';

function EquipmentForm({ manufacturers, editing, onSubmit, onCancel }) {
  const [type, setType] = useState(editing?.type ?? 'Movement');
  const [statEffects, setStatEffects] = useState(editing?.effect_stats ?? []);
  const [showEffectEditor, setShowEffectEditor] = useState(false);
  const [newEffectStat, setNewEffectStat] = useState('');
  const [newEffectAmount, setNewEffectAmount] = useState('');
  const isWeapon = type === 'Weapon';
  const isMovement = type === 'Movement';

  function addStatEffect() {
    if (!EFFECT_STATS.some((s) => s.key === newEffectStat)) return;
    const isDice = newEffectStat === 'dice';
    const isTag = newEffectStat === 'tags';
    const amount = isDice || isTag ? newEffectAmount : Number(newEffectAmount);
    const valid = isDice
      ? DICE_COLORS.includes(amount)
      : isTag
        ? EQUIPMENT_TAGS.some((t) => t.key === amount)
        : Boolean(amount);
    if (!valid) return;
    setStatEffects((current) => [...current, { stat: newEffectStat, amount }]);
    setShowEffectEditor(false);
    setNewEffectStat('');
    setNewEffectAmount('');
  }

  function removeStatEffect(index) {
    setStatEffects((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={onSubmit}>
      <input
        type="hidden"
        name="effect_stats"
        value={JSON.stringify(statEffects)}
        readOnly
      />
      <div className="stat-grid">
        <div className="field">
          <label htmlFor="equipment_name">Name</label>
          <input
            type="text"
            id="equipment_name"
            name="name"
            placeholder="New weapon"
            defaultValue={editing?.name ?? ''}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="equipment_manufacturer">Faction</label>
          <select
            id="equipment_manufacturer"
            name="manufacturer"
            defaultValue={editing?.manufacturer ?? manufacturers[0]}
          >
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="equipment_type">Equipment type</label>
          <select
            id="equipment_type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {EQUIPMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="equipment_weight">Weight (tonnes)</label>
          <input
            type="number"
            id="equipment_weight"
            name="weight"
            min="0"
            step="1"
            defaultValue={editing?.weight ?? 0}
            required
          />
        </div>
      </div>

      {isMovement && (
        <div className="stat-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="movement">Movement</label>
            <input
              type="number"
              id="movement"
              name="movement"
              min="0"
              step="1"
              defaultValue={editing?.movement ?? 0}
            />
          </div>
          <div className="field">
            <label htmlFor="heat_rating">Heat rating</label>
            <input
              type="text"
              id="heat_rating"
              name="heat_rating"
              placeholder="e.g. 1/1"
              defaultValue={editing?.heat_rating ?? ''}
            />
          </div>
        </div>
      )}

      {isWeapon && (
        <div className="stat-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="size">Weapon size</label>
            <select id="size" name="size" defaultValue={editing?.size ?? 'Small'}>
              {WEAPON_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="range">Range</label>
            <input
              type="text"
              id="range"
              name="range"
              placeholder="e.g. 6 or 3-9"
              defaultValue={editing?.range ?? ''}
            />
          </div>
          <div className="field">
            <label htmlFor="heat_rating">Heat rating</label>
            <input
              type="text"
              id="heat_rating"
              name="heat_rating"
              placeholder="e.g. 3/3"
              defaultValue={editing?.heat_rating ?? ''}
            />
          </div>
          <div className="field">
            <label htmlFor="hit_dice">Hit dice</label>
            <input
              type="text"
              id="hit_dice"
              name="hit_dice"
              placeholder="e.g. 1d4"
              defaultValue={editing?.hit_dice ?? ''}
            />
          </div>
          <div className="field">
            <label htmlFor="hp">HP</label>
            <input
              type="number"
              id="hp"
              name="hp"
              min="0"
              step="1"
              defaultValue={editing?.hp ?? 5}
            />
          </div>
        </div>
      )}

      <div
        className="field"
        style={{
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <input
          type="checkbox"
          id="no_drop_pod"
          name="no_drop_pod"
          defaultChecked={editing?.no_drop_pod ?? false}
        />
        <label htmlFor="no_drop_pod" style={{ margin: 0 }}>
          Cannot be equipped on a Drop Pod
        </label>
      </div>

      <div className="field" style={{ marginTop: 10 }}>
        <label htmlFor="effects">Effects (description)</label>
        <textarea
          id="effects"
          name="effects"
          rows={3}
          placeholder="What happens when this is equipped?"
          defaultValue={editing?.effects ?? ''}
        />
      </div>

      <div className="field" style={{ marginTop: 10 }}>
        <label>Equipment Effects</label>
        {statEffects.length > 0 && (
          <div className="effect-chips">
            {statEffects.map((effect, i) => (
              <span className="effect-chip" key={`${effect.stat}-${i}`}>
                {effectStatChipText(effect)}
                <button
                  type="button"
                  className="effect-chip-remove"
                  aria-label="Remove effect"
                  onClick={() => removeStatEffect(i)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          className="add-effect-btn"
          onClick={() => setShowEffectEditor((v) => !v)}
        >
          {showEffectEditor ? 'Cancel' : '+ Add an effect'}
        </button>
        {showEffectEditor && (
          <div
            className="effect-editor"
            style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
          >
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="effect_stat">Effect</label>
              <select
                id="effect_stat"
                value={newEffectStat}
                onChange={(e) => {
                  setNewEffectStat(e.target.value);
                  setNewEffectAmount('');
                }}
              >
                <option value="" disabled>
                  Choose an effect
                </option>
                {EFFECT_STATS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="effect_amount">Type</label>
              {newEffectStat === 'dice' ? (
                <select
                  id="effect_amount"
                  value={newEffectAmount}
                  onChange={(e) => setNewEffectAmount(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a die
                  </option>
                  {DICE_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              ) : newEffectStat === 'tags' ? (
                <select
                  id="effect_amount"
                  value={newEffectAmount}
                  onChange={(e) => setNewEffectAmount(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a tag
                  </option>
                  {EQUIPMENT_TAGS.map((tag) => (
                    <option key={tag.key} value={tag.key}>
                      {tag.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  id="effect_amount"
                  step="1"
                  placeholder="+2"
                  value={newEffectAmount}
                  onChange={(e) => setNewEffectAmount(e.target.value)}
                />
              )}
            </div>
            <button type="button" onClick={addStatEffect}>
              Add
            </button>
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 12,
        }}
      >
        {editing && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit">
          {editing ? 'Save changes' : 'Add equipment'}
        </button>
      </div>
    </form>
  );
}

export default EquipmentForm;
