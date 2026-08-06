// A glossary of the game's terms and tags (#219), reachable from the
// settings menu — for a player who forgot what "Splash" or "Overheated"
// means without digging through the rulebook.
const SECTIONS = [
  {
    title: 'Equipment tags',
    terms: [
      {
        term: 'Flying',
        body: 'Ignores terrain that blocks movement (water, buildings, etc.) — a flying model can cross it freely.',
      },
      {
        term: 'Fire',
        body: "This weapon's damage is applied as heat instead of HP loss, but only when it lands on a side with equipment mounted there — heat only risks breaking that one item. Hitting a bare side (front/rear, or an empty slot) still deals full chassis damage.",
      },
      {
        term: 'Splash',
        body: 'Targets a tile instead of a model — every model on that tile and its six neighbors takes the hit, friend or foe.',
      },
      {
        term: 'Indirect Fire',
        body: 'Ignores blocking terrain when checking line of sight to a target.',
      },
      {
        term: 'Armor Plate',
        body: "Adds +1 armor to the side it's mounted on: Left/Right if equipped in a weapon slot, or Front and Rear if equipped in the Head slot.",
      },
      {
        term: 'Heat Sink',
        body: "After the end-of-turn heat cooldown, each Heat Sink pulls 1 point of heat from another piece of overheating equipment in the same slot, up to its own heat rating's max. Heat Sinks never transfer heat to each other; with more than one in a slot, they each get a turn in top-down order.",
      },
    ],
  },
  {
    title: 'Combat',
    terms: [
      {
        term: 'Armor',
        body: 'Shown as Front/Left/Right/Rear (e.g. "2/1/1/0") — subtracted from a weapon\'s hit dice size before counting damage.',
      },
      {
        term: 'Target Number',
        body: "A target's size (Micro 1, Small 2, Medium 3, Large 4, Huge 5) — a hit die roll of that value or lower counts as a hit.",
      },
      {
        term: 'Hit Dice',
        body: 'A weapon\'s attack roll, e.g. "2d8" — roll that many dice of that size against the target\'s Target Number.',
      },
      {
        term: 'Heat',
        body: 'Firing a weapon raises its heat by its heat rating\'s "generate" value. Heat cools by 1 on its owner\'s End Turn.',
      },
      {
        term: 'Overheated',
        body: "A weapon whose heat has passed its heat rating's max — it can't fire again until it cools back down.",
      },
      {
        term: 'Broken',
        body: 'A weapon or piece of equipment reduced to 0 HP — it stops working until repaired.',
      },
      {
        term: 'Drop Pod',
        body: "A reserve unit that deploys mid-game with an Action die instead of during normal deployment — aim a hex, then roll its deviation (1d4 distance, 1d6 direction). Anything it bounces off on the way down takes 10 rear damage.",
      },
    ],
  },
  {
    title: 'Action dice & the Dice Pool',
    terms: [
      {
        term: 'Dice Pool',
        body: 'The dice rolled at the start of your turn, spent on moving, attacking, and other actions. Rolled automatically from your dice color counts (see each unit\'s Blue/Red/Green/Yellow/Purple/Orange dice).',
      },
      {
        term: 'Move / Attack / Action faces',
        body: "A colored die lands on one of these three faces, and each only pays for its own kind: a Move die only for movement, an Attack die only for attacking, and an Action die only for actions like Drop Pods and Repairing. Use Exchange to turn a spare die into the face you actually need.",
      },
      {
        term: 'Exchange',
        body: "Spend one unused die to change a different unused die's face to whatever you need — useful when the pool doesn't have the face an action needs.",
      },
      {
        term: 'Banked dice',
        body: "When a model is destroyed, its owner may keep one of its dice colors banked into their pool for future turns instead of losing it entirely.",
      },
    ],
  },
  {
    title: 'Turns & victory',
    terms: [
      {
        term: 'Deployment Phase',
        body: 'The setup stage before Turn 1 — place reserve units on the board. The game only starts checking for a winner once this ends.',
      },
      {
        term: 'Victory Points',
        body: 'Earned by having a model adjacent to an uncontested Objective tile at the end of your turn.',
      },
      {
        term: 'Sandbox vs. vs Computer',
        body: "Sandbox is one person freely controlling both sides (great for testing or building scenarios) — it never auto-ends. vs Computer seats you against an AI opponent and ends normally once one side has no models left.",
      },
    ],
  },
  {
    title: 'Terrain',
    terms: [
      {
        term: 'Blocks movement',
        body: "A model can't move through this terrain (unless it has the Flying tag).",
      },
      {
        term: 'Blocks LOS',
        body: 'This terrain blocks line of sight — a weapon without Indirect Fire can\'t target through it.',
      },
      {
        term: 'Objective',
        body: 'A terrain type that grants Victory Points to whoever uncontestedly holds it at the end of their turn.',
      },
    ],
  },
  {
    title: 'Equipment slots',
    terms: [
      {
        term: 'Movement',
        body: "A unit's mobility gear — how far it can move each turn.",
      },
      {
        term: 'Left / Right',
        body: 'Weapon slots — a weapon mounted in one only fires into that side\'s firing arc.',
      },
      {
        term: 'Head',
        body: 'Augment slot — passive equipment with an always-on effect rather than something you fire or move with.',
      },
    ],
  },
];

function ReferencePage() {
  return (
    <div className="container">
      <h1 style={{ textAlign: 'center' }}>Reference</h1>
      <p
        className="unit-meta"
        style={{ textAlign: 'center', marginBottom: 24 }}
      >
        What the game's tags and terms mean.
      </p>
      {SECTIONS.map((section) => (
        <div className="card" key={section.title}>
          <p className="unit-name">{section.title}</p>
          <dl className="reference-list">
            {section.terms.map(({ term, body }) => (
              <div className="reference-term" key={term}>
                <dt>{term}</dt>
                <dd>{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export default ReferencePage;
