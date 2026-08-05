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
    window.localStorage.setItem(
      'dropshipsimulator:gameScenario',
      JSON.stringify('first-to-11'),
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
    // in vs-computer mode instead of dropping to sandbox — same for the
    // scenario picked for this match (#232).
    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('vs-computer'),
    );
    expect(
      window.localStorage.getItem('dropshipsimulator:gameScenario'),
    ).toBe(JSON.stringify('first-to-11'));
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

  it('also resets the scenario back to annihilation (#232)', () => {
    window.localStorage.setItem(
      'dropshipsimulator:gameScenario',
      JSON.stringify('first-to-11'),
    );

    resetActiveGame();

    expect(
      window.localStorage.getItem('dropshipsimulator:gameScenario'),
    ).toBe(JSON.stringify('annihilation'));
  });
});
