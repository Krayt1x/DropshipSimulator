const SIDES = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'rear', label: 'Rear' },
];

function AttackModal({
  attackerName,
  weaponName,
  hitDice,
  heatGenerate,
  targetName,
  targetSizeLabel,
  targetNumber,
  visibleSides,
  sideInfo,
  side,
  onPickSide,
  result,
  onRoll,
  onApply,
  onCancel,
}) {
  // A hit that lands 0 damage (fully absorbed) reads the same as a miss to
  // the player, so only shake when damage actually landed (#161).
  const hitLanded = Boolean(result) && result.damage > 0;
  return (
    <div className="attack-modal-backdrop" onClick={onCancel}>
      <div
        className={`attack-modal ${hitLanded ? 'attack-modal-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="attack-modal-title">
          {attackerName}'s {weaponName} → {targetName}
        </p>
        <p className="unit-meta">
          Target: {targetName} ({targetSizeLabel ?? '—'}) · Target number{' '}
          {targetNumber ?? '—'} (roll ≤{targetNumber ?? '—'} to hit)
        </p>

        <p className="attack-modal-label">Which side are you hitting?</p>
        <div className="attack-side-picker">
          {SIDES.map((s) => {
            const notVisible = visibleSides && !visibleSides.includes(s.id);
            const info = sideInfo?.[s.id];
            return (
              <button
                type="button"
                key={s.id}
                className={side === s.id ? 'active' : ''}
                disabled={Boolean(result) || notVisible}
                title={notVisible ? "Can't see this side from here" : undefined}
                onClick={() => onPickSide(s.id)}
              >
                {s.label}
                {info && (
                  // Hidden from the accessible name, matching the terrain
                  // pill convention (#215) — otherwise
                  // getByRole('button', { name: 'Right' }) breaks once an
                  // armor caption renders inside the button.
                  <span className="attack-side-armor" aria-hidden="true">
                    Armor {info.armor}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {side && sideInfo?.[side] && (
          <div className="attack-side-detail">
            <p className="unit-meta">Armor: {sideInfo[side].armor}</p>
            {(side === 'left' || side === 'right') && (
              <p className="unit-meta">
                Equipment:{' '}
                {sideInfo[side].items.length === 0
                  ? 'none'
                  : sideInfo[side].items
                      .map(
                        (item) =>
                          `${item.name} (${item.broken ? 'Broken' : `${item.hp}/${item.maxHp} HP`})`,
                      )
                      .join(', ')}
              </p>
            )}
          </div>
        )}

        <p className="unit-meta">
          Hit dice: {hitDice || '—'} · Heat +{heatGenerate ?? 0} on roll
        </p>

        {!result ? (
          <button
            type="button"
            className="attack-roll-btn"
            disabled={!side}
            onClick={onRoll}
          >
            Roll to Hit
          </button>
        ) : (
          <div className="attack-result">
            <p>
              Rolled {result.rolls.join(', ')} vs TN {targetNumber} →{' '}
              <b>
                {result.hits} hit{result.hits === 1 ? '' : 's'}
              </b>
            </p>
            <p>
              ({result.sides} − {result.sideArmor}) × {result.hits} ={' '}
              <b>{result.damage} damage</b> to{' '}
              {side === 'left' || side === 'right'
                ? `the ${side} slot`
                : 'the chassis'}
            </p>
            <button type="button" className="attack-roll-btn" onClick={onApply}>
              Apply damage
            </button>
          </div>
        )}

        <button
          type="button"
          className="ghost attack-cancel-btn"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default AttackModal;
