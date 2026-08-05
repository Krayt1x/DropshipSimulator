// Ported from DropshipBuilder's src/components/ExportPanel.jsx (#199).
import { useState } from 'react';

function ExportPanel({ manufacturers, units, equipment }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify({ manufacturers, units, equipment }, null, 2);

  function download() {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dropshipsimulator-catalogue.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — Download JSON still works.
    }
  }

  return (
    <div className="card">
      <h2 style={{ fontSize: 15, marginTop: 0 }}>Export catalogue</h2>
      <p className="unit-meta" style={{ marginBottom: 10 }}>
        Your edits are only saved in this browser. Download or copy this JSON
        to back it up or share it.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={download}>
          Download JSON
        </button>
        <button type="button" className="ghost" onClick={copy}>
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>
    </div>
  );
}

export default ExportPanel;
