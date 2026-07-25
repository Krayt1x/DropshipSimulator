const DICE_COLORS = ['blue', 'red', 'green'];

function DiceIcons({ unit }) {
  const dice = DICE_COLORS.flatMap((color) => {
    const count = Number(unit[`dice_${color}`]) || 0;
    return Array.from({ length: count }, (_, i) => (
      <span key={`${color}-${i}`} className={`die-icon ${color}`} />
    ));
  });

  if (dice.length === 0) {
    return <span className="dice-icons-empty">No dice</span>;
  }

  return <span className="dice-icons">{dice}</span>;
}

export default DiceIcons;
