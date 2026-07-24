# Dropship Simulator

A browser-based hex map builder for Dropship, a tabletop wargame. Combat rules
are still being drafted — this repo currently holds the hex battlefield
editor, with the turn-based game engine to follow once the rules are locked
down.

## Live Demo

🌐 https://Krayt1x.github.io/DropshipSimulator

## Features

- Resizable hex grid (pointy-top hexes, adjustable columns/rows)
- Define your own tile types (name + color) and paint/erase them onto the
  board — nothing is hardcoded, since terrain rules aren't finalized yet
- Board state persists locally in the browser

## Development

```bash
npm install
npm run dev
```

### Testing

```bash
npm run test
```

### Building

```bash
npm run build
```

---

Built with React and Vite.
