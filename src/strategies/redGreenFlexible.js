// src/strategies/redGreenFlexible.js
import { isRedCandle } from '../utils/helpers.js';

/**
 * RED-GREEN FLEXIBLE BREAKOUT STRATEGY
 * 
 * Core Logic:
 * - Normal red candles (< 7 points): Wait 2 candles for breakout, shift on newer red
 * - Big red candles (≥ 7 points): Skip next candle (cooling period), then use next as reference
 * - Green references (after big red): Strict 1 candle wait for continuation
 * 
 * Designed for: Nifty 50 Options, 1-min timeframe, morning volatility (9:15-9:40)
 */
export const redGreenFlexible = {
  id: 'red_green_flexible',
  name: 'Red-Green Flexible Breakout',
  description: 'Volatility-adaptive breakout strategy with big red candle filtering',
  
  /**
   * Create a new instance of this strategy with its own state
   */
  createInstance() {
    return new RedGreenFlexibleInstance();
  }
};

/**
 * Strategy instance that maintains state
 */
class RedGreenFlexibleInstance {
  constructor() {
    this.reset();
  }

  reset() {
    this.referenceCandle = null;
    this.referenceType = null; // 'red' or 'green'
    this.candlesSinceReference = 0;
    this.skipNextCandle = false; // Flag for big red cooling period
    this.bigRedThreshold = 7; // Points threshold for big red
  }

  /**
   * Called when trade exits - reset everything
   */
  onTradeExit() {
    this.reset();
  }

  /**
   * Calculate candle size (points)
   */
  getCandleSize(candle) {
    return Math.abs(candle.open - candle.close);
  }

  /**
   * Check if candle is big (≥ threshold)
   */
  isBigCandle(candle) {
    return this.getCandleSize(candle) >= this.bigRedThreshold;
  }

  /**
   * Get max wait candles based on reference type
   */
  getMaxWaitCandles() {
    return this.referenceType === 'green' ? 1 : 2;
  }

  /**
   * Main entry check - called for every candle
   * @returns {Object|null} { enter: true, entryPrice: X, referenceCandle: Y } or null
   */
  checkEntry(candle, index, allCandles) {
    const candleSize = this.getCandleSize(candle);
    const isBig = this.isBigCandle(candle);
    const isRed = isRedCandle(candle);

    // ==============================================
    // STAGE 0: Skip flag is active (cooling period)
    // CHECK THIS FIRST, BEFORE ANYTHING ELSE!
    // ==============================================
    if (this.skipNextCandle) {
      console.log(`[${candle.timestamp}] ⏭️ SKIPPING this candle (cooling period after big red)`);
      
      // Check if this candle is ALSO big (consecutive big candles)
      if (isRed && isBig) {
        console.log(`[${candle.timestamp}] 🔥 This candle is ALSO big red (size=${candleSize.toFixed(2)}), extending skip`);
        // Keep skip flag active for next candle
        return null;
      }

      // Cooling period over - this candle becomes new reference
      this.skipNextCandle = false;
      this.referenceCandle = candle;
      this.referenceType = isRed ? 'red' : 'green';
      this.candlesSinceReference = 0;
      
      console.log(`[${candle.timestamp}] ✅ Cooling over, NEW ${this.referenceType.toUpperCase()} reference set, High=${candle.high}, Size=${candleSize.toFixed(2)}`);
      return null;
    }

    // ==============================================
    // STAGE 1: Looking for initial reference candle
    // ==============================================
    if (!this.referenceCandle) {
      if (isRed) {
        // Check if it's a big red
        if (isBig) {
          console.log(`[${candle.timestamp}] 🔴🔥 BIG RED detected! Size=${candleSize.toFixed(2)}, High=${candle.high}, Skipping next candle`);
          this.skipNextCandle = true;
          return null;
        } else {
          // Normal red - set as reference
          this.referenceCandle = candle;
          this.referenceType = 'red';
          this.candlesSinceReference = 0;
          console.log(`[${candle.timestamp}] 🔴 Normal red reference set, High=${candle.high}, Size=${candleSize.toFixed(2)}`);
        }
      }
      return null;
    }

    // ==============================================
    // STAGE 2: Have reference, waiting for breakout
    // ==============================================

    // --- Red candle appears: Shift or Set Big Red ---
    if (isRed) {
      // Check if it's a big red
      if (isBig) {
        console.log(`[${candle.timestamp}] 🔴🔥 NEW BIG RED! Size=${candleSize.toFixed(2)}, Resetting with skip flag`);
        this.referenceCandle = null;
        this.referenceType = null;
        this.candlesSinceReference = 0;
        this.skipNextCandle = true;
        return null;
      } else {
        // Normal red - shift reference
        console.log(`[${candle.timestamp}] 🔄 Shifted to newer normal red, High=${candle.high}, Size=${candleSize.toFixed(2)}`);
        this.referenceCandle = candle;
        this.referenceType = 'red';
        this.candlesSinceReference = 0;
        return null;
      }
    }

    // --- Non-red candle: Increment counter ---
    this.candlesSinceReference++;

    // --- Check for BREAKOUT (before timeout) ---
    if (candle.high > this.referenceCandle.high) {
      const entryPrice = this.referenceCandle.high;
      console.log(`[${candle.timestamp}] 🚀 BREAKOUT! Entry=${entryPrice}, CurrentHigh=${candle.high}, Reference=${this.referenceType.toUpperCase()}, RefHigh=${this.referenceCandle.high}`);
      
      return {
        enter: true,
        entryPrice: entryPrice,
        referenceCandle: this.referenceCandle,
        referenceType: this.referenceType
      };
    }

    // --- Check TIMEOUT (after breakout check) ---
    const maxWait = this.getMaxWaitCandles();
    if (this.candlesSinceReference > maxWait) {
      console.log(`[${candle.timestamp}] ⏰ Timeout! Waited ${this.candlesSinceReference} candles (max=${maxWait}, type=${this.referenceType}), Resetting`);
      this.reset();
      return null;
    }

    // Still waiting...
    return null;
  }
}