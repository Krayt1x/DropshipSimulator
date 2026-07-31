import { sizeLabel } from '../lib/builderConstants.js';
import {
  WEIGHT_SEGMENT_COLORS,
  computeRosterStats,
} from '../lib/rosterEntry.js';
import DiceIcons from './DiceIcons.jsx';

// Ported from DropshipBuilder's src/components/RosterListItem.jsx (#188).
function CondensedTile({ badge, item, invalid }) {
  return (
    <div className={`roster-condensed-tile ${invalid ? 'invalid' : ''}`}>
      <span className="roster-condensed-badge">{badge}</span>
      <span className="roster-condensed-name">
        {item ? item.name : 'Empty'}
      </span>
    </div>
  );
}

function RosterListItem({
  entry,
  units,
  equipment,
  totalWeight,
  selected,
  onSelect,
  onRemove,
}) {
  const stats = computeRosterStats(entry, units, equipment, totalWeight);
  const {
    unit,
    isDropPod,
    slotCounts,
    resolveEquippedItems,
    dropPodSelected,
    maxWeight,
    maxDropWeight,
    overMaxWeight,
    overDropWeight,
    overCapacitySlots,
    statsLine,
    hullWeight,
    equippedWeights,
  } = stats;

  function renderCondensedGrid() {
    if (isDropPod) {
      if (!dropPodSelected) {
        return (
          <p className="empty" style={{ padding: '4px 0' }}>
            Nothing loaded yet.
          </p>
        );
      }
      return (
        <div className="roster-condensed-grid">
          <CondensedTile badge="E" item={dropPodSelected} />
        </div>
      );
    }

    const headItems = slotCounts.Head > 0 ? resolveEquippedItems('Head') : [];
    const leftItems = resolveEquippedItems('Left');
    const rightItems = resolveEquippedItems('Right');
    const movementItem = resolveEquippedItems('Movement')[0] ?? null;

    return (
      <div className="roster-condensed-grid">
        {slotCounts.Head > 0 && (
          <div className="roster-condensed-cell roster-condensed-head">
            {headItems.length > 0 ? (
              headItems.map((item, i) => (
                <CondensedTile
                  badge="H"
                  item={item}
                  invalid={overCapacitySlots.Head}
                  key={`head-${i}`}
                />
              ))
            ) : (
              <CondensedTile badge="H" item={null} />
            )}
          </div>
        )}
        <div className="roster-condensed-cell">
          {leftItems.length > 0 ? (
            leftItems.map((item, i) => (
              <CondensedTile
                badge="L"
                item={item}
                invalid={overCapacitySlots.Left}
                key={`left-${i}`}
              />
            ))
          ) : (
            <CondensedTile badge="L" item={null} />
          )}
        </div>
        <div className="roster-condensed-cell">
          {rightItems.length > 0 ? (
            rightItems.map((item, i) => (
              <CondensedTile
                badge="R"
                item={item}
                invalid={overCapacitySlots.Right}
                key={`right-${i}`}
              />
            ))
          ) : (
            <CondensedTile badge="R" item={null} />
          )}
        </div>
        <div className="roster-condensed-cell roster-condensed-move">
          <CondensedTile badge="M" item={movementItem} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`unit-row roster-list-item ${selected ? 'selected' : ''} ${overMaxWeight ? 'over-max-weight' : ''}`}
      style={{ alignItems: 'flex-start', flexWrap: 'wrap', cursor: 'pointer' }}
      onClick={onSelect}
    >
      <div className="unit-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p className="unit-name" style={{ flex: 1, minWidth: 0 }}>
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
          <button
            type="button"
            className="ghost"
            aria-label="Remove"
            style={{ padding: '4px 8px', fontSize: 12 }}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ✕
          </button>
        </div>
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
          </div>
        )}
        <div className="roster-list-split">
          <div>
            <p className="unit-stats">{sizeLabel(unit.size)}</p>
            <p className="unit-stats">{statsLine}</p>
            <p className="unit-stats">
              <DiceIcons unit={unit} />
            </p>
          </div>
          {renderCondensedGrid()}
        </div>
      </div>
    </div>
  );
}

export default RosterListItem;
