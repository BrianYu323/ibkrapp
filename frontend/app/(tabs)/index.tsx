import React, { useEffect, useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useStore, fetchPortfolio, fetchOrders } from '../../store/useStore';
import { apiFetch } from '../../constants/config';
import ChartModal from '../../components/ChartModal';
import OrderEntry from '../../components/OrderEntry';

// ─── Symbol Search + Chart Launcher ───
function SymbolSearch({ onOpenChart }: { onOpenChart: (symbol: string) => void }) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    const symbol = input.trim().toUpperCase();
    if (symbol) {
      onOpenChart(symbol);
    }
  };

  return (
    <View style={styles.searchCard}>
      <Text style={styles.searchTitle}>📈 View Chart</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter symbol (e.g. AAPL)"
          placeholderTextColor="#555"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSubmit}
          autoCapitalize="characters"
          returnKeyType="go"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSubmit}>
          <Text style={styles.searchBtnText}>Open</Text>
        </TouchableOpacity>
      </View>
      {/* Quick access symbols */}
      <View style={styles.quickRow}>
        {['GC1!', 'SI1!', 'CL1!', 'NQ0626', 'AAPL', 'HSBC'].map((sym) => (
          <TouchableOpacity
            key={sym}
            style={styles.quickBtn}
            onPress={() => onOpenChart(sym)}
          >
            <Text style={styles.quickBtnText}>{sym}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Account Summary Card ───
function AccountSummary() {
  const account = useStore((s) => s.account);

  const fmt = (key: string) => {
    const val = account[key];
    if (!val) return '—';
    const n = parseFloat(val);
    return isNaN(n) ? val : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Account Summary</Text>
      <View style={styles.row}>
        <SummaryItem label="Net Liquidation" value={fmt('NetLiquidation')} />
        <SummaryItem label="Buying Power" value={fmt('BuyingPower')} />
      </View>
      <View style={styles.row}>
        <SummaryItem label="Total Cash" value={fmt('TotalCashValue')} />
        <SummaryItem label="Gross Position" value={fmt('GrossPositionValue')} />
      </View>
      <View style={styles.row}>
        <SummaryItem
          label="Unrealized P&L"
          value={fmt('UnrealizedPnL')}
          color={parseFloat(account['UnrealizedPnL'] || '0') >= 0 ? '#00ff78' : '#ff4d4d'}
        />
        <SummaryItem
          label="Realized P&L"
          value={fmt('RealizedPnL')}
          color={parseFloat(account['RealizedPnL'] || '0') >= 0 ? '#00ff78' : '#ff4d4d'}
        />
      </View>
    </View>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

// ─── Positions List ───
function PositionsList({ onOpenChart }: { onOpenChart: (symbol: string) => void }) {
  const positions = useStore((s) => s.positions);

  if (positions.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Positions</Text>
        <Text style={styles.emptyText}>No open positions</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Positions ({positions.length})</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Symbol</Text>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Qty</Text>
        <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Avg Cost</Text>
        <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Value</Text>
        <Text style={[styles.tableHeaderText, { flex: 0.8 }]}></Text>
      </View>
      {positions.map((pos, i) => (
        <TouchableOpacity
          key={`${pos.symbol}-${i}`}
          style={styles.tableRow}
          onPress={() => onOpenChart(pos.symbol)}
        >
          <View style={{ flex: 1.5 }}>
            <Text style={styles.symbolText}>{pos.symbol}</Text>
            <Text style={styles.secTypeText}>{pos.secType}</Text>
          </View>
          <Text style={[styles.cellText, { flex: 1, color: pos.quantity >= 0 ? '#00ff78' : '#ff4d4d' }]}>
            {pos.quantity}
          </Text>
          <Text style={[styles.cellText, { flex: 1.5 }]}>
            ${pos.avgCost.toFixed(2)}
          </Text>
          <Text style={[styles.cellText, { flex: 1.5 }]}>
            ${pos.marketValue.toFixed(2)}
          </Text>
          <View style={{ flex: 0.8, alignItems: 'center' }}>
            <Text style={styles.chartIcon}>📊</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Orders Section (Open Orders + Order History) ───
function OrdersList() {
  const orders = useStore((s) => s.orders);
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await apiFetch('/api/order-history');
      setHistory(data.orders || []);
    } catch (e) {
      console.error('Failed to fetch order history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Filled': return '#00ff78';
      case 'Submitted': case 'PreSubmitted': return '#6366f1';
      case 'Cancelled': return '#ff4d4d';
      case 'Inactive': return '#888';
      default: return '#555';
    }
  };

  const displayOrders = activeTab === 'open' ? orders : history;

  return (
    <View style={styles.card}>
      {/* Tab Header */}
      <View style={{ flexDirection: 'row', marginBottom: 12, gap: 0 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderBottomWidth: 2,
            borderBottomColor: activeTab === 'open' ? '#6366f1' : 'transparent',
          }}
          onPress={() => setActiveTab('open')}
        >
          <Text style={{ color: activeTab === 'open' ? '#fff' : '#555', fontSize: 15, fontWeight: 'bold' }}>
            Open Orders {orders.length > 0 ? `(${orders.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderBottomWidth: 2,
            borderBottomColor: activeTab === 'history' ? '#6366f1' : 'transparent',
          }}
          onPress={() => setActiveTab('history')}
        >
          <Text style={{ color: activeTab === 'history' ? '#fff' : '#555', fontSize: 15, fontWeight: 'bold' }}>
            Order History {history.length > 0 ? `(${history.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Refresh button for history tab */}
      {activeTab === 'history' && (
        <TouchableOpacity
          style={{
            alignSelf: 'flex-end',
            paddingHorizontal: 12,
            paddingVertical: 5,
            backgroundColor: '#1a1a2e',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: '#2a2a4a',
            marginBottom: 10,
          }}
          onPress={fetchHistory}
          disabled={loadingHistory}
        >
          {loadingHistory ? (
            <ActivityIndicator size="small" color="#8888ff" />
          ) : (
            <Text style={{ color: '#8888ff', fontSize: 12, fontWeight: '600' }}>↻ Refresh</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Order List */}
      {displayOrders.length === 0 ? (
        <Text style={styles.emptyText}>
          {activeTab === 'open' ? 'No open orders' : (loadingHistory ? 'Loading...' : 'No order history')}
        </Text>
      ) : (
        displayOrders.map((order: any, i: number) => (
          <View key={`${order.orderId}-${i}`} style={styles.orderRow}>
            <View style={styles.orderTop}>
              <Text style={styles.symbolText}>
                {order.localSymbol || order.symbol}
              </Text>
              <View style={[styles.badge, { backgroundColor: order.action === 'BUY' ? '#00ff78' : '#ff4d4d' }]}>
                <Text style={styles.badgeText}>{order.action}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: getStatusColor(order.status) }]}>
                <Text style={styles.badgeText}>{order.status}</Text>
              </View>
              {order.tif && (
                <View style={[styles.badge, { backgroundColor: '#333' }]}>
                  <Text style={[styles.badgeText, { color: '#aaa' }]}>{order.tif}</Text>
                </View>
              )}
            </View>
            <View style={styles.orderDetails}>
              <Text style={styles.orderDetailText}>
                {order.orderType} · Qty: {order.quantity}
                {order.limitPrice ? ` · Limit: $${order.limitPrice.toFixed(2)}` : ''}
                {order.stopPrice ? ` · Stop: $${order.stopPrice.toFixed(2)}` : ''}
              </Text>
              <Text style={styles.orderDetailText}>
                Filled: {order.filled} / {order.quantity}
                {order.avgFillPrice > 0 ? ` @ $${order.avgFillPrice.toFixed(2)}` : ''}
              </Text>
              {order.lastUpdate && (
                <Text style={{ color: '#444', fontSize: 11, marginTop: 2 }}>
                  {order.lastUpdate}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ─── Main Screen ───
export default function TabOneScreen() {
  const isConnected = useStore((s) => s.isConnected);
  const isDemoMode = useStore((s) => s.isDemoMode);
  const isLoading = useStore((s) => s.isLoading);

  // Chart modal state
  const [chartVisible, setChartVisible] = useState(false);
  const [chartSymbol, setChartSymbol] = useState('');

  const openChart = useCallback((symbol: string) => {
    setChartSymbol(symbol);
    setChartVisible(true);
  }, []);

  const closeChart = useCallback(() => {
    setChartVisible(false);
  }, []);

  const refresh = useCallback(() => {
    fetchPortfolio();
    fetchOrders();
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>IBKR Trading Pro</Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? (isDemoMode ? '#f59e0b' : '#00ff78') : '#ff4d4d' }]} />
          <Text style={styles.statusText}>
            {isConnected ? (isDemoMode ? 'Demo Mode' : 'Connected') : 'Disconnected'}
          </Text>
        </View>
      </View>

      {/* Refresh */}
      <TouchableOpacity style={styles.refreshBtn} onPress={refresh} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.refreshText}>↻ Refresh</Text>
        )}
      </TouchableOpacity>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
        <SymbolSearch onOpenChart={openChart} />
        <AccountSummary />
        <PositionsList onOpenChart={openChart} />
        <OrdersList />
        <OrderEntry />
      </ScrollView>

      {/* Chart Modal */}
      <ChartModal visible={chartVisible} symbol={chartSymbol} onClose={closeChart} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: '#888', fontSize: 13 },

  refreshBtn: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#1a1a2e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  refreshText: { color: '#8888ff', fontSize: 15, fontWeight: '600' },

  content: { flex: 1, paddingHorizontal: 16 },

  // Search card
  searchCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  searchTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    fontFamily: 'monospace',
  },
  searchBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  quickBtnText: { color: '#888', fontSize: 12, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryItem: { flex: 1 },
  summaryLabel: { color: '#666', fontSize: 12, marginBottom: 2 },
  summaryValue: { color: '#fff', fontSize: 16, fontWeight: '600' },

  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginBottom: 4,
  },
  tableHeaderText: { color: '#555', fontSize: 12, fontWeight: '600' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  symbolText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  secTypeText: { color: '#555', fontSize: 11 },
  cellText: { color: '#ccc', fontSize: 14, fontFamily: 'monospace' },
  chartIcon: { fontSize: 18 },

  orderRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#555' },
  orderDetails: {},
  orderDetailText: { color: '#888', fontSize: 13, marginTop: 2 },
});
