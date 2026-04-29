// Script Name: Fair Value Gap (TS)

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const calculateFVG = (bars: Bar[]) => {
  const boxes = [];
  const markers = [];
  
  // 向右延伸的 K 線數量（你可以自由修改這個數字）
  const EXTEND_BARS = 15;
  
  for (let i = 2; i < bars.length; i++) {
    const current = bars[i];
    const prev1 = bars[i - 1];
    const prev2 = bars[i - 2];

    // 1. 偵測看漲 FVG (Bullish FVG)
    const isBull = current.low > prev2.high && prev1.close > prev2.high;
    // 2. 偵測看跌 FVG (Bearish FVG)
    const isBear = current.high < prev2.low && prev1.close < prev2.low;

    // 計算方塊的終點時間 (避免超出陣列邊界)
    const extendIndex = Math.min(i + EXTEND_BARS, bars.length - 1);
    const endTime = bars[extendIndex].time;

    if (isBull) {
      boxes.push({
        type: 'bull',
        upper: [
          { time: prev1.time, value: current.low },
          { time: endTime, value: current.low }
        ],
        lower: [
          { time: prev1.time, value: prev2.high },
          { time: endTime, value: prev2.high }
        ]
      });
      markers.push({
        time: prev1.time,
        position: 'belowBar',
        color: '#26a69a',
        shape: 'arrowUp',
        text: 'FVG'
      });
    } else if (isBear) {
      boxes.push({
        type: 'bear',
        upper: [
          { time: prev1.time, value: prev2.low },
          { time: endTime, value: prev2.low }
        ],
        lower: [
          { time: prev1.time, value: current.high },
          { time: endTime, value: current.high }
        ]
      });
      markers.push({
        time: prev1.time,
        position: 'aboveBar',
        color: '#ef5350',
        shape: 'arrowDown',
        text: 'FVG'
      });
    }
  }

  return { boxes: boxes, markers: markers };
};

return calculateFVG(bars);
