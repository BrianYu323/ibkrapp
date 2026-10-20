import { create } from 'zustand';
import { apiFetch } from '../constants/config';

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
  isDemoMode: boolean;
  setConnected: (status: boolean) => void;
  setDemoMode: (isDemo: boolean) => void;

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

export const useStore = create<AppState>((set) => ({
  isConnected: false,
  isDemoMode: false,
  setConnected: (status) => set({ isConnected: status }),
  setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),

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
  const { setPortfolio, setLoading, setConnected, setDemoMode } = useStore.getState();
  setLoading(true);
  try {
    // First check if backend is connected to IBKR (or running in demo mode)
    const statusData = await apiFetch('/api/status');
    const isDemo = statusData.mode === 'demo';
    setDemoMode(isDemo);
    setConnected(statusData.connected === true || isDemo);

    // Then fetch portfolio data
    const data = await apiFetch('/api/portfolio');
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
    const data = await apiFetch('/api/orders');
    setOrders(data.orders || []);
  } catch (e) {
    console.error('Failed to fetch orders:', e);
  }
}
