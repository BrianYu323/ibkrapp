import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { AVAILABLE_INDICATORS } from '../utils/indicators';
import { useBotEngine } from '../hooks/useBotEngine';

const API_BASE = 'http://127.0.0.1:8000';
const TIMEFRAMES = ['15m', '1h', '2h', '4h'];

interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartModalProps {
  visible: boolean;
  symbol: string;
  onClose: () => void;
}

export default function ChartModal({ visible, symbol, onClose }: ChartModalProps) {
  const [bars, setBars] = useState<Bar[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showIndicators, setShowIndicators] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);

  // Custom Scripts State
  const [customScripts, setCustomScripts] = useState<{name: string, code: string}[]>([]);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const [scriptName, setScriptName] = useState('');
  const [scriptCode, setScriptCode] = useState('// Write TypeScript/JavaScript script here\n// Inputs: bars (array of {time, open, high, low, close, volume})\n// Output: array of {time, value}\n\nlet result = [];\nfor(let i=0; i<bars.length; i++) {\n  result.push({\n    time: bars[i].time,\n    value: bars[i].close\n  });\n}\nreturn result;');

  // Run the bot engine on the current chart's bars
  useBotEngine(symbol, bars);

  const fetchCustomScripts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scripts/indicators`);
      const data = await res.json();
      if (data.scripts) setCustomScripts(data.scripts);
    } catch (e) {
      console.error('Failed to fetch scripts', e);
    }
  };

  useEffect(() => {
    fetchCustomScripts();
  }, []);

  const saveCustomScript = async () => {
    if (!scriptName.trim()) {
      alert("Please enter a script name");
      return;
    }
    try {
      await fetch(`${API_BASE}/api/scripts/indicators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scriptName.trim(), code: scriptCode })
      });
      setShowScriptEditor(false);
      setScriptName('');
      fetchCustomScripts();
    } catch (e) {
      console.error('Failed to save script', e);
    }
  };

  const deleteCustomScript = async (name: string) => {
    try {
      await fetch(`${API_BASE}/api/scripts/indicators/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      setActiveIndicators(prev => prev.filter(id => id !== `custom_${name}`));
      fetchCustomScripts();
    } catch (e) {
      console.error('Failed to delete script', e);
    }
  };

  const toggleIndicator = (id: string) => {
    setActiveIndicators(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const fetchBars = useCallback(async (tf: string) => {
    if (!symbol) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/api/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${tf}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setBars([]);
      } else {
        setBars(data.bars || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (visible && symbol) {
      fetchBars(timeframe);
    }
  }, [visible, symbol, timeframe]);

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
  };

  // Latest bar info
  const latestBar = bars.length > 0 ? bars[bars.length - 1] : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.symbolTitle}>{symbol}</Text>
            {latestBar && (
              <Text style={[
                styles.priceText,
                { color: latestBar.close >= latestBar.open ? '#26a69a' : '#ef5350' }
              ]}>
                {latestBar.close.toFixed(2)}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Timeframe Selector & Indicators Button */}
        <View style={styles.tfRow}>
          {TIMEFRAMES.map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.tfBtn, timeframe === tf && styles.tfBtnActive]}
              onPress={() => handleTimeframeChange(tf)}
            >
              <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>
                {tf.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity 
            style={[styles.tfBtn, { marginLeft: 'auto', backgroundColor: showIndicators ? '#1a1a3e' : '#141414' }]}
            onPress={() => setShowIndicators(!showIndicators)}
          >
            <Text style={[styles.tfText, showIndicators && styles.tfTextActive]}>Indicators ⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Indicators Panel (Floating Dropdown) */}
        {showIndicators && (
          <View style={styles.indicatorsDropdown}>
            <ScrollView style={{ flex: 1 }}>
              <Text style={styles.indicatorsGroupTitle}>Overlay Indicators</Text>
              {AVAILABLE_INDICATORS.filter(d => d.category === 'overlay').map(ind => {
                const isActive = activeIndicators.includes(ind.id);
                return (
                  <TouchableOpacity 
                    key={ind.id} 
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => toggleIndicator(ind.id)}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <View style={[styles.colorDot, { backgroundColor: ind.color }]} />
                      <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>{ind.name}</Text>
                    </View>
                    {isActive && <Text style={{color: '#6366f1', fontWeight: 'bold'}}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              <Text style={styles.indicatorsGroupTitle}>Oscillators</Text>
              {AVAILABLE_INDICATORS.filter(d => d.category === 'oscillator').map(ind => {
                const isActive = activeIndicators.includes(ind.id);
                return (
                  <TouchableOpacity 
                    key={ind.id} 
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => toggleIndicator(ind.id)}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <View style={[styles.colorDot, { backgroundColor: ind.color }]} />
                      <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>{ind.name}</Text>
                    </View>
                    {isActive && <Text style={{color: '#6366f1', fontWeight: 'bold'}}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              <Text style={styles.indicatorsGroupTitle}>Custom Scripts</Text>
              {customScripts.map(script => {
                const id = `custom_${script.name}`;
                const isActive = activeIndicators.includes(id);
                return (
                  <View 
                    key={id} 
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                  >
                    <TouchableOpacity 
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => toggleIndicator(id)}
                    >
                      <View style={[styles.colorDot, { backgroundColor: '#f368e0' }]} />
                      <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>{script.name}</Text>
                      {isActive && <Text style={{color: '#6366f1', fontWeight: 'bold', marginLeft: 10}}>✓</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCustomScript(script.name)} style={{ paddingLeft: 10 }}>
                      <Text style={{color: '#ef5350', fontSize: 16}}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => { setShowScriptEditor(true); setShowIndicators(false); }}
              >
                <Text style={{color: '#00cec9', fontWeight: 'bold'}}>+ Add Custom Script</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Chart Area */}
        <View style={styles.chartArea}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Loading {symbol}...</Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </View>
          ) : bars.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No data available</Text>
            </View>
          ) : Platform.OS === 'web' ? (
            <LightweightChartView bars={bars} activeIndicators={activeIndicators} customScripts={customScripts} />
          ) : (
            <Text style={styles.emptyText}>Chart only available on web</Text>
          )}
        </View>

        {/* OHLCV Info Bar */}
        {latestBar && !loading && (
          <View style={styles.infoBar}>
            <InfoItem label="O" value={latestBar.open.toFixed(2)} />
            <InfoItem label="H" value={latestBar.high.toFixed(2)} />
            <InfoItem label="L" value={latestBar.low.toFixed(2)} />
            <InfoItem
              label="C"
              value={latestBar.close.toFixed(2)}
              color={latestBar.close >= latestBar.open ? '#26a69a' : '#ef5350'}
            />
            <InfoItem label="Vol" value={formatVolume(latestBar.volume)} />
          </View>
        )}

        {/* Custom Script Editor Modal */}
        <Modal visible={showScriptEditor} transparent={true} animationType="fade">
          <View style={styles.editorOverlay}>
            <View style={styles.editorContent}>
              <Text style={styles.editorTitle}>📝 Add Custom Indicator</Text>
              <Text style={styles.editorDesc}>
                Write TypeScript / JavaScript to create your own indicator. The array <Text style={{color: '#ff9ff3'}}>bars</Text> is provided containing `{'{time, open, high, low, close, volume}'}` for each candle. Your script MUST return an array of objects shaped like `{'{time, value}'}`.
              </Text>
              <TextInput
                style={styles.editorInputName}
                placeholder="Script Name (e.g. My Indicator)"
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
              />
              <View style={styles.editorBtns}>
                <TouchableOpacity style={styles.editorBtnCancel} onPress={() => setShowScriptEditor(false)}>
                  <Text style={{color: '#ccc', fontWeight: 'bold'}}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editorBtnSave} onPress={saveCustomScript}>
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>Save Script</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </Modal>
  );
}

// ─── Strip TypeScript syntax for runtime execution ───
function stripTypeScript(code: string): string {
  let result = code;
  // Remove interface blocks (single & multi-line)
  result = result.replace(/^\s*interface\s+\w+\s*\{[\s\S]*?\n\s*\}/gm, '');
  // Remove type alias declarations
  result = result.replace(/^\s*type\s+\w+\s*=[\s\S]*?;\s*$/gm, '');
  // Remove 'export' keyword
  result = result.replace(/\bexport\s+/g, '');
  // Remove generic type params from function calls/defs: <Type>
  result = result.replace(/<\s*(?:number|string|boolean|any|void|null|undefined|\w+)(?:\s*\|\s*(?:number|string|boolean|any|void|null|undefined|\w+))*(?:\s*\[\])?\s*>/g, '');
  // Remove function return type annotations: ): ReturnType => or ): ReturnType {
  result = result.replace(/\)\s*:\s*[\w\[\]|\s,<>]+?\s*(=>|\{)/g, ') $1');
  // Remove const/let/var type annotations: const x: Type =
  result = result.replace(/(const|let|var)\s+(\w+)\s*:\s*[\w\[\]|\s,<>]+?\s*=/g, '$1 $2 =');
  // Remove parameter type annotations in function signatures: (param: Type)
  // Handle multi-param: (a: T, b: U) — process each param
  result = result.replace(/(\(|,)\s*(\w+)\s*:\s*[\w\[\]|\s<>]+?(?=\s*[,)])/g, '$1 $2');
  return result;
}

// ─── TradingView Lightweight Charts (Web Only) ───
function LightweightChartView({ bars, activeIndicators, customScripts }: { bars: Bar[]; activeIndicators: string[]; customScripts: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically import lightweight-charts
    const initChart = async () => {
      const { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries, BaselineSeries } = await import('lightweight-charts');

      // Clean up previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = createChart(containerRef.current!, {
        width: containerRef.current!.clientWidth,
        height: containerRef.current!.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: '#0a0a0a' },
          textColor: '#888',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: '#1a1a1a' },
          horzLines: { color: '#1a1a1a' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#6366f1',
            width: 1,
            style: 2,
            labelBackgroundColor: '#6366f1',
          },
          horzLine: {
            color: '#6366f1',
            width: 1,
            style: 2,
            labelBackgroundColor: '#6366f1',
          },
        },
        rightPriceScale: {
          borderColor: '#222',
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        timeScale: {
          borderColor: '#222',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // Add candlestick series (v5 API)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        wickUpColor: '#26a69a',
      });

      // Convert bar data to lightweight-charts format
      const chartData = bars.map((bar) => ({
        time: parseBarDate(bar.date),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));

      candleSeries.setData(chartData as any);

      // Add volume series (v5 API)
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      const volumeData = bars.map((bar) => ({
        time: parseBarDate(bar.date),
        value: bar.volume,
        color: bar.close >= bar.open ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)',
      }));

      volumeSeries.setData(volumeData as any);

      // ── Add Technical Indicators ──
      const chartBars = bars.map((bar) => ({
        time: parseBarDate(bar.date),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      }));

      // Calculate how many oscillators we have to split the bottom space
      const activeOscillators = activeIndicators.map(id => AVAILABLE_INDICATORS.find(d => d.id === id)).filter(d => d && d.category === 'oscillator');
      const numOscillators = activeOscillators.length;
      
      // Adjust volume scale to leave room if there are oscillators
      const bottomSpace = numOscillators > 0 ? 0.3 : 0;
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8 - bottomSpace, bottom: bottomSpace },
      });

      let oscIndex = 0;

      activeIndicators.forEach(id => {
        let linesData: any[] = [];
        let isOscillator = false;

        if (id.startsWith('custom_')) {
          const scriptName = id.replace('custom_', '');
          const scriptDef = customScripts.find(s => s.name === scriptName);
          if (scriptDef) {
            try {
              // Strip TypeScript syntax before execution
              const jsCode = stripTypeScript(scriptDef.code);
              const computeFunc = new Function('bars', jsCode);
              const result = computeFunc(chartBars);

              // Support two return formats:
              // 1) Simple: [{time, value}, ...]
              // 2) Rich:   { lines: [...], markers: [...], boxes: [...] }
              if (Array.isArray(result) && result.length > 0) {
                // Filter out null values for line data
                const validData = result.filter((p: any) => p.value !== null && p.value !== undefined);
                if (validData.length > 0) {
                  linesData = [{
                    data: validData,
                    color: '#f368e0',
                    lineWidth: 2,
                    title: scriptName
                  }];
                }
              } else if (result && typeof result === 'object') {
                // Rich format
                if (result.lines) {
                  linesData = result.lines;
                }
                // Render boxes as colored Area pairs using BaselineSeries
                if (result.boxes && Array.isArray(result.boxes)) {
                  for (const box of result.boxes) {
                    const isBullish = box.type === 'bull';
                    const fillColor = isBullish
                      ? 'rgba(38,166,154,0.25)'
                      : 'rgba(239,83,80,0.25)';
                    const lineColor = isBullish
                      ? 'rgba(38,166,154,0.6)'
                      : 'rgba(239,83,80,0.6)';

                    if (box.upper && box.lower && box.upper.length > 0 && box.lower.length > 0) {
                      const basePrice = box.lower[0].value;
                      
                      const boxSeries = chart.addSeries(BaselineSeries, {
                        topFillColor1: fillColor,
                        topFillColor2: fillColor,
                        bottomFillColor1: fillColor,
                        bottomFillColor2: fillColor,
                        topLineColor: lineColor,
                        bottomLineColor: lineColor,
                        lineWidth: 1,
                        crosshairMarkerVisible: false,
                        lastValueVisible: false,
                        priceLineVisible: false,
                        baseValue: { type: 'price', price: basePrice }
                      });
                      
                      boxSeries.setData(box.upper);

                      // Lower boundary line is already drawn by BaselineSeries (either top or bottom depending on which is higher)
                      // But to ensure the lower line has exactly the same color/thickness as the upper, we can still add it if we want.
                      // Actually BaselineSeries draws both lines! But if value === baseValue, it doesn't draw the line on baseValue.
                      // Let's explicitly draw the lower line just in case.
                      const lowerSeries = chart.addSeries(LineSeries, {
                        color: lineColor,
                        lineWidth: 1,
                        crosshairMarkerVisible: false,
                        lastValueVisible: false,
                        priceLineVisible: false,
                      });
                      lowerSeries.setData(box.lower);
                    }
                  }
                }
                // Render markers on candle series
                if (result.markers && Array.isArray(result.markers)) {
                  const existingMarkers = (candleSeries as any).markers?.() || [];
                  candleSeries.setMarkers([...existingMarkers, ...result.markers]);
                }
              }
            } catch (e) {
              console.error(`Script error for ${scriptName}:`, e);
            }
          }
        } else {
          const def = AVAILABLE_INDICATORS.find(d => d.id === id);
          if (!def) return;
          const result = def.compute(chartBars as any);
          linesData = result.lines;
          isOscillator = def.category === 'oscillator';
        }

        linesData.forEach((lineDef: any) => {
          const seriesOptions: any = {
            color: lineDef.color,
            lineWidth: lineDef.lineWidth || 2,
            title: lineDef.title,
            crosshairMarkerVisible: false,
          };

          if (isOscillator) {
            seriesOptions.priceScaleId = `oscillator_${id}`;
          }

          const series = chart.addSeries(LineSeries, seriesOptions);

          if (isOscillator) {
            // Distribute oscillators evenly at the bottom
            const heightPerOsc = 0.3 / (numOscillators || 1);
            const bottomMargin = oscIndex * heightPerOsc;
            const topMargin = 1 - bottomMargin - heightPerOsc;
            
            series.priceScale().applyOptions({
              scaleMargins: { top: topMargin, bottom: bottomMargin },
            });
            oscIndex++;
          }

          series.setData(lineDef.data);
        });
      });

      // Auto-fit content
      chart.timeScale().fitContent();

      chartRef.current = chart;

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      resizeObserver.observe(containerRef.current!);

      return () => {
        resizeObserver.disconnect();
      };
    };

    initChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [bars, activeIndicators]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    />
  );
}

// Parse date string to lightweight-charts time format
function parseBarDate(dateStr: string): string | number {
  // IBKR returns dates like "2024-01-15" or "2024-01-15 09:30:00"
  if (dateStr.includes(' ')) {
    // Intraday: convert to UNIX timestamp
    return Math.floor(new Date(dateStr).getTime() / 1000);
  }
  // Daily: return as string "YYYY-MM-DD"
  return dateStr;
}

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toString();
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  symbolTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
  },
  tfRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  tfBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222',
  },
  tfBtnActive: {
    backgroundColor: '#1a1a3e',
    borderColor: '#6366f1',
  },
  tfText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  tfTextActive: {
    color: '#6366f1',
  },
  chartArea: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 10,
    fontSize: 14,
  },
  errorText: {
    color: '#ff4d4d',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#555',
    fontSize: 14,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    backgroundColor: '#0f0f0f',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    color: '#555',
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  indicatorsDropdown: {
    position: 'absolute',
    top: 135,
    right: 20,
    width: 260,
    maxHeight: 450,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    zIndex: 100,
    // Add shadow to make it float visually above chart
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  indicatorsGroupTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#0a0a0a',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  dropdownItemActive: {
    backgroundColor: '#1a1a3e',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownItemText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  editorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editorContent: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  editorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  editorDesc: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  editorInputName: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#222',
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    fontSize: 15,
    marginBottom: 12,
  },
  editorInputCode: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#222',
    color: '#a29bfe',
    padding: 12,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'monospace',
    height: 250,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  editorBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editorBtnCancel: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  editorBtnSave: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
});
