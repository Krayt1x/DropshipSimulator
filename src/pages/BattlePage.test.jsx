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

    // deployment phase now defaults to on: default board is 14 cols x 10
    // rows, giving 3 tinted rows per zone x 14 cols
    expect(container.querySelectorAll('polygon[fill^="rgba(37"]')).toHaveLength(
      42,
    );
    expect(
      container.querySelectorAll('polygon[fill^="rgba(220"]'),
    ).toHaveLength(42);

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
      42,
    );
    expect(
      container.querySelectorAll('polygon[fill^="rgba(220"]'),
    ).toHaveLength(42);
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
    fireEvent.click(screen.getByTestId('hex-5,6'));

    // Re-select A10 (the attacker) and arm its weapon.
    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));

    // A20 sits directly in the arc at distance 1 — a valid target.
    fireEvent.click(screen.getByTestId('hex-5,6'));
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
    fireEvent.click(screen.getByTestId('hex-5,6'));
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
    fireEvent.click(screen.getByTestId('hex-5,6'));

    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByTestId('hex-5,6'));
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
    fireEvent.click(screen.getByTestId('hex-5,6'));

    fireEvent.click(screen.getByTestId('hex-5,5'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByTestId('hex-5,6'));
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll to Hit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));
    randomSpy.mockRestore();

    expect(
      screen.getByText(new RegExp(`Long Range Bolt took ${damage} heat`)),
    ).toBeDefined();

    fireEvent.click(screen.getByTestId('hex-5,6'));
    expect(screen.getByText(new RegExp(`Heat ${damage} /`))).toBeDefined();
    expect(screen.queryByRole('checkbox').checked).toBe(false);
  });
});
