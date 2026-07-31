import { useState } from 'react';
import {
  sizeLabel,
  weaponSlotCost,
  effectStatLabel,
} from '../lib/builderConstants.js';
import {
  WEIGHT_SEGMENT_COLORS,
  requiredTypeForSlot,
  computeRosterStats,
  itemStatSummary,
} from '../lib/rosterEntry.js';
import DiceIcons from './DiceIcons.jsx';

// Ported from DropshipBuilder's src/components/RosterConfigPanel.jsx (#188).
function SlotCard({ label, item, isOpen, disabled, invalid, onToggle }) {
  return (
    <button
      type="button"
      className={`slot-card ${isOpen ? 'open' : ''} ${invalid ? 'invalid' : ''}`}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="slot-card-label">{label}</span>
      <span className="slot-card-item">{item?.name ?? 'Empty'}</span>
      {item && <span className="slot-card-wt">{itemStatSummary(item)}</span>}
      {item?.effects && (
        <span className="slot-card-effects">{item.effects}</span>
      )}
      {!disabled && <span className="slot-card-edit">✎</span>}
    </button>
  );
}

function SlotPicker({
  title,
  options,
  selectedId,
  allowNone,
  isWeapon,
  weaponFit,
  onSelect,
}) {
  return (
    <div className="slot-picker">
      <p className="slot-picker-title">{title}</p>
      {allowNone && (
        <div
          className={`slot-picker-row ${Number(selectedId) === 0 ? 'selected' : ''}`}
          onClick={() => onSelect(0)}
        >
          <span className="slot-picker-name">— None —</span>
        </div>
      )}
      {options.map((item) => {
        const isSelected = Number(selectedId) === Number(item.id);
        const fits = !weaponFit || isSelected || weaponFit(item);
        const itemType = item.type ?? 'Movement';
        return (
          <div
            key={item.id}
            className={`slot-picker-row ${(!isWeapon && item.effects) || (weaponFit && !fits) ? 'slot-picker-row-stack' : ''} ${isSelected ? 'selected' : ''} ${!fits ? 'slot-picker-row-nofit' : ''}`}
            onClick={() => fits && onSelect(Number(item.id))}
          >
            <div className="slot-picker-row-main">
              <span className="slot-picker-name">{item.name}</span>
              <span className="slot-picker-stats">
                {isWeapon
                  ? `${item.size ?? 'Small'} (${weaponSlotCost(item)} slot${weaponSlotCost(item) > 1 ? 's' : ''}) · ${item.weight ?? 0}t · ${item.range || '—'} · ${item.heat_rating || '—'} · ${item.hit_dice || '—'} · HP ${item.hp ?? '—'}`
                  : itemType === 'Movement'
                    ? `${item.movement ?? 0} movement · ${item.weight ?? 0}t · ${item.heat_rating || '—'}`
                    : itemType === 'Augment'
                      ? `${weaponSlotCost(item)} slot${weaponSlotCost(item) > 1 ? 's' : ''} · ${item.weight ?? 0}t`
                      : `${item.weight ?? 0}t`}
                {item.action_dice_color
                  ? ` · +1 ${item.action_dice_color} die`
                  : ''}
              </span>
            </div>
            {!isWeapon && item.effects && (
              <span className="slot-picker-row-effects">{item.effects}</span>
            )}
            {weaponFit && !fits && (
              <span className="slot-picker-row-effects">
                Not enough room in this slot
              </span>
            )}
          </div>
        );
      })}
      {options.length === 0 && !allowNone && (
        <p className="empty" style={{ padding: '6px 0' }}>
          No options available.
        </p>
      )}
    </div>
  );
}

function RosterConfigPanel({
  entry,
  units,
  equipment,
  totalWeight,
  onAssignEquipment,
}) {
  const stats = computeRosterStats(entry, units, equipment, totalWeight);
  const {
    unit,
    isDropPod,
    unitEquipment,
    dropPodEquipmentId,
    dropPodEquipmentOptions,
    dropPodSelected,
    slotCounts,
    maxWeight,
    maxDropWeight,
    overMaxWeight,
    overDropWeight,
    movementGearStat,
    excessDropWeight,
    effectiveMovement,
    statsLine,
    equippedWithEffects,
    equippedWeights,
    hullWeight,
  } = stats;

  const [openSlotKey, setOpenSlotKey] = useState(null);

  function toggleSlot(key) {
    setOpenSlotKey((current) => (current === key ? null : key));
  }

  function weaponUsage(slot) {
    const requiredType = requiredTypeForSlot(slot);
    const slotOptions = unitEquipment.filter(
      (item) => (item.type ?? 'Movement') === requiredType,
    );
    const equippedItems = (entry.equipment?.[slot] ?? [])
      .filter(Boolean)
      .map((id) => slotOptions.find((item) => Number(item.id) === Number(id)))
      .filter(Boolean);
    const used = equippedItems.reduce(
      (sum, item) => sum + weaponSlotCost(item),
      0,
    );
    return { capacity: slotCounts[slot], used, equippedItems, slotOptions };
  }

  function renderSlotCards(slot) {
    if (slot === 'Movement') {
      const slotOptions = unitEquipment.filter(
        (item) => (item.type ?? 'Movement') === 'Movement',
      );
      const selectedId = entry.equipment?.Movement?.[0] ?? 0;
      const selected = slotOptions.find(
        (item) => Number(item.id) === Number(selectedId),
      );
      const key = 'Movement-0';
      return [
        <SlotCard
          key={key}
          label="Movement"
          item={selected}
          isOpen={openSlotKey === key}
          disabled={slotOptions.length === 0}
          onToggle={() => toggleSlot(key)}
        />,
      ];
    }

    const { capacity, used, equippedItems, slotOptions } = weaponUsage(slot);
    const overCapacity = used > capacity;
    const cards = equippedItems.map((item, i) => {
      const key = `${slot}-${i}`;
      return (
        <SlotCard
          key={key}
          label={`${slot} ${i + 1}`}
          item={item}
          isOpen={openSlotKey === key}
          disabled={false}
          invalid={overCapacity}
          onToggle={() => toggleSlot(key)}
        />
      );
    });
    if (used < capacity) {
      const addKey = `${slot}-new`;
      cards.push(
        <SlotCard
          key={addKey}
          label={slot}
          item={null}
          isOpen={openSlotKey === addKey}
          disabled={slotOptions.length === 0}
          onToggle={() => toggleSlot(addKey)}
        />,
      );
    }
    return cards;
  }

  return (
    <div
      className={`card roster-config-panel ${overMaxWeight ? 'over-max-weight' : ''}`}
    >
      <p className="unit-name">
        {overMaxWeight && (
          <span
            className="warning-icon warning-icon-max"
            title={`Over max weight (${unit.max_weight} t)`}
          >
            ⛔
          </span>
        )}
        {overDropWeight && (
          <span
            className="warning-icon warning-icon-drop"
            title={`Over Maximum Safe Weight (${unit.max_drop_weight} t)`}
          >
            ⚠️
          </span>
        )}
        {unit.name} {isDropPod && <span className="badge">Drop Pod</span>}
      </p>
      <p className="unit-meta">{totalWeight} t</p>
      {maxWeight > 0 && (
        <div className="weight-bar-mini">
          <div className="weight-bar-mini-track">
            {hullWeight > 0 && (
              <div
                className="weight-bar-mini-seg weight-bar-mini-seg-hull"
                style={{
                  width: `${Math.min(100, (hullWeight / maxWeight) * 100)}%`,
                }}
                title={`${unit.name} hull: ${hullWeight}t`}
              />
            )}
            {equippedWeights.map((item, i) => (
              <div
                key={item.key}
                className="weight-bar-mini-seg"
                style={{
                  width: `${Math.min(100, (item.weight / maxWeight) * 100)}%`,
                  background:
                    WEIGHT_SEGMENT_COLORS[i % WEIGHT_SEGMENT_COLORS.length],
                }}
                title={`${item.name}: ${item.weight}t`}
              />
            ))}
            {maxDropWeight > 0 && (
              <div
                className="weight-bar-mini-drop-marker"
                style={{
                  left: `${Math.min(100, (maxDropWeight / maxWeight) * 100)}%`,
                }}
              />
            )}
          </div>
          <div className="weight-bar-mini-labels">
            <span>0t</span>
            {maxDropWeight > 0 && (
              <span
                className={
                  totalWeight > maxDropWeight ? 'max-drop-exceeded' : ''
                }
              >
                MSW {maxDropWeight}t
              </span>
            )}
            <span className={overMaxWeight ? 'max-weight-exceeded' : ''}>
              Max {maxWeight}t
            </span>
          </div>
          {(hullWeight > 0 || equippedWeights.length > 0) && (
            <div className="weight-legend">
              {hullWeight > 0 && (
                <span className="legend-chip">
                  <span className="legend-swatch legend-swatch-hull" />
                  {unit.name} chassis {hullWeight}t
                </span>
              )}
              {equippedWeights.map((item, i) => (
                <span className="legend-chip" key={item.key}>
                  <span
                    className="legend-swatch"
                    style={{
                      background:
                        WEIGHT_SEGMENT_COLORS[i % WEIGHT_SEGMENT_COLORS.length],
                    }}
                  />
                  {item.name} {item.weight}t
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="unit-stats">{sizeLabel(unit.size)}</p>
      <p className="unit-stats">{statsLine}</p>
      <p className="unit-stats">
        <DiceIcons unit={unit} />
      </p>

      {maxWeight > 0 && (
        <p className="unit-stats">
          Effective movement: <b>{effectiveMovement}</b> (gear movement{' '}
          {movementGearStat}
          {excessDropWeight > 0 ? ` − ${excessDropWeight}t over MSW` : ''})
        </p>
      )}

      {isDropPod ? (
        <div className="equipment-slots">
          <SlotCard
            label="Equipment"
            item={dropPodSelected}
            isOpen={openSlotKey === 'equipment'}
            disabled={dropPodEquipmentOptions.length === 0}
            onToggle={() => toggleSlot('equipment')}
          />
        </div>
      ) : (
        <div className="equipment-slots-grid">
          {slotCounts.Head > 0 && (
            <div className="equipment-slots-panel equipment-slots-panel-head">
              <div className="equipment-slots-panel-label">
                Head ({weaponUsage('Head').used}/{slotCounts.Head})
              </div>
              {renderSlotCards('Head')}
            </div>
          )}
          <div className="equipment-slots-panel">
            <div className="equipment-slots-panel-label">
              Left ({weaponUsage('Left').used}/{slotCounts.Left})
            </div>
            {renderSlotCards('Left')}
          </div>
          <div className="equipment-slots-panel">
            <div className="equipment-slots-panel-label">
              Right ({weaponUsage('Right').used}/{slotCounts.Right})
            </div>
            {renderSlotCards('Right')}
          </div>
          <div className="equipment-slots-panel equipment-slots-panel-movement">
            <div className="equipment-slots-panel-label">Movement</div>
            {renderSlotCards('Movement')}
          </div>
        </div>
      )}

      {isDropPod && openSlotKey === 'equipment' && (
        <SlotPicker
          title="Equipment"
          options={dropPodEquipmentOptions}
          selectedId={dropPodEquipmentId}
          allowNone
          isWeapon={false}
          onSelect={(id) => {
            onAssignEquipment('Movement', 0, id);
            setOpenSlotKey(null);
          }}
        />
      )}

      {!isDropPod &&
        openSlotKey &&
        (() => {
          const [slot, indexStr] = openSlotKey.split('-');

          if (slot === 'Movement') {
            const slotOptions = unitEquipment
              .filter((item) => (item.type ?? 'Movement') === 'Movement')
              .sort((a, b) => Number(a.weight ?? 0) - Number(b.weight ?? 0));
            const selectedId = entry.equipment?.Movement?.[0] ?? 0;
            return (
              <SlotPicker
                title="Movement"
                options={slotOptions}
                selectedId={selectedId}
                allowNone={false}
                isWeapon={false}
                onSelect={(id) => {
                  onAssignEquipment('Movement', 0, id);
                  setOpenSlotKey(null);
                }}
              />
            );
          }

          const { capacity, equippedItems, slotOptions } = weaponUsage(slot);
          const isNew = indexStr === 'new';
          const i = isNew ? equippedItems.length : Number(indexStr);
          const usedExcludingCurrent = equippedItems.reduce(
            (sum, item, idx) =>
              !isNew && idx === i ? sum : sum + weaponSlotCost(item),
            0,
          );
          const remaining = capacity - usedExcludingCurrent;
          const selectedId = isNew ? 0 : (equippedItems[i]?.id ?? 0);
          return (
            <SlotPicker
              title={`${slot} ${i + 1}`}
              options={slotOptions}
              selectedId={selectedId}
              allowNone={!isNew}
              isWeapon={requiredTypeForSlot(slot) === 'Weapon'}
              weaponFit={(item) => weaponSlotCost(item) <= remaining}
              onSelect={(id) => {
                if (id > 0) {
                  const item = slotOptions.find(
                    (it) => Number(it.id) === Number(id),
                  );
                  if (item && weaponSlotCost(item) > remaining) return;
                }
                onAssignEquipment(slot, isNew ? -1 : i, id);
                setOpenSlotKey(null);
              }}
            />
          );
        })()}

      {equippedWithEffects.map(({ key, item }) => (
        <p key={key} className="equipment-effects">
          {item.name}: {item.effects}
          {item.effects && item.effect_stats?.length > 0 ? ' · ' : ''}
          {item.effect_stats?.map((effect, i) => (
            <span className="effect-chip" key={`${key}-${effect.stat}-${i}`}>
              {effect.amount > 0 ? '+' : ''}
              {effect.amount} {effectStatLabel(effect.stat)}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export default RosterConfigPanel;
