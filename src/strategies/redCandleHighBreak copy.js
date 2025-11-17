// src/strategies/redCandleHighBreak.js

/**
 * RED CANDLE HIGH BREAK STRATEGY
 * 
 * Setup:
 * - Find first red candle (open > close)
 * - This becomes the reference candle
 * 
 * Entry:
 * - Enter when price breaks above reference candle high
 * - Only wait for next 2 candles after reference
 * - Entry price = reference candle high
 * 
 * Exit:
 * - Managed by parameters (SL/TSL/Target/Time)
 * 
 * After exit:
 * - Look for next red candle and repeat
 */

export const redCandleHighBreak = {
  id: 'red_candle_high_break',
  name: 'Red Candle High Break',
  description: 'Enter when price breaks above the high of first red candle',
  
  /**
   * Identifies if current candle qualifies as a reference candle
   * @param {Object} candle - Current candle data
   * @param {Number} index - Current candle index
   * @param {Array} allCandles - All candles (for context if needed)
   * @returns {Boolean} - True if this is a valid reference candle
   */
  findReferenceCandle(candle, index, allCandles) {
    // Red candle: open > close
    return candle.open > candle.close;
  },
  
  /**
   * Checks if entry condition is met on current candle
   * @param {Object} currentCandle - The candle being checked
   * @param {Object} referenceCandle - The reference candle
   * @returns {Number|null} - Entry price if triggered, null otherwise
   */
  checkEntry(currentCandle, referenceCandle) {
    // Entry triggered if current candle high breaks reference candle high
    if (currentCandle.high > referenceCandle.high) {
      return referenceCandle.high; // Entry at reference high
    }
    return null; // No entry
  },
  
  /**
   * Maximum candles to wait after reference before resetting
   */
  maxCandlesWait: 2
};