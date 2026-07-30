import { describe, it, expect } from 'vitest';
import {
  isWeaponUsable,
  isSplashWeapon,
  expectedDamage,
  stepToward,
  chooseBotAction,
  pickDeploymentHexes,
} from './bot.js';

const units = [
  {
    id: 1,
    name: 'A10',
    manufacturer: 'Corp A',
    size: 'Small',
    hp: 5,
    armor: '2/2/2/1',
  },
  {
    id: 2,
    name: 'A20',
    manufacturer: 'Corp A',
    size: 'Medium',
    hp: 8,
    armor: '3/3/3/2',
  },
  {
    id: 3,
    name: 'A30',
    manufacturer: 'Corp A',
    size: 'Small',
    hp: 10,
    armor: '0/0/0/0',
  },
];

const equipment = [
  {
    id: 10,
    name: 'Long Range Bolt',
    type: 'Weapon',
    hit_dice: '2d8',
    range: '6',
    heat_rating: '2/6',
  },
  {
    id: 11,
    name: 'Chicken Legs',
    type: 'Movement',
    movement: 3,
  },
  {
    id: 12,
    name: 'Splash Cannon',
    type: 'Weapon',
    hit_dice: '1d8',
    range: '6',
    heat_rating: '1/4',
    effects: 'Hits the target tile and all adjacent tiles.',
  },
];

function makeToken({
  id,
  unitId,
  owner,
  position,
  facing = 0,
  equippedIds = [],
  weaponState = {},
  currentHp = 5,
}) {
  return {
    id,
    unitId,
    owner,
    position,
    facing,
    currentHp,
    equippedIds,
    weaponState,
    destroyed: false,
  };
}

describe('isWeaponUsable', () => {
  it('is false when broken', () => {
    expect(
      isWeaponUsable({ heat: 0, broken: true }, { heat_rating: '2/6' }),
    ).toBe(false);
  });

  it('is false when heat exceeds max', () => {
    expect(
      isWeaponUsable({ heat: 7, broken: false }, { heat_rating: '2/6' }),
    ).toBe(false);
  });

  it('is true within heat limits and not broken', () => {
    expect(
      isWeaponUsable({ heat: 4, broken: false }, { heat_rating: '2/6' }),
    ).toBe(true);
  });

  it('ignores heat when the weapon has no heat rating', () => {
    expect(isWeaponUsable({ heat: 99, broken: false }, {})).toBe(true);
  });
});

describe('isSplashWeapon', () => {
  it('detects the splash effects text', () => {
    expect(
      isSplashWeapon({ effects: 'Hits the target tile and all adjacent tiles.' }),
    ).toBe(true);
  });

  it('is false for a normal weapon', () => {
    expect(isSplashWeapon({ effects: 'Nothing special.' })).toBe(false);
  });
});

describe('expectedDamage', () => {
  it('computes expected damage from hit dice, size, and armor', () => {
    // 2d8, Small (targetNumber 2) vs front armor 2: expectedHits = 2*(2/8)=0.5,
    // damage = (8-2)*0.5 = 3.
    const weapon = { hit_dice: '2d8' };
    const targetUnit = units[0];
    expect(expectedDamage(weapon, targetUnit, 'front')).toBeCloseTo(3);
  });

  it('returns 0 for unparseable hit dice', () => {
    expect(expectedDamage({ hit_dice: 'lots' }, units[0], 'front')).toBe(0);
  });
});

describe('stepToward', () => {
  it('moves closer to the target without exceeding maxSteps', () => {
    const from = { col: 0, row: 0 };
    const to = { col: 0, row: 5 };
    const result = stepToward(from, to, 2, 0, () => false);
    expect(result).not.toEqual(from);
    // Never overshoots the requested step budget.
    const totalDistance = Math.abs(to.row - from.row);
    const resultDistance = Math.abs(to.row - result.row);
    expect(totalDistance - resultDistance).toBeLessThanOrEqual(2);
  });

  it('stops short of the target when stopDistance is set (kiting)', () => {
    const from = { col: 0, row: 0 };
    const to = { col: 0, row: 10 };
    const result = stepToward(from, to, 10, 4, () => false);
    expect(Math.abs(to.row - result.row)).toBeGreaterThanOrEqual(4);
  });

  it('does not move onto a blocked hex', () => {
    const from = { col: 0, row: 0 };
    const to = { col: 0, row: 1 };
    // Every neighbor is blocked, so the walk should just stay put.
    const result = stepToward(from, to, 5, 0, () => true);
    expect(result).toEqual(from);
  });
});

describe('pickDeploymentHexes', () => {
  it('returns the requested count of distinct, unoccupied hexes within the zone', () => {
    const hexes = pickDeploymentHexes({
      count: 3,
      rows: [0, 1, 2],
      cols: 5,
      occupied: new Set(),
    });
    expect(hexes).toHaveLength(3);
    const keys = hexes.map((h) => `${h.col},${h.row}`);
    expect(new Set(keys).size).toBe(3);
    hexes.forEach((h) => {
      expect(h.row).toBeGreaterThanOrEqual(0);
      expect(h.row).toBeLessThanOrEqual(2);
      expect(h.col).toBeGreaterThanOrEqual(0);
      expect(h.col).toBeLessThan(5);
    });
  });

  it('skips already-occupied hexes', () => {
    const occupied = new Set(['0,0', '1,0', '2,0', '3,0']);
    const hexes = pickDeploymentHexes({
      count: 1,
      rows: [0],
      cols: 5,
      occupied,
    });
    expect(hexes).toHaveLength(1);
    expect(occupied.has(`${hexes[0].col},${hexes[0].row}`)).toBe(false);
  });
});

describe('chooseBotAction', () => {
  it('returns null when the bot has no deployed tokens', () => {
    const result = chooseBotAction({
      tokens: [],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [],
      difficulty: 'simple',
    });
    expect(result).toBeNull();
  });

  it('attacks an enemy in range when an Attack die is available', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [10],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 6 },
    });
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({
      type: 'attack',
      attackerId: 'bot1',
      targetId: 'enemy1',
      dieId: 'd1',
    });
  });

  it('does not attack with an overheated weapon', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [10],
      weaponState: { 0: { heat: 10, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 6 },
    });
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'simple',
    });
    expect(result).toBeNull();
  });

  it('moves toward the nearest enemy when nothing is in range and a Move die is available', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [10, 11],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 10 },
    });
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1', dieId: 'd1' });
    expect(result.destination).not.toEqual(bot.position);
  });

  it('returns null once every die is used', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [10],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 6 },
    });
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Red', value: 'Attack', used: true }],
      difficulty: 'simple',
    });
    expect(result).toBeNull();
  });

  it('the tactical bot prefers a kill over a higher-expected-damage option', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [10],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    // Armor 2 on unit 1 gives ~3 expected damage — a kill against 1 HP.
    const weakEnemy = makeToken({
      id: 'weak',
      unitId: 1,
      owner: 'p1',
      position: { col: 5, row: 6 },
      currentHp: 1,
    });
    // Armor 0 on unit 3 gives ~4 expected damage — higher raw EV, but not
    // enough to kill its much higher HP.
    const toughEnemy = makeToken({
      id: 'tough',
      unitId: 3,
      owner: 'p1',
      position: { col: 6, row: 5 },
      currentHp: 10,
    });
    const result = chooseBotAction({
      tokens: [bot, toughEnemy, weakEnemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'tactical',
    });
    expect(result.targetId).toBe('weak');
  });

  it("a splash weapon skips a shot that would catch more of the bot's own tokens than enemies (tactical)", () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [12],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const ally = makeToken({
      id: 'ally1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 6 },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 6, row: 6 },
    });
    const result = chooseBotAction({
      tokens: [bot, ally, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'tactical',
    });
    expect(result).toBeNull();
  });
});
