const HEADER_RE = /^(.+?)\s+\(([^)]+)\)\s*$/;
// DropshipBuilder appends " (1)", " (2)", etc. to tell multiple copies of
// the same unit apart (#151) — captured separately so it doesn't break
// matching against the unit list, but can still be kept as a per-token label.
const UNIT_LINE_RE = /^(.+?)(\s*\(\d+\))? - \d+t$/;
const ITEM_LINE_RE = /^([^:]+):\s*(.+)$/;

export function parseRosterExport(text, { units, manufacturers, equipment }) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const warnings = [];

  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  const headerMatch = lines[i]?.match(HEADER_RE);
  if (!headerMatch) {
    return {
      listName: '',
      manufacturer: '',
      entries: [],
      warnings: [
        'Could not find a "List Name (Faction)" header line — is this a DropshipBuilder share export?',
      ],
    };
  }
  const listName = headerMatch[1].trim();
  const manufacturer = headerMatch[2].trim();
  i++;
  if (lines[i]?.trim().startsWith('Weight:')) i++;

  if (!manufacturers.includes(manufacturer)) {
    warnings.push(
      `Unrecognized faction "${manufacturer}" — no units will match.`,
    );
  }

  const manufacturerUnits = units.filter(
    (u) => u.manufacturer === manufacturer,
  );
  const manufacturerEquipment = equipment.filter(
    (e) => e.manufacturer === manufacturer,
  );

  const entries = [];
  let current = null;
  function flush() {
    if (current) entries.push(current);
    current = null;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') {
      flush();
      continue;
    }
    if (/^\s/.test(line)) {
      if (!current) continue;
      const itemMatch = trimmed.match(ITEM_LINE_RE);
      if (!itemMatch) continue;
      const slotLabel = itemMatch[1].trim().toLowerCase();
      const itemName = itemMatch[2].trim();
      const item = manufacturerEquipment.find((e) => e.name === itemName);
      if (item) {
        current.equippedIds.push(item.id);
        current.equippedSides.push(
          slotLabel === 'left' || slotLabel === 'right' ? slotLabel : undefined,
        );
        // The raw slot label (#245), kept separate from equippedSides above
        // since that one only ever carries 'left'/'right' for arc-restriction
        // purposes — this instead tells Heat Sinks which slot ('head' included)
        // an item shares with others, without touching arc behavior at all.
        current.equippedSlots.push(slotLabel);
      } else {
        warnings.push(
          `Unknown equipment "${itemName}" on ${current.unit.name} — skipped.`,
        );
      }
      continue;
    }
    flush();
    const unitMatch = trimmed.match(UNIT_LINE_RE);
    if (!unitMatch) {
      warnings.push(`Could not parse line: "${trimmed}"`);
      continue;
    }
    const name = unitMatch[1].trim();
    const label = unitMatch[2]?.trim();
    const unit = manufacturerUnits.find((u) => u.name === name);
    if (!unit) {
      warnings.push(`Unknown unit "${name}" — skipped.`);
      continue;
    }
    current = {
      unit,
      equippedIds: [],
      equippedSides: [],
      equippedSlots: [],
      label,
    };
  }
  flush();

  if (entries.length === 0) {
    warnings.push('No units were found in the pasted text.');
  }

  return { listName, manufacturer, entries, warnings };
}
