function GameLog({ entries }) {
  return (
    <div className="card">
      <p className="unit-name">Game log</p>
      {entries.length === 0 ? (
        <p className="empty">No actions yet.</p>
      ) : (
        <ul className="game-log-list">
          {entries.map((entry) => (
            <li key={entry.id} className="game-log-entry">
              {entry.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GameLog;
