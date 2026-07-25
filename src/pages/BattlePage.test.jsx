import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BattlePage from './BattlePage.jsx';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('BattlePage', () => {
  it('places a token on the board and shows its stat card', () => {
    render(<BattlePage />);

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

    fireEvent.change(screen.getByLabelText('Mech'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    fireEvent.click(screen.getByRole('button', { name: 'Move token' }));
    fireEvent.click(screen.getByTestId('hex-3,3'));

    expect(screen.getByText('A10', { selector: 'p.unit-name' })).toBeDefined();
  });

  it('imports a roster export into reserve and places a unit from it', () => {
    render(<BattlePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: [
          'Test List (Corp A)',
          'Weight: 6t / 100t',
          '',
          'A10 - 6t',
        ].join('\n'),
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

    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: { value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join('\n') },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(screen.getByRole('button', { name: 'Player 2' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    expect(screen.getByText('Player 2 (1)')).toBeDefined();
    expect(screen.queryByText('Player 1 (1)')).toBeNull();
  });

  it("prevents controlling another player's token once an identity is chosen", () => {
    window.localStorage.setItem('dropshipsimulator:myPlayer', JSON.stringify('p2'));
    render(<BattlePage />);

    // Only Player 2 should be offered as an owner when adding a unit.
    expect(screen.queryByRole('button', { name: 'Player 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Player 2' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Mech'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));

    // This token belongs to Player 2 (the locked owner), so it's controllable.
    expect(
      screen.getByRole('button', { name: 'Move token' }).disabled,
    ).toBe(false);
  });

  it('disables move/remove for a token belonging to the other player', () => {
    render(<BattlePage />);
    fireEvent.change(screen.getByLabelText('Mech'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place on board' }));
    fireEvent.click(screen.getByTestId('hex-0,0'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    window.localStorage.setItem('dropshipsimulator:myPlayer', JSON.stringify('p2'));
    cleanup();
    render(<BattlePage />);
    fireEvent.click(screen.getByTestId('hex-0,0'));

    expect(screen.getByRole('button', { name: 'Move token' }).disabled).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Remove from board' }).disabled,
    ).toBe(true);
  });

  it('toggles the deployment phase and renders zigzag boundary lines by default', () => {
    const { container } = render(<BattlePage />);

    expect(container.querySelectorAll('polyline')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Deployment Phase' }));
    expect(container.querySelectorAll('polyline')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Line' }));
    expect(container.querySelectorAll('polyline')).toHaveLength(0);
    expect(container.querySelectorAll('line')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Shaded zones' }));
    expect(container.querySelectorAll('line')).toHaveLength(0);
  });

  it('deploys a reserve unit onto the board via drag and drop', () => {
    render(<BattlePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: { value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join('\n') },
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
