import { MAP_BACKGROUND_PRESETS } from '../lib/mapBackground.js';

function BackgroundPicker({ background, onChange }) {
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ type: 'custom', dataUrl: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="card">
      <p className="unit-name">Map background</p>
      <div className="background-swatch-row">
        <button
          type="button"
          className={`background-swatch ${!background ? 'selected' : ''}`}
          style={{ background: 'var(--bg-track)' }}
          onClick={() => onChange(null)}
        >
          None
        </button>
        {MAP_BACKGROUND_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className={`background-swatch ${background?.type === 'preset' && background.id === preset.id ? 'selected' : ''}`}
            style={{ background: preset.css }}
            onClick={() => onChange({ type: 'preset', id: preset.id })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label htmlFor="background-upload">Or upload your own image</label>
        <input
          type="file"
          id="background-upload"
          accept="image/*"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}

export default BackgroundPicker;
