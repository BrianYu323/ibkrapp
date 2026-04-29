/**
 * Technical indicator calculation utilities.
 * All functions accept an array of bar data and return computed series.
 */

export interface BarData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LinePoint {
  time: string | number;
  value: number;
}

// ─── SMA (Simple Moving Average) ───
export function calcSMA(bars: BarData[], period: number): LinePoint[] {
  const result: LinePoint[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += bars[i - j].close;
    }
    result.push({ time: bars[i].time, value: sum / period });
  }
  return result;
}

// ─── EMA (Exponential Moving Average) ───
export function calcEMA(bars: BarData[], period: number): LinePoint[] {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  const result: LinePoint[] = [];

  // Seed with SMA of first `period` bars
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += bars[i].close;
  }
  let ema = sum / period;
  result.push({ time: bars[period - 1].time, value: ema });

  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    result.push({ time: bars[i].time, value: ema });
  }
  return result;
}

// ─── Bollinger Bands ───
export function calcBollingerBands(
  bars: BarData[],
  period: number,
  stdDev: number
): { upper: LinePoint[]; middle: LinePoint[]; lower: LinePoint[] } {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];

  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += bars[i - j].close;
    }
    const sma = sum / period;

    let sqSum = 0;
    for (let j = 0; j < period; j++) {
      sqSum += (bars[i - j].close - sma) ** 2;
    }
    const sd = Math.sqrt(sqSum / period);

    middle.push({ time: bars[i].time, value: sma });
    upper.push({ time: bars[i].time, value: sma + stdDev * sd });
    lower.push({ time: bars[i].time, value: sma - stdDev * sd });
  }

  return { upper, middle, lower };
}

// ─── RSI (Relative Strength Index) ───
export function calcRSI(bars: BarData[], period: number): LinePoint[] {
  if (bars.length < period + 1) return [];
  const result: LinePoint[] = [];

  let avgGain = 0;
  let avgLoss = 0;

  // Calculate initial avg gain/loss
  for (let i = 1; i <= period; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({ time: bars[period].time, value: 100 - 100 / (1 + rs) });

  // Subsequent values using smoothed method
  for (let i = period + 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: bars[i].time, value: rsi });
  }
  return result;
}

// ─── MACD ───
export function calcMACD(
  bars: BarData[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macd: LinePoint[]; signal: LinePoint[]; histogram: LinePoint[] } {
  const fastEma = calcEMA(bars, fastPeriod);
  const slowEma = calcEMA(bars, slowPeriod);

  // Align times: MACD only starts where both EMAs exist
  const slowStart = slowPeriod - 1;
  const fastStart = fastPeriod - 1;
  const macdLine: LinePoint[] = [];

  // Build a time-indexed map of the fast EMA
  const fastMap = new Map<string | number, number>();
  for (const p of fastEma) {
    fastMap.set(p.time, p.value);
  }

  for (const sp of slowEma) {
    const fv = fastMap.get(sp.time);
    if (fv !== undefined) {
      macdLine.push({ time: sp.time, value: fv - sp.value });
    }
  }

  // Signal line = EMA of MACD line
  const signal: LinePoint[] = [];
  if (macdLine.length >= signalPeriod) {
    const k = 2 / (signalPeriod + 1);
    let sum = 0;
    for (let i = 0; i < signalPeriod; i++) {
      sum += macdLine[i].value;
    }
    let ema = sum / signalPeriod;
    signal.push({ time: macdLine[signalPeriod - 1].time, value: ema });

    for (let i = signalPeriod; i < macdLine.length; i++) {
      ema = macdLine[i].value * k + ema * (1 - k);
      signal.push({ time: macdLine[i].time, value: ema });
    }
  }

  // Histogram = MACD - Signal
  const signalMap = new Map<string | number, number>();
  for (const s of signal) {
    signalMap.set(s.time, s.value);
  }

  const histogram: LinePoint[] = [];
  for (const m of macdLine) {
    const sv = signalMap.get(m.time);
    if (sv !== undefined) {
      histogram.push({ time: m.time, value: m.value - sv });
    }
  }

  return { macd: macdLine, signal, histogram };
}

// ─── VWAP (Volume Weighted Average Price) ───
export function calcVWAP(bars: BarData[]): LinePoint[] {
  const result: LinePoint[] = [];
  let cumulativeVolume = 0;
  let cumulativeTPV = 0; // TP * Volume

  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativeVolume += bar.volume;
    cumulativeTPV += typicalPrice * bar.volume;

    if (cumulativeVolume > 0) {
      result.push({ time: bar.time, value: cumulativeTPV / cumulativeVolume });
    }
  }
  return result;
}

// ─── Indicator Registry ───
export interface IndicatorDef {
  id: string;
  name: string;
  category: 'overlay' | 'oscillator';
  color: string;
  // For Bollinger Bands, extra colors:
  extraColors?: string[];
  compute: (bars: BarData[]) => { lines: { data: LinePoint[]; color: string; lineWidth?: number; title?: string }[] };
}

export const AVAILABLE_INDICATORS: IndicatorDef[] = [
  // ── Overlay Indicators ──
  {
    id: 'sma10',
    name: 'SMA 10',
    category: 'overlay',
    color: '#ff9ff3',
    compute: (bars) => ({
      lines: [{ data: calcSMA(bars, 10), color: '#ff9ff3', title: 'SMA 10' }],
    }),
  },
  {
    id: 'sma20',
    name: 'SMA 20',
    category: 'overlay',
    color: '#ff6b6b',
    compute: (bars) => ({
      lines: [{ data: calcSMA(bars, 20), color: '#ff6b6b', title: 'SMA 20' }],
    }),
  },
  {
    id: 'sma50',
    name: 'SMA 50',
    category: 'overlay',
    color: '#4ecdc4',
    compute: (bars) => ({
      lines: [{ data: calcSMA(bars, 50), color: '#4ecdc4', title: 'SMA 50' }],
    }),
  },
  {
    id: 'sma200',
    name: 'SMA 200',
    category: 'overlay',
    color: '#45b7d1',
    compute: (bars) => ({
      lines: [{ data: calcSMA(bars, 200), color: '#45b7d1', title: 'SMA 200' }],
    }),
  },
  {
    id: 'ema9',
    name: 'EMA 9',
    category: 'overlay',
    color: '#f9ca24',
    compute: (bars) => ({
      lines: [{ data: calcEMA(bars, 9), color: '#f9ca24', title: 'EMA 9' }],
    }),
  },
  {
    id: 'ema21',
    name: 'EMA 21',
    category: 'overlay',
    color: '#6c5ce7',
    compute: (bars) => ({
      lines: [{ data: calcEMA(bars, 21), color: '#6c5ce7', title: 'EMA 21' }],
    }),
  },
  {
    id: 'ema55',
    name: 'EMA 55',
    category: 'overlay',
    color: '#e17055',
    compute: (bars) => ({
      lines: [{ data: calcEMA(bars, 55), color: '#e17055', title: 'EMA 55' }],
    }),
  },
  {
    id: 'bb20',
    name: 'Bollinger Bands',
    category: 'overlay',
    color: '#a29bfe',
    compute: (bars) => {
      const bb = calcBollingerBands(bars, 20, 2);
      return {
        lines: [
          { data: bb.upper, color: 'rgba(162,155,254,0.5)', lineWidth: 1, title: 'BB Upper' },
          { data: bb.middle, color: '#a29bfe', lineWidth: 1, title: 'BB Mid' },
          { data: bb.lower, color: 'rgba(162,155,254,0.5)', lineWidth: 1, title: 'BB Lower' },
        ],
      };
    },
  },
  {
    id: 'vwap',
    name: 'VWAP',
    category: 'overlay',
    color: '#00cec9',
    compute: (bars) => ({
      lines: [{ data: calcVWAP(bars), color: '#00cec9', title: 'VWAP' }],
    }),
  },

  // ── Oscillator Indicators (separate pane) ──
  {
    id: 'rsi14',
    name: 'RSI 14',
    category: 'oscillator',
    color: '#fdcb6e',
    compute: (bars) => ({
      lines: [{ data: calcRSI(bars, 14), color: '#fdcb6e', title: 'RSI 14' }],
    }),
  },
  {
    id: 'macd',
    name: 'MACD (12,26,9)',
    category: 'oscillator',
    color: '#00b894',
    compute: (bars) => {
      const m = calcMACD(bars, 12, 26, 9);
      return {
        lines: [
          { data: m.macd, color: '#00b894', lineWidth: 2, title: 'MACD' },
          { data: m.signal, color: '#e17055', lineWidth: 1, title: 'Signal' },
        ],
      };
    },
  },
];
