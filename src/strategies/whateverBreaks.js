// src/strategies/whateverBreaks.js

/**
 * WHATEVER BREAKS STRATEGY - ULTRA SIMPLE
 * 
 * Logic:
 * - Every candle becomes reference
 * - If next candle breaks reference high → ENTER
 * - If not → Shift reference to current candle
 * - No filters, no conditions, pure breakout play
 * 
 * Designed for: Volatile markets where any momentum matters
 */
export const whateverBreaks = {
  id: 'whatever_breaks',
  name: 'Whatever Breaks',
  description: 'Enter on any candle high breakout - simplest momentum strategy',
  
  /**
   * Create a new instance of this strategy with its own state
   */
  createInstance() {
    return new WhateverBreaksInstance();
  }
};

/**
 * Strategy instance that maintains state
 */
class WhateverBreaksInstance {
  constructor() {
    this.reset();
  }

  reset() {
    this.referenceCandle = null;
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
    
    // FIRST CANDLE: Set as reference
    if (!this.referenceCandle) {
      this.referenceCandle = candle;
      console.log(`[${candle.timestamp}] 📌 Reference set: High=${candle.high}, Low=${candle.low}`);
      return null;
    }

    // CHECK BREAKOUT: Current candle high > Reference candle high
    if (candle.high > this.referenceCandle.high) {
      const entryPrice = this.referenceCandle.high;
      console.log(`[${candle.timestamp}] 🚀 BREAKOUT! Entry=${entryPrice}, CurrentHigh=${candle.high}, RefHigh=${this.referenceCandle.high}`);
      
      return {
        enter: true,
        entryPrice: entryPrice,
        referenceCandle: this.referenceCandle
      };
    }

    // NO BREAKOUT: Shift reference to current candle
    console.log(`[${candle.timestamp}] 🔄 No breakout, shifting reference: OldHigh=${this.referenceCandle.high} → NewHigh=${candle.high}`);
    this.referenceCandle = candle;
    
    return null;
  }
}