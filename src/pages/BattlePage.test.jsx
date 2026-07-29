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

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

    fireEvent.click(screen.getByRole('button', { name: 'Move token' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Move token' }));
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
    expect(screen.getByRole('button', { name: 'Move token' }).disabled).toBe(
      false,
    );
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

    expect(screen.getByRole('button', { name: 'Move token' }).disabled).toBe(
      true,
    );
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

    fireEvent.click(screen.getByRole('button', { name: 'Move token' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));
    finishMoveAnimation();
    expect(screen.getByText(/moved A10 to \(3, 3\)/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    expect(screen.getByText(/Player 1 ended their turn/)).toBeDefined();
  });

  it('rolls a dice pool and logs the result', () => {
    render(<BattlePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add D6 to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add D6 to pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll (2)' }));

    expect(
      screen.getByText('D6', { selector: 'p.equipment-subheader' }),
    ).toBeDefined();
    expect(screen.getByText(/Rolled 2d6/)).toBeDefined();
  });

  it('deletes the game after confirming End Game', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BattlePage />);
    startDeploymentPhase();

    importA10ToReserve();
    fireEvent.click(screen.getByRole('button', { name: 'A10' }));
    endDeploymentPhase();
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    fireEvent.click(screen.getByRole('button', { name: 'End Game' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.queryByText('A10', { selector: 'p.unit-name' })).toBeNull();
    expect(screen.getByText('No actions yet.')).toBeDefined();

    confirmSpy.mockRestore();
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

    fireEvent.click(screen.getByRole('button', { name: 'Move token' }));
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
    // and broke once it hit 0.
    fireEvent.click(screen.getByTestId('hex-4,6'));
    expect(
      screen.getByText(new RegExp(`HP ${Math.max(0, 5 - damage)} / 5`)),
    ).toBeDefined();
    if (damage >= 5) {
      expect(screen.getByRole('checkbox').checked).toBe(true);
    }
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

    expect(screen.queryByText('Wait for your turn to roll dice.')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Add Blue to pool' }).disabled,
    ).toBe(false);
  });
});
