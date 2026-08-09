import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Subscribe to server-sent location.batch events (1/min heartbeat + occasional moves).
 */
export function useLocationEvents(enabled = true) {
  const [connected, setConnected] = useState(false);
  const [lastPulseAt, setLastPulseAt] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [batchMeta, setBatchMeta] = useState(null);

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return undefined;

    const url = `${API_BASE}/events/locations`;
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'location.subscribed') {
          setConnected(true);
          return;
        }
        if (data.type === 'location.batch') {
          setLastPulseAt(data.reported_at);
          setBatchMeta({ count: data.count, moved: data.moved });
          setLiveEvents(data.events || []);
        }
      } catch {
        /* ignore malformed */
      }
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [enabled]);

  return { connected, lastPulseAt, liveEvents, batchMeta };
}
