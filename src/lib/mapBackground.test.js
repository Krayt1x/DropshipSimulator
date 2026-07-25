import { describe, it, expect } from 'vitest';
import {
  backgroundContainerStyle,
  MAP_BACKGROUND_PRESETS,
} from './mapBackground.js';

describe('mapBackground', () => {
  it('returns an empty style when no background is set', () => {
    expect(backgroundContainerStyle(null)).toEqual({});
  });

  it('builds a background-image style for a custom upload', () => {
    const style = backgroundContainerStyle({
      type: 'custom',
      dataUrl: 'data:image/png;base64,abc',
    });
    expect(style.backgroundImage).toBe('url(data:image/png;base64,abc)');
    expect(style.backgroundColor).toBe('transparent');
  });

  it('resolves a preset id to its CSS', () => {
    const preset = MAP_BACKGROUND_PRESETS[0];
    const style = backgroundContainerStyle({ type: 'preset', id: preset.id });
    expect(style.background).toBe(preset.css);
  });

  it("doesn't override a preset's own fallback color with transparent", () => {
    // A preset's `background` shorthand (e.g. Terrain's gradients-over-a-
    // solid-color) already carries its own color; a separate
    // `backgroundColor: 'transparent'` in the same style object would clobber
    // it, since React applies style properties in order and the longhand
    // would run after the shorthand.
    const preset = MAP_BACKGROUND_PRESETS[0];
    const style = backgroundContainerStyle({ type: 'preset', id: preset.id });
    expect(style.backgroundColor).toBeUndefined();
  });

  it('falls back to an empty style for an unknown preset id', () => {
    expect(
      backgroundContainerStyle({ type: 'preset', id: 'does-not-exist' }),
    ).toEqual({});
  });
});
