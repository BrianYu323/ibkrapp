import React from 'react';
import { Dimensions } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

const { width } = Dimensions.get('window');
const HEIGHT = 200;

export default function CandleChartInner() {
  const path = Skia.Path.Make();
  path.moveTo(0, HEIGHT / 2);
  path.lineTo(width * 0.2, HEIGHT * 0.8);
  path.lineTo(width * 0.4, HEIGHT * 0.3);
  path.lineTo(width * 0.6, HEIGHT * 0.6);
  path.lineTo(width * 0.8, HEIGHT * 0.2);
  path.lineTo(width, HEIGHT * 0.5);

  return (
    <Canvas style={{ width, height: HEIGHT }}>
      <Path path={path} style="stroke" strokeWidth={2} color="#00ff00" />
    </Canvas>
  );
}
