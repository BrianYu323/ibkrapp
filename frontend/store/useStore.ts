import { create } from 'zustand';

export interface Position {
  symbol: string;
  secType: string;
  exchange: string;
  currency: string;
  quantity: number;
  avgCost: number;
  marketValue: number;
}

export interface Order {
  orderId: number;
  symbol: string;
  secType: string;
  action: string;
  orderType: string;
  quantity: number;
  limitPrice: number | null;
  status: string;
  filled: number;
  remaining: number;
  avgFillPrice: number;
}

interface AppState {
  // Connection
  isConnected: boolean;
  setConnected: (status: boolean) => void;

  // Portfolio
  positions: Position[];
  account: Record<string, string>;
  setPortfolio: (positions: Position[], account: Record<string, string>) => void;

  // Orders
  orders: Order[];
  setOrders: (orders: Order[]) => void;

  // Loading
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Bot Engine
  botAutoSubmit: boolean;
  setBotAutoSubmit: (val: boolean) => void;
  runningBots: {id: string, name: string, code: string}[];
  setRunningBots: (bots: {id: string, name: string, code: string}[]) => void;
}

const API_BASE = 'http://127.0.0.1:8000';

export const useStore = create<AppState>((set) => ({
  isConnected: false,
  setConnected: (status) => set({ isConnected: status }),

  positions: [],
  account: {},
  setPortfolio: (positions, account) => set({ positions, account }),

  orders: [],
  setOrders: (orders) => set({ orders }),

  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  botAutoSubmit: false,
  setBotAutoSubmit: (val) => set({ botAutoSubmit: val }),
  runningBots: [],
  setRunningBots: (bots) => set({ runningBots: bots }),
}));

// Plain async functions (NOT hooks) to fetch data
export async function fetchPortfolio() {
  const { setPortfolio, setLoading, setConnected } = useStore.getState();
  setLoading(true);
  try {
    // First check if backend is connected to IBKR
    const statusRes = await fetch(`${API_BASE}/`);
    const statusData = await statusRes.json();
    setConnected(statusData.connected === true);

    // Then fetch portfolio data
    const res = await fetch(`${API_BASE}/api/portfolio`);
    const data = await res.json();
    setPortfolio(data.positions || [], data.account || {});
  } catch (e) {
    console.error('Failed to fetch portfolio:', e);
    setConnected(false);
  } finally {
    setLoading(false);
  }
}

export async function fetchOrders() {
  const { setOrders } = useStore.getState();
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    const data = await res.json();
    setOrders(data.orders || []);
  } catch (e) {
    console.error('Failed to fetch orders:', e);
  }
}
