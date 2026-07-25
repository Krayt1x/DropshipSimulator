import { useEffect, useState } from 'react';
import { useMultiplayer } from '../context/MultiplayerContext.jsx';
import {
  buildInviteLink,
  extractCode,
  readHashParam,
} from '../lib/inviteLink.js';
import BattlePage from './BattlePage.jsx';

function CopyCode({ link }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
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
        value={link}
        onClick={(e) => e.target.select()}
      />
      <button type="button" className="ghost" onClick={copy}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}

function ConnectPage() {
  const mp = useMultiplayer();
  const [pastedOffer, setPastedOffer] = useState(
    () => readHashParam('offer') ?? '',
  );
  const [pastedAnswer, setPastedAnswer] = useState(
    () => readHashParam('answer') ?? '',
  );

  useEffect(() => {
    function onHashChange() {
      const offer = readHashParam('offer');
      const answer = readHashParam('answer');
      if (offer) setPastedOffer(offer);
      if (answer) setPastedAnswer(answer);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (!mp) return null;
  const { role, phase, offerCode, answerCode, error } = mp;

  return (
    <>
      <div className="container">
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Multiplayer</h1>
        <p className="unit-meta" style={{ marginBottom: 20 }}>
          Connect two browsers directly (WebRTC) so the map and battle board
          stay in sync live. No account or server needed — just a one-time link
          exchange to link up.
        </p>

        {error && (
          <div className="card" style={{ borderColor: '#dc2626' }}>
            <p className="unit-meta" style={{ color: '#dc2626' }}>
              {error}
            </p>
          </div>
        )}

        {phase === 'connected' && (
          <div className="card">
            <p className="unit-name">
              ✅ Connected as {role === 'host' ? 'host' : 'guest'}
            </p>
            <p className="unit-meta" style={{ marginBottom: 12 }}>
              Changes to the map and battle board now sync automatically.
            </p>
            <button type="button" className="danger" onClick={mp.disconnect}>
              Disconnect
            </button>
          </div>
        )}

        {phase === 'idle' && (
          <div className="map-editor-layout">
            <div className="card">
              <p className="unit-name">Host a game</p>
              <p className="unit-meta" style={{ marginBottom: 12 }}>
                Creates a link to send to your opponent.
              </p>
              <button type="button" onClick={mp.startHost}>
                Host a game
              </button>
            </div>

            <div className="card">
              <p className="unit-name">Join a game</p>
              <p className="unit-meta" style={{ marginBottom: 12 }}>
                Paste the link (or code) your host sent you — or just click
                their link and this box fills in automatically.
              </p>
              <div className="field">
                <textarea
                  rows={4}
                  placeholder="Paste host's link or code here"
                  value={pastedOffer}
                  onChange={(e) => setPastedOffer(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={!pastedOffer.trim()}
                onClick={() =>
                  mp.joinWithOffer(extractCode(pastedOffer, 'offer'))
                }
              >
                Join a game
              </button>
            </div>
          </div>
        )}

        {phase === 'offer-ready' && role === 'host' && (
          <div className="card">
            <p className="unit-name">Step 1: send this link to your opponent</p>
            <CopyCode link={buildInviteLink('offer', offerCode)} />
            <p className="unit-name" style={{ marginTop: 16 }}>
              Step 2: paste the answer link (or code) they send back
            </p>
            <div className="field">
              <textarea
                rows={4}
                placeholder="Paste their answer link or code here"
                value={pastedAnswer}
                onChange={(e) => setPastedAnswer(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={!pastedAnswer.trim()}
              onClick={() =>
                mp.submitAnswer(extractCode(pastedAnswer, 'answer'))
              }
            >
              Connect
            </button>
          </div>
        )}

        {phase === 'connecting' && role === 'guest' && answerCode && (
          <div className="card">
            <p className="unit-name">Send this link back to your host</p>
            <CopyCode link={buildInviteLink('answer', answerCode)} />
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
      {phase === 'connected' && <BattlePage />}
    </>
  );
}

export default ConnectPage;
