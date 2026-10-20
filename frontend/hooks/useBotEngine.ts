import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useStore, fetchOrders, fetchPortfolio } from '@/store/useStore';
import { apiFetch } from '@/constants/config';

interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function useBotEngine(symbol: string, bars: Bar[]) {
  const runningBots = useStore(state => state.runningBots);
  const botAutoSubmit = useStore(state => state.botAutoSubmit);
  const lastProcessedTime = useRef<number>(0);

  useEffect(() => {
    if (!symbol || bars.length === 0 || runningBots.length === 0) return;

    // Only process the latest bar to avoid duplicate orders
    const latestBar = bars[bars.length - 1];
    const latestTime = new Date(latestBar.date).getTime();

    // Debounce to prevent multiple executions for the same tick
    if (latestTime === lastProcessedTime.current) return;
    lastProcessedTime.current = latestTime;

    runningBots.forEach(async (bot) => {
      try {
        // Evaluate the bot script
        // Note: In production, consider Web Workers or sandbox. For now, new Function.
        const jsCode = stripTypeScript(bot.code);
        
        // Inject helper functions into the bot context
        const contextCode = `
          // Basic moving average helper
          const calculateSMA = (data, period) => {
            const result = [];
            for (let i = 0; i < data.length; i++) {
              if (i < period - 1) {
                result.push({ time: data[i].date, value: null });
                continue;
              }
              let sum = 0;
              for (let j = 0; j < period; j++) {
                sum += data[i - j].close;
              }
              result.push({ time: data[i].date, value: sum / period });
            }
            return result;
          };

          // Basic RSI helper
          const calculateRSI = (data, period) => {
             const result = [];
             let gains = 0;
             let losses = 0;
             for(let i=0; i<data.length; i++) {
               if(i === 0) { result.push({time: data[i].date, value: null}); continue; }
               const diff = data[i].close - data[i-1].close;
               if(diff >= 0) gains += diff; else losses -= diff;
               
               if(i < period) { result.push({time: data[i].date, value: null}); continue; }
               
               if(i === period) {
                  gains /= period; losses /= period;
               } else {
                  const currDiff = data[i].close - data[i-1].close;
                  const currGain = currDiff > 0 ? currDiff : 0;
                  const currLoss = currDiff < 0 ? -currDiff : 0;
                  gains = (gains * (period - 1) + currGain) / period;
                  losses = (losses * (period - 1) + currLoss) / period;
               }
               let rs = gains / (losses === 0 ? 0.00001 : losses);
               let rsi = 100 - (100 / (1 + rs));
               result.push({time: data[i].date, value: rsi});
             }
             return result;
          };

          // Wrap the user's script in an anonymous block to capture return
          ${jsCode}
        `;

        const executeBot = new Function('bars', contextCode);
        const decision = executeBot(bars);

        if (decision && decision.action && decision.quantity) {
          console.log(`Bot [${bot.name}] decided to ${decision.action} ${decision.quantity} ${symbol}`);
          
          if (botAutoSubmit) {
            // Auto-submit order silently
            await apiFetch('/api/order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbol: symbol,
                action: decision.action,
                quantity: decision.quantity,
                orderType: 'MKT'
              })
            });
            fetchOrders();
            fetchPortfolio();
            // Show toast or alert to notify user
            Alert.alert('🤖 Bot Executed', `[${bot.name}] Automatically submitted ${decision.action} ${decision.quantity} ${symbol} at MKT`);
          } else {
            // Pop-up confirmation
            Alert.alert(
              `🤖 Bot Triggered: ${bot.name}`,
              `The bot wants to ${decision.action} ${decision.quantity} ${symbol} at Market price.\n\nDo you want to submit this order?`,
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Submit", 
                  style: "default",
                  onPress: async () => {
                    await apiFetch('/api/order', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        symbol: symbol,
                        action: decision.action,
                        quantity: decision.quantity,
                        orderType: 'MKT'
                      })
                    });
                    fetchOrders();
                    fetchPortfolio();
                  }
                }
              ]
            );
          }
        }
      } catch (err) {
        console.error(`Error executing bot ${bot.name}:`, err);
      }
    });

  }, [bars, symbol, runningBots, botAutoSubmit]);
}

// Minimal TS stripper to avoid circular dependencies if utils is complex
function stripTypeScript(code: string): string {
  let result = code;
  result = result.replace(/^\s*interface\s+\w+\s*\{[\s\S]*?\n\s*\}/gm, '');
  result = result.replace(/^\s*type\s+\w+\s*=[\s\S]*?;\s*$/gm, '');
  result = result.replace(/\bexport\s+/g, '');
  result = result.replace(/<\s*(?:number|string|boolean|any|void|null|undefined|\w+)(?:\s*\|\s*(?:number|string|boolean|any|void|null|undefined|\w+))*(?:\s*\[\])?\s*>/g, '');
  result = result.replace(/\)\s*:\s*[\w\[\]|\s,<>]+?\s*(=>|\{)/g, ') $1');
  result = result.replace(/(const|let|var)\s+(\w+)\s*:\s*[\w\[\]|\s,<>]+?\s*=/g, '$1 $2 =');
  result = result.replace(/(^|,)\s*(\w+)\s*:\s*[\w\[\]|\s<>]+?(?=\s*[,)])/g, '$1 $2');
  return result;
}
