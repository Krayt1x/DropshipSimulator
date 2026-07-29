import { useState } from 'react';
import { useMultiplayer } from '../context/MultiplayerContext.jsx';
import BattlePage from './BattlePage.jsx';

function CopyCode({ code }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the textarea below can still be copied manually
    }
  }

  return (
    <div className="field">
      <textarea
        readOnly
        rows={4}
        value={code}
        onClick={(e) => e.target.select()}
      />
      <button type="button" className="ghost" onClick={copy}>
        {copied ? 'Copied!' : 'Copy code'}
      </button>
    </div>
  );
}

function ConnectPage() {
  const mp = useMultiplayer();
  const [pastedOffer, setPastedOffer] = useState('');
  const [pastedAnswer, setPastedAnswer] = useState('');

  if (!mp) return null;
  const { role, phase, offerCode, answerCode, error } = mp;

  // Once connected, status and Disconnect live in the nav's connection
  // badge instead (#115) — this page's own card is only for the
  // host/join code exchange leading up to that.
  if (phase === 'connected') return <BattlePage />;

  return (
    <div className="container">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Multiplayer</h1>
      <p className="unit-meta" style={{ marginBottom: 20 }}>
        Connect two browsers directly (WebRTC) so the map and battle board stay
        in sync live. No account or server needed — just a one-time code
        exchange to link up.
      </p>

      {error && (
        <div className="card" style={{ borderColor: '#dc2626' }}>
          <p className="unit-meta" style={{ color: '#dc2626' }}>
            {error}
          </p>
        </div>
      )}

      {phase === 'idle' && (
        <div className="map-editor-layout">
          <div className="card">
            <p className="unit-name">Host a game</p>
            <p className="unit-meta" style={{ marginBottom: 12 }}>
              Creates a code to send to your opponent.
            </p>
            <button type="button" onClick={mp.startHost}>
              Host a game
            </button>
          </div>

          <div className="card">
            <p className="unit-name">Join a game</p>
            <p className="unit-meta" style={{ marginBottom: 12 }}>
              Paste the code your host sent you.
            </p>
            <div className="field">
              <textarea
                rows={4}
                placeholder="Paste host's code here"
                value={pastedOffer}
                onChange={(e) => setPastedOffer(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={!pastedOffer.trim()}
              onClick={() => mp.joinWithOffer(pastedOffer.trim())}
            >
              Join a game
            </button>
          </div>
        </div>
      )}

      {phase === 'offer-ready' && role === 'host' && (
        <div className="card">
          <p className="unit-name">Step 1: send this code to your opponent</p>
          <CopyCode code={offerCode} />
          <p className="unit-name" style={{ marginTop: 16 }}>
            Step 2: paste the answer code they send back
          </p>
          <div className="field">
            <textarea
              rows={4}
              placeholder="Paste their answer code here"
              value={pastedAnswer}
              onChange={(e) => setPastedAnswer(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={!pastedAnswer.trim()}
            onClick={() => mp.submitAnswer(pastedAnswer.trim())}
          >
            Connect
          </button>
        </div>
      )}

      {phase === 'connecting' && role === 'guest' && answerCode && (
        <div className="card">
          <p className="unit-name">Send this code back to your host</p>
          <CopyCode code={answerCode} />
          <p className="unit-meta">
            Waiting for the host to finish connecting…
          </p>
        </div>
      )}

      {phase === 'connecting' && !(role === 'guest' && answerCode) && (
        <div className="card">
          <p className="unit-meta">Connecting…</p>
        </div>
      )}
    </div>
  );
}

export default ConnectPage;
