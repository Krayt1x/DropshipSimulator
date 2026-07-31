import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  act,
} from '@testing-library/react';
import BattlePage from './BattlePage.jsx';
import units from '../data/units.json';
import equipment from '../data/equipment.json';
import { sizeNumber, parseHeatRating } from '../lib/tokens.js';
import { parseArmor, calculateDamage } from '../lib/combat.js';
import { publish, subscribe } from '../lib/syncBus.js';

// BattlePage portals its TurnTracker into a slot App.jsx normally renders in
// the top menu bar (#136); standing this element in manually here since
// these tests render BattlePage on its own, without App around it.
beforeEach(() => {
  window.localStorage.clear();
  const slot = document.createElement('div');
  slot.id = 'topnav-turn-slot';
  document.body.appendChild(slot);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.getElementById('topnav-turn-slot')?.remove();
});

// Deployment phase now defaults to on (#75), so tests that used to need
// this to arm the phase no longer do — kept as a no-op so every existing
// call site stays valid without touching each one individually.
function startDeploymentPhase() {}

// TokenCard (the Unit Card) is now hidden while deployment phase is active
// (#87), so tests that need to interact with it must end the phase first.
function endDeploymentPhase() {
  fireEvent.click(screen.getByRole('button', { name: 'End deployment phase' }));
}

// The Dice roller's manual controls (Roll Action Pool, etc.) are collapsed
// by default now that rolling is automated (#171) — idempotent, so it's
// safe to call even if already expanded.
function expandDiceRoller() {
  // Scoped to the Dice roller card specifically — Turn order and the
  // Reserve/Roster panel have their own independent Collapse/Expand
  // toggles that would otherwise collide with a page-wide query.
  const header = screen.getByText('Dice roller').closest('.reserve-header');
  const expandBtn = within(header).queryByRole('button', { name: 'Expand' });
  if (expandBtn) fireEvent.click(expandBtn);
}

function collapseDiceRoller() {
  const header = screen.getByText('Dice roller').closest('.reserve-header');
  const collapseBtn = within(header).queryByRole('button', {
    name: 'Collapse',
  });
  if (collapseBtn) fireEvent.click(collapseBtn);
}

// A move now steps the token through each hex it crosses (#93) instead of
// jumping straight there, so tests that check the post-move state need to
// fast-forward past that animation first.
function finishMoveAnimation() {
  act(() => {
    vi.runAllTimers();
  });
}

// Import-only roster flow for "just get a plain A10 into reserve" (#113
// removed the manual Add unit form, so every test that used to arm a
// TokenForm draft now goes through the always-visible roster import panel).
function importA10ToReserve(extraLines = []) {
  fireEvent.change(screen.getByLabelText('Roster export'), {
    target: {
      value: [
        'Test List (Corp A)',
        'Weight: 6t / 100t',
        '',
        'A10 - 6t',
        ...extraLines,
      ].join('\n'),
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
  );
}

describe('BattlePage', () => {
  it('only shows the roster import panel during the deployment phase', () => {
    render(<BattlePage />);

    expect(screen.getByText('Import roster')).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'End deployment phase' }),
    );
    expect(screen.queryByText('Import roster')).toBeNull();
    expect(screen.queryByText(/only available during the/i)).toBeNull();
  });

  it('places a token on the board and shows its stat card', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    const a10Hp = units.find((u) => u.name === 'A10').hp;
    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
    expect(screen.getByText(`${a10Hp} / ${a10Hp}`)).toBeDefined();
  });

  it('adjusts HP on the selected token', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    const a10Hp = units.find((u) => u.name === 'A10').hp;
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(screen.getByText(`${a10Hp - 1} / ${a10Hp}`)).toBeDefined();
  });

  it('moves a selected token to a new hex', () => {
    vi.useFakeTimers();
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    // A real move spends a Move die (#162) — the turn-start auto-roll (#164)
    // ran before this token was deployed and came up empty, so roll manually.
    // Math.random mocked so red's face-index-3 ("Move") comes up reliably.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));
    finishMoveAnimation();

    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('moves an on-board token by dragging it to a new hex', () => {
    vi.useFakeTimers();
    const { container } = render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    // A real move spends a Move die (#162); mock so red's "Move" face wins.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    const tokenMarker = container.querySelector('[data-testid^="token-"]');
    const targetHex = screen.getByTestId('hex-4,4');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetHex;

    fireEvent.pointerDown(tokenMarker, { pointerId: 1 });
    fireEvent.pointerUp(tokenMarker, { pointerId: 1 });
    finishMoveAnimation();

    document.elementFromPoint = originalElementFromPoint;

    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    expect(screen.queryByText('A10', { selector: 'p.unit-name' })).toBeNull();
  });

  it('blocks a move that would land a non-flying model on water (#178, #265)', () => {
    vi.useFakeTimers();
    // (0,4) sits straight down the column from (0,0), so a token there is
    // moving directly onto the water tile with no detour available.
    window.localStorage.setItem(
      'dropshipsimulator:mapEditor:tiles',
      JSON.stringify({ '0,4': 'water' }),
    );
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Movement: Chicken Legs']);
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-0,4'));
    finishMoveAnimation();

    // Still on (0,0), not (0,4) — the water blocked the move.
    fireEvent.click(screen.getByTestId('hex-0,4'));
    expect(screen.queryByText('A10', { selector: 'p.unit-name' })).toBeNull();
    fireEvent.click(screen.getByTestId('hex-0,0'));
    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('blocks a move onto a hex already occupied by another model (#181)', () => {
    vi.useFakeTimers();
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 26t / 100t',
          '',
          'A10 - 6t',
          'A20 - 20t',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 2 units to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,4'));

    // Try to move the A10 (still at 0,0) straight onto the A20 at (0,4).
    fireEvent.click(screen.getByTestId('hex-0,0'));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-0,4'));
    finishMoveAnimation();

    // A10 never left (0,0) — the A20 blocked the destination.
    fireEvent.click(screen.getByTestId('hex-0,0'));
    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('blocks a longer move that would pass through an occupied hex (#181)', () => {
    vi.useFakeTimers();
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 26t / 100t',
          '',
          'A10 - 6t',
          'A20 - 20t',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 2 units to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    // A20 sits directly between (0,0) and (0,8), blocking the straight path.
    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,4'));

    fireEvent.click(screen.getByTestId('hex-0,0'));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-0,8'));
    finishMoveAnimation();

    // (0,8) itself was empty, but the A20 in the way still blocked the move.
    fireEvent.click(screen.getByTestId('hex-0,8'));
    expect(screen.queryByText('A10', { selector: 'p.unit-name' })).toBeNull();
    fireEvent.click(screen.getByTestId('hex-0,0'));
    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('undoes the last move back to the previous hex', () => {
    vi.useFakeTimers();
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(
      screen.getByRole('button', { name: 'Undo last move' }).disabled,
    ).toBe(true);

    // A real move spends a Move die (#162); mock so red's "Move" face wins.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));
    finishMoveAnimation();

    expect(
      screen.getByRole('button', { name: 'Undo last move' }).disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Undo last move' }));

    fireEvent.click(screen.getByTestId('hex-0,0'));
    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Undo last move' }).disabled,
    ).toBe(true);
  });

  it('refunds the spent Move die when undoing a move, for both a short (instant) and long (animated) move (#168)', () => {
    vi.useFakeTimers();
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    // A10 has 2 red dice; vary the mock slightly per call (still within
    // red's "Move" face bucket) so the two dice don't collide on the same
    // makeKey-generated id the way a constant mock would.
    let rollCall = 0;
    const poolRollSpy = vi
      .spyOn(Math, 'random')
      .mockImplementation(() => 0.5 + (rollCall++ % 5) * 0.01);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));
    poolRollSpy.mockRestore();
    expect(screen.getByRole('button', { name: /2 Move/ })).toBeDefined();

    // Adjacent hex -> the move completes synchronously (no animation),
    // exercising the same-tick race between useActionPoolDie and
    // moveTokenTo's own lastAction write.
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-0,1'));
    finishMoveAnimation();

    expect(
      screen.getByRole('button', { name: 'Undo last move' }).disabled,
    ).toBe(false);
    expect(screen.getByRole('button', { name: /1 Move/ })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Undo last move' }));
    expect(screen.getByRole('button', { name: /2 Move/ })).toBeDefined();

    // Now a distant hex -> the move completes later, on a timeout.
    fireEvent.click(screen.getByTestId('hex-0,0'));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));
    finishMoveAnimation();

    expect(screen.getByRole('button', { name: /1 Move/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo last move' }));
    expect(screen.getByRole('button', { name: /2 Move/ })).toBeDefined();
  });

  it('advances the turn tracker as each player ends their turn', () => {
    render(<BattlePage />);

    expect(screen.getByText('Turn 1')).toBeDefined();
    expect(screen.getByText('▲ Player 1')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    expect(screen.getByText('Turn 1')).toBeDefined();
    expect(screen.getByText('Player 2 ▼')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    expect(screen.getByText('Turn 2')).toBeDefined();
    expect(screen.getByText('▲ Player 1')).toBeDefined();
  });

  it('awards a victory point for a model adjacent to an uncontested objective on End Turn (#178, #179)', () => {
    const a10 = units.find((u) => u.name === 'A10');
    const token = {
      id: 'token-1',
      unitId: a10.id,
      manufacturer: a10.manufacturer,
      owner: 'p1',
      position: { col: 0, row: 0 },
      facing: 0,
      currentHp: a10.hp,
      equippedIds: [],
      weaponState: {},
      destroyed: false,
      label: null,
    };
    window.localStorage.setItem(
      'dropshipsimulator:battle:tokens',
      JSON.stringify([token]),
    );
    // (1,0) is adjacent to (0,0) — the default terrain types already include
    // an "objective" tile type (#178).
    window.localStorage.setItem(
      'dropshipsimulator:mapEditor:tiles',
      JSON.stringify({ '1,0': 'objective' }),
    );

    render(<BattlePage />);
    expect(screen.getAllByText('🏆 0')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));

    expect(screen.getByText('🏆 1')).toBeDefined();
    expect(screen.getByText(/scored 1 victory point/)).toBeDefined();
  });

  it('shows a toast naming whose turn it now is, then auto-dismisses it (#131)', () => {
    vi.useFakeTimers();
    render(<BattlePage />);

    expect(screen.queryByText(/turn/i, { selector: '.turn-toast' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    expect(screen.getByText('Your turn — Player 2')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Your turn — Player 2')).toBeNull();
  });

  it('imports a roster export into reserve and places a unit from it', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();

    expect(screen.getByText('Reserve (1)')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-1,1'));

    expect(screen.queryByText('Reserve (1)')).toBeNull();
    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('groups reserve units by owning player', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join(
          '\n',
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(screen.getByRole('button', { name: 'Player 2' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    expect(screen.getByText('Player 2 (1)')).toBeDefined();
    expect(screen.queryByText('Player 1 (1)')).toBeNull();
  });

  it('collapses and expands the reserve list', () => {
    render(<BattlePage />);
    startDeploymentPhase();
    importA10ToReserve();

    const reserveCard = screen.getByText('Reserve (1)').closest('.card');
    expect(screen.getByRole('button', { name: 'A10' })).toBeDefined();
    fireEvent.click(
      within(reserveCard).getByRole('button', { name: 'Collapse' }),
    );
    expect(screen.queryByRole('button', { name: 'A10' })).toBeNull();

    fireEvent.click(
      within(reserveCard).getByRole('button', { name: 'Expand' }),
    );
    expect(screen.getByRole('button', { name: 'A10' })).toBeDefined();
  });

  it("prevents controlling another player's token once an identity is chosen", () => {
    window.localStorage.setItem(
      'dropshipsimulator:myPlayer',
      JSON.stringify('p2'),
    );
    // This test is about ownership (canControl), not dice — seed a Move die
    // directly since it's Player 1's turn and this browser is Player 2's, so
    // neither a manual nor an automatic roll (#164) would populate one here
    // (#162).
    window.localStorage.setItem(
      'dropshipsimulator:battle:actionPool',
      JSON.stringify([{ id: 'test-move-die', label: 'Red', value: 'Move' }]),
    );
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join(
          '\n',
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    // Only Player 2 should be offered as an owner when importing.
    expect(screen.queryByRole('button', { name: 'Player 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Player 2' })).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    // This token belongs to Player 2 (the locked owner), so it's controllable.
    expect(screen.getByRole('button', { name: 'Move' }).disabled).toBe(false);
  });

  it('disables move/destroy for a token belonging to the other player', () => {
    render(<BattlePage />);
    startDeploymentPhase();
    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    window.localStorage.setItem(
      'dropshipsimulator:myPlayer',
      JSON.stringify('p2'),
    );
    cleanup();
    render(<BattlePage />);
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(screen.getByRole('button', { name: 'Move' }).disabled).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Model Destroyed' }).disabled,
    ).toBe(true);
  });

  it('marks a token destroyed and lists it under Destroyed Models', () => {
    render(<BattlePage />);
    startDeploymentPhase();
    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    fireEvent.click(screen.getByRole('button', { name: 'Model Destroyed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Destroy' }));

    expect(screen.getByText('Destroyed Models (1)')).toBeDefined();
    expect(
      screen.getByText('Destroyed', { selector: 'span.badge-destroyed' }),
    ).toBeDefined();
  });

  it('returns a destroyed model to reserve', () => {
    render(<BattlePage />);
    startDeploymentPhase();
    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    fireEvent.click(screen.getByRole('button', { name: 'Model Destroyed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Destroy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Return to reserve' }));

    expect(screen.queryByText('Destroyed Models (1)')).toBeNull();
    expect(screen.getByText('Reserve (1)')).toBeDefined();
  });

  it('returns a deployed token directly to reserve', () => {
    render(<BattlePage />);
    startDeploymentPhase();
    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    fireEvent.click(screen.getByRole('button', { name: 'Return to reserve' }));

    expect(screen.getByText('Reserve (1)')).toBeDefined();
  });

  it('toggles the deployment phase and tints the top/bottom 3 rows of tiles', () => {
    const { container } = render(<BattlePage />);

    // deployment phase now defaults to on: default board is 24 cols x 24
    // rows, giving 3 tinted rows per zone x 24 cols (#129)
    const tintedPerZone = 3 * 24;
    expect(container.querySelectorAll('polygon[fill^="rgba(37"]')).toHaveLength(
      tintedPerZone,
    );
    expect(
      container.querySelectorAll('polygon[fill^="rgba(220"]'),
    ).toHaveLength(tintedPerZone);

    fireEvent.click(
      screen.getByRole('button', { name: 'End deployment phase' }),
    );
    expect(container.querySelectorAll('polygon[fill^="rgba(37"]')).toHaveLength(
      0,
    );
    expect(
      container.querySelectorAll('polygon[fill^="rgba(220"]'),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Deployment Phase' }));
    expect(container.querySelectorAll('polygon[fill^="rgba(37"]')).toHaveLength(
      tintedPerZone,
    );
    expect(
      container.querySelectorAll('polygon[fill^="rgba(220"]'),
    ).toHaveLength(tintedPerZone);
  });

  it('deploys a reserve unit onto the board via drag and drop', () => {
    render(<BattlePage />);
    startDeploymentPhase();
    importA10ToReserve();

    const reserveItem = screen.getByRole('button', { name: 'A10' });
    endDeploymentPhase();
    const data = {};
    const dataTransfer = {
      setData: (type, value) => {
        data[type] = value;
      },
      getData: (type) => data[type],
    };
    fireEvent.dragStart(reserveItem, { dataTransfer });
    fireEvent.drop(screen.getByTestId('hex-2,2'), { dataTransfer });

    expect(screen.queryByText('Reserve (1)')).toBeNull();
    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('logs deployments, moves, and turn changes to the game log', () => {
    vi.useFakeTimers();
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(screen.getByText(/deployed A10 at \(0, 0\)/)).toBeDefined();

    // A real move spends a Move die (#162); mock so red's "Move" face wins.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));
    finishMoveAnimation();
    expect(screen.getByText(/moved A10 to \(3, 3\)/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    expect(screen.getByText(/Player 1 ended their turn/)).toBeDefined();
  });

  it('starts the Dice roller collapsed, hiding its manual controls but not the Action Pool results (#171)', () => {
    render(<BattlePage />);

    // Collapsed from the start — the manual pool controls aren't there yet.
    expect(
      screen.queryByRole('button', { name: 'Add Blue to pool' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull();

    // Roll a pool manually, then collapse again — the Action Pool results
    // stay visible even though the roller itself is collapsed.
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Add Blue to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll (1)' }));
    collapseDiceRoller();

    expect(
      screen.queryByRole('button', { name: 'Add Blue to pool' }),
    ).toBeNull();
    expect(document.querySelector('.dice-action-pool')).not.toBeNull();
  });

  it('rolls a dice pool and logs the result', () => {
    render(<BattlePage />);
    expandDiceRoller();

    fireEvent.click(screen.getByRole('button', { name: 'Add D6 to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add D6 to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll (2)' }));

    expect(
      screen.getByText('D6', { selector: 'p.equipment-subheader' }),
    ).toBeDefined();
    expect(screen.getByText(/Rolled 2d6/)).toBeDefined();
  });

  it("rolls the deployed unit's action dice immediately via Roll Action Pool, once per turn (#140)", () => {
    render(<BattlePage />);
    startDeploymentPhase();

    // A10 has dice_red: 2, so once it's deployed the active player has 2 Red
    // dice available to roll.
    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    expandDiceRoller();
    const rollActionPoolBtn = screen.getByRole('button', {
      name: 'Roll Action Pool',
    });
    expect(rollActionPoolBtn.disabled).toBe(false);

    fireEvent.click(rollActionPoolBtn);

    expect(
      screen.getByText('Red', { selector: 'p.equipment-subheader' }),
    ).toBeDefined();
    expect(screen.getByText(/Rolled 2 red/i)).toBeDefined();
    expect(rollActionPoolBtn.disabled).toBe(true);

    // Ending Player 1's turn hands it to Player 2, who has no deployed units
    // (and so no action dice of their own); ending again comes back around
    // to Player 1's next turn, where the gate resets and the pool
    // auto-rolls again on its own (#164) — already used, no manual click
    // needed this time.
    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    expandDiceRoller();
    expect(
      screen.getByRole('button', { name: 'Roll Action Pool' }).disabled,
    ).toBe(true);
    // Two log entries now: the manual roll above, and the auto-roll (#164)
    // for this new turn.
    expect(screen.getAllByText(/Rolled 2 red/i)).toHaveLength(2);
  });

  it("automatically rolls the Action Pool at the start of a player's turn, without a manual click (#164)", () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    // Deploying after deployment phase already ended doesn't itself trigger
    // a roll — only an actual turn-start transition does.
    expandDiceRoller();
    expect(
      screen.getByRole('button', { name: 'Roll Action Pool' }).disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));

    expect(
      screen.getByRole('button', { name: 'Roll Action Pool' }).disabled,
    ).toBe(true);
    expect(screen.getByText(/Rolled 2 red/i)).toBeDefined();
  });

  it('does not auto-roll the Action Pool during deployment phase, even once dice are available (#164)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'Deploy to board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    // Deployed with dice available, but still mid-deployment-phase — the
    // action pool must stay untouched until the real game starts.
    expect(
      window.localStorage.getItem('dropshipsimulator:battle:actionPool'),
    ).toBe(JSON.stringify([]));
  });

  it("never tints the model's own tile as part of its weapon's arc", () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Long Range Bolt']);
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    fireEvent.click(screen.getByRole('button', { name: 'Long Range Bolt' }));

    const ownHexGroup = screen.getByTestId('hex-5,5').closest('g');
    expect(
      ownHexGroup.querySelector('polygon[fill="rgba(220,38,38,0.4)"]'),
    ).toBeNull();
  });

  it("heats up a token's movement gear by 1 when it moves, and undo reverts it (#102)", () => {
    vi.useFakeTimers();
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Movement: Chicken Legs']);
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    expect(screen.getByText(/Heat 0 \/ 1/)).toBeDefined();

    // A real move spends a Move die (#162); mock so red's "Move" face wins.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByTestId('hex-8,8'));
    finishMoveAnimation();

    expect(screen.getByText(/Heat 1 \/ 1/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Undo last move' }));

    expect(screen.getByText(/Heat 0 \/ 1/)).toBeDefined();
  });

  it('runs the automated attack workflow: arc target, side pick, roll, and damage application (#103)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Derived from the live data files rather than hardcoded, since both are
    // synced from DropshipBuilder daily and their values can drift.
    const a20 = units.find((u) => u.name === 'A20');
    const weapon = equipment.find((e) => e.name === 'Long Range Bolt');
    expect(sizeNumber(a20.size)).toBeGreaterThanOrEqual(1);
    const dieSides = Number(weapon.hit_dice.match(/d(\d+)/)[1]);
    const rightArmor = parseArmor(a20.armor).right;
    const hits = 2; // both dice mocked to roll a 1, which is <= any real TN.
    const damage = calculateDamage(dieSides, rightArmor, hits);

    render(<BattlePage />);
    startDeploymentPhase();

    // Player 1: A10 with a right-mounted Long Range Bolt (2d8, range 9).
    importA10ToReserve(['  Right: Long Range Bolt']);

    // Player 2: A20 (Large, size 4, armor 2/2/2/1) with the same weapon in
    // its right slot, so the attack has something to damage there.
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 20t / 100t',
          '',
          'A20 - 20t',
          '  Right: Long Range Bolt',
        ].join('\n'),
      },
    });
    const importPanel = screen
      .getByRole('button', { name: 'Preview import' })
      .closest('.token-form');
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      within(importPanel).getByRole('button', { name: 'Player 2' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // A10's attack spends an Attack (or Action) die (#162); Math.random is
    // already mocked to 0 above, so this manual roll produces "Attack" too.
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-4,6'));

    // Re-select A10 (the attacker) and arm its weapon.
    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));

    // A20 sits directly in the arc at distance 1 — a valid target.
    fireEvent.click(screen.getByTestId('hex-4,6'));
    expect(
      screen.getByText(new RegExp(`Target: A20 \\(${a20.size}\\)`)),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll to Hit' }));

    // Math.random mocked to 0 -> both dice roll a 1, which is <= any real
    // target number -> 2 hits; (die size - right armor) * 2 hits = damage.
    const modal = screen
      .getByText(/Which side are you hitting/)
      .closest('.attack-modal');
    expect(within(modal).getByText(/2 hits/)).toBeDefined();
    expect(
      within(modal).getByText(new RegExp(`${damage} damage`)),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));
    expect(screen.queryByText(/Which side are you hitting/)).toBeNull();

    // The attacker's own weapon heated up by its heat_rating's generate
    // amount from the roll (#124), not a flat 1.
    const { generate: heatGenerate, max: heatMax } = parseHeatRating(
      weapon.heat_rating,
    );
    expect(
      screen.getByText(new RegExp(`Heat ${heatGenerate} / ${heatMax}`)),
    ).toBeDefined();

    // The target's right-slot weapon took the computed damage on its 5 HP
    // and broke once it hit 0. Scoped to the detailed weapon row (not the
    // card header's equipment summary, which shows the same "current / max"
    // text since #175) so the query stays unambiguous.
    fireEvent.click(screen.getByTestId('hex-4,6'));
    const weaponRow = screen
      .getByText('Long Range Bolt')
      .closest('.token-weapon-row');
    expect(
      within(weaponRow).getByText(
        new RegExp(`HP ${Math.max(0, 5 - damage)} / 5`),
      ),
    ).toBeDefined();
    if (damage >= 5) {
      expect(screen.getByRole('checkbox').checked).toBe(true);
    }
  });

  it('shakes the attack modal when a roll lands damage, but not on a miss (#161)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Long Range Bolt']);
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 20t / 100t',
          '',
          'A20 - 20t',
          '  Right: Long Range Bolt',
        ].join('\n'),
      },
    });
    const importPanel = screen
      .getByRole('button', { name: 'Preview import' })
      .closest('.token-form');
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      within(importPanel).getByRole('button', { name: 'Player 2' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // A10's attack spends an Attack (or Action) die (#162). Both of A10's
    // red dice need to land on "Attack" here, but a single constant mock
    // would give both dice's makeKey suffix the same value in the same
    // tick, colliding their ids — vary it slightly per call (still under
    // 1/6 so every call lands on red's "Attack" face) instead.
    let rollCall = 0;
    const poolRollSpy = vi
      .spyOn(Math, 'random')
      .mockImplementation(() => (rollCall++ % 5) * 0.02);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));
    poolRollSpy.mockRestore();

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-4,6'));

    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByTestId('hex-4,6'));
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));

    // A20 is Medium (target number 3); mocking Math.random near 1 rolls the
    // maximum face on the 2d8 (8), always over the target number -> a miss.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    fireEvent.click(screen.getByRole('button', { name: 'Roll to Hit' }));
    let modal = screen
      .getByText(/Which side are you hitting/)
      .closest('.attack-modal');
    expect(within(modal).getByText(/0 hits/)).toBeDefined();
    expect(modal.classList.contains('attack-modal-shake')).toBe(false);

    fireEvent.click(
      within(modal).getByRole('button', { name: 'Apply damage' }),
    );

    // Re-arm the same attack and roll again, this time landing a hit.
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByTestId('hex-4,6'));
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    // Math.random mocked to 0 -> both dice roll a 1, always <= the target
    // number -> a hit that lands damage (weapon.hit_dice guarantees >0 dice).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: 'Roll to Hit' }));
    modal = screen
      .getByText(/Which side are you hitting/)
      .closest('.attack-modal');
    expect(within(modal).queryByText(/0 hits/)).toBeNull();
    expect(modal.classList.contains('attack-modal-shake')).toBe(true);
  });

  it("cools a player's weapons by 1 heat when their turn ends (#121)", () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Long Range Bolt']);
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    // Order in the card: chassis HP +, weapon heat +, weapon HP + — the
    // weapon's heat button is the second "+" on the page.
    const heatPlusButton = () =>
      screen.getAllByRole('button', { name: '+' })[1];
    fireEvent.click(heatPlusButton());
    fireEvent.click(heatPlusButton());
    expect(screen.getByText(/Heat 2/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));

    expect(screen.getByText(/Heat 1/)).toBeDefined();
  });

  it('shows an action-pool summary and consumes a matching die when used (#120)', () => {
    render(<BattlePage />);
    expandDiceRoller();

    fireEvent.click(screen.getByRole('button', { name: 'Add Blue to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Blue to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll (2)' }));

    // Don't assume which 2 of Move/Action/Attack got rolled (that depends on
    // real randomness) — just check the pool's total count is 2, then use
    // whichever action has a nonzero count and confirm it drops by 1.
    const summary = document.querySelector('.dice-action-pool .dice-summary');
    const chips = within(summary).getAllByRole('button');
    const totalBefore = chips.reduce(
      (sum, btn) => sum + Number(btn.textContent.split(' ')[0]),
      0,
    );
    expect(totalBefore).toBe(2);

    const activeChip = chips.find((btn) => !btn.disabled);
    const [countText, actionWord] = activeChip.textContent.split(' ');

    fireEvent.click(activeChip);
    fireEvent.click(screen.getByRole('button', { name: 'Use Dice' }));

    expect(
      screen.getByRole('button', {
        name: `${Number(countText) - 1} ${actionWord}`,
      }),
    ).toBeDefined();
  });

  it('puts Use Dice and Exchange in the same row (#150)', () => {
    render(<BattlePage />);
    expandDiceRoller();

    fireEvent.click(screen.getByRole('button', { name: 'Add Blue to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Blue to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll (2)' }));

    const summary = document.querySelector('.dice-action-pool .dice-summary');
    const activeChip = within(summary)
      .getAllByRole('button')
      .find((btn) => !btn.disabled);
    fireEvent.click(activeChip);

    const useDiceBtn = screen.getByRole('button', { name: 'Use Dice' });
    const exchangeBtn = screen.getByRole('button', { name: 'Exchange' });
    expect(useDiceBtn.closest('.token-owner-row')).toBe(
      exchangeBtn.closest('.token-owner-row'),
    );
  });

  it("spends one action die to change a different one's rolled outcome (#134)", () => {
    // Real randomness here (not mocked) — the two Blue dice need distinct
    // ids, and mocking Math.random to a fixed value would collide the
    // random-suffixed ids makeKey() generates for both, same as the
    // Math.random-mock pitfall documented elsewhere in this file.
    render(<BattlePage />);
    expandDiceRoller();

    fireEvent.click(screen.getByRole('button', { name: 'Add Blue to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Blue to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll (2)' }));

    const exchangeToggle = screen.getByRole('button', { name: 'Exchange' });
    expect(exchangeToggle.disabled).toBe(false);
    fireEvent.click(exchangeToggle);

    // Spend, Change, and Into (#147) — the third lets the player pick what
    // the changed die's new outcome actually is, rather than rerolling it.
    // Change (#152) excludes whichever die Spend has selected, so with only
    // 2 unused dice total it's left with 1 option once Spend claims the
    // other.
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3);
    expect(within(selects[0]).getAllByRole('option')).toHaveLength(2);
    expect(within(selects[1]).getAllByRole('option')).toHaveLength(1);
    expect(within(selects[2]).getAllByRole('option')).toHaveLength(3);

    const confirmBtn = screen.getAllByRole('button', { name: 'Exchange' })[1];
    expect(confirmBtn.disabled).toBe(false);
    fireEvent.click(confirmBtn);

    // One of the two unused Blue dice was spent, so a further Exchange isn't
    // possible until another unused die is rolled.
    expect(screen.getByRole('button', { name: 'Exchange' }).disabled).toBe(
      true,
    );
    expect(
      screen.getByText(/Exchanged a blue die to change Blue's roll from/),
    ).toBeDefined();
  });

  it('rolls excess left/right attack damage onto another item on that side, then the chassis (#122)', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const weapon = equipment.find((e) => e.name === 'Long Range Bolt');
    const a20 = units.find((u) => u.name === 'A20');
    const lightAssault = equipment.find((e) => e.name === 'Light Assault');
    const flameThrower = equipment.find((e) => e.name === 'Flame Thrower');
    const dieSides = Number(weapon.hit_dice.match(/d(\d+)/)[1]);
    const rightArmor = parseArmor(a20.armor).right;
    const damage = calculateDamage(dieSides, rightArmor, 2); // 2 hits, TN always met

    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Long Range Bolt']);

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 20t / 100t',
          '',
          'A20 - 20t',
          '  Right: Light Assault',
          '  Right: Flame Thrower',
        ].join('\n'),
      },
    });
    const importPanel = screen
      .getByRole('button', { name: 'Preview import' })
      .closest('.token-form');
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      within(importPanel).getByRole('button', { name: 'Player 2' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // A10's attack spends an Attack (or Action) die (#162); Math.random is
    // already mocked to 0 above, so this manual roll produces "Attack" too.
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-4,6'));

    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByTestId('hex-4,6'));
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll to Hit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));
    randomSpy.mockRestore();

    const lightAssaultHp = Number(lightAssault.hp) || 0;
    const flameThrowerHp = Number(flameThrower.hp) || 0;
    const overflow = Math.max(0, damage - lightAssaultHp - flameThrowerHp);

    expect(
      screen.getByText(
        new RegExp(
          `Light Assault took ${Math.min(damage, lightAssaultHp)} damage and broke`,
        ),
      ),
    ).toBeDefined();
    if (damage > lightAssaultHp) {
      expect(
        screen.getByText(
          new RegExp(
            `Flame Thrower took ${Math.min(damage - lightAssaultHp, flameThrowerHp)} damage`,
          ),
        ),
      ).toBeDefined();
    }
    if (overflow > 0) {
      expect(
        screen.getByText(
          new RegExp(
            `took ${overflow} damage to the chassis \\(no right equipment left to absorb it\\)`,
          ),
        ),
      ).toBeDefined();
    }
  });

  it('applies Flame Thrower damage as heat instead of HP loss (#125)', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const flameThrower = equipment.find((e) => e.name === 'Flame Thrower');
    const a20 = units.find((u) => u.name === 'A20');
    const dieSides = Number(flameThrower.hit_dice.match(/d(\d+)/)[1]);
    const rightArmor = parseArmor(a20.armor).right;
    const damage = calculateDamage(dieSides, rightArmor, 2);

    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Flame Thrower']);

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 20t / 100t',
          '',
          'A20 - 20t',
          '  Right: Long Range Bolt',
        ].join('\n'),
      },
    });
    const importPanel = screen
      .getByRole('button', { name: 'Preview import' })
      .closest('.token-form');
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      within(importPanel).getByRole('button', { name: 'Player 2' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // A10's attack spends an Attack (or Action) die (#162); Math.random is
    // already mocked to 0 above, so this manual roll produces "Attack" too.
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-4,6'));

    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByTestId('hex-4,6'));
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll to Hit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));
    randomSpy.mockRestore();

    expect(
      screen.getByText(new RegExp(`Long Range Bolt took ${damage} heat`)),
    ).toBeDefined();

    fireEvent.click(screen.getByTestId('hex-4,6'));
    expect(screen.getByText(new RegExp(`Heat ${damage} /`))).toBeDefined();
    expect(screen.queryByRole('checkbox').checked).toBe(false);
  });

  it('disables Attack and shows an OVERHEATED badge once heat exceeds max (#127)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    const weapon = equipment.find((e) => e.name === 'Long Range Bolt');
    const { max: heatMax } = parseHeatRating(weapon.heat_rating);

    importA10ToReserve(['  Right: Long Range Bolt']);
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // Attacking spends an Attack (or Action) die (#162); mock so red's
    // "Attack" face wins.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    expect(screen.queryByText('OVERHEATED')).toBeNull();
    expect(screen.getByRole('button', { name: 'Attack' }).disabled).toBe(false);

    // Order in the card: chassis HP +, weapon heat +, weapon HP +.
    const heatPlusButton = () =>
      screen.getAllByRole('button', { name: '+' })[1];
    for (let i = 0; i <= heatMax; i++) {
      fireEvent.click(heatPlusButton());
    }

    expect(screen.getByText('OVERHEATED')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Attack' }).disabled).toBe(true);
  });

  it('disables Attack and Move once a model reaches 0 chassis HP (#160)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    const a10 = units.find((u) => u.name === 'A10');
    importA10ToReserve(['  Right: Long Range Bolt']);
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // Attacking/moving spends a matching (or Action) die (#162); mock so
    // red's "Action" face wins, covering both.
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    expect(screen.getByRole('button', { name: 'Attack' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Move' }).disabled).toBe(false);

    // Order in the card: chassis HP −, weapon heat −, weapon HP −.
    const chassisHpMinusButton = () =>
      screen.getAllByRole('button', { name: '−' })[0];
    for (let i = 0; i < Number(a10.hp); i++) {
      fireEvent.click(chassisHpMinusButton());
    }

    expect(screen.getByRole('button', { name: 'Attack' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Move' }).disabled).toBe(true);
    expect(
      screen.getByText('Destroyed — this model can no longer move.'),
    ).toBeDefined();
  });

  it('only allows picking sides visible to the attacker (#126)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Long Range Bolt']);

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 20t / 100t',
          '',
          'A20 - 20t',
          '  Right: Long Range Bolt',
        ].join('\n'),
      },
    });
    const importPanel = screen
      .getByRole('button', { name: 'Preview import' })
      .closest('.token-form');
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      within(importPanel).getByRole('button', { name: 'Player 2' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // A10's attack spends an Attack (or Action) die (#162); mock so red's
    // "Attack" face wins.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    // A20 defaults to facing north (p2), so sitting directly north of it
    // (A10's spot) puts the attacker in A20's front-left visibility cone —
    // Front and Left should be pickable, Right and Rear should not (#126).
    fireEvent.click(screen.getByTestId('hex-5,6'));

    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByTestId('hex-5,6'));

    expect(screen.getByRole('button', { name: 'Front' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Left' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Right' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Rear' }).disabled).toBe(true);
  });

  it('splashes an Artillery blast across the targeted tile and its 6 neighbors, one roll checked against every model under it (#123)', () => {
    const a20 = units.find((u) => u.name === 'A20');
    const artillery = equipment.find((e) => e.name === 'Artillery');
    const dieSides = Number(artillery.hit_dice.match(/d(\d+)/)[1]);
    const armor = parseArmor(a20.armor);
    const hits = 3; // all 3 dice mocked to roll a 1, always <= any target number

    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Artillery']);

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 40t / 100t',
          '',
          'A20 - 20t',
          '  Right: Long Range Bolt',
          '',
          'A20 - 20t',
          '  Right: Long Range Bolt',
        ].join('\n'),
      },
    });
    const importPanel = screen
      .getByRole('button', { name: 'Preview import' })
      .closest('.token-form');
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      within(importPanel).getByRole('button', { name: 'Player 2' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 2 units to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // A10's splash attack spends an Attack (or Action) die (#162); scoped
    // mock+restore (same id-collision concern as the later roll below) so
    // it doesn't affect the A20 tokens' ids created right after.
    const dieRollSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));
    dieRollSpy.mockRestore();

    // Origin-tile model (5,9 — 4 hexes due south, within Artillery's 3-9
    // range and its right-mounted arc): its side must be picked manually.
    fireEvent.click(screen.getAllByRole('button', { name: 'A20' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,9'));

    // Neighbor-tile model (6,9, one of the origin's 6 splash neighbors):
    // its side is derived automatically from the blast's origin (#123),
    // and works out to 'left' for this geometry (verified in hex.test.js).
    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-6,9'));

    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByTestId('hex-5,9'));

    const modal = screen.getByText(/blast at/).closest('.attack-modal');
    expect(within(modal).getByText(/pick the side hit below/)).toBeDefined();
    expect(within(modal).getByText(/left side/)).toBeDefined();

    fireEvent.click(within(modal).getByRole('button', { name: 'Front' }));
    // Mocked only for the roll itself — tokens are all already created by
    // this point, so this can't collide two tokens' random-suffixed ids the
    // way mocking it from the very start of the test would.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fireEvent.click(within(modal).getByRole('button', { name: 'Roll to Hit' }));

    // Landed damage on at least one target under the blast -> shakes (#161).
    expect(modal.classList.contains('attack-modal-shake')).toBe(true);

    const frontDamage = calculateDamage(dieSides, armor.front, hits);
    const leftDamage = calculateDamage(dieSides, armor.left, hits);
    // Per-target rows mix bold damage numbers with plain text ("... to the
    // chassis"), so a plain getByText regex can't span that node boundary —
    // read each row's own textContent instead. Rows render in the same
    // order tokens were placed: origin (chassis) first, neighbor (left) second.
    const resultRows = modal.querySelectorAll('.attack-result p');
    expect(resultRows[1].textContent).toMatch(
      new RegExp(`${frontDamage} damage`),
    );
    expect(resultRows[1].textContent).toMatch(/chassis/);
    expect(resultRows[2].textContent).toMatch(
      new RegExp(`${leftDamage} damage`),
    );
    expect(resultRows[2].textContent).toMatch(/left slot/);

    fireEvent.click(
      within(modal).getByRole('button', { name: 'Apply damage' }),
    );
    expect(screen.queryByText(/Which side/)).toBeNull();
    randomSpy.mockRestore();

    // The origin-tile model took its damage on the chassis (Front hit).
    fireEvent.click(screen.getByTestId('hex-5,9'));
    const originHp = Math.max(0, a20.hp - frontDamage);
    expect(
      screen.getByText(new RegExp(`${originHp} / ${a20.hp}`)),
    ).toBeDefined();

    // The neighbor-tile model has no left-slot equipment (only a Right
    // weapon), so its left-side hit rolled over straight to its chassis too.
    fireEvent.click(screen.getByTestId('hex-6,9'));
    const neighborHp = Math.max(0, a20.hp - leftDamage);
    expect(
      screen.getByText(new RegExp(`${neighborHp} / ${a20.hp}`)),
    ).toBeDefined();
  });

  it('only lets the active player use the dice roller once an identity is chosen (#130)', () => {
    window.localStorage.setItem(
      'dropshipsimulator:myPlayer',
      JSON.stringify('p2'),
    );
    render(<BattlePage />);
    expandDiceRoller();

    // Turn 1 starts with Player 1 active, so Player 2 can't roll yet.
    expect(screen.getByText('Wait for your turn to roll dice.')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Add Blue to pool' }).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));

    expect(screen.queryByText('Wait for your turn to roll dice.')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Add Blue to pool' }).disabled,
    ).toBe(false);
  });

  it('lets either player use the dice roller with no identity chosen (hotseat play)', () => {
    render(<BattlePage />);
    expandDiceRoller();

    expect(screen.queryByText('Wait for your turn to roll dice.')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Add Blue to pool' }).disabled,
    ).toBe(false);
  });

  it("broadcasts my selection and shows the peer's selected token and weapon range (#135)", () => {
    // Import/deploy both sides first, while no identity is locked yet (so
    // both owners are still offered) — then lock in "I'm Player 1" the same
    // way the real app does it live, over the same sync channel
    // useLocalStorageState already subscribes to, rather than needing a
    // remount.
    const { container } = render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Long Range Bolt']);
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 20t / 100t',
          '',
          'A20 - 20t',
        ].join('\n'),
      },
    });
    const importPanel = screen
      .getByRole('button', { name: 'Preview import' })
      .closest('.token-form');
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      within(importPanel).getByRole('button', { name: 'Player 2' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,6'));

    act(() => {
      publish('dropshipsimulator:myPlayer', 'p1');
    });

    const markers = container.querySelectorAll('[data-testid^="token-"]');
    const a20TokenId = markers[1]
      .getAttribute('data-testid')
      .replace('token-', '');

    // Selecting my (p1's) own token publishes my focus for p2 to see.
    let published = null;
    const unsubscribe = subscribe(
      'dropshipsimulator:battle:peerFocus',
      (value) => {
        published = value;
      },
    );
    fireEvent.click(screen.getByTestId('hex-5,5'));
    expect(published?.p1?.selectedTokenId).toBeTruthy();
    unsubscribe();

    // Simulate p2 (a peer, over the sync channel) having A20 selected.
    act(() => {
      publish('dropshipsimulator:battle:peerFocus', {
        p2: {
          selectedTokenId: a20TokenId,
          isMoving: false,
          weaponRange: null,
        },
      });
    });

    const a20Marker = markers[1];
    expect(a20Marker.querySelector('.peer-focus-ring')).not.toBeNull();
    const a10Marker = markers[0];
    expect(a10Marker.querySelector('.peer-focus-ring')).toBeNull();
  });

  it('shows a mobile tab bar and toggles which panel is active (#101)', () => {
    const { container } = render(<BattlePage />);

    expect(screen.getByRole('button', { name: 'Board' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Units' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Dice' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Log' })).toBeDefined();

    // Mobile starts on the Units tab (its Import sub-tab) rather than Board
    // (#165), so Units is active and Board isn't until a tab switch.
    const boardPanel = container.querySelector('.battle-board-column');
    expect(boardPanel.classList.contains('mobile-tab-panel-active')).toBe(
      false,
    );
    expect(
      screen
        .getByRole('button', { name: 'Units' })
        .classList.contains('active'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(boardPanel.classList.contains('mobile-tab-panel-active')).toBe(true);
  });

  it('hides the TokenCard while deployment phase is active, shows it once ended (#101)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));

    expect(document.querySelector('.card.token-card')).toBeNull();

    endDeploymentPhase();
    expect(document.querySelector('.card.token-card')).not.toBeNull();
  });

  it('shows a Deploy/Move floating action button for the selected controllable token (#101)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));

    // Works even before ending deployment phase (bypasses the hidden
    // TokenCard entirely, same movingTokenId toggle its own button uses).
    fireEvent.click(screen.getByRole('button', { name: 'Deploy' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(screen.getByText('Reserve (0)')).toBeDefined();

    endDeploymentPhase();
    fireEvent.click(screen.getByTestId('hex-0,0'));
    expect(screen.getByRole('button', { name: /^Move \(/ })).toBeDefined();
  });

  it('shows each die only once across the Move/Weapons FAB counts, not double-counted via Action (#167)', () => {
    // 1 Move + 3 Action + 4 Attack = 8 dice total; Move and Weapons must not
    // each separately add the Action dice on top of their own type.
    window.localStorage.setItem(
      'dropshipsimulator:battle:actionPool',
      JSON.stringify([
        { id: 'd-move', label: 'Blue', value: 'Move' },
        { id: 'd-action-1', label: 'Blue', value: 'Action' },
        { id: 'd-action-2', label: 'Blue', value: 'Action' },
        { id: 'd-action-3', label: 'Blue', value: 'Action' },
        { id: 'd-attack-1', label: 'Red', value: 'Attack' },
        { id: 'd-attack-2', label: 'Red', value: 'Attack' },
        { id: 'd-attack-3', label: 'Red', value: 'Attack' },
        { id: 'd-attack-4', label: 'Red', value: 'Attack' },
      ]),
    );
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Long Range Bolt']);
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(screen.getByRole('button', { name: 'Move (1)' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Weapons (4)' })).toBeDefined();
  });

  it('deploys a reserve token via its own Deploy to board button, jumping straight to the Board tab (#142)', () => {
    render(<BattlePage />);
    startDeploymentPhase();
    importA10ToReserve();

    // Explicitly select the Units tab (already the mobile default, #165).
    fireEvent.click(screen.getByRole('button', { name: /^Units$/i }));
    expect(
      document
        .querySelector('.battle-board-column')
        .className.includes('mobile-tab-panel-active'),
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Deploy to board' }));

    expect(
      document
        .querySelector('.battle-board-column')
        .className.includes('mobile-tab-panel-active'),
    ).toBe(true);
    expect(screen.getByText(/Tap a tile to deploy A10/)).toBeDefined();

    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(screen.queryByText(/Tap a tile to deploy/)).toBeNull();
    expect(screen.getByText('Reserve (0)')).toBeDefined();
  });

  it('renders the full Player 1/Player 2/End Turn panel inline next to the heading on mobile (#141)', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(<BattlePage />);

    const tracker = document.querySelector('.mobile-turn-tracker');
    expect(tracker).not.toBeNull();
    expect(tracker.querySelector('.split-tracker')).not.toBeNull();

    // The nav-bar's own copy (#136) is skipped while this inline one is
    // mounted, so there's never a duplicate "End Turn" button on screen.
    expect(screen.getAllByRole('button', { name: 'End Turn' })).toHaveLength(1);

    fireEvent.click(within(tracker).getByRole('button', { name: 'End Turn' }));

    expect(within(tracker).getByText(/Player 2/)).toBeDefined();
  });

  it('does not show a "Battle board" heading (#144)', () => {
    render(<BattlePage />);
    expect(screen.queryByText('Battle board')).toBeNull();
  });

  it('moves End Deploy into the mobile action toolbar next to Move/Weapons (#143)', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(<BattlePage />);
    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));

    const toolbar = document.querySelector('.mobile-action-toolbar');
    expect(toolbar).not.toBeNull();

    // Deployment phase starts active, so only "End Deploy" shows, inside the
    // Board tab's toolbar; only one instance of it exists anywhere on screen
    // — it's moved here, not duplicated alongside the desktop-only button.
    expect(
      within(toolbar).getByRole('button', { name: 'End Deploy' }),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Deploy Phase' })).toBeNull();
    expect(
      within(toolbar).getByRole('button', { name: 'Deploy' }),
    ).toBeDefined();
  });

  it('starts deployment from a button on the Units tab instead of the Board toolbar (#145)', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(<BattlePage />);
    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));

    fireEvent.click(screen.getByRole('button', { name: 'End Deploy' }));

    // Ending deployment removes the toolbar's toggle entirely; starting it
    // again is only offered from the Units tab now, not the Board tab.
    expect(screen.queryByRole('button', { name: 'End Deploy' })).toBeNull();

    const startBtn = screen.getByRole('button', { name: 'Deploy Phase' });
    expect(startBtn.closest('.mobile-action-toolbar')).toBeNull();

    fireEvent.click(startBtn);

    expect(
      within(document.querySelector('.mobile-action-toolbar')).getByRole(
        'button',
        { name: 'End Deploy' },
      ),
    ).toBeDefined();
  });

  it('offers Import as a tab alongside Reserve/Roster on mobile, switching to Reserve once a unit lands (#146)', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(<BattlePage />);

    // Import is offered (and active by default) even with nothing in
    // Reserve/Roster yet — otherwise there'd be no way to import the very
    // first unit on mobile.
    expect(screen.getByRole('button', { name: 'Import' }).className).toContain(
      'active',
    );
    expect(screen.getByLabelText('Roster export')).toBeDefined();

    importA10ToReserve();

    // A successful import jumps to Reserve automatically instead of leaving
    // the player stranded on the now-empty paste box.
    expect(screen.queryByLabelText('Roster export')).toBeNull();
    expect(screen.getByRole('button', { name: 'A10' })).toBeDefined();
  });

  it('does not offer an Import tab on desktop — the roster panel stays above Reserve/Roster (#146)', () => {
    render(<BattlePage />);
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    expect(screen.getByLabelText('Roster export')).toBeDefined();
  });

  it('imports duplicate copies of a unit with their "(N)" suffix kept as a label (#151)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 12t / 100t',
          '',
          'A10 (1) - 6t',
          '',
          'A10 (2) - 6t',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    // Matches against the unit list despite the "(N)" suffix, and the
    // preview shows it kept so the player can confirm which is which.
    expect(screen.queryByText(/Unknown unit/)).toBeNull();
    expect(screen.getByText('A10 (1)')).toBeDefined();
    expect(screen.getByText('A10 (2)')).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'Import 2 units to reserve' }),
    );

    // Kept on the actual token too, so multiple copies stay distinguishable
    // in the Reserve list once imported.
    expect(screen.getByRole('button', { name: 'A10 (1)' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'A10 (2)' })).toBeDefined();
  });

  it('shows a winner modal once a player has no live models left on the board (#159)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    // Player 1's A10.
    importA10ToReserve();

    // Player 2's A20.
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 20t / 100t',
          '',
          'A20 - 20t',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(screen.getByRole('button', { name: 'Player 2' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    endDeploymentPhase();

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-6,5'));

    expect(screen.queryByText(/Wins!/)).toBeNull();

    // A20 is still the selected token from placing it — no need to
    // re-select it via the Reserve tab (it's empty now that both are
    // deployed). Wreck it: chassis HP − is the first "−" button.
    const a20 = units.find((u) => u.name === 'A20');
    const chassisHpMinusButton = () =>
      screen.getAllByRole('button', { name: '−' })[0];
    for (let i = 0; i < Number(a20.hp); i++) {
      fireEvent.click(chassisHpMinusButton());
    }

    expect(screen.getByText('Player 1 Wins!')).toBeDefined();
    expect(
      screen.getByText('Player 2 has no models left on the board.'),
    ).toBeDefined();
    expect(screen.getByText('Player 2 models remaining')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }));

    // restartBattle() clears the board but leaves gameMode alone, so the
    // winner modal disappears and deployment starts fresh.
    expect(screen.queryByText(/Wins!/)).toBeNull();
    expect(
      JSON.parse(
        window.localStorage.getItem('dropshipsimulator:battle:tokens') ?? '[]',
      ),
    ).toEqual([]);
    expect(
      JSON.parse(
        window.localStorage.getItem(
          'dropshipsimulator:battle:deploymentPhase',
        ) ?? 'false',
      ),
    ).toBe(true);
  });

  it('shows the bot difficulty on the victory page in vs-computer mode, but not in sandbox (#169)', () => {
    // In vs-computer mode the bot owns and manages Player 2's roster itself
    // (it auto-imports on mount), so this only drives Player 1's own side —
    // Player 2 never gets a model onto the board within this synchronous
    // test, which is enough to reach the same "no models left" win state
    // the display feature only needs to be checked against.
    window.localStorage.setItem(
      'dropshipsimulator:gameMode',
      JSON.stringify('vs-computer'),
    );
    window.localStorage.setItem(
      'dropshipsimulator:botDifficulty',
      JSON.stringify('tactical'),
    );
    window.localStorage.setItem(
      'dropshipsimulator:myPlayer',
      JSON.stringify('p1'),
    );
    render(<BattlePage />);
    startDeploymentPhase();

    // Drone (Corp B) rather than A10 — the bot's own default roster (Corp
    // A) already contains two A10s, which would collide by name.
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp B)',
          'Weight: 10t / 100t',
          '',
          'Drone - 10t',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );
    endDeploymentPhase();

    fireEvent.click(screen.getByRole('button', { name: 'Drone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    expect(screen.getByText('Player 1 Wins!')).toBeDefined();
    expect(screen.getByText('vs Computer · Tactical')).toBeDefined();
  });

  it('does not show a difficulty line on the victory page in sandbox mode', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 20t / 100t',
          '',
          'A20 - 20t',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(screen.getByRole('button', { name: 'Player 2' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    endDeploymentPhase();

    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));

    fireEvent.click(screen.getByRole('button', { name: 'A20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-6,5'));

    const a20 = units.find((u) => u.name === 'A20');
    const chassisHpMinusButton = () =>
      screen.getAllByRole('button', { name: '−' })[0];
    for (let i = 0; i < Number(a20.hp); i++) {
      fireEvent.click(chassisHpMinusButton());
    }

    expect(screen.getByText('Player 1 Wins!')).toBeDefined();
    expect(screen.queryByText(/vs Computer/)).toBeNull();
  });

  it('does not declare a winner while models are only in reserve, or during deployment', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    endDeploymentPhase();

    // Nobody has deployed anything yet — 0 models each side shouldn't be
    // read as either player winning.
    expect(screen.queryByText(/Wins!/)).toBeNull();
  });

  it('does not let a drop pod count as defending the board (#159)', () => {
    const deliveryCapsule = units.find((u) => u.name === 'Delivery Capsule');
    const a10 = units.find((u) => u.name === 'A10');
    window.localStorage.setItem(
      'dropshipsimulator:battle:deploymentPhase',
      JSON.stringify(false),
    );
    window.localStorage.setItem(
      'dropshipsimulator:battle:tokens',
      JSON.stringify([
        {
          id: 'p1-token',
          unitId: a10.id,
          owner: 'p1',
          position: { col: 5, row: 5 },
          facing: 0,
          currentHp: a10.hp,
          equippedIds: [],
          weaponState: {},
          destroyed: false,
        },
        {
          id: 'p2-pod',
          unitId: deliveryCapsule.id,
          owner: 'p2',
          position: { col: 6, row: 5 },
          facing: 0,
          currentHp: deliveryCapsule.hp,
          equippedIds: [],
          weaponState: {},
          destroyed: false,
        },
      ]),
    );

    render(<BattlePage />);

    expect(screen.getByText('Player 1 Wins!')).toBeDefined();
    expect(
      screen.getByText('Player 2 has no models left on the board.'),
    ).toBeDefined();
  });

  it('arms an attack from the Board tab via the Weapons FAB, without needing the Units tab (#138)', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve(['  Right: Long Range Bolt']);
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-5,5'));
    // Attacking spends an Attack (or Action) die (#162); mock so red's
    // "Attack" face wins.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expandDiceRoller();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Action Pool' }));

    fireEvent.click(screen.getByRole('button', { name: /^Weapons \(/ }));
    const picker = screen
      .getByText('Choose a weapon')
      .closest('.mobile-attack-picker');
    expect(picker).not.toBeNull();

    fireEvent.click(
      within(picker).getByRole('button', { name: 'Long Range Bolt' }),
    );

    // Picker closes and the FAB now reads "Cancel attack" — same armed
    // state the TokenCard's own per-weapon Attack button drives.
    expect(screen.queryByText('Choose a weapon')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel attack' })).toBeDefined();
  });

  it('deploys itself and takes a full turn automatically in vs-computer mode', async () => {
    window.localStorage.setItem(
      'dropshipsimulator:gameMode',
      JSON.stringify('vs-computer'),
    );
    window.localStorage.setItem(
      'dropshipsimulator:botDifficulty',
      JSON.stringify('simple'),
    );
    window.localStorage.setItem(
      'dropshipsimulator:myPlayer',
      JSON.stringify('p1'),
    );

    render(<BattlePage />);

    // The bot equips and deploys its own roster without any input — except
    // its drop pods (Delivery Capsule), which stay in reserve until played
    // in with an Action die during the game (#157).
    await vi.waitFor(
      () => {
        const currentTokens = JSON.parse(
          window.localStorage.getItem('dropshipsimulator:battle:tokens') ??
            '[]',
        );
        const botTokens = currentTokens.filter((t) => t.owner === 'p2');
        const nonPodBotTokens = botTokens.filter((t) => {
          const unit = units.find((u) => Number(u.id) === Number(t.unitId));
          return unit?.size !== 'Drop Pod';
        });
        expect(nonPodBotTokens.length).toBeGreaterThan(0);
        expect(nonPodBotTokens.every((t) => t.position)).toBe(true);
        expect(
          botTokens
            .filter((t) => {
              const unit = units.find((u) => Number(u.id) === Number(t.unitId));
              return unit?.size === 'Drop Pod';
            })
            .every((t) => !t.position),
        ).toBe(true);
      },
      { timeout: 15000, interval: 100 },
    );

    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));

    // The bot rolls its Action Pool, takes whatever actions it can (which
    // depend on real dice rolls, so not asserted specifically here), and
    // hands the turn back — verified via the same log line a human's own
    // End Turn produces.
    await vi.waitFor(
      () => {
        expect(screen.getByText(/Player 2 ended their turn/)).toBeDefined();
      },
      { timeout: 15000, interval: 100 },
    );

    // `turn` syncs to localStorage via its own passive effect (useLocalStorageState),
    // one render tick behind the DOM update the assertion above already
    // waited for — so this needs its own wait rather than a synchronous read
    // right after, or it can catch localStorage a beat before that effect
    // flushes.
    await vi.waitFor(
      () => {
        const turn = JSON.parse(
          window.localStorage.getItem('dropshipsimulator:battle:turn') ?? '{}',
        );
        expect(turn.active).toBe('p1');
      },
      { timeout: 5000, interval: 50 },
    );
  });

  it('deploys the bot with the roster chosen on PlayPage, not the default one (#173)', async () => {
    window.localStorage.setItem(
      'dropshipsimulator:gameMode',
      JSON.stringify('vs-computer'),
    );
    window.localStorage.setItem(
      'dropshipsimulator:botDifficulty',
      JSON.stringify('simple'),
    );
    window.localStorage.setItem(
      'dropshipsimulator:myPlayer',
      JSON.stringify('p1'),
    );
    window.localStorage.setItem(
      'dropshipsimulator:botRoster',
      JSON.stringify({ type: 'specific', name: 'Flame Chicken Spam' }),
    );

    render(<BattlePage />);

    // Flame Chicken Spam is all A10s (plus a Delivery Capsule) — unlike the
    // default roster, it has no A30 or A20.
    await vi.waitFor(
      () => {
        const currentTokens = JSON.parse(
          window.localStorage.getItem('dropshipsimulator:battle:tokens') ??
            '[]',
        );
        const botTokens = currentTokens.filter((t) => t.owner === 'p2');
        expect(botTokens.length).toBeGreaterThan(0);
        expect(
          botTokens.every((t) => {
            const unit = units.find((u) => Number(u.id) === Number(t.unitId));
            return unit?.name === 'A10' || unit?.name === 'Delivery Capsule';
          }),
        ).toBe(true);
      },
      { timeout: 15000, interval: 100 },
    );
  });

  it('does not run any bot logic in sandbox mode', async () => {
    render(<BattlePage />);

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    // Give any (incorrectly firing) bot effect a moment to have acted.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const currentTokens = JSON.parse(
      window.localStorage.getItem('dropshipsimulator:battle:tokens') ?? '[]',
    );
    expect(currentTokens.filter((t) => t.owner === 'p2')).toHaveLength(0);
    expect(screen.queryByText(/Player 2 ended their turn/)).toBeNull();
  });
});
