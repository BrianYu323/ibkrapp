import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEIGHT = 200;

// Demo price data
const PRICES = [120, 135, 125, 148, 140, 155, 150, 165, 158, 170, 162, 175, 168, 180, 172];

function buildSvgPath(prices: number[], w: number, h: number): string {
  const minP = Math.min(...prices) - 5;
  const maxP = Math.max(...prices) + 5;
  const rangeP = maxP - minP;
  const stepX = w / (prices.length - 1);
  const toY = (p: number) => h - ((p - minP) / rangeP) * h;

  let d = `M 0 ${toY(prices[0])}`;
  for (let i = 1; i < prices.length; i++) {
    d += ` L ${(i * stepX).toFixed(1)} ${toY(prices[i]).toFixed(1)}`;
  }
  return d;
}

function buildAreaPath(prices: number[], w: number, h: number): string {
  const linePath = buildSvgPath(prices, w, h);
  return `${linePath} L ${w} ${h} L 0 ${h} Z`;
}

export default function CandleChart() {
  const chartWidth = SCREEN_WIDTH;

  return (
    <View style={styles.container}>
      <svg
        width={chartWidth}
        height={HEIGHT}
        viewBox={`0 0 ${chartWidth} ${HEIGHT}`}
        style={{ backgroundColor: '#121212' }}
      >
        {/* Grid lines */}
        {[1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={0}
            y1={(HEIGHT / 5) * i}
            x2={chartWidth}
            y2={(HEIGHT / 5) * i}
            stroke="#333"
            strokeWidth={0.5}
          />
        ))}

        {/* Gradient fill */}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,255,120,0.35)" />
            <stop offset="100%" stopColor="rgba(0,255,120,0)" />
          </linearGradient>
        </defs>

        <path
          d={buildAreaPath(PRICES, chartWidth, HEIGHT)}
          fill="url(#areaGrad)"
        />

        {/* Line */}
        <path
          d={buildSvgPath(PRICES, chartWidth, HEIGHT)}
          fill="none"
          stroke="#00ff78"
          strokeWidth={2}
        />

        {/* Dots */}
        {PRICES.map((p, i) => {
          const minP = Math.min(...PRICES) - 5;
          const maxP = Math.max(...PRICES) + 5;
          const rangeP = maxP - minP;
          const stepX = chartWidth / (PRICES.length - 1);
          const cy = HEIGHT - ((p - minP) / rangeP) * HEIGHT;
          return (
            <circle
              key={i}
              cx={i * stepX}
              cy={cy}
              r={3}
              fill="#00ff78"
            />
          );
        })}
      </svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEIGHT,
    width: '100%',
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
});
