import { describe, it, expect, beforeEach } from 'vitest';
import { resetActiveGame, restartBattle, DEFAULT_TURN } from './gameState.js';

beforeEach(() => window.localStorage.clear());

describe('restartBattle', () => {
  it('clears the battle state but leaves gameMode untouched (#159)', () => {
    window.localStorage.setItem(
      'dropshipsimulator:battle:tokens',
      JSON.stringify([{ id: 'token-1' }]),
    );
    window.localStorage.setItem(
      'dropshipsimulator:gameMode',
      JSON.stringify('vs-computer'),
    );

    restartBattle();

    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:battle:tokens')),
    ).toEqual([]);
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:battle:turn')),
    ).toEqual(DEFAULT_TURN);
    expect(
      JSON.parse(
        window.localStorage.getItem('dropshipsimulator:battle:deploymentPhase'),
      ),
    ).toBe(true);
    // Unlike resetActiveGame(), a rematch in vs-computer mode should stay
    // in vs-computer mode instead of dropping to sandbox.
    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('vs-computer'),
    );
  });
});

describe('resetActiveGame', () => {
  it('also resets gameMode back to sandbox', () => {
    window.localStorage.setItem(
      'dropshipsimulator:gameMode',
      JSON.stringify('vs-computer'),
    );

    resetActiveGame();

    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('sandbox'),
    );
  });
});
