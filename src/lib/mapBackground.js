export const MAP_BACKGROUND_PRESETS = [
  {
    id: 'grid',
    label: 'Grid paper',
    css: 'repeating-linear-gradient(0deg, #d8d5c4 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, #d8d5c4 0 1px, transparent 1px 28px), #f4f2e8',
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    css: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0 1px, transparent 1px 32px), #1e3a5f',
  },
  {
    id: 'terrain',
    label: 'Terrain',
    css: 'radial-gradient(circle at 20% 30%, #8a9a5b 0%, transparent 50%), radial-gradient(circle at 80% 70%, #6b7c4a 0%, transparent 55%), #7d8f52',
  },
];

export function backgroundContainerStyle(background) {
  if (!background) return {};
  if (background.type === 'custom') {
    return {
      backgroundImage: `url(${background.dataUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: 'transparent',
    };
  }
  const preset = MAP_BACKGROUND_PRESETS.find((p) => p.id === background.id);
  return preset ? { background: preset.css, backgroundColor: 'transparent' } : {};
}
