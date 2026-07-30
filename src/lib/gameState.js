import { publish } from './syncBus.js';
import { emptyDiceTotals } from './tokens.js';

export const DEFAULT_TURN = { number: 1, active: 'p1' };
export const DEFAULT_BANKED_DICE = emptyDiceTotals();

const RESET_VALUES = {
  'dropshipsimulator:battle:tokens': [],
  'dropshipsimulator:battle:deploymentPhase': true,
  'dropshipsimulator:battle:turn': DEFAULT_TURN,
  'dropshipsimulator:battle:log': [],
  'dropshipsimulator:battle:bankedDice': DEFAULT_BANKED_DICE,
  'dropshipsimulator:battle:actionPool': [],
  // Back to sandbox so a fresh #battle visit that bypasses PlayPage's mode
  // picker (a direct link, a stale tab) never silently resumes vs-computer
  // mode and auto-deploys a bot opponent nobody asked for this time.
  'dropshipsimulator:gameMode': 'sandbox',
};

// Clears the active game's shared (synced) state. Any mounted
// useLocalStorageState for these keys picks this up via the same syncBus
// used for multiplayer sync, whether or not a BattlePage is currently
// mounted to see it happen.
export function resetActiveGame() {
  Object.entries(RESET_VALUES).forEach(([key, value]) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage unavailable (private browsing, quota) — sync still works
    }
    publish(key, value);
  });
}
