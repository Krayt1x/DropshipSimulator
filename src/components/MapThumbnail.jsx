import { hexToPixel, hexPointsAttr, boardPixelSize } from '../lib/hex.js';
import { terrainAt } from '../lib/terrain.js';

// A small rendered preview of a map's terrain layout (#226), shown in place
// of a generic map emoji wherever pre-made maps are listed — same hex
// geometry the real board/editor use, just drawn at a fixed small hex size
// and scaled down to icon size via the SVG viewBox.
const THUMBNAIL_HEX_SIZE = 6;

// Passing size="full" (#258) stretches the SVG to its container's width
// instead of a fixed pixel size — the viewBox still preserves the map's
// aspect ratio, so the rendered hexes never distort.
function MapThumbnail({ dimensions, tileTypes, tiles, size = 120 }) {
  const { width, height } = boardPixelSize(
    dimensions.cols,
    dimensions.rows,
    THUMBNAIL_HEX_SIZE,
  );
  const hexes = [];
  for (let row = 0; row < dimensions.rows; row++) {
    for (let col = 0; col < dimensions.cols; col++) {
      hexes.push({ col, row });
    }
  }
  const isFullWidth = size === 'full';
  return (
    <svg
      className={`map-thumbnail${isFullWidth ? ' map-thumbnail-full' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      width={isFullWidth ? '100%' : size}
      height={isFullWidth ? undefined : (size * height) / width}
    >
      {hexes.map(({ col, row }) => {
        const { x, y } = hexToPixel(col, row, THUMBNAIL_HEX_SIZE);
        const terrain = terrainAt(tiles, tileTypes, { col, row });
        return (
          <polygon
            key={`${col},${row}`}
            points={hexPointsAttr(x, y, THUMBNAIL_HEX_SIZE)}
            fill={terrain?.color ?? 'var(--bg-track)'}
          />
        );
      })}
    </svg>
  );
}

export default MapThumbnail;
