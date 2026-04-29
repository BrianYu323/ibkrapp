import { useEffect } from 'react';
import { useStore } from '../store/useStore';

const WS_URL = 'ws://127.0.0.1:8000/ws';

export function useIBKRWebsocket() {
  const updateTicker = useStore((state) => state.updateTicker);
  const setConnected = useStore((state) => state.setConnected);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectInterval: NodeJS.Timeout;

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('Connected to IBKR Backend');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'tick') {
            updateTicker({
              symbol: data.symbol,
              price: data.price,
              change: data.change || 0,
              changePercent: data.changePercent || 0,
            });
          }
        } catch (e) {
          console.error('WebSocket Message Parse Error:', e);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from IBKR Backend');
        setConnected(false);
        // Attempt reconnect
        reconnectInterval = setTimeout(connect, 3000);
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
