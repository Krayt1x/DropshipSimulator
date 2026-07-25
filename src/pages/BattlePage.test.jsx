import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BattlePage from './BattlePage.jsx';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

function startDeploymentPhase() {
  fireEvent.click(screen.getByRole('button', { name: 'Deployment Phase' }));
}

describe('BattlePage', () => {
  it('only shows Add unit / Import roster during the deployment phase', () => {
    render(<BattlePage />);

    expect(screen.queryByRole('button', { name: 'Add unit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import roster' })).toBeNull();
    expect(screen.getByText(/only available during the/i)).toBeDefined();

    startDeploymentPhase();
    expect(screen.getByRole('button', { name: 'Add unit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Import roster' })).toBeDefined();
  });

  it('places a token on the board and shows its stat card', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
    expect(screen.getByText('10 / 10')).toBeDefined();
  });

  it('adjusts HP on the selected token', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(screen.getByText('9 / 10')).toBeDefined();
  });

  it('moves a selected token to a new hex', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    fireEvent.click(screen.getByRole('button', { name: 'Move token' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));

    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('moves an on-board token by dragging it to a new hex', () => {
    const { container } = render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    const tokenMarker = container.querySelector('[data-testid^="token-"]');
    const targetHex = screen.getByTestId('hex-4,4');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => targetHex;

    fireEvent.pointerDown(tokenMarker, { pointerId: 1 });
    fireEvent.pointerUp(tokenMarker, { pointerId: 1 });

    document.elementFromPoint = originalElementFromPoint;

    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    expect(screen.queryByText('A10', { selector: 'p.unit-name' })).toBeNull();
  });

  it('undoes the last move back to the previous hex', () => {
    render(<BattlePage />);
    startDeploymentPhase();

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(
      screen.getByRole('button', { name: 'Undo last move' }).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Move token' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));

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

    expect(screen.getByRole('button', { name: 'A10' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.queryByRole('button', { name: 'A10' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Model Destroyed' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Model Destroyed' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Return to reserve' }));

    expect(screen.getByText('Reserve (1)')).toBeDefined();
  });

  it('toggles the deployment phase and tints the top/bottom 3 rows of tiles', () => {
    const { container } = render(<BattlePage />);

    expect(container.querySelectorAll('polygon[fill^="rgba(37"]')).toHaveLength(
      0,
    );
    expect(
      container.querySelectorAll('polygon[fill^="rgba(220"]'),
    ).toHaveLength(0);

    startDeploymentPhase();
    // default board is 14 cols x 10 rows: 3 tinted rows per zone x 14 cols
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
});
