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

  it("shows an equipped item's current (damaged) HP, not its max, on hover (#175)", () => {
    const unit = {
      manufacturer: 'Corp A',
      size: 'Medium',
      armor: '2/2/2/1',
      hp: 10,
    };
    const token = {
      currentHp: 10,
      weaponState: { 0: { heat: 0, broken: false, hp: 2 } },
    };
    const equippedItems = [
      { id: 3, instanceIndex: 0, name: 'Heavy Plating', hp: 5 },
    ];

    render(
      <UnitCardHeader
        unit={unit}
        token={token}
        equippedItems={equippedItems}
      />,
    );

    expect(screen.getByText(/HP 2 \/ 5/)).toBeDefined();
  });

  it("shows a weapon's current heat, not just its static generate/max rating (#295)", () => {
    const unit = {
      manufacturer: 'Corp A',
      size: 'Medium',
      armor: '2/2/2/1',
      hp: 10,
    };
    const token = {
      currentHp: 10,
      weaponState: { 0: { heat: 4, broken: false } },
    };
    const equippedItems = [
      {
        id: 2,
        instanceIndex: 0,
        name: 'Long Range Bolt',
        range: '9',
        hit_dice: '2d8',
        heat_rating: '2/6',
      },
    ];

    render(
      <UnitCardHeader
        unit={unit}
        token={token}
        equippedItems={equippedItems}
      />,
    );

    expect(screen.getByText(/Heat 4 \/ 6/)).toBeDefined();
  });
});
