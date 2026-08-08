import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isWeaponUsable,
  isSplashWeapon,
  expectedDamage,
  stepToward,
  chooseBotAction,
  pickDeploymentHexes,
} from './bot.js';
import { hexDistance } from './hex.js';
import { DEFAULT_TERRAIN_TYPES } from './terrain.js';

afterEach(() => vi.restoreAllMocks());

const terrainTypes = DEFAULT_TERRAIN_TYPES;

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
  {
    id: 14,
    name: 'Wings',
    type: 'Movement',
    movement: 3,
    effect_stats: [{ stat: 'tags', amount: 'flying' }],
  },
  {
    id: 15,
    name: 'Mortar',
    type: 'Weapon',
    hit_dice: '1d8',
    range: '6',
    heat_rating: '1/6',
    effect_stats: [{ stat: 'tags', amount: 'indirect_fire' }],
  },
  {
    id: 20,
    name: 'Light Assault',
    type: 'Weapon',
    hit_dice: '4d4',
    range: '3',
    heat_rating: '1/4',
  },
  {
    id: 21,
    name: 'Flame Thrower',
    type: 'Weapon',
    hit_dice: '2d4',
    range: '3',
    heat_rating: '2/4',
    effect_stats: [{ stat: 'tags', amount: 'Fire' }],
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

  describe('Fire-tagged weapons (#209)', () => {
    const fireWeapon = {
      hit_dice: '2d8',
      effect_stats: [{ stat: 'tags', amount: 'fire' }],
    };
    const equipment = [
      { id: 9, name: 'Some Weapon', type: 'Weapon', hp: 5 },
    ];
    const baseline = expectedDamage(fireWeapon, units[0], 'left');

    it('discounts heavily when the hit side has equipment mounted (it becomes heat, not HP loss)', () => {
      const targetToken = {
        equippedIds: [9],
        weaponState: { 0: { heat: 0, broken: false, side: 'left' } },
      };
      const discounted = expectedDamage(
        fireWeapon,
        units[0],
        'left',
        targetToken,
        equipment,
      );
      expect(discounted).toBeGreaterThan(0);
      expect(discounted).toBeLessThan(baseline);
    });

    it('deals full value against a bare side (front/rear, or an empty slot)', () => {
      const targetToken = { equippedIds: [], weaponState: {} };
      expect(
        expectedDamage(fireWeapon, units[0], 'left', targetToken, equipment),
      ).toBeCloseTo(baseline);
      expect(
        expectedDamage(fireWeapon, units[0], 'front', targetToken, equipment),
      ).toBeCloseTo(expectedDamage(fireWeapon, units[0], 'front'));
    });

    it('is unaffected for a non-Fire weapon even on an equipped side', () => {
      const normalWeapon = { hit_dice: '2d8' };
      const targetToken = {
        equippedIds: [9],
        weaponState: { 0: { heat: 0, broken: false, side: 'left' } },
      };
      expect(
        expectedDamage(normalWeapon, units[0], 'left', targetToken, equipment),
      ).toBeCloseTo(expectedDamage(normalWeapon, units[0], 'left'));
    });
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

  // (#299) Reproduces "CPU not moving around 0hp unit": a single blocked hex
  // sits exactly on the one neighbor that most directly reduces distance to
  // the target, but a valid detour exists a step or two sideways. The old
  // greedy single-step-lookahead walk only ever compared its 6 immediate
  // neighbors each step; when none of them individually beat the current
  // distance (because the only one that does is blocked), it gave up
  // immediately instead of trying a hex that requires briefly not improving
  // distance before it can resume closing in.
  it('routes around a single blocking hex directly in its path instead of giving up (#299)', () => {
    const from = { col: 0, row: 0 };
    const to = { col: 0, row: 5 };
    // (0,1) is the only neighbor of (0,0) whose distance to (0,5) is less
    // than (0,0)'s own distance — block it and confirm a real detour (e.g.
    // through (1,0)/(1,1)) is still found rather than stalling in place.
    const isBlocked = (hex) => hex.col === 0 && hex.row === 1;
    const result = stepToward(from, to, 6, 0, isBlocked);
    expect(result).not.toEqual(from);
    expect(hexDistance(result, to)).toBeLessThan(hexDistance(from, to));
  });

  it('still respects maxSteps when the only route around an obstacle is longer (#299)', () => {
    const from = { col: 0, row: 0 };
    const to = { col: 0, row: 5 };
    const isBlocked = (hex) => hex.col === 0 && hex.row === 1;
    // Only 1 step allowed — not enough to complete the 2-step detour around
    // the blocked hex, so the model should still end up somewhere reachable
    // in a single step, never further than 1 hex from where it started.
    const result = stepToward(from, to, 1, 0, isBlocked);
    expect(hexDistance(from, result)).toBeLessThanOrEqual(1);
  });

  it('still stops at stopDistance even when routing around an obstacle (#299)', () => {
    const from = { col: 0, row: 0 };
    const to = { col: 0, row: 5 };
    const isBlocked = (hex) => hex.col === 0 && hex.row === 1;
    const result = stepToward(from, to, 10, 3, isBlocked);
    expect(hexDistance(result, to)).toBeGreaterThanOrEqual(3);
  });

  it('does not move at all when already within stopDistance, even with a detour available', () => {
    const from = { col: 0, row: 0 };
    const to = { col: 0, row: 2 };
    const result = stepToward(from, to, 10, 5, () => false);
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

  it('varies the layout from one call to the next instead of always picking the same evenly-spaced hexes (#303)', () => {
    const args = {
      count: 3,
      rows: [0, 1, 2, 3, 4, 5],
      cols: 10,
      occupied: new Set(),
    };

    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const layoutA = pickDeploymentHexes(args);

    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const layoutB = pickDeploymentHexes(args);

    expect(layoutA).not.toEqual(layoutB);
  });
});

describe('chooseBotAction', () => {
  it('returns null when the bot has no deployed tokens', () => {
    const result = chooseBotAction({
      tokens: [],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [],
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
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1', dieId: 'd1' });
    expect(result.destination).not.toEqual(bot.position);
  });

  it('spreads Move dice across the roster instead of one token hogging every die (#254)', () => {
    const bot1 = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [10, 11],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const bot2 = makeToken({
      id: 'bot2',
      unitId: 1,
      owner: 'p2',
      position: { col: 3, row: 0 },
      equippedIds: [10, 11],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 20 },
    });
    const dicePool = [
      { id: 'd1', label: 'Blue', value: 'Move', used: false },
      { id: 'd2', label: 'Blue', value: 'Move', used: false },
      { id: 'd3', label: 'Blue', value: 'Move', used: false },
    ];
    const baseArgs = {
      tokens: [bot1, bot2, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool,
      difficulty: 'simple',
    };

    const movedTokenIds = new Set();
    const first = chooseBotAction({ ...baseArgs, movedTokenIds });
    expect(first.tokenId).toBe('bot1');
    movedTokenIds.add(first.tokenId);

    const second = chooseBotAction({ ...baseArgs, movedTokenIds });
    expect(second.tokenId).toBe('bot2');
    movedTokenIds.add(second.tokenId);

    // Both tokens have now had a turn at the dice; since neither has closed
    // to weapon range yet, a repeat mover becomes eligible again rather than
    // the bot declaring it has nothing left to do.
    const third = chooseBotAction({ ...baseArgs, movedTokenIds });
    expect(third.tokenId).toBe('bot1');
  });

  it('lets a lone token keep using Move dice when it is the only one with anywhere to go', () => {
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
      position: { col: 0, row: 20 },
    });
    const dicePool = [
      { id: 'd1', label: 'Blue', value: 'Move', used: false },
      { id: 'd2', label: 'Blue', value: 'Move', used: false },
    ];
    const baseArgs = {
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool,
      difficulty: 'simple',
    };

    const movedTokenIds = new Set();
    const first = chooseBotAction({ ...baseArgs, movedTokenIds });
    expect(first.tokenId).toBe('bot1');
    movedTokenIds.add(first.tokenId);

    const second = chooseBotAction({ ...baseArgs, movedTokenIds });
    expect(second.tokenId).toBe('bot1');
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
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: true }],
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
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Green', value: 'Action', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({
      type: 'dropPod',
      tokenId: 'pod1',
      dieId: 'd1',
      aim: { col: 5, row: 6 },
    });
  });

  it('moves an already-deployed model with its own Move die before spending a spare Action die on a reserve drop pod (#230, #237)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11], // Chicken Legs, movement only — nothing to attack with
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
      position: { col: 10, row: 0 },
    });
    const result = chooseBotAction({
      tokens: [bot, pod, enemy],
      units,
      equipment,
      botOwner: 'p2',
      // A dedicated Move die alongside a spare Action die (#237: Action can
      // no longer cover Move directly) — the bot should still prefer moving
      // its own model over spending the Action die on the reserve pod.
      dicePool: [
        { id: 'd1', label: 'Blue', value: 'Move', used: false },
        { id: 'd2', label: 'Green', value: 'Action', used: false },
      ],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1', dieId: 'd1' });
  });

  it('drops a reserve pod instead of moving when the only spare die is an Action die (#237)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11], // Chicken Legs, movement only — nothing to attack with
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
      position: { col: 10, row: 0 },
    });
    const result = chooseBotAction({
      tokens: [bot, pod, enemy],
      units,
      equipment,
      botOwner: 'p2',
      // No Move die and only one die total, so there's nothing to spend on
      // an Exchange either — the Action die can only pay for the pod.
      dicePool: [{ id: 'd1', label: 'Green', value: 'Action', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({ type: 'dropPod', tokenId: 'pod1' });
  });

  it('moves toward an uncovered objective instead of the enemy under the "First to 11" scenario (#233)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11], // Chicken Legs, movement only — nothing to attack with
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 9, row: 0 },
    });
    const tiles = { '0,4': 'objective' };
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
      dimensions: { cols: 10, rows: 10 },
      tiles,
      terrainTypes,
      scenario: 'first-to-11',
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1' });
    expect(
      hexDistance(result.destination, { col: 0, row: 4 }),
    ).toBeLessThan(hexDistance(bot.position, { col: 0, row: 4 }));
  });

  it('ignores objectives and keeps chasing the enemy under the default Annihilation scenario', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11],
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 9, row: 0 },
    });
    const tiles = { '0,4': 'objective' };
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
      dimensions: { cols: 10, rows: 10 },
      tiles,
      terrainTypes,
      // No scenario passed — matches vs-computer's own default the same
      // way an unset gameScenario resolves to 'annihilation' (#232).
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1' });
    expect(
      hexDistance(result.destination, enemy.position),
    ).toBeLessThan(hexDistance(bot.position, enemy.position));
  });

  it('stops redirecting to an objective once it is already uncontested-held (#233)', () => {
    const holder = makeToken({
      id: 'holder1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 3 }, // adjacent to the objective at (0,4)
    });
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11],
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 9, row: 0 },
    });
    const tiles = { '0,4': 'objective' };
    const result = chooseBotAction({
      tokens: [holder, bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
      dimensions: { cols: 10, rows: 10 },
      tiles,
      terrainTypes,
      scenario: 'first-to-11',
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1' });
    expect(
      hexDistance(result.destination, enemy.position),
    ).toBeLessThan(hexDistance(bot.position, enemy.position));
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
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
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
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
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

  it('blocking terrain between attacker and target stops a shot (#178, #268)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [10],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 4 },
    });
    const tiles = { '0,2': 'buildings' };
    const base = {
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'simple',
      tiles,
      terrainTypes,
    };

    expect(chooseBotAction(base)).toBeNull();
  });

  it('an indirect-fire weapon ignores blocking terrain (#268)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [15], // Mortar, tagged indirect_fire
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 4 },
    });
    const tiles = { '0,2': 'buildings' };
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'simple',
      tiles,
      terrainTypes,
    });
    expect(result).toMatchObject({ type: 'attack', targetId: 'enemy1' });
  });

  it('water blocks a non-flying model from moving through it when no route around exists (#178, #265)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11], // Chicken Legs, no flying tag
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 2 },
    });
    // Every neighbor of (0,0) is water, so there's truly nowhere to step —
    // unlike the single-tile case below, no detour exists at all.
    const tiles = {
      '0,-1': 'water',
      '1,-1': 'water',
      '1,0': 'water',
      '0,1': 'water',
      '-1,0': 'water',
      '-1,-1': 'water',
    };
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
      tiles,
      terrainTypes,
    });
    expect(result).toBeNull();
  });

  it('a non-flying model routes around a single blocking water tile instead of stalling (#299)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11], // Chicken Legs, no flying tag
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 2 },
    });
    // (0,1) is the only neighbor of (0,0) that makes direct progress toward
    // (0,2), but a two-step detour around it (e.g. via (1,0)) exists within
    // the model's move range — the bot should take it rather than sit still
    // just because the single "obviously best" step is blocked (#299).
    const tiles = { '0,1': 'water' };
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
      tiles,
      terrainTypes,
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1' });
    expect(result.destination).not.toEqual(bot.position);
    expect(result.destination).not.toEqual({ col: 0, row: 1 });
    expect(hexDistance(result.destination, enemy.position)).toBeLessThan(
      hexDistance(bot.position, enemy.position),
    );
  });

  it('a flying model can move over water (#265)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [14], // Wings, tagged flying
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 2 },
    });
    const tiles = { '0,1': 'water' };
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
      tiles,
      terrainTypes,
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1' });
    expect(result.destination).not.toEqual(bot.position);
  });

  it('routes around an enemy 0 HP wreck blocking the path to a live enemy instead of stalling (#299)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 0, row: 0 },
      equippedIds: [11], // Chicken Legs, no flying tag
    });
    // An enemy-owned wreck — 0 HP but not yet marked `destroyed` (its owner
    // hasn't clicked "Model Destroyed" yet, which only that player's client
    // can do — the bot only auto-cleans its own wrecks) — sitting on the one
    // hex that most directly closes distance to the live enemy beyond it.
    // `occupied` (computeMoveCandidate) treats a 0 HP token exactly like a
    // live one for pathing purposes, so it blocks movement the same way a
    // live model would, even though it's excluded as a move/attack target
    // itself (#182, and the matching enemyTokens filter added for #299).
    const wreck = makeToken({
      id: 'wreck1',
      unitId: 3,
      owner: 'p1',
      position: { col: 0, row: 1 },
      currentHp: 0,
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 0, row: 2 },
    });
    const result = chooseBotAction({
      tokens: [bot, wreck, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1' });
    expect(result.destination).not.toEqual(bot.position);
    expect(result.destination).not.toEqual(wreck.position);
    expect(hexDistance(result.destination, enemy.position)).toBeLessThan(
      hexDistance(bot.position, enemy.position),
    );
  });

  it('does not fixate on a nearby 0 HP wreck as a move target while a live enemy sits farther off (#299)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [11], // Chicken Legs, no flying tag
    });
    // Adjacent already — nothing productive to do toward a corpse, but the
    // old unfiltered enemyTokens list would have made this the bot's
    // "nearest enemy" anyway, and since it's already as close as an occupied
    // hex allows, the token would sit idle forever instead of ever
    // considering the real, live enemy two tiles farther out (#299).
    const wreck = makeToken({
      id: 'wreck1',
      unitId: 3,
      owner: 'p1',
      position: { col: 5, row: 6 },
      currentHp: 0,
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 8 },
    });
    const result = chooseBotAction({
      tokens: [bot, wreck, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1' });
    expect(hexDistance(result.destination, enemy.position)).toBeLessThan(
      hexDistance(bot.position, enemy.position),
    );
  });

  it('does not target an enemy model already at 0 HP (#182)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [10],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const wreck = makeToken({
      id: 'wreck1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 6 },
      currentHp: 0,
    });
    const result = chooseBotAction({
      tokens: [bot, wreck],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'simple',
    });
    // No live enemy to attack, no Move die to reposition with either.
    expect(result).toBeNull();
  });

  it('prefers a live model over a drop pod, even when the pod is a better raw EV target (#180)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 2 },
      equippedIds: [10],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    // Delivery Capsule (unitId 4) has 0 armor everywhere — the highest raw
    // EV target on the board, but not one worth prioritizing (#180).
    const pod = makeToken({
      id: 'pod1',
      unitId: 4,
      owner: 'p1',
      position: { col: 5, row: 4 },
    });
    const liveUnit = makeToken({
      id: 'enemy1',
      unitId: 1,
      owner: 'p1',
      position: { col: 6, row: 2 },
    });
    const result = chooseBotAction({
      tokens: [bot, pod, liveUnit],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'tactical',
    });
    expect(result.targetId).toBe('enemy1');
  });

  it('still attacks a drop pod when it is the only target left (#180)', () => {
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      equippedIds: [10],
      weaponState: { 0: { heat: 0, broken: false } },
    });
    const pod = makeToken({
      id: 'pod1',
      unitId: 4,
      owner: 'p1',
      position: { col: 5, row: 6 },
    });
    const result = chooseBotAction({
      tokens: [bot, pod],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
      difficulty: 'simple',
    });
    expect(result.targetId).toBe('pod1');
  });

  // #200: the bot never used Exchange (#134) at all — it just gave up on an
  // otherwise-available attack or move whenever the pool had no die of that
  // exact value (or a flexible Action die) and quietly ended its turn.
  describe('exchanging a die (#200)', () => {
    it('exchanges a spare die for Attack when a target is in range but no Attack/Action die is available', () => {
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
      // Green's own faces (actionDice.json) are Action/Move only — it can
      // never become an Attack — so it must be skipped in favor of Blue,
      // which can.
      const result = chooseBotAction({
        tokens: [bot, enemy],
        units,
        equipment,
        botOwner: 'p2',
        dicePool: [
          { id: 'green1', label: 'Green', value: 'Move', used: false },
          { id: 'blue1', label: 'Blue', value: 'Move', used: false },
        ],
        difficulty: 'simple',
      });
      expect(result).toEqual({
        type: 'exchange',
        spendId: 'green1',
        targetId: 'blue1',
        newValue: 'Attack',
      });
    });

    it('exchanges a spare die for Move when a token wants to close distance but no Move/Action die is available', () => {
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
        dicePool: [
          { id: 'red1', label: 'Red', value: 'Attack', used: false },
          { id: 'blue1', label: 'Blue', value: 'Attack', used: false },
        ],
        difficulty: 'simple',
      });
      expect(result).toEqual({
        type: 'exchange',
        spendId: 'blue1',
        targetId: 'red1',
        newValue: 'Move',
      });
    });

    it('does not exchange when there is nothing useful to do even with the die it would gain', () => {
      // No weapon, no movement gear, so neither an Attack nor a Move
      // exchange would unlock anything — the bot should just end its turn.
      const bot = makeToken({
        id: 'bot1',
        unitId: 1,
        owner: 'p2',
        position: { col: 0, row: 0 },
        equippedIds: [],
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
        dicePool: [
          { id: 'red1', label: 'Red', value: 'Attack', used: false },
          { id: 'blue1', label: 'Blue', value: 'Attack', used: false },
        ],
        difficulty: 'simple',
      });
      expect(result).toBeNull();
    });

    it('does not exchange when only one spare die is available (nothing left to spend)', () => {
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
        dicePool: [{ id: 'blue1', label: 'Blue', value: 'Move', used: false }],
        difficulty: 'simple',
      });
      expect(result).toBeNull();
    });

    it('exchanges a spare die into Move for an idle token instead of into another Attack, when both are possible (#277, #280)', () => {
      // shooter already has a live target and no Move die to spend anyway
      // (no movement gear) — it's never a move candidate either way.
      const shooter = makeToken({
        id: 'shooter1',
        unitId: 1,
        owner: 'p2',
        position: { col: 5, row: 5 },
        equippedIds: [10],
        weaponState: { 0: { heat: 0, broken: false } },
      });
      // mover has nothing to shoot with, but somewhere to go — with no Move
      // die in the pool, it needs the exchange the shooter would otherwise
      // have claimed for one more Attack.
      const mover = makeToken({
        id: 'mover1',
        unitId: 1,
        owner: 'p2',
        position: { col: 0, row: 0 },
        equippedIds: [11],
      });
      const enemyNear = makeToken({
        id: 'enemyNear',
        unitId: 2,
        owner: 'p1',
        position: { col: 5, row: 6 },
      });
      const enemyFar = makeToken({
        id: 'enemyFar',
        unitId: 2,
        owner: 'p1',
        position: { col: 0, row: 10 },
      });
      const result = chooseBotAction({
        tokens: [shooter, mover, enemyNear, enemyFar],
        units,
        equipment,
        botOwner: 'p2',
        // Neither die is currently Attack or Move, but both Red and Yellow
        // can become either — old code always grabbed these for a bonus
        // Attack (shooter's target never runs out), starving mover's need.
        dicePool: [
          { id: 'd1', label: 'Red', value: 'Action', used: false },
          { id: 'd2', label: 'Yellow', value: 'Action', used: false },
        ],
        difficulty: 'simple',
      });
      expect(result).toEqual({
        type: 'exchange',
        spendId: 'd2',
        targetId: 'd1',
        newValue: 'Move',
      });
    });
  });

  it('does not credit a token with "already in range" when its only nearby target is out of arc, and moves it instead (#277, #280)', () => {
    // The weapon (id 10) is right-mounted only (see equipment fixture below);
    // the enemy sits behind the token, in raw range but outside any arc, so
    // there is no real shot even though the old distance-only check thought
    // there was.
    const bot = makeToken({
      id: 'bot1',
      unitId: 1,
      owner: 'p2',
      position: { col: 5, row: 5 },
      facing: 0,
      equippedIds: [10, 11],
      weaponState: { 0: { side: 'right', heat: 0, broken: false } },
    });
    const enemy = makeToken({
      id: 'enemy1',
      unitId: 2,
      owner: 'p1',
      position: { col: 5, row: 9 },
    });
    const result = chooseBotAction({
      tokens: [bot, enemy],
      units,
      equipment,
      botOwner: 'p2',
      dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
      difficulty: 'simple',
    });
    expect(result).toMatchObject({ type: 'move', tokenId: 'bot1' });
    expect(
      hexDistance(result.destination, enemy.position),
    ).toBeLessThan(hexDistance(bot.position, enemy.position));
  });

  describe('does not prefer a strictly worse weapon (#302)', () => {
    // Reproduces the reported scenario: a unit carrying both a Light Assault
    // (4d4, no tag) and a Flame Thrower (2d4, Fire-tagged) with a live enemy
    // dead ahead, in range and in arc of both mounts, whose hit side already
    // has equipment on it (so the Flame Thrower's damage would convert to
    // near-harmless heat, per #125/#209). Light Assault's raw EV (3) vastly
    // outweighs the Flame Thrower's fire-discounted EV (0.375) here, so any
    // difficulty should fire Light Assault — never the Flame Thrower.
    function buildScenario(equippedIds) {
      const bot = makeToken({
        id: 'bot1',
        unitId: 2,
        owner: 'p2',
        position: { col: 5, row: 5 },
        facing: 0,
        equippedIds,
        weaponState: {
          0: { side: equippedIds[0] === 20 ? 'left' : 'right', heat: 0, broken: false },
          1: { side: equippedIds[1] === 20 ? 'left' : 'right', heat: 0, broken: false },
        },
      });
      const enemy = makeToken({
        id: 'enemy1',
        unitId: 2,
        owner: 'p1',
        position: { col: 5, row: 2 },
        facing: 4,
        currentHp: 100,
        equippedIds: [11],
        weaponState: { 0: { side: 'left', heat: 0, broken: false } },
      });
      return { bot, enemy };
    }

    it.each(['simple', 'tactical', 'expert'])(
      'fires Light Assault, not the Flame Thrower, regardless of equipped-slot order (%s)',
      (difficulty) => {
        for (const equippedIds of [
          [20, 21],
          [21, 20],
        ]) {
          const { bot, enemy } = buildScenario(equippedIds);
          const result = chooseBotAction({
            tokens: [bot, enemy],
            units,
            equipment,
            botOwner: 'p2',
            dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
            difficulty,
          });
          expect(result).toMatchObject({ type: 'attack', attackerId: 'bot1' });
          expect(result.item.name).toBe('Light Assault');
        }
      },
    );
  });

  describe('rotates for free to reach an arc-restricted better weapon (#302 pt2)', () => {
    // Bot at (5,5) facing 0 (north). Enemy at (7,5) sits at a 90° relative
    // angle from the bot's facing (verified directly against hex.js). The
    // right-mounted arc is (-30,150), so Flame Thrower (right) is in arc;
    // the left-mounted arc is (-150,30), so Light Assault (left) is NOT in
    // arc at this facing — it never even appears in the option set, which is
    // the actual root cause the earlier #302 fix (Simple's `viable.reduce`
    // ranking) could not address: that fix only helps when both weapons are
    // already candidates and merely ranked wrong. Facing 2 is the only other
    // facing that puts Light Assault in arc (also verified directly against
    // hex.js), so a fixed bot should rotate there instead of settling for
    // the arc-limited Flame Thrower.
    function buildScenario(facing) {
      const bot = makeToken({
        id: 'bot1',
        unitId: 2,
        owner: 'p2',
        position: { col: 5, row: 5 },
        facing,
        equippedIds: [20, 21],
        weaponState: {
          0: { side: 'left', heat: 0, broken: false },
          1: { side: 'right', heat: 0, broken: false },
        },
      });
      const enemy = makeToken({
        id: 'enemy1',
        unitId: 2,
        owner: 'p1',
        position: { col: 7, row: 5 },
        facing: 0,
        currentHp: 100,
      });
      return { bot, enemy };
    }

    it.each(['simple', 'tactical', 'expert'])(
      'rotates to facing 2 instead of firing the arc-limited Flame Thrower (%s)',
      (difficulty) => {
        const { bot, enemy } = buildScenario(0);
        const result = chooseBotAction({
          tokens: [bot, enemy],
          units,
          equipment,
          botOwner: 'p2',
          dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
          difficulty,
        });
        expect(result).toEqual({ type: 'rotate', tokenId: 'bot1', facing: 2 });
      },
    );

    it.each(['simple', 'tactical', 'expert'])(
      'fires the now-unlocked Light Assault once already facing the direction the rotate picked (%s)',
      (difficulty) => {
        // Simulates the very next chooseBotAction call within the same bot
        // turn, after runBotTurn applied the rotate above — proves the loop
        // actually proceeds to attack with the better weapon instead of
        // rotating forever or never firing.
        const { bot, enemy } = buildScenario(2);
        const result = chooseBotAction({
          tokens: [bot, enemy],
          units,
          equipment,
          botOwner: 'p2',
          dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
          difficulty,
        });
        expect(result).toMatchObject({ type: 'attack', attackerId: 'bot1' });
        expect(result.item.name).toBe('Light Assault');
      },
    );

    it.each(['simple', 'tactical', 'expert'])(
      'does not rotate when the current facing already offers the best available option (%s)',
      (difficulty) => {
        const { bot, enemy } = buildScenario(2);
        const result = chooseBotAction({
          tokens: [bot, enemy],
          units,
          equipment,
          botOwner: 'p2',
          dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
          difficulty,
        });
        expect(result.type).not.toBe('rotate');
      },
    );

    it.each(['simple', 'tactical', 'expert'])(
      'does not rotate when no other facing offers a better option (single arc-restricted weapon) (%s)',
      (difficulty) => {
        // Only Flame Thrower is equipped — whichever facing puts it in arc,
        // its EV is identical (EV never depends on the attacker's own
        // facing, only on the fixed target/side/weapon), so there is no
        // "better" facing to rotate toward, and the bot should just fire.
        const bot = makeToken({
          id: 'bot1',
          unitId: 2,
          owner: 'p2',
          position: { col: 5, row: 5 },
          facing: 0,
          equippedIds: [21],
          weaponState: { 0: { side: 'right', heat: 0, broken: false } },
        });
        const enemy = makeToken({
          id: 'enemy1',
          unitId: 2,
          owner: 'p1',
          position: { col: 7, row: 5 },
          facing: 0,
          currentHp: 100,
        });
        const result = chooseBotAction({
          tokens: [bot, enemy],
          units,
          equipment,
          botOwner: 'p2',
          dicePool: [{ id: 'd1', label: 'Red', value: 'Attack', used: false }],
          difficulty,
        });
        expect(result).toMatchObject({ type: 'attack', item: { name: 'Flame Thrower' } });
      },
    );

    it('does not rotate without an Attack die available (nothing to fire with this iteration anyway)', () => {
      const { bot, enemy } = buildScenario(0);
      const result = chooseBotAction({
        tokens: [bot, enemy],
        units,
        equipment,
        botOwner: 'p2',
        dicePool: [{ id: 'd1', label: 'Blue', value: 'Move', used: false }],
        difficulty: 'tactical',
      });
      expect(result?.type).not.toBe('rotate');
    });
  });
});
