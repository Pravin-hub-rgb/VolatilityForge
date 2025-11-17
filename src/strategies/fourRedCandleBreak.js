// src/strategies/fourRedCandleBreak.js
import { isRedCandle, isGreenCandle } from '../utils/helpers.js';

/**
 * Four Red Candle Break Strategy - SELF-CONTAINED
 * 
 * This strategy manages its own state internally.
 * The backtest engine doesn't need to know anything about it.
 */
export const fourRedCandleBreak = {
  id: 'fourRedCandleBreak',
  name: 'Four Red Candle Break',
  description: 'Enter on break of green candle high after ≥4 consecutive red candles.',

  /**
   * Create a new instance of this strategy with its own state
   */
  createInstance() {
    return new FourRedCandleBreakInstance();
  }
};

/**
 * Strategy instance that maintains state
 */
class FourRedCandleBreakInstance {
  constructor() {
    this.reset();
  }

  reset() {
    this.referenceCandle = null; // Last of 4+ red candles
    this.greenCandle = null; // Green candle after reds
    this.candlesSinceGreen = 0;
    this.maxWaitCandles = 2;
    this.lookingForGreen = false; // Flag: found 4 reds, now looking for green
  }

  /**
   * Called when trade exits - reset everything
   */
  onTradeExit() {
    console.log(`[Trade Exit] Resetting strategy state`);
    this.reset();
  }

  /**
   * Main entry check - called for every candle
   * @returns {Object|null} { enter: true, entryPrice: X, referenceCandle: Y } or null
   */
  checkEntry(candle, index, allCandles) {
    console.log(`[${candle.timestamp}] State: ref=${this.referenceCandle?.timestamp || 'none'}, green=${this.greenCandle?.timestamp || 'none'}`);

    // STAGE 1: Looking for reference (4+ reds)
    if (!this.referenceCandle) {
      // Case 1: Current candle is red and completes 4+ sequence
      if (isRedCandle(candle) && this.findFourRedSequence(candle, index, allCandles)) {
        this.referenceCandle = candle;
        this.lookingForGreen = true;
        console.log(`[${candle.timestamp}] ✅ Found 4+ red sequence, last red at ${candle.timestamp}`);
        return null;
      }
      
      // Case 2: Current candle is green, check if previous candles had 4+ reds
      if (isGreenCandle(candle) && index >= 4) {
        // Check if the candle before this green one completes a 4-red sequence
        const prevCandle = allCandles[index - 1];
        if (isRedCandle(prevCandle) && this.findFourRedSequence(prevCandle, index - 1, allCandles)) {
          this.referenceCandle = prevCandle; // Last red candle
          this.greenCandle = candle; // Current green candle
          this.candlesSinceGreen = 0;
          console.log(`[${candle.timestamp}] ✅ Found 4+ reds ending at ${prevCandle.timestamp}, green candle set, high=${candle.high}`);
          return null;
        }
      }
      
      return null; // Keep looking
    }

    // STAGE 2: Have reference, looking for green candle
    if (!this.greenCandle && this.lookingForGreen) {
      // Check if newer red sequence appears (shift reference)
      if (isRedCandle(candle) && this.findFourRedSequence(candle, index, allCandles)) {
        this.referenceCandle = candle;
        console.log(`[${candle.timestamp}] 🔄 Shifted to newer 4+ red sequence`);
        return null;
      }

      // Found green candle!
      if (isGreenCandle(candle)) {
        this.greenCandle = candle;
        this.candlesSinceGreen = 0;
        this.lookingForGreen = false;
        console.log(`[${candle.timestamp}] 🟢 Green candle found, high=${candle.high}`);
      }
      return null; // Keep looking
    }

    // STAGE 3: Have green candle, waiting for breakout
    if (this.greenCandle) {
      this.candlesSinceGreen++;

      // Check for breakout
      if (candle.high > this.greenCandle.high) {
        const entryPrice = this.greenCandle.high;
        console.log(`[${candle.timestamp}] 🚀 ENTRY! Price=${entryPrice}, current high=${candle.high} broke green high ${this.greenCandle.high}`);
        
        return {
          enter: true,
          entryPrice: entryPrice,
          referenceCandle: this.referenceCandle
        };
      }

      // Timeout - waited too long
      if (this.candlesSinceGreen > this.maxWaitCandles) {
        console.log(`[${candle.timestamp}] ⏰ Timeout, resetting (waited ${this.candlesSinceGreen} candles)`);
        this.reset();
      }
    }

    return null;
  }

  /**
   * Check if current candle is last of 4+ consecutive red candles
   */
  findFourRedSequence(candle, index, allCandles) {
    // Need at least 3 previous candles
    if (index < 3) return false;

    // Current must be red
    if (!isRedCandle(candle)) return false;

    // Count consecutive reds backwards
    let redCount = 1; // Current candle
    for (let i = index - 1; i >= 0 && redCount < 4; i--) {
      if (isRedCandle(allCandles[i])) {
        redCount++;
      } else {
        break; // Sequence broken
      }
    }

    return redCount >= 4;
  }
}