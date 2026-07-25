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
});
