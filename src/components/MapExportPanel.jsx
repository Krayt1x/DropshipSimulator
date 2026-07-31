import { useState } from 'react';
import { exportMap, parseMapExport } from '../lib/maps.js';

// Export/import a map as JSON text (#176) — mirrors the roster
// export/import convention (RosterImport.jsx) but for map data instead of a
// unit list.
function MapExportPanel({ dimensions, tileTypes, tiles, onImport }) {
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [previewAttempted, setPreviewAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const exportText = exportMap({ dimensions, tileTypes, tiles });

  function copyExport() {
    navigator.clipboard?.writeText(exportText).then(
      () => setCopied(true),
      () => {},
    );
  }

  function previewImport() {
    setImportPreview(parseMapExport(importText));
    setPreviewAttempted(true);
  }

  function applyImport() {
    if (!importPreview) return;
    onImport(importPreview);
    setImportText('');
    setImportPreview(null);
    setPreviewAttempted(false);
  }

  return (
    <div className="card">
      <p className="unit-name">Export / Import map</p>
      <div className="field">
        <label htmlFor="map-export-text">Export</label>
        <textarea
          id="map-export-text"
          rows={4}
          readOnly
          value={exportText}
          onFocus={(e) => e.target.select()}
        />
      </div>
      <button
        type="button"
        className="ghost"
        style={{ marginTop: 8 }}
        onClick={copyExport}
      >
        {copied ? 'Copied!' : 'Copy to clipboard'}
      </button>

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="map-import-text">Import</label>
        <textarea
          id="map-import-text"
          rows={4}
          placeholder="Paste an exported map here"
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportPreview(null);
            setPreviewAttempted(false);
          }}
        />
      </div>
      <div className="token-owner-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="ghost"
          disabled={!importText.trim()}
          onClick={previewImport}
        >
          Preview import
        </button>
        <button type="button" disabled={!importPreview} onClick={applyImport}>
          Use this map
        </button>
      </div>
      {previewAttempted && !importPreview && (
        <p className="unit-meta" style={{ marginTop: 8 }}>
          That doesn&apos;t look like a valid map export.
        </p>
      )}
      {importPreview && (
        <p className="unit-meta" style={{ marginTop: 8 }}>
          {importPreview.dimensions.cols} × {importPreview.dimensions.rows},{' '}
          {Object.keys(importPreview.tiles).length} tile
          {Object.keys(importPreview.tiles).length === 1 ? '' : 's'} painted.
        </p>
      )}
    </div>
  );
}

export default MapExportPanel;
