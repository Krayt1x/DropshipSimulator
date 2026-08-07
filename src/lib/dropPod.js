// Drop pod deviation/collision resolution (#158). Kept pure so both the
// human flow (BattlePage.jsx) and the bot (bot.js) share one implementation.
import { neighborHex } from './hex.js';

// Maps a 1d6 roll to one of the hex grid's 6 neighbor directions. 1=North
// (top), going clockwise, 4=South (bottom) — matching neighborHex's own
// 0=N,1=NE,2=SE,3=S,4=SW,5=NW clockwise ordering (see hex.js).
export function directionFromD6(d6Roll) {
  return (((Number(d6Roll) - 1) % 6) + 6) % 6;
}

function inBounds(hex, dimensions) {
  if (!dimensions) return true;
  return (
    hex.col >= 0 &&
    hex.row >= 0 &&
    hex.col < dimensions.cols &&
    hex.row < dimensions.rows
  );
}

// Walks `distance` hexes from `aim` in `direction`, stopping (and reporting
// whether it went off the board) rather than clamping to the edge — used by
// resolveDropPod both for the initial deviation and for judging whether a
// given direction is even worth trying (#292).
function walk(aim, direction, distance, dimensions) {
  let hex = aim;
  for (let i = 0; i < distance; i++) {
    const next = neighborHex(hex.col, hex.row, direction);
    if (!inBounds(next, dimensions)) return { hex, offBoard: true };
    hex = next;
  }
  return { hex, offBoard: false };
}

// Walks the pod from `aim` in the rolled direction for (d4Roll - 1) hexes
// (#163 — 0-3 hexes rather than 1-4), then, if it lands on an occupied hex,
// that model is hit and the pod deviates one further hex in the same
// direction — repeated until it lands somewhere empty or falls off the
// board. `findTokenAt` takes a {col,row} and returns the occupying token
// (or null/undefined).
//
// A direction that would send the pod off the board entirely gets rerolled
// instead of just clamping it to the edge (#292) — `rerollD6` (optional, a
// () => 1-6 roll) is called for a fresh direction, retried up to once per
// distinct direction so a genuinely cornered aim still terminates.
export function resolveDropPod({
  aim,
  d4Roll,
  d6Roll,
  dimensions,
  findTokenAt,
  rerollD6,
}) {
  const distance = Number(d4Roll) - 1;
  let roll = d6Roll;
  let direction = directionFromD6(roll);
  let walked = walk(aim, direction, distance, dimensions);

  if (walked.offBoard && rerollD6) {
    const tried = new Set([direction]);
    for (let attempt = 0; attempt < 6 && walked.offBoard; attempt++) {
      roll = rerollD6();
      direction = directionFromD6(roll);
      if (tried.has(direction)) continue;
      tried.add(direction);
      walked = walk(aim, direction, distance, dimensions);
    }
  }

  let hex = walked.hex;
  const hits = [];
  // Bounded rather than infinite — a fully packed board could otherwise
  // bounce forever.
  const MAX_BOUNCES = 20;
  for (let i = 0; i < MAX_BOUNCES; i++) {
    const occupant = findTokenAt?.(hex);
    if (!occupant) break;
    hits.push({ token: occupant, hex });
    const next = neighborHex(hex.col, hex.row, direction);
    if (!inBounds(next, dimensions)) break;
    hex = next;
  }

  return { hex, direction, hits };
}
