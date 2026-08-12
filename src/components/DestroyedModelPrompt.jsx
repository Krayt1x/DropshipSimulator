import { useState } from 'react';
import { DICE_COLORS } from '../lib/dice.js';

// Surfaced at the start of a player's turn when one of their models was
// reduced to 0 HP (a wreck, #160) but never got confirmed as destroyed
// (#307) — the same "Model Destroyed" + "keep which die" flow TokenCard
// already offers on the side panel, just impossible to miss instead of
// requiring the player to notice and select the wrecked model themselves.
function DestroyedModelPrompt({ unitLabel, unit, onConfirm, onDismiss }) {
  const availableDiceColors = DICE_COLORS.filter(
    (color) => Number(unit?.[`dice_${color}`]) > 0,
  );
  const [pickedDieColor, setPickedDieColor] = useState(
    availableDiceColors[0] ?? null,
  );

  return (
    <div className="destroy-prompt-backdrop">
      <div className="destroy-prompt-modal">
        <p className="destroy-prompt-title">A model has been destroyed</p>
        <p className="unit-meta" style={{ marginBottom: 10 }}>
          {unitLabel} was reduced to 0 HP and can't act until it's confirmed
          destroyed.
        </p>
        {availableDiceColors.length > 0 && (
          <>
            <p className="unit-meta" style={{ marginBottom: 8 }}>
              Keep which die in this player's pool?
            </p>
            <div className="token-owner-row" style={{ marginBottom: 10 }}>
              {availableDiceColors.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={`die-pick-btn ${pickedDieColor === color ? 'selected' : ''}`}
                  onClick={() => setPickedDieColor(color)}
                >
                  <span className={`die-icon ${color}`} />
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="token-stat-row">
          <button
            type="button"
            className="danger"
            onClick={() => onConfirm(pickedDieColor)}
          >
            Model Destroyed
          </button>
          <button type="button" className="ghost" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export default DestroyedModelPrompt;
