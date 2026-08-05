// Ported from DropshipBuilder's src/components/UnitForm.jsx (#199). Armor
// is still edited as 4 separate fields here (matching the shape a person
// thinks in), but this repo stores it as one combined "F/L/R/Rear" string
// (see builderConstants.js's armorStringToFields/armorFieldsToString) —
// `editing` is pre-split by the caller (ManagePage) before being passed in.
import { UNIT_SIZES } from '../lib/builderConstants.js';
import { DICE_COLORS } from '../lib/dice.js';

function UnitForm({ manufacturers, editing, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="stat-grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="New unit"
            defaultValue={editing?.name ?? ''}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="manufacturer">Manufacturer</label>
          <select
            id="manufacturer"
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
          <label htmlFor="size">Size</label>
          <select id="size" name="size" defaultValue={editing?.size ?? 'Small'}>
            {Object.entries(UNIT_SIZES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="weight">Weight (tonnes)</label>
          <input
            type="number"
            id="weight"
            name="weight"
            min="0"
            step="1"
            defaultValue={editing?.weight ?? 50}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="max_weight">Max weight</label>
          <input
            type="number"
            id="max_weight"
            name="max_weight"
            min="0"
            step="1"
            defaultValue={editing?.max_weight ?? 0}
          />
        </div>
        <div className="field">
          <label htmlFor="max_drop_weight">Maximum Safe Weight (MSW)</label>
          <input
            type="number"
            id="max_drop_weight"
            name="max_drop_weight"
            min="0"
            step="1"
            defaultValue={editing?.max_drop_weight ?? 0}
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
            defaultValue={editing?.hp ?? 0}
          />
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 10 }}>
        <div className="field">
          <label htmlFor="front_armor">Front armor</label>
          <input
            type="number"
            id="front_armor"
            name="front_armor"
            min="0"
            step="1"
            defaultValue={editing?.front_armor ?? 0}
          />
        </div>
        <div className="field">
          <label htmlFor="left_armor">Left armor</label>
          <input
            type="number"
            id="left_armor"
            name="left_armor"
            min="0"
            step="1"
            defaultValue={editing?.left_armor ?? 0}
          />
        </div>
        <div className="field">
          <label htmlFor="right_armor">Right armor</label>
          <input
            type="number"
            id="right_armor"
            name="right_armor"
            min="0"
            step="1"
            defaultValue={editing?.right_armor ?? 0}
          />
        </div>
        <div className="field">
          <label htmlFor="rear_armor">Rear armor</label>
          <input
            type="number"
            id="rear_armor"
            name="rear_armor"
            min="0"
            step="1"
            defaultValue={editing?.rear_armor ?? 0}
          />
        </div>
      </div>

      <div
        className="stat-grid"
        style={{ marginTop: 10, gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {DICE_COLORS.map((color) => (
          <div className="field" key={color}>
            <label htmlFor={`dice_${color}`}>
              {color.charAt(0).toUpperCase() + color.slice(1)} dice
            </label>
            <input
              type="number"
              id={`dice_${color}`}
              name={`dice_${color}`}
              min="0"
              step="1"
              defaultValue={editing?.[`dice_${color}`] ?? 0}
            />
          </div>
        ))}
      </div>

      <div className="stat-grid" style={{ marginTop: 10 }}>
        <div className="field">
          <label htmlFor="left_slots">Left slots</label>
          <input
            type="number"
            id="left_slots"
            name="left_slots"
            min="0"
            step="1"
            defaultValue={editing?.left_slots ?? 1}
          />
        </div>
        <div className="field">
          <label htmlFor="right_slots">Right slots</label>
          <input
            type="number"
            id="right_slots"
            name="right_slots"
            min="0"
            step="1"
            defaultValue={editing?.right_slots ?? 1}
          />
        </div>
        <div className="field">
          <label htmlFor="head_slots">Head slots</label>
          <input
            type="number"
            id="head_slots"
            name="head_slots"
            min="0"
            step="1"
            defaultValue={editing?.head_slots ?? 0}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit">{editing ? 'Save changes' : 'Add unit'}</button>
        {editing && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default UnitForm;
