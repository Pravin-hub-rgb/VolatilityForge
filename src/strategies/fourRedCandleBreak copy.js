// src/strategies/fourRedCandleBreak.js
import { isRedCandle, isGreenCandle } from '../utils/helpers.js';

/**
 * Four Red Candle Break Strategy
 * - Looks for at least 4 consecutive red candles (open > close).
 * - No green candles allowed in the sequence.
 * - After the sequence, waits for a green candle.
 * - Enters if the green candle’s high is broken within the next 2 candles.
 * - Resets pattern search if no entry or after trade exit.
 */
export const fourRedCandleBreak = {
  id: 'fourRedCandleBreak',
  name: 'Four Red Candle Break',
  description: 'Enter on break of green candle high after ≥4 consecutive red candles.',
  maxCandlesWait: 2, // Wait 2 candles for entry after green candle

  /**
   * Find reference candle (last of ≥4 consecutive red candles)
   * @param {Object} candle - Current candle
   * @param {number} index - Current index
   * @param {Array} data - Full CSV data
   * @returns {Object|null} Reference candle or null
   */
  findReferenceCandle(candle, index, data) {
    // Need at least 4 candles before current to check sequence
    if (index < 3) {
      console.log(`[${candle.timestamp}] Too few candles: index=${index}`);
      return null;
    }

    // Current candle must be red
    if (!isRedCandle(candle)) {
      console.log(`[${candle.timestamp}] Not red: open=${candle.open}, close=${candle.close}`);
      return null;
    }

    let redCandleCount = 1; // Count current candle

    // Check previous candles for consecutive red sequence
    for (let i = index - 1; i >= 0 && redCandleCount < 4; i--) {
      const prevCandle = data[i];
      if (isRedCandle(prevCandle)) {
        redCandleCount++;
      } else {
        console.log(`[${candle.timestamp}] Sequence broken at ${prevCandle.timestamp}: open=${prevCandle.open}, close=${prevCandle.close}`);
        break;
      }
    }

    if (redCandleCount >= 4) {
      console.log(`[${candle.timestamp}] Valid sequence: redCount=${redCandleCount}`);
      return candle; // Last red candle as reference
    }

    console.log(`[${candle.timestamp}] Insufficient red candles: redCount=${redCandleCount}`);
    return null;
  },

  /**
   * Check for entry
   * @param {Object} candle - Current candle
   * @param {Object} referenceCandle - Reference candle (last red candle)
   * @param {Object} state - Strategy state
   * @returns {number|null} Entry price or null
   */
  checkEntry(candle, referenceCandle, state = {}) {
    // Initialize state
    if (!state.greenCandle) {
      state.greenCandle = null;
      state.candlesSinceGreen = 0;
    }

    console.log(`[${candle.timestamp}] checkEntry: greenCandle=${state.greenCandle ? state.greenCandle.timestamp : 'none'}, candlesSinceGreen=${state.candlesSinceGreen}`);

    // Look for green candle after red sequence
    if (!state.greenCandle && isGreenCandle(candle)) {
      state.greenCandle = candle;
      state.candlesSinceGreen = 0;
      console.log(`[${candle.timestamp}] Green candle set: high=${candle.high}`);
      return null; // Wait for break of high
    }

    // Check for break of green candle’s high
    if (state.greenCandle) {
      state.candlesSinceGreen++;
      if (candle.high > state.greenCandle.high) {
        const entryPrice = state.greenCandle.high;
        console.log(`[${candle.timestamp}] Entry triggered: price=${entryPrice}, greenHigh=${state.greenCandle.high}`);
        // Reset state
        state.greenCandle = null;
        state.candlesSinceGreen = 0;
        return entryPrice;
      }
      // Reset if waited too long
      if (state.candlesSinceGreen > this.maxCandlesWait) {
        console.log(`[${candle.timestamp}] Reset: waited too long (${state.candlesSinceGreen} candles)`);
        state.greenCandle = null;
        state.candlesSinceGreen = 0;
      }
    }

    return null;
  }
};