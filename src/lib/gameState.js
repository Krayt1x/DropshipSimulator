import { publish } from './syncBus.js';
import { emptyDiceTotals } from './tokens.js';

export const DEFAULT_TURN = { number: 1, active: 'p1' };
export const DEFAULT_BANKED_DICE = emptyDiceTotals();

const BATTLE_RESET_VALUES = {
  'dropshipsimulator:battle:tokens': [],
  'dropshipsimulator:battle:deploymentPhase': true,
  'dropshipsimulator:battle:turn': DEFAULT_TURN,
  'dropshipsimulator:battle:log': [],
  'dropshipsimulator:battle:bankedDice': DEFAULT_BANKED_DICE,
  'dropshipsimulator:battle:actionPool': [],
};

function applyResetValues(values) {
  Object.entries(values).forEach(([key, value]) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage unavailable (private browsing, quota) — sync still works
    }
    publish(key, value);
  });
}

// Clears the active game's shared (synced) state. Any mounted
// useLocalStorageState for these keys picks this up via the same syncBus
// used for multiplayer sync, whether or not a BattlePage is currently
// mounted to see it happen.
export function resetActiveGame() {
  applyResetValues({
    ...BATTLE_RESET_VALUES,
    // Back to sandbox so a fresh #battle visit that bypasses PlayPage's mode
    // picker (a direct link, a stale tab) never silently resumes vs-computer
    // mode and auto-deploys a bot opponent nobody asked for this time.
    'dropshipsimulator:gameMode': 'sandbox',
  });
}

// Same board/turn/log reset as resetActiveGame(), but leaves gameMode (and
// therefore botDifficulty/myPlayer) untouched — used by the winner screen's
// "Play Again" (#159) so a vs-computer rematch starts back in vs-computer
// mode instead of silently dropping to sandbox.
export function restartBattle() {
  applyResetValues(BATTLE_RESET_VALUES);
}
