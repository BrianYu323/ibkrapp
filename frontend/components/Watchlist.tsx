import React, { memo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useStore } from '../store/useStore';

const TickerItem = memo(({ symbol }: { symbol: string }) => {
  const ticker = useStore((state) => state.tickers[symbol]);

  if (!ticker) return null;

  const isPositive = ticker.change >= 0;

  return (
    <View style={styles.itemContainer}>
      <Text style={styles.symbol}>{ticker.symbol}</Text>
      <View style={styles.priceContainer}>
        <Text style={[styles.price, { color: isPositive ? '#00ff78' : '#ff4d4d' }]}>
          {ticker.price.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}, (prevProps, nextProps) => prevProps.symbol === nextProps.symbol);

export default function Watchlist() {
  const symbols = useStore(
    (state) => Object.keys(state.tickers),
    (oldKeys, newKeys) =>
      oldKeys.length === newKeys.length &&
      oldKeys.every((key, index) => key === newKeys[index]),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={symbols}
        renderItem={({ item }) => <TickerItem symbol={item} />}
        keyExtractor={(item) => item}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1e1e1e',
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  symbol: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontFamily: 'monospace',
  },
});
