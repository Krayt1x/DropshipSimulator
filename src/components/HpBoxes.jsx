const BOXES_PER_ROW = 5;

function chunkIntoRows(maxHp) {
  const rows = [];
  for (let start = 0; start < maxHp; start += BOXES_PER_ROW) {
    rows.push(
      Array.from(
        { length: Math.min(BOXES_PER_ROW, maxHp - start) },
        (_, i) => start + i,
      ),
    );
  }
  return rows;
}

function HpBoxes({ currentHp, maxHp, variant = 'pips', onSetHp }) {
  const rows = chunkIntoRows(Math.max(0, maxHp));

  return (
    <div className={`hp-boxes hp-boxes-${variant}`}>
      {rows.map((row, rowIndex) => (
        <div className="hp-boxes-row" key={rowIndex}>
          {row.map((index) => {
            const filled = index < currentHp;
            const target = filled ? index : index + 1;
            return (
              <button
                type="button"
                key={index}
                className={`hp-box ${filled ? 'hp-box-filled' : 'hp-box-empty'}`}
                title={`Set HP to ${target}`}
                onClick={() => onSetHp(target)}
              >
                {variant === 'numbered' ? index + 1 : ''}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default HpBoxes;
