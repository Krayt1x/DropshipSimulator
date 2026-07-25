import jungleCamoUrl from '../assets/backgrounds/jungle-camo.webp';

export const MAP_BACKGROUND_PRESETS = [
  {
    id: 'terrain',
    label: 'Terrain',
    css: 'radial-gradient(circle at 20% 30%, #8a9a5b 0%, transparent 50%), radial-gradient(circle at 80% 70%, #6b7c4a 0%, transparent 55%), #7d8f52',
  },
  {
    id: 'jungle-camo',
    label: 'Jungle Camo',
    css: `url(${jungleCamoUrl}) center / cover`,
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
  return preset ? { background: preset.css } : {};
}
