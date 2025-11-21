// Test script to verify redCandleHighBreak strategy behavior
import { redCandleHighBreak } from './src/strategies/redCandleHighBreak.js';

// CSV data in chronological order (oldest first)
const testData = [
  { timestamp: '2025-11-19 09:15:00+05:30', open: 114.65, high: 114.65, low: 87.05, close: 95.45 },
  { timestamp: '2025-11-19 09:16:00+05:30', open: 95.2, high: 102.6, low: 94.3, close: 97.6 },
  { timestamp: '2025-11-19 09:17:00+05:30', open: 97.7, high: 99.2, low: 95.15, close: 96.65 },
  { timestamp: '2025-11-19 09:18:00+05:30', open: 96.65, high: 96.7, low: 86.75, close: 86.8 },
  { timestamp: '2025-11-19 09:19:00+05:30', open: 87.05, high: 89.0, low: 83.0, close: 83.8 },
  { timestamp: '2025-11-19 09:20:00+05:30', open: 84.0, high: 87.35, low: 81.35, close: 85.7 },
  { timestamp: '2025-11-19 09:21:00+05:30', open: 85.8, high: 91.4, low: 85.0, close: 87.6 },
  { timestamp: '2025-11-19 09:22:00+05:30', open: 87.7, high: 93.35, low: 87.2, close: 92.4 },
  { timestamp: '2025-11-19 09:23:00+05:30', open: 92.35, high: 93.3, low: 89.8, close: 91.6 },
  { timestamp: '2025-11-19 09:24:00+05:30', open: 91.4, high: 100.55, low: 88.85, close: 97.3 },
  { timestamp: '2025-11-19 09:25:00+05:30', open: 97.35, high: 99.15, low: 94.5, close: 97.9 },
  { timestamp: '2025-11-19 09:26:00+05:30', open: 97.85, high: 102.25, low: 97.2, close: 99.95 },
  { timestamp: '2025-11-19 09:27:00+05:30', open: 100.25, high: 101.6, low: 98.5, close: 99.3 },
];

console.log('Testing redCandleHighBreak strategy...\n');

const instance = redCandleHighBreak.createInstance();
let inPosition = false;

for (let i = 0; i < testData.length; i++) {
  const candle = testData[i];
  const isRed = candle.open > candle.close;
  const candleType = isRed ? 'RED' : 'GREEN';
  
  console.log(`\n[${candle.timestamp}] ${candleType} - O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`);
  
  if (!inPosition) {
    const entrySignal = instance.checkEntry(candle, i, testData);
    
    if (entrySignal && entrySignal.enter) {
      console.log(`  ✅ ENTRY SIGNAL! Entry Price: ${entrySignal.entryPrice}`);
      inPosition = true;
    }
  } else {
    console.log(`  (In position, would check exit)`);
    // Simulate exit for testing
    if (candle.low <= 83.0) { // Reference low from 09:19
      console.log(`  ❌ EXIT: Stop Loss Hit`);
      instance.onTradeExit();
      inPosition = false;
    }
  }
}

