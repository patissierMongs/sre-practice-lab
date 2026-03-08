import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = `ws://${window.location.hostname}:8000`;

export function useXrayWebSocket() {
  const [systemState, setSystemState] = useState(null);
  const [traces, setTraces] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const tracesRef = useRef([]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/api/system/ws/xray`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'system_state') {
          setSystemState(msg.data);
        } else if (msg.type === 'trace') {
          tracesRef.current = [...tracesRef.current.slice(-199), msg.data];
          setTraces([...tracesRef.current]);
        }
      } catch (e) {
        // ignore
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const clearTraces = useCallback(() => {
    tracesRef.current = [];
    setTraces([]);
  }, []);

  return { systemState, traces, connected, clearTraces };
}
