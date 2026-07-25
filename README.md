# Dropship Simulator

A browser-based game-state manager for Dropship, a tabletop wargame. It
doesn't referee the rules — players still need to know them — but it handles
the board, tokens, HP/heat tracking, and keeping two remote players in sync.

## Live Demo

🌐 https://Krayt1x.github.io/DropshipSimulator

## Features

- **Map editor** — resizable hex grid with user-defined tile types and
  optional background images (built-in presets or your own upload)
- **Battle board** — deploy units from the catalogue or import a roster
  exported from [DropshipBuilder](https://Krayt1x.github.io/DropshipBuilder),
  move/rotate tokens, track HP and per-weapon heat, mark units destroyed or
  return them to reserve, and run a Deployment Phase with zone highlighting
- **Multiplayer** — connect two browsers directly over WebRTC (no server, no
  accounts) so the map and battle board stay live-synced
- Per-browser player identity, so each side can only move/deploy their own
  units

## Development

```bash
npm install
npm run dev
```

### Testing

```bash
npm run test
npm run lint
npm run format:check
```

### Building

```bash
npm run build
```

## Contributing

- 📖 [Contribution Guide](./CONTRIBUTING.md)

---

Built with React and Vite. Licensed under MIT.
