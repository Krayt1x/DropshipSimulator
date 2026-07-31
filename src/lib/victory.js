// Victory point scoring (#179), currently earned only from contesting
// objective terrain (#178) at the end of a turn.
import { hexDistance } from './hex.js';
import { objectiveHexesFrom } from './terrain.js';

// A player gains 1 VP per own model adjacent to an objective, unless an
// enemy model is adjacent to that same model or to that same objective hex
// — either one contests it. A model can only ever score once per turn even
// if it's adjacent to several uncontested objectives.
export function computeObjectiveVp({ tokens, tiles, terrainTypes, owner }) {
  const objectiveHexes = objectiveHexesFrom(tiles, terrainTypes);
  if (objectiveHexes.length === 0) return 0;

  const myTokens = tokens.filter(
    (t) => t.owner === owner && t.position && !t.destroyed,
  );
  const enemyTokens = tokens.filter(
    (t) => t.owner !== owner && t.position && !t.destroyed,
  );

  let vp = 0;
  myTokens.forEach((token) => {
    const tokenIsContested = enemyTokens.some(
      (e) => hexDistance(e.position, token.position) === 1,
    );
    if (tokenIsContested) return;
    const scoresAnObjective = objectiveHexes.some((hex) => {
      if (hexDistance(token.position, hex) !== 1) return false;
      const objectiveIsContested = enemyTokens.some(
        (e) => hexDistance(e.position, hex) === 1,
      );
      return !objectiveIsContested;
    });
    if (scoresAnObjective) vp += 1;
  });
  return vp;
}
