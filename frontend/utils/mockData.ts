import { Platform } from 'react-native';

export interface MockBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE_PRICES: Record<string, { price: number; secType: string; exchange: string; localSymbol: string }> = {
  'AAPL':   { price: 228.50, secType: 'STK',     exchange: 'SMART', localSymbol: 'AAPL' },
  'HSBC':   { price: 46.80,  secType: 'STK',     exchange: 'SMART', localSymbol: 'HSBC' },
  'TSLA':   { price: 254.20, secType: 'STK',     exchange: 'SMART', localSymbol: 'TSLA' },
  'NVDA':   { price: 138.60, secType: 'STK',     exchange: 'SMART', localSymbol: 'NVDA' },
  'GC1!':   { price: 2745.30, secType: 'CONTFUT', exchange: 'COMEX', localSymbol: 'GCZ6' },
  'SI1!':   { price: 33.85,  secType: 'CONTFUT', exchange: 'COMEX', localSymbol: 'SIZ6' },
  'CL1!':   { price: 71.40,  secType: 'CONTFUT', exchange: 'NYMEX', localSymbol: 'CLZ6' },
  'MCL1!':  { price: 71.40,  secType: 'CONTFUT', exchange: 'NYMEX', localSymbol: 'MCLZ6' },
  'NQ0626': { price: 20450.00, secType: 'FUT',   exchange: 'CME',   localSymbol: 'NQM6' },
};

const TF_MINUTES: Record<string, number> = {
  '15m': 15,
  '1h': 60,
  '2h': 120,
  '4h': 240,
};

// In-memory state for client-side standalone demo mode (e.g. GitHub Pages)
let clientDemoPositions = [
  { symbol: 'AAPL', secType: 'STK', exchange: 'SMART', currency: 'USD', quantity: 50, avgCost: 215.40, marketValue: 11425.00 },
  { symbol: 'NVDA', secType: 'STK', exchange: 'SMART', currency: 'USD', quantity: 100, avgCost: 124.00, marketValue: 13860.00 },
  { symbol: 'GC1!', secType: 'CONTFUT', exchange: 'COMEX', currency: 'USD', quantity: 2, avgCost: 2690.00, marketValue: 5490.60 },
];

let clientDemoOrders: any[] = [
  {
    orderId: 1001,
    symbol: 'AAPL',
    localSymbol: 'AAPL',
    secType: 'STK',
    action: 'BUY',
    orderType: 'LMT',
    quantity: 25,
    limitPrice: 220.00,
    stopPrice: null,
    status: 'Submitted',
    filled: 0,
    remaining: 25,
    avgFillPrice: 0,
    lastUpdate: new Date(Date.now() - 3600_000).toISOString().slice(0, 19).replace('T', ' '),
    tif: 'GTC',
  },
];

let clientDemoHistory: any[] = [
  {
    orderId: 1000,
    symbol: 'NVDA',
    localSymbol: 'NVDA',
    secType: 'STK',
    action: 'BUY',
    orderType: 'MKT',
    quantity: 100,
    limitPrice: null,
    stopPrice: null,
    status: 'Filled',
    filled: 100,
    remaining: 0,
    avgFillPrice: 124.00,
    lastUpdate: new Date(Date.now() - 86400_000).toISOString().slice(0, 19).replace('T', ' '),
    tif: 'DAY',
  },
  ...clientDemoOrders,
];

let nextOrderId = 1002;

function getSeededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateMockBars(symbol: string, timeframe: string = '1h', count: number = 120): MockBar[] {
  const sym = symbol.toUpperCase();
  const baseInfo = BASE_PRICES[sym] || { price: 150.0, secType: 'STK', exchange: 'SMART', localSymbol: sym };
  const stepMins = TF_MINUTES[timeframe] || 60;
  const stepMs = stepMins * 60 * 1000;
  const now = Math.floor(Date.now() / stepMs) * stepMs;

  let seed = 0;
  for (let i = 0; i < sym.length; i++) {
    seed = seed * 31 + sym.charCodeAt(i);
  }
  seed += stepMins;
  const rand = getSeededRandom(seed);

  const volatility = baseInfo.price * 0.006;
  let currentClose = baseInfo.price * (0.94 + rand() * 0.08);
  const bars: MockBar[] = [];

  for (let i = count; i >= 0; i--) {
    const t = new Date(now - i * stepMs);
    const open = currentClose;
    const delta = (rand() - 0.485) * volatility;
    const close = Math.max(0.5, open + delta);
    const high = Math.max(open, close) + rand() * volatility * 0.65;
    const low = Math.max(0.1, Math.min(open, close) - rand() * volatility * 0.65);
    const volume = Math.floor(1500 + rand() * 25000);

    bars.push({
      date: t.toISOString().slice(0, 19).replace('T', ' '),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
    currentClose = close;
  }

  return bars;
}

export function getClientDemoAccount() {
  const gross = clientDemoPositions.reduce((acc, p) => acc + Math.abs(p.marketValue), 0);
  const cash = 85420.50;
  return {
    NetLiquidation: (cash + gross).toFixed(2),
    BuyingPower: ((cash + gross) * 4).toFixed(2),
    TotalCashValue: cash.toFixed(2),
    GrossPositionValue: gross.toFixed(2),
    UnrealizedPnL: '2145.60',
    RealizedPnL: '840.00',
  };
}

export function handleClientDemoRequest(path: string, options?: RequestInit): any {
  const url = new URL(path, 'http://localhost');
  const pathname = url.pathname;
  const method = (options?.method || 'GET').toUpperCase();

  if (pathname === '/' || pathname === '' || pathname === '/api/status') {
    return { status: 'ok', connected: true, mode: 'demo', account: 'DU999999 (Demo)' };
  }

  if (pathname === '/api/portfolio') {
    return { positions: [...clientDemoPositions], account: getClientDemoAccount(), mode: 'demo' };
  }

  if (pathname === '/api/orders') {
    return { orders: [...clientDemoOrders] };
  }

  if (pathname === '/api/order-history') {
    return { orders: [...clientDemoHistory].sort((a, b) => b.orderId - a.orderId) };
  }

  if (pathname === '/api/bars') {
    const symbol = (url.searchParams.get('symbol') || 'AAPL').toUpperCase();
    const timeframe = url.searchParams.get('timeframe') || '1h';
    return { symbol, timeframe, bars: generateMockBars(symbol, timeframe), mode: 'demo' };
  }

  if (pathname === '/api/resolve') {
    const symbol = (url.searchParams.get('symbol') || 'AAPL').toUpperCase();
    const info = BASE_PRICES[symbol] || { price: 150.0, secType: 'STK', exchange: 'SMART', localSymbol: symbol };
    return {
      found: true,
      symbol: symbol.replace('1!', ''),
      secType: info.secType,
      exchange: info.exchange,
      currency: 'USD',
      conId: Math.floor(Math.random() * 900000) + 100000,
      localSymbol: info.localSymbol,
      multiplier: info.secType.includes('FUT') ? '100' : '1',
      lastTradeDateOrContractMonth: '',
      mode: 'demo',
    };
  }

  if (pathname === '/api/market-price') {
    const symbol = (url.searchParams.get('symbol') || 'AAPL').toUpperCase();
    const bars = generateMockBars(symbol, '15m', 5);
    const lastPrice = bars[bars.length - 1].close;
    const jitter = Number(((Math.random() - 0.5) * lastPrice * 0.001).toFixed(2));
    const mp = Number((lastPrice + jitter).toFixed(2));
    return {
      symbol,
      bid: Number((mp - 0.05).toFixed(2)),
      ask: Number((mp + 0.05).toFixed(2)),
      last: mp,
      close: bars[bars.length - 2].close,
      marketPrice: mp,
      source: 'demo',
    };
  }

  if ((pathname === '/api/order' || pathname === '/api/place-order') && method === 'POST') {
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    const symbol = (body.symbol || 'AAPL').toUpperCase();
    const action = body.action || 'BUY';
    const quantity = Number(body.quantity || 1);
    const orderType = body.orderType || 'MKT';
    const bars = generateMockBars(symbol, '15m', 5);
    const fillPrice = body.limitPrice ? Number(body.limitPrice) : bars[bars.length - 1].close;
    const isMarket = orderType === 'MKT';

    const newOrder = {
      orderId: nextOrderId++,
      symbol,
      localSymbol: symbol,
      secType: (BASE_PRICES[symbol]?.secType) || 'STK',
      action,
      orderType,
      quantity,
      limitPrice: body.limitPrice ? Number(body.limitPrice) : null,
      stopPrice: body.stopPrice ? Number(body.stopPrice) : null,
      status: isMarket ? 'Filled' : 'Submitted',
      filled: isMarket ? quantity : 0,
      remaining: isMarket ? 0 : quantity,
      avgFillPrice: isMarket ? fillPrice : 0,
      lastUpdate: new Date().toISOString().slice(0, 19).replace('T', ' '),
      tif: body.tif || 'DAY',
    };

    if (!isMarket) {
      clientDemoOrders = [newOrder, ...clientDemoOrders];
    } else {
      // Update demo position
      const signedQty = action === 'BUY' ? quantity : -quantity;
      const existing = clientDemoPositions.find(p => p.symbol === symbol);
      if (existing) {
        existing.quantity += signedQty;
        existing.marketValue = Number((existing.quantity * fillPrice).toFixed(2));
      } else {
        clientDemoPositions.push({
          symbol,
          secType: newOrder.secType,
          exchange: 'SMART',
          currency: 'USD',
          quantity: signedQty,
          avgCost: fillPrice,
          marketValue: Number((signedQty * fillPrice).toFixed(2)),
        });
      }
    }

    clientDemoHistory = [newOrder, ...clientDemoHistory];
    return {
      success: true,
      orderId: newOrder.orderId,
      status: newOrder.status,
      symbol,
      action,
      quantity,
      orderType,
      mode: 'demo',
    };
  }

  if (pathname.startsWith('/api/scripts/indicators')) {
    const key = 'ibkr_demo_indicators';
    const defaultIndicators = [{
      name: 'FVG2',
      code: `// Script Name: Fair Value Gap (TS)\nconst calculateFVG = (bars) => {\n  const boxes = [];\n  const markers = [];\n  const EXTEND_BARS = 15;\n  for (let i = 2; i < bars.length; i++) {\n    const current = bars[i];\n    const prev1 = bars[i - 1];\n    const prev2 = bars[i - 2];\n    const isBull = current.low > prev2.high && prev1.close > prev2.high;\n    const isBear = current.high < prev2.low && prev1.close < prev2.low;\n    const extendIndex = Math.min(i + EXTEND_BARS, bars.length - 1);\n    const endTime = bars[extendIndex].time;\n    if (isBull) {\n      boxes.push({ type: 'bull', upper: [{ time: prev1.time, value: current.low }, { time: endTime, value: current.low }], lower: [{ time: prev1.time, value: prev2.high }, { time: endTime, value: prev2.high }] });\n      markers.push({ time: prev1.time, position: 'belowBar', color: '#26a69a', shape: 'arrowUp', text: 'FVG' });\n    } else if (isBear) {\n      boxes.push({ type: 'bear', upper: [{ time: prev1.time, value: prev2.low }, { time: endTime, value: prev2.low }], lower: [{ time: prev1.time, value: current.high }, { time: endTime, value: current.high }] });\n      markers.push({ time: prev1.time, position: 'aboveBar', color: '#ef5350', shape: 'arrowDown', text: 'FVG' });\n    }\n  }\n  return { boxes, markers };\n};\nreturn calculateFVG(bars);`
    }];
    const stored = Platform.OS === 'web' && typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultIndicators))
      : defaultIndicators;
    if (method === 'GET') {
      return { scripts: stored };
    }
    if (method === 'POST') {
      const body = options?.body ? JSON.parse(String(options.body)) : {};
      const updated = [...stored.filter((s: any) => s.name !== body.name), body];
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(updated));
      }
      return { success: true };
    }
    if (method === 'DELETE') {
      const name = decodeURIComponent(pathname.split('/').pop() || '');
      const updated = stored.filter((s: any) => s.name !== name);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(updated));
      }
      return { success: true };
    }
  }

  if (pathname.startsWith('/api/scripts/bots')) {
    const key = 'ibkr_demo_bots';
    const stored = Platform.OS === 'web' && typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem(key) || '[]')
      : [];
    if (method === 'GET') {
      return { scripts: stored };
    }
    if (method === 'POST') {
      const body = options?.body ? JSON.parse(String(options.body)) : {};
      const updated = [...stored.filter((s: any) => s.name !== body.name), body];
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(updated));
      }
      return { success: true };
    }
    if (method === 'DELETE') {
      const name = decodeURIComponent(pathname.split('/').pop() || '');
      const updated = stored.filter((s: any) => s.name !== name);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(updated));
      }
      return { success: true };
    }
  }

  return { status: 'ok', mode: 'demo' };
}
