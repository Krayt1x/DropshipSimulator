import { describe, it, expect } from 'vitest';
import {
  isWeaponUsable,
  isSplashWeapon,
  expectedDamage,
  stepToward,
  chooseBotAction,
  pickDeploymentHexes,
} from './bot.js';
import { hexDistance } from './hex.js';

const units = [
  {
    id: 1,
    name: 'A10',
    manufacturer: 'Corp A',
    size: 'Small',
    hp: 5,
    armor: '2/2/2/1',
    dice_blue: 1,
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
  {
    id: 4,
    name: 'Delivery Capsule',
    manufacturer: 'Corp A',
    size: 'Drop Pod',
    hp: 5,
    armor: '0/0/0/0',
  },
  {
    id: 5,
    name: 'A15',
    manufacturer: 'Corp A',
    size: 'Small',
    hp: 6,
    // Uniform armor on every side so a test can ignore which side a splash
    // template actually lands on and focus purely on the EV comparison.
    armor: '2/2/2/2',
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
  {
    id: 13,
    name: 'Backup Rifle',
    type: 'Weapon',
    hit_dice: '1d8',
    range: '6',
    heat_rating: '1/6',
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

  it('processes its own wrecked (0 HP) model before attacking or moving (#154)', () => {
    const wreck = makeToken({
      id: 'bot1',
      unitId: 1, // A10, dice_blue: 1
      owner: 'p2',
      position: { col: 5, row: 5 },
      currentHp: 0,
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 6 },
    });
    const result = chooseBotAction({
      tokens: [wreck, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'simple',
    });
    expect(result).toEqual({ type: 'destroy', tokenId: 'bot1', dieColor: 'blue' });
  });

  it('never moves a token outside the board bounds (#155)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11], // Chicken Legs, movement 3
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 20 },
    });
    // A 3x3 board: unclamped, 3 steps south from (0,0) would land on row 3,
    // one past the last valid row (2).
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
      dimensions: { cols: 3, rows: 3 },
    });
    expect(result.destination.col).toBeGreaterThanOrEqual(0);
    expect(result.destination.row).toBeGreaterThanOrEqual(0);
    expect(result.destination.col).toBeLessThan(3);
    expect(result.destination.row).toBeLessThan(3);
  });

  it('does not move a token whose movement gear is overheated (#153)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11],
      weaponState: { 0: { heat: 99, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 10 },
    });
    // Chicken Legs (id 11) has no heat_rating in the fixture, so give it one
    // here via a per-test equipment override.
    const hotEquipment = equipment.map((item) =>
      item.id === 11 ? { ...item, heat_rating: '2/6' } : item,
    );
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment: hotEquipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
    });
    expect(result).toBeNull();
  });

  it('brings in a reserve drop pod with a spare Action die (#157, #158)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [10],
      weaponState: { 0: { heat: 10, broken: false } }, // overheated, can't attack
    });
    const pod = makeToken({
      id: 'pod1',
      unitId: 4, // Delivery Capsule / Drop Pod
      owner: 'p2',
      position: null,
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 6 },
    });
    const result = chooseBotAction({
      tokens: [bot, pod, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Green', value: 'Action', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({
      type: 'dropPod',
      tokenId: 'pod1',
      dieId: 'd1',
      aim: { col: 5, row: 6 },
    });
  });

  it('does not drop a pod without a spare Action die', () => {
    const pod = makeToken({
      id: 'pod1',
      unitId: 4,
      owner: 'p2',
      position: null,
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 6 },
    });
    const result = chooseBotAction({
      tokens: [pod, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
    });
    expect(result).toBeNull();
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

  it('the expert bot holds back a shot that would overheat a weapon when a safer one is available', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [10, 13],
      weaponState: {
        // One more shot from the Long Range Bolt (generate 2, max 6) would
        // push it to 7 heat and break it; the Backup Rifle is nowhere close.
        0: { heat: 5, broken: false },
        1: { heat: 0, broken: false },
      },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 6 },
      currentHp: 100,
    });
    const base = {
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
    };

    // Tactical only ranks by raw expected damage, so it fires the bigger
    // gun even though doing so breaks it.
    expect(
      chooseBotAction({ ...base, difficulty: 'tactical' }).instanceIndex,
    ).toBe(0);

    // Expert holds the overheating weapon back for the smaller gun that
    // won't break itself, since neither shot secures a kill anyway.
    expect(
      chooseBotAction({ ...base, difficulty: 'expert' }).instanceIndex,
    ).toBe(1);
  });

  it('the expert bot requires a bigger safety margin before a splash shot near its own tokens', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      // Far enough from the blast origin below that the bot doesn't also
      // catch itself in the template (only the ally at (5,6) does).
      position: { col: 5, row: 2 },
      equippedIds: [12],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const ally = makeToken({
      id: 'ally1',
      unitId: 5, // uniform armor 2 on every side
      owner: 'p2',
      position: { col: 5, row: 6 },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 3, // A30, armor 0 on every side
      owner: 'p1',
      position: { col: 6, row: 6 },
    });
    const base = {
      tokens: [bot, ally, enemy],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
    };

    // Tactical only asks whether the trade is nominally favorable — the
    // unarmored enemy takes more expected damage than the armored ally, so
    // it fires.
    expect(chooseBotAction({ ...base, difficulty: 'tactical' })).toMatchObject(
      { type: 'attack', isSplash: true },
    );

    // Expert wants a clearer margin before risking a blast near its own
    // model, so the same nominally-favorable trade isn't enough.
    expect(chooseBotAction({ ...base, difficulty: 'expert' })).toBeNull();
  });

  it('the expert bot moves toward the most wounded nearby enemy instead of just the nearest one', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11], // Chicken Legs, movement 3, no weapon
    });
    const nearestHealthy = makeToken({
      id: 'enemyA',
      unitId: 2,
      owner: 'p1',
      position: { col: 3, row: 0 },
      currentHp: 10,
    });
    const fartherWounded = makeToken({
      id: 'enemyB',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 5 },
      currentHp: 1,
    });
    const base = {
      tokens: [bot, nearestHealthy, fartherWounded],
      units,
      equipment,
      botOwner: 'p2',
      actionPool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
    };

    const tacticalResult = chooseBotAction({ ...base, difficulty: 'tactical' });
    expect(
      hexDistance(tacticalResult.destination, nearestHealthy.position),
    ).toBeLessThan(
      hexDistance(tacticalResult.destination, fartherWounded.position),
    );

    const expertResult = chooseBotAction({ ...base, difficulty: 'expert' });
    expect(
      hexDistance(expertResult.destination, fartherWounded.position),
    ).toBeLessThan(
      hexDistance(expertResult.destination, nearestHealthy.position),
    );
  });
});
