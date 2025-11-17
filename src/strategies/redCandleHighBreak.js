// src/strategies/redCandleHighBreak.js
import { isRedCandle } from '../utils/helpers.js';

/**
 * RED CANDLE HIGH BREAK STRATEGY - SELF-CONTAINED
 * 
 * Setup:
 * - Find first red candle (open > close)
 * - Enter when price breaks above red candle high
 * - Wait max 2 candles for breakout
 * - If newer red candle appears while waiting, shift to it
 */
export const redCandleHighBreak = {
  id: 'red_candle_high_break',
  name: 'Red Candle High Break',
  description: 'Enter when price breaks above the high of first red candle',

  /**
   * Create a new instance of this strategy with its own state
   */
  createInstance() {
    return new RedCandleHighBreakInstance();
  }
};

/**
 * Strategy instance that maintains state
 */
class RedCandleHighBreakInstance {
  constructor() {
    this.reset();
  }

  reset() {
    this.referenceCandle = null;
    this.candlesSinceReference = 0;
    this.maxWaitCandles = 2;
  }

  /**
   * Called when trade exits - reset everything
   */
  onTradeExit() {
    this.reset();
  }

  /**
   * Main entry check - called for every candle
   * @returns {Object|null} { enter: true, entryPrice: X, referenceCandle: Y } or null
   */
  checkEntry(candle, index, allCandles) {
    // STAGE 1: Looking for reference red candle
    if (!this.referenceCandle) {
      if (isRedCandle(candle)) {
        this.referenceCandle = candle;
        this.candlesSinceReference = 0;
        console.log(`[${candle.timestamp}] 🔴 Red candle reference set, high=${candle.high}`);
      }
      return null;
    }

    // STAGE 2: Have reference, waiting for breakout
    this.candlesSinceReference++;

    // Check if newer red candle appears (shift reference)
    if (isRedCandle(candle)) {
      this.referenceCandle = candle;
      this.candlesSinceReference = 0;
      console.log(`[${candle.timestamp}] 🔄 Shifted to newer red candle, high=${candle.high}`);
      return null;
    }

    // Check for breakout
    if (candle.high > this.referenceCandle.high) {
      const entryPrice = this.referenceCandle.high;
      console.log(`[${candle.timestamp}] 🚀 ENTRY! Price=${entryPrice}, broke ${this.referenceCandle.high}`);
      
      return {
        enter: true,
        entryPrice: entryPrice,
        referenceCandle: this.referenceCandle
      };
    }

    // Timeout - waited too long
    if (this.candlesSinceReference > this.maxWaitCandles) {
      console.log(`[${candle.timestamp}] ⏰ Timeout, resetting`);
      this.reset();
    }

    return null;
  }
}