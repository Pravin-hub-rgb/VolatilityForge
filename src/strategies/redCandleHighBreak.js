// src/strategies/redCandleHighBreak.js
import { isRedCandle } from '../utils/helpers.js';

/**
 * RED CANDLE HIGH BREAK STRATEGY - FIXED VERSION
 * 
 * Setup:
 * - Find first red candle (open > close)
 * - Enter when price breaks above red candle high
 * - Wait max 2 candles for breakout
 * - If newer red candle appears while waiting, shift to it
 * 
 * FIX: Check for breakout BEFORE shifting to newer red candle
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
    
    // ⚠️ CRITICAL FIX: Check for breakout FIRST (before checking if it's a red candle)
    // Entry triggers when current candle high breaks above reference candle high
    if (candle.high > this.referenceCandle.high) {
      const entryPrice = this.referenceCandle.high;
      console.log(`[${candle.timestamp}] 🚀 ENTRY! EntryPrice=${entryPrice}, CurrentHigh=${candle.high}, CurrentLow=${candle.low}, CurrentClose=${candle.close}, ReferenceHigh=${this.referenceCandle.high}, ReferenceLow=${this.referenceCandle.low}`);
      
      return {
        enter: true,
        entryPrice: entryPrice,
        referenceCandle: this.referenceCandle
      };
    }

    // NOW check if newer red candle appears (shift reference)
    // This happens AFTER breakout check, so we don't miss entries
    if (isRedCandle(candle)) {
      this.referenceCandle = candle;
      this.candlesSinceReference = 0;
      console.log(`[${candle.timestamp}] 🔄 Shifted to newer red candle, high=${candle.high}`);
      return null;
    }

    // Increment counter for non-red candles
    this.candlesSinceReference++;

    // Timeout - waited too long (check AFTER breakout check, use > instead of >=)
    if (this.candlesSinceReference > this.maxWaitCandles) {
      console.log(`[${candle.timestamp}] ⏰ Timeout, resetting (waited ${this.candlesSinceReference} candles, max=${this.maxWaitCandles})`);
      this.reset();
    }

    return null;
  }
}