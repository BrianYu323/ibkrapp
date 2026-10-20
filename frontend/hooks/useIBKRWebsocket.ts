import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { WS_URL, isStandaloneDemo } from '../constants/config';

export function useIBKRWebsocket() {
  const setConnected = useStore((state) => state.setConnected);

  useEffect(() => {
    if (isStandaloneDemo) {
      setConnected(true);
      return;
    }

    let ws: WebSocket;
    let reconnectInterval: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (isStandaloneDemo) {
        setConnected(true);
        return;
      }
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('Connected to IBKR Backend');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          JSON.parse(event.data);
        } catch (e) {
          console.error('WebSocket Message Parse Error:', e);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from IBKR Backend');
        if (!isStandaloneDemo) {
          setConnected(false);
          reconnectInterval = setTimeout(connect, 3000);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket Error: ', error);
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectInterval);
      if (ws) ws.close();
    };
  }, []);
}
