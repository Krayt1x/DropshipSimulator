import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { publish, subscribe } from '../lib/syncBus.js';
import {
  acceptAnswerCode,
  createAnswerCode,
  createOfferCode,
  createPeerConnection,
} from '../lib/webrtc.js';

const SYNCED_KEYS = [
  'dropshipsimulator:mapEditor:tileTypes',
  'dropshipsimulator:mapEditor:dimensions',
  'dropshipsimulator:mapEditor:tiles',
  'dropshipsimulator:battle:tokens',
  'dropshipsimulator:battle:deploymentPhase',
  'dropshipsimulator:battle:turn',
  'dropshipsimulator:battle:log',
  'dropshipsimulator:battle:bankedDice',
  'dropshipsimulator:battle:usedDice',
];

const MultiplayerContext = createContext(null);

function readStored(key) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

export function MultiplayerProvider({ children }) {
  const [role, setRole] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [offerCode, setOfferCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [error, setError] = useState('');

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const lastRemoteJson = useRef({});

  const sendRaw = useCallback((message) => {
    if (channelRef.current?.readyState === 'open') {
      channelRef.current.send(JSON.stringify(message));
    }
  }, []);

  const reset = useCallback(() => {
    channelRef.current?.close();
    pcRef.current?.close();
    channelRef.current = null;
    pcRef.current = null;
    setRole(null);
    setPhase('idle');
    setOfferCode('');
    setAnswerCode('');
  }, []);

  const disconnect = useCallback(() => {
    reset();
  }, [reset]);

  function handleIncomingMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.type === 'sync' && SYNCED_KEYS.includes(message.key)) {
      lastRemoteJson.current[message.key] = JSON.stringify(message.value);
      publish(message.key, message.value);
    }
  }

  function watchConnectionState(pc) {
    let disconnectTimer = null;
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      // 'disconnected' is often a brief, self-recovering blip (a NAT
      // rebinding or momentary network hiccup) rather than a real failure —
      // give it a grace period before tearing the connection down.
      if (state === 'disconnected') {
        disconnectTimer = setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            setError('Connection lost.');
            reset();
          }
        }, 5000);
        return;
      }
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      if (['failed', 'closed'].includes(state)) {
        setError('Connection lost.');
        reset();
      }
    };
  }

  function wireChannel(channel, isHost) {
    channelRef.current = channel;
    channel.onopen = () => {
      setPhase('connected');
      if (isHost) {
        SYNCED_KEYS.forEach((key) => {
          const value = readStored(key);
          if (value !== undefined) sendRaw({ type: 'sync', key, value });
        });
      }
    };
    channel.onmessage = (event) => handleIncomingMessage(event.data);
    channel.onclose = () => setPhase((p) => (p === 'connected' ? 'idle' : p));
  }

  const startHost = useCallback(async () => {
    reset();
    setError('');
    setRole('host');
    setPhase('connecting');
    try {
      const pc = createPeerConnection();
      pcRef.current = pc;
      watchConnectionState(pc);
      const { channel, code } = await createOfferCode(pc);
      wireChannel(channel, true);
      setOfferCode(code);
      setPhase('offer-ready');
    } catch {
      setError('Could not start hosting. Please try again.');
      reset();
    }
  }, [reset]);

  const submitAnswer = useCallback(async (code) => {
    setError('');
    setPhase('connecting');
    try {
      await acceptAnswerCode(pcRef.current, code);
    } catch {
      setError('That answer code looks invalid.');
      setPhase('offer-ready');
    }
  }, []);

  const joinWithOffer = useCallback(
    async (offerCode) => {
      reset();
      setError('');
      setRole('guest');
      setPhase('connecting');
      try {
        const pc = createPeerConnection();
        pcRef.current = pc;
        watchConnectionState(pc);
        pc.ondatachannel = (event) => wireChannel(event.channel, false);
        const code = await createAnswerCode(pc, offerCode);
        setAnswerCode(code);
      } catch {
        setError('That connection code looks invalid.');
        reset();
      }
    },
    [reset],
  );

  useEffect(() => {
    const unsubscribers = SYNCED_KEYS.map((key) =>
      subscribe(key, (value) => {
        const json = JSON.stringify(value);
        if (lastRemoteJson.current[key] === json) return;
        sendRaw({ type: 'sync', key, value });
      }),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [sendRaw]);

  useEffect(() => reset, [reset]);

  const value = {
    role,
    phase,
    offerCode,
    answerCode,
    error,
    startHost,
    submitAnswer,
    joinWithOffer,
    disconnect,
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  return useContext(MultiplayerContext);
}
