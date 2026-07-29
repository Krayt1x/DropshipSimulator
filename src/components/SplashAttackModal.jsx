const SIDES = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'rear', label: 'Rear' },
];

function SplashAttackModal({
  attackerName,
  weaponName,
  hitDice,
  heatGenerate,
  origin,
  targets,
  side,
  onPickSide,
  result,
  onRoll,
  onApply,
  onCancel,
}) {
  const manualTarget = targets.find((t) => t.isManualSide);
  const canRoll = !manualTarget || Boolean(side);

  return (
    <div className="attack-modal-backdrop" onClick={onCancel}>
      <div className="attack-modal" onClick={(e) => e.stopPropagation()}>
        <p className="attack-modal-title">
          {attackerName}'s {weaponName} → blast at ({origin.col}, {origin.row})
        </p>
        <p className="unit-meta">
          Hits the targeted tile and its 6 neighbors — every model under the
          template is checked against the same roll.
        </p>

        {targets.length === 0 ? (
          <p className="unit-meta">No models are under the blast template.</p>
        ) : (
          <ul className="roster-import-preview">
            {targets.map((t) => (
              <li key={t.tokenId}>
                {t.name} ({t.sizeLabel ?? '—'}) ·{' '}
                {t.isManualSide ? 'pick the side hit below' : `${t.side} side`}
              </li>
            ))}
          </ul>
        )}

        {manualTarget && (
          <>
            <p className="attack-modal-label">
              Which side of {manualTarget.name} are you hitting?
            </p>
            <div className="attack-side-picker">
              {SIDES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={side === s.id ? 'active' : ''}
                  disabled={Boolean(result)}
                  onClick={() => onPickSide(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="unit-meta">
          Hit dice: {hitDice || '—'} · Heat +{heatGenerate ?? 0} on roll
        </p>

        {!result ? (
          <button
            type="button"
            className="attack-roll-btn"
            disabled={!canRoll}
            onClick={onRoll}
          >
            Roll to Hit
          </button>
        ) : (
          <div className="attack-result">
            <p>Rolled {result.rolls.join(', ')}</p>
            {result.perTarget.length === 0 ? (
              <p>No targets were caught in the blast.</p>
            ) : (
              result.perTarget.map((r) => (
                <p key={r.tokenId}>
                  {r.name} (TN {r.targetNumber}) →{' '}
                  <b>
                    {r.hits} hit{r.hits === 1 ? '' : 's'}
                  </b>{' '}
                  → <b>{r.damage} damage</b> to{' '}
                  {r.side === 'left' || r.side === 'right'
                    ? `the ${r.side} slot`
                    : 'the chassis'}
                </p>
              ))
            )}
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

export default SplashAttackModal;
