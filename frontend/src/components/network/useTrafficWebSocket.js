import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = `ws://${window.location.hostname}:8000`;

export function useTrafficWebSocket() {
  const [packets, setPackets] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const packetsRef = useRef([]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/api/traffic/ws/traffic`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        packetsRef.current = [...packetsRef.current.slice(-499), packet];
        setPackets([...packetsRef.current]);
      } catch (e) {
        // ignore parse errors
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

  const clearPackets = useCallback(() => {
    packetsRef.current = [];
    setPackets([]);
  }, []);

  return { packets, connected, clearPackets };
}

export function useTerminalWebSocket() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback((onData) => {
    const ws = new WebSocket(`${WS_URL}/api/traffic/ws/terminal`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => connect(onData), 2000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output' && onData) {
          onData(msg.data);
        }
      } catch (e) {
        // ignore
      }
    };

    wsRef.current = ws;
  }, []);

  const sendInput = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  const sendCommand = useCallback((command) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', data: command }));
    }
  }, []);

  const sendResize = useCallback((cols, rows) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  return { connect, sendInput, sendCommand, sendResize, disconnect, connected };
}
