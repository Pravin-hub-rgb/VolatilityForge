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
   * Called when trade ENTERS - reset to start looking for next setup
   */
  onTradeEntry() {
    console.log(`🔄 Trade entered, resetting strategy state for next setup`);
    this.reset();
  }

  /**
   * Called when trade EXITS - reset everything
   */
  onTradeExit() {
    console.log(`🔄 Trade exited, resetting strategy state`);
    this.reset();
  }

  /**
   * Calculate candle size (points)
   * Uses High - Close to capture total downward move including wicks
   */
  getCandleSize(candle) {
    return candle.high - candle.close;
  }

  /**
   * Check if candle is big (≥ threshold)
   */
  isBigCandle(candle) {
    const size = this.getCandleSize(candle);
    return size >= this.bigRedThreshold;
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
    // ==============================================
    if (this.skipNextCandle) {
      console.log(`[${candle.timestamp}] ⭐️ COOLING PERIOD - Checking this candle...`);
      
      // Check if this candle is ALSO a big red (extend cooling)
      if (isRed && isBig) {
        console.log(`[${candle.timestamp}] 🔥 This is ALSO big red (${candleSize.toFixed(2)} ≥ ${this.bigRedThreshold}), EXTENDING cooling to next candle`);
        // Skip flag stays true for next candle
        return null;
      }

      // Cooling period over - this candle becomes new reference
      console.log(`[${candle.timestamp}] ✅ Cooling COMPLETE. This candle becomes reference.`);
      this.skipNextCandle = false;
      this.referenceCandle = candle;
      this.referenceType = isRed ? 'red' : 'green';
      this.candlesSinceReference = 0;
      
      console.log(`[${candle.timestamp}] 🔍 NEW ${this.referenceType.toUpperCase()} reference: High=${candle.high}, Size=${candleSize.toFixed(2)}, MaxWait=${this.getMaxWaitCandles()}`);
      return null;
    }

    // ==============================================
    // STAGE 1: Looking for initial reference candle
    // ==============================================
    if (!this.referenceCandle) {
      if (isRed) {
        if (isBig) {
          console.log(`[${candle.timestamp}] 🔴🔥 BIG RED detected! Size=${candleSize.toFixed(2)} ≥ ${this.bigRedThreshold}. Setting skip flag.`);
          this.skipNextCandle = true;
          return null;
        } else {
          this.referenceCandle = candle;
          this.referenceType = 'red';
          this.candlesSinceReference = 0;
          console.log(`[${candle.timestamp}] 🔴 Normal red reference: High=${candle.high}, Size=${candleSize.toFixed(2)}, MaxWait=2`);
        }
      }
      return null;
    }

    // ==============================================
    // STAGE 2: Have reference, waiting for breakout
    // ==============================================
    
    // Increment counter (this candle counts as a wait candle)
    this.candlesSinceReference++;
    
    console.log(`[${candle.timestamp}] 📊 Reference: ${this.referenceType.toUpperCase()}, RefHigh=${this.referenceCandle.high}, Counter=${this.candlesSinceReference}, MaxWait=${this.getMaxWaitCandles()}`);

    // 🚨 PRIORITY 1: Check for BREAKOUT FIRST
    if (candle.high > this.referenceCandle.high) {
      const entryPrice = this.referenceCandle.high;
      console.log(`[${candle.timestamp}] 🚀 BREAKOUT! CurrentHigh=${candle.high} > RefHigh=${this.referenceCandle.high}`);
      console.log(`[${candle.timestamp}] 💰 ENTRY at ${entryPrice} (Reference: ${this.referenceType}, waited ${this.candlesSinceReference} candles)`);
      
      return {
        enter: true,
        entryPrice: entryPrice,
        referenceCandle: this.referenceCandle,
        referenceType: this.referenceType
      };
    }

    // 🚨 PRIORITY 2: No breakout - check if current candle is BIG RED
    if (isRed && isBig) {
      console.log(`[${candle.timestamp}] 🔴🔥 NEW BIG RED while waiting! Size=${candleSize.toFixed(2)}. Resetting with skip flag.`);
      this.referenceCandle = null;
      this.referenceType = null;
      this.candlesSinceReference = 0;
      this.skipNextCandle = true;
      return null;
    }

    // PRIORITY 3: Normal red - shift only if current reference is also RED
    if (isRed) {
      if (this.referenceType === 'red') {
        console.log(`[${candle.timestamp}] 🔄 New normal red - SHIFTING reference. NewHigh=${candle.high}, Size=${candleSize.toFixed(2)}`);
        this.referenceCandle = candle;
        this.referenceType = 'red';
        this.candlesSinceReference = 0;
        return null;
      } else {
        console.log(`[${candle.timestamp}] 🔴 Red candle but GREEN reference doesn't shift`);
        // Don't shift green references - fall through to timeout check
      }
    }

    // Check timeout
    const maxWait = this.getMaxWaitCandles();
    if (this.candlesSinceReference > maxWait) {
      console.log(`[${candle.timestamp}] ⏰ TIMEOUT! Waited ${this.candlesSinceReference} candles (max=${maxWait}). Resetting.`);
      this.reset();
      return null;
    }

    // Still waiting...
    return null;
  }
}