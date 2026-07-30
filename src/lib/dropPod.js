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

// Walks the pod from `aim` in the rolled direction for (d4Roll - 1) hexes
// (#163 — 0-3 hexes rather than 1-4, clamped to the board edge), then, if it
// lands on an occupied hex, that model is hit and the pod deviates one
// further hex in the same direction — repeated until it lands somewhere
// empty or falls off the board. `findTokenAt` takes a {col,row} and returns
// the occupying token (or null/undefined).
export function resolveDropPod({ aim, d4Roll, d6Roll, dimensions, findTokenAt }) {
  const direction = directionFromD6(d6Roll);
  const distance = Number(d4Roll) - 1;
  let hex = aim;
  for (let i = 0; i < distance; i++) {
    const next = neighborHex(hex.col, hex.row, direction);
    if (!inBounds(next, dimensions)) break;
    hex = next;
  }

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
