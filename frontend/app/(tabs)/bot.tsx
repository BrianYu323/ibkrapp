import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Modal, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useStore } from '@/store/useStore';
import { apiFetch } from '@/constants/config';

interface BotScript {
  name: string;
  code: string;
}

const PRESET_BOTS = [
  {
    name: 'SMA Crossover (10, 20)',
    description: 'Buys when SMA10 crosses above SMA20. Sells when SMA10 crosses below SMA20.',
    code: `// Built-in Strategy
const sma10 = calculateSMA(bars, 10);
const sma20 = calculateSMA(bars, 20);
if (sma10.length < 2) return null;
const curr10 = sma10[sma10.length - 1].value;
const prev10 = sma10[sma10.length - 2].value;
const curr20 = sma20[sma20.length - 1].value;
const prev20 = sma20[sma20.length - 2].value;

if (prev10 <= prev20 && curr10 > curr20) return { action: 'BUY', quantity: 1 };
if (prev10 >= prev20 && curr10 < curr20) return { action: 'SELL', quantity: 1 };
return null;`
  },
  {
    name: 'RSI Oversold/Overbought',
    description: 'Buys when RSI < 30. Sells when RSI > 70.',
    code: `// Built-in Strategy
const rsi = calculateRSI(bars, 14);
if (rsi.length < 2) return null;
const curr = rsi[rsi.length - 1].value;
const prev = rsi[rsi.length - 2].value;

if (prev >= 30 && curr < 30) return { action: 'BUY', quantity: 1 };
if (prev <= 70 && curr > 70) return { action: 'SELL', quantity: 1 };
return null;`
  },
  {
    name: 'FVG Retracement + SMA10',
    description: 'Finds recent FVG. Buys when price steps into Bull FVG & price > SMA10. Sells on Bear FVG & price < SMA10.',
    code: `// FVG Retracement Strategy
const sma10Data = calculateSMA(bars, 10);
if (sma10Data.length < 10) return null;
const sma10 = sma10Data[sma10Data.length - 1].value;
const latest = bars[bars.length - 1];

let activeBullishFVG = null;
let activeBearishFVG = null;

// Scan backwards to find the most recent unmitigated FVG
for (let i = bars.length - 2; i >= 2; i--) {
  const current = bars[i];
  const prev1 = bars[i - 1];
  const prev2 = bars[i - 2];

  const isBull = current.low > prev2.high;
  const isBear = current.high < prev2.low;

  if (isBull && !activeBullishFVG) {
    const gapTop = current.low;
    const gapBottom = prev2.high;
    // Check if filled by any subsequent candle
    let filled = false;
    for (let j = i + 1; j < bars.length - 1; j++) {
      if (bars[j].low < gapBottom) { filled = true; break; }
    }
    if (!filled) activeBullishFVG = { top: gapTop, bottom: gapBottom };
  } 
  else if (isBear && !activeBearishFVG) {
    const gapTop = prev2.low;
    const gapBottom = current.high;
    let filled = false;
    for (let j = i + 1; j < bars.length - 1; j++) {
      if (bars[j].high > gapTop) { filled = true; break; }
    }
    if (!filled) activeBearishFVG = { top: gapTop, bottom: gapBottom };
  }
  
  if (activeBullishFVG || activeBearishFVG) break;
}

// Execution Logic
if (activeBullishFVG) {
  // Price touches the FVG region and stays above SMA10
  if (latest.low <= activeBullishFVG.top && latest.close > sma10) {
    return { action: 'BUY', quantity: 1 };
  }
}

if (activeBearishFVG) {
  // Price touches the FVG region and stays below SMA10
  if (latest.high >= activeBearishFVG.bottom && latest.close < sma10) {
    return { action: 'SELL', quantity: 1 };
  }
}

return null;`
  }
];

export default function BotScreen() {
  const [customBots, setCustomBots] = useState<BotScript[]>([]);
  const [activeBots, setActiveBots] = useState<string[]>([]);
  
  // Safety Settings
  const [autoSubmit, setAutoSubmit] = useState(false);

  // Editor State
  const [showEditor, setShowEditor] = useState(false);
  const [scriptName, setScriptName] = useState('');
  const [scriptCode, setScriptCode] = useState('// Write TypeScript / JavaScript script here\n// Inputs: bars (array of {time, open, high, low, close, volume})\n// Output: return { action: "BUY" | "SELL", quantity: number } OR return null;\n\n// Example: Buy if latest close > 100\nconst latest = bars[bars.length - 1];\nif (latest && latest.close > 100) {\n  return { action: "BUY", quantity: 1 };\n}\nreturn null;');

  const fetchCustomBots = async () => {
    try {
      const data = await apiFetch('/api/scripts/bots');
      if (data.scripts) {
        setCustomBots(data.scripts);
      }
    } catch (e) {
      console.error('Failed to fetch custom bots', e);
    }
  };

  useEffect(() => {
    fetchCustomBots();
  }, []);

  const saveCustomBot = async () => {
    if (!scriptName.trim()) {
      Alert.alert("Error", "Please enter a script name");
      return;
    }
    try {
      await apiFetch('/api/scripts/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scriptName.trim(), code: scriptCode })
      });
      setShowEditor(false);
      setScriptName('');
      fetchCustomBots();
    } catch (e) {
      console.error('Failed to save script', e);
    }
  };

  const deleteCustomBot = async (name: string) => {
    try {
      await apiFetch(`/api/scripts/bots/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      setActiveBots(prev => prev.filter(id => id !== `custom_${name}`));
      fetchCustomBots();
    } catch (e) {
      console.error('Failed to delete script', e);
    }
  };

  const toggleBot = (id: string) => {
    setActiveBots(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const openEditor = (bot?: { name: string, code: string }) => {
    if (bot) {
      setScriptName(bot.name);
      setScriptCode(bot.code);
    } else {
      setScriptName('');
      setScriptCode('// Write TypeScript / JavaScript script here\n// Inputs: bars (array of {time, open, high, low, close, volume})\n// Output: return { action: "BUY" | "SELL", quantity: number } OR return null;\n\n// Example: Buy if latest close > 100\nconst latest = bars[bars.length - 1];\nif (latest && latest.close > 100) {\n  return { action: "BUY", quantity: 1 };\n}\nreturn null;');
    }
    setShowEditor(true);
  };

  // Sync safety settings to store so execution engine can use it
  const setBotAutoSubmit = useStore(state => state.setBotAutoSubmit);
  useEffect(() => {
    setBotAutoSubmit(autoSubmit);
  }, [autoSubmit]);

  // Sync active bots to store
  const setRunningBots = useStore(state => state.setRunningBots);
  useEffect(() => {
    // Combine preset and custom bots codes and push to store
    const running = activeBots.map(id => {
      if (id.startsWith('preset_')) {
        const name = id.replace('preset_', '');
        const preset = PRESET_BOTS.find(p => p.name === name);
        return { id, name, code: preset?.code || '' };
      } else if (id.startsWith('custom_')) {
        const name = id.replace('custom_', '');
        const custom = customBots.find(c => c.name === name);
        return { id, name, code: custom?.code || '' };
      }
      return null;
    }).filter(b => b !== null) as {id: string, name: string, code: string}[];

    setRunningBots(running);
  }, [activeBots, customBots]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Automated Trading Bots</Text>
      </View>

      <ScrollView style={styles.content}>
        
        {/* Safety Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Settings</Text>
          <View style={styles.settingRow}>
            <View style={{flex: 1}}>
              <Text style={styles.settingTitle}>Auto-submit Orders</Text>
              <Text style={styles.settingDesc}>
                If OFF, the bot will show a pop-up confirmation window. If ON, the bot will automatically send orders to IBKR.
              </Text>
            </View>
            <Switch 
              value={autoSubmit} 
              onValueChange={setAutoSubmit} 
              trackColor={{ false: '#333', true: '#6366f1' }}
              thumbColor={autoSubmit ? '#fff' : '#888'}
            />
          </View>
        </View>

        {/* Action Library */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Action Library (Presets)</Text>
          {PRESET_BOTS.map(bot => {
            const id = `preset_${bot.name}`;
            const isActive = activeBots.includes(id);
            return (
              <View key={id} style={[styles.botCard, isActive && styles.botCardActive, { padding: 0 }]}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 16, flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => toggleBot(id)}
                >
                  <View style={styles.botCardLeft}>
                    <Text style={[styles.botName, isActive && styles.botNameActive]}>{bot.name}</Text>
                    <Text style={styles.botDesc}>{bot.description}</Text>
                  </View>
                  <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                    {isActive && <Text style={{color: '#fff', fontSize: 12, fontWeight: 'bold'}}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEditor(bot)} style={styles.actionBtn}>
                  <Text style={{color: '#4ecdc4', fontSize: 16}}>✏️</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Custom Bots */}
        <View style={styles.section}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
            <Text style={[styles.sectionTitle, {marginBottom: 0}]}>Custom Bots</Text>
            <TouchableOpacity onPress={() => openEditor()} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add Custom Bot</Text>
            </TouchableOpacity>
          </View>

          {customBots.length === 0 ? (
            <Text style={styles.emptyText}>No custom bots created yet.</Text>
          ) : (
            customBots.map(bot => {
              const id = `custom_${bot.name}`;
              const isActive = activeBots.includes(id);
              return (
                <View key={id} style={[styles.botCard, isActive && styles.botCardActive, { padding: 0 }]}>
                  <TouchableOpacity 
                    style={{ flex: 1, padding: 16, flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => toggleBot(id)}
                  >
                    <View style={styles.botCardLeft}>
                      <Text style={[styles.botName, isActive && styles.botNameActive]}>{bot.name}</Text>
                      <Text style={styles.botDesc}>Custom defined logic</Text>
                    </View>
                    <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                      {isActive && <Text style={{color: '#fff', fontSize: 12, fontWeight: 'bold'}}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEditor(bot)} style={styles.actionBtn}>
                    <Text style={{color: '#4ecdc4', fontSize: 16}}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteCustomBot(bot.name)} style={styles.actionBtn}>
                    <Text style={{color: '#ef5350', fontSize: 16}}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Script Editor Modal */}
      <Modal visible={showEditor} transparent={true} animationType="fade">
        <View style={styles.editorOverlay}>
          <View style={styles.editorContent}>
            <Text style={styles.editorTitle}>🤖 Add Custom Bot</Text>
            <Text style={styles.editorDesc}>
              Write TypeScript / JavaScript to define your trading logic. Type annotations will be auto-stripped.{'\n\n'}
              Input: <Text style={{color: '#ff9ff3'}}>bars</Text> — array of {'{ time, open, high, low, close, volume }'}{'\n\n'}
              Return format: <Text style={{color: '#4ecdc4'}}>{'{ action: "BUY" | "SELL", quantity: number }'}</Text> OR <Text style={{color: '#4ecdc4'}}>null</Text> if no action should be taken.
            </Text>
            <TextInput
              style={styles.editorInputName}
              placeholder="Bot Name (e.g. Breakout Strategy)"
              placeholderTextColor="#888"
              value={scriptName}
              onChangeText={setScriptName}
            />
            <TextInput
              style={styles.editorInputCode}
              multiline
              value={scriptCode}
              onChangeText={setScriptCode}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              keyboardType="ascii-capable"
            />
            <View style={styles.editorActions}>
              <TouchableOpacity style={styles.editorBtnCancel} onPress={() => setShowEditor(false)}>
                <Text style={styles.editorBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editorBtnSave} onPress={saveCustomBot}>
                <Text style={styles.editorBtnText}>Save Bot</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 32 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  
  settingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  settingTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  settingDesc: { color: '#aaa', fontSize: 13, marginTop: 4, marginRight: 20 },

  botCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#222', marginBottom: 10 },
  botCardActive: { borderColor: '#6366f1', backgroundColor: '#1a1a2e' },
  botCardLeft: { flex: 1 },
  botName: { color: '#ddd', fontSize: 16, fontWeight: 'bold' },
  botNameActive: { color: '#fff' },
  botDesc: { color: '#888', fontSize: 13, marginTop: 4 },
  
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },

  addBtn: { backgroundColor: '#1a1a2e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#6366f1' },
  addBtnText: { color: '#6366f1', fontWeight: 'bold' },
  emptyText: { color: '#666', fontStyle: 'italic', padding: 16, textAlign: 'center' },
  actionBtn: { padding: 16, borderLeftWidth: 1, borderLeftColor: '#222', justifyContent: 'center' },

  // Editor Modal
  editorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  editorContent: { width: '100%', maxWidth: 600, backgroundColor: '#141414', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#333' },
  editorTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  editorDesc: { color: '#aaa', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  editorInputName: { backgroundColor: '#0a0a0a', color: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 12, fontSize: 16 },
  editorInputCode: { backgroundColor: '#0a0a0a', color: '#a8ff60', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', height: 250, fontFamily: 'monospace', fontSize: 14, textAlignVertical: 'top', marginBottom: 20 },
  editorActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  editorBtnCancel: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#333', borderRadius: 8 },
  editorBtnSave: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#6366f1', borderRadius: 8 },
  editorBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
