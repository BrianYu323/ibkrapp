import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useStore, fetchOrders, fetchPortfolio } from '../store/useStore';
import { apiFetch } from '../constants/config';

export default function OrderEntry() {
  const isConnected = useStore((s) => s.isConnected);

  const [symbol, setSymbol] = useState('');
  const [requestSymbol, setRequestSymbol] = useState('');
  const [displaySymbol, setDisplaySymbol] = useState('');
  const [secType, setSecType] = useState('');
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Order Fields
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('1');
  const [orderType, setOrderType] = useState('MKT');
  const [limitPrice, setLimitPrice] = useState('');
  const [tif, setTif] = useState('DAY');
  const [outsideRth, setOutsideRth] = useState(true);

  const [hasStopLoss, setHasStopLoss] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState('');

  // Modal
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (requestSymbol && isConnected) {
      fetchPrice(requestSymbol);
      interval = setInterval(() => {
        fetchPrice(requestSymbol);
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [requestSymbol, isConnected]);

  const fetchPrice = async (sym: string) => {
    try {
      const data = await apiFetch(`/api/market-price?symbol=${encodeURIComponent(sym)}`);
      if (data && data.marketPrice) {
        setMarketPrice(data.marketPrice);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolve = async () => {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setIsResolving(true);
    setErrorMsg('');
    setRequestSymbol('');
    setDisplaySymbol('');
    setMarketPrice(null);
    try {
      const data = await apiFetch(`/api/resolve?symbol=${encodeURIComponent(s)}`);
      if (data.found) {
        setRequestSymbol(s);
        setDisplaySymbol(data.symbol);
        setSecType(data.secType);
      } else {
        setErrorMsg(data.error || 'Contract not found');
      }
    } catch (e) {
      setErrorMsg('Failed to resolve contract');
    } finally {
      setIsResolving(false);
    }
  };

  const handlePreSubmit = () => {
    if (!requestSymbol) {
      setErrorMsg('Please resolve a contract first.');
      return;
    }
    const q = parseFloat(quantity);
    if (isNaN(q) || q <= 0) {
      setErrorMsg('Please enter a valid quantity.');
      return;
    }
    if (orderType === 'LMT' && (!limitPrice || isNaN(parseFloat(limitPrice)))) {
      setErrorMsg('Please enter a valid limit price.');
      return;
    }
    if (hasStopLoss && (!stopLossPrice || isNaN(parseFloat(stopLossPrice)))) {
      setErrorMsg('Please enter a valid stop loss price.');
      return;
    }
    setErrorMsg('');
    setConfirmVisible(true);
  };

  const executeOrder = async () => {
    setIsSubmitting(true);
    const orderData: any = {
      symbol: requestSymbol,
      action,
      quantity: parseFloat(quantity),
      orderType,
      tif,
      outsideRth,
    };

    if (orderType === 'LMT') {
      orderData.limitPrice = parseFloat(limitPrice);
    }
    if (hasStopLoss) {
      orderData.attachedStopLossPrice = parseFloat(stopLossPrice);
    }

    try {
      const data = await apiFetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (data.success) {
        // Reset the form basically after success
        setQuantity('1');
        setLimitPrice('');
        setStopLossPrice('');
        setHasStopLoss(false);
        fetchOrders();
        fetchPortfolio();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert('Order submission failed.');
    } finally {
      setIsSubmitting(false);
      setConfirmVisible(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>⚡ Order Entry</Text>

      {/* Search Row */}
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Symbol (e.g. AAPL, NQ0626)"
          placeholderTextColor="#555"
          value={symbol}
          onChangeText={setSymbol}
          autoCapitalize="characters"
          onSubmitEditing={handleResolve}
        />
        <TouchableOpacity style={styles.resolveBtn} onPress={handleResolve}>
          {isResolving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Match Contract</Text>}
        </TouchableOpacity>
      </View>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      {/* Market Data */}
      {requestSymbol ? (
        <View style={styles.marketDataBox}>
          <View>
            <Text style={styles.resolvedSymbol}>{displaySymbol}</Text>
            <Text style={styles.secType}>{secType}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.marketPriceLabel}>Market Price</Text>
            <Text style={styles.marketPriceValue}>
              {marketPrice ? `$${marketPrice.toFixed(2)}` : 'Loading...'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Order Settings */}
      {requestSymbol ? (
        <View style={styles.orderSettings}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, action === 'BUY' && styles.buyBtnActive]}
              onPress={() => setAction('BUY')}
            >
              <Text style={[styles.actionBtnText, action === 'BUY' && { color: '#fff' }]}>BUY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, action === 'SELL' && styles.sellBtnActive]}
              onPress={() => setAction('SELL')}
            >
              <Text style={[styles.actionBtnText, action === 'SELL' && { color: '#fff' }]}>SELL</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Qty</Text>
              <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Order Type</Text>
              <View style={styles.toggleRow}>
                {['MKT', 'LMT'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.toggleBtn, orderType === t && styles.toggleBtnActive]}
                    onPress={() => setOrderType(t)}
                  >
                    <Text style={[styles.toggleText, orderType === t && styles.toggleTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {orderType === 'LMT' && (
            <View style={styles.fieldRow}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Limit Price</Text>
                <TextInput style={styles.input} value={limitPrice} onChangeText={setLimitPrice} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#555" />
              </View>
              <View style={styles.fieldGroup} />
            </View>
          )}

          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Time in Force</Text>
              <View style={styles.toggleRow}>
                {['DAY', 'GTC'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.toggleBtn, tif === t && styles.toggleBtnActive]}
                    onPress={() => setTif(t)}
                  >
                    <Text style={[styles.toggleText, tif === t && styles.toggleTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Trading Hours</Text>
              <TouchableOpacity style={[styles.checkboxRow, { marginTop: 10 }]} onPress={() => setOutsideRth(!outsideRth)}>
                <View style={[styles.checkbox, outsideRth && styles.checkboxActive]}>
                  {outsideRth && <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={styles.label}>Outside RTH</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stop Loss Option */}
          <View style={styles.stopLossContainer}>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setHasStopLoss(!hasStopLoss)}>
              <View style={[styles.checkbox, hasStopLoss && styles.checkboxActive]}>
                {hasStopLoss && <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
              </View>
              <Text style={styles.label}>Attach Stop Loss</Text>
            </TouchableOpacity>

            {hasStopLoss && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.label}>Stop Price</Text>
                <TextInput style={styles.input} value={stopLossPrice} onChangeText={setStopLossPrice} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#555" />
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handlePreSubmit}>
            <Text style={styles.submitBtnText}>Submit Order</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Confirmation Modal */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Order</Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>Action: <Text style={[styles.summaryVal, { color: action === 'BUY' ? '#00ff78' : '#ff4d4d' }]}>{action}</Text></Text>
              <Text style={styles.summaryText}>Symbol: <Text style={styles.summaryVal}>{requestSymbol}</Text></Text>
              <Text style={styles.summaryText}>Quantity: <Text style={styles.summaryVal}>{quantity}</Text></Text>
              <Text style={styles.summaryText}>Type: <Text style={styles.summaryVal}>{orderType}</Text></Text>
              {orderType === 'LMT' && <Text style={styles.summaryText}>Limit Price: <Text style={styles.summaryVal}>${limitPrice}</Text></Text>}
              <Text style={styles.summaryText}>TIF: <Text style={styles.summaryVal}>{tif}</Text></Text>
              <Text style={styles.summaryText}>Outside RTH: <Text style={styles.summaryVal}>{outsideRth ? 'Yes' : 'No'}</Text></Text>
              {hasStopLoss && <Text style={styles.summaryText}>Stop Loss: <Text style={styles.summaryVal}>${stopLossPrice}</Text></Text>}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.btnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={executeOrder} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  input: {
    backgroundColor: '#0a0a0a',
    color: '#fff',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    fontFamily: 'monospace',
  },
  resolveBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  errorText: { color: '#ff4d4d', fontSize: 13, marginBottom: 10 },

  marketDataBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    marginBottom: 16,
  },
  resolvedSymbol: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  secType: { color: '#8888ff', fontSize: 12 },
  marketPriceLabel: { color: '#aaa', fontSize: 12, marginBottom: 2 },
  marketPriceValue: { color: '#00ff78', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' },

  orderSettings: {
    gap: 12,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  buyBtnActive: { backgroundColor: '#008840', borderColor: '#00ff78' },
  sellBtnActive: { backgroundColor: '#880000', borderColor: '#ff4d4d' },
  actionBtnText: { color: '#666', fontSize: 15, fontWeight: 'bold' },

  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldGroup: { flex: 1, gap: 6 },
  label: { color: '#aaa', fontSize: 13 },

  toggleRow: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#333' },
  toggleText: { color: '#555', fontSize: 13, fontWeight: 'bold' },
  toggleTextActive: { color: '#fff' },

  stopLossContainer: {
    marginTop: 10,
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },

  submitBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#141414', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  summaryBox: { backgroundColor: '#0a0a0a', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#222', gap: 8, marginBottom: 20 },
  summaryText: { color: '#aaa', fontSize: 15 },
  summaryVal: { color: '#fff', fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 12, backgroundColor: '#333', borderRadius: 8, alignItems: 'center' },
  modalBtnConfirm: { flex: 1, paddingVertical: 12, backgroundColor: '#6366f1', borderRadius: 8, alignItems: 'center' },
});
