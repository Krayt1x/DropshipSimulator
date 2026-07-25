import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnitCardHeader from './UnitCardHeader.jsx';

describe('UnitCardHeader', () => {
  it("shows each equipped weapon's hit dice", () => {
    const unit = {
      manufacturer: 'Corp A',
      size: 'Medium',
      armor: '2/2/2/1',
      hp: 10,
    };
    const token = { currentHp: 10 };
    const equippedItems = [
      {
        id: 2,
        name: 'Long Range Bolt',
        range: '9',
        hit_dice: '2d8',
        heat_rating: '4/6',
      },
    ];

    render(
      <UnitCardHeader
        unit={unit}
        token={token}
        equippedItems={equippedItems}
      />,
    );

    expect(screen.getByText(/Hit 2d8/)).toBeDefined();
  });
});
