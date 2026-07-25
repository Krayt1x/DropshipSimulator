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

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

describe('BattlePage', () => {
  it('only shows Add unit / Import roster during the deployment phase', () => {
    render(<BattlePage />);

    expect(screen.getByRole('button', { name: 'Add unit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Import roster' })).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'End deployment phase' }),
    );
    expect(screen.queryByRole('button', { name: 'Add unit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import roster' })).toBeNull();
    expect(screen.queryByText(/only available during the/i)).toBeNull();
  });

  it('places a token on the board and shows its stat card', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();

    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
    expect(screen.getByText('5 / 5')).toBeDefined();
  });

  it('adjusts HP on the selected token', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();

    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(screen.getByText('4 / 5')).toBeDefined();
  });

  it('moves a selected token to a new hex', () => {
    vi.useFakeTimers();
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();

    fireEvent.click(screen.getByRole('button', { name: 'Move token' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));
    finishMoveAnimation();

    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('moves an on-board token by dragging it to a new hex', () => {
    vi.useFakeTimers();
    const { container } = render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();

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

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();

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

    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join(
          '\n',
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

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

    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join(
          '\n',
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

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

    // Only Player 2 should be offered as an owner when adding a unit.
    expect(screen.queryByRole('button', { name: 'Player 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Player 2' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Mech'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();

    // This token belongs to Player 2 (the locked owner), so it's controllable.
    expect(screen.getByRole('button', { name: 'Move token' }).disabled).toBe(
      false,
    );
  });

  it('disables move/destroy for a token belonging to the other player', () => {
    render(<BattlePage />);
    startDeploymentPhase();
    fireEvent.change(screen.getByLabelText('Mech'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();
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
    fireEvent.change(screen.getByLabelText('Mech'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();

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
    fireEvent.change(screen.getByLabelText('Mech'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();
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
    fireEvent.change(screen.getByLabelText('Mech'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    endDeploymentPhase();

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
    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join(
          '\n',
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

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

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(screen.getByText(/deployed A10 at \(0, 0\)/)).toBeDefined();
    endDeploymentPhase();

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

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 6t / 100t',
          '',
          'A10 - 6t',
          '  Right: Long Range Bolt',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );
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
});
