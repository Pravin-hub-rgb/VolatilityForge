// src/strategies/YOUR_STRATEGY_NAME.js

/**
 * STRATEGY TEMPLATE
 * 
 * Copy this file to create new strategies.
 * The backtest engine will NEVER need to be modified.
 * 
 * Key principle: Strategy manages its own state and logic.
 */

export const yourStrategyName = {
  id: 'your_strategy_id',
  name: 'Your Strategy Display Name',
  description: 'Brief description of what this strategy does',

  /**
   * Create a new instance of this strategy with its own state
   * This is called once at the start of the backtest
   */
  createInstance() {
    return new YourStrategyInstance();
  }
};

/**
 * Strategy instance that maintains state
 * 
 * This class holds all the logic and state for your strategy.
 * You can add as many properties and methods as you need.
 */
class YourStrategyInstance {
  constructor() {
    // Initialize your strategy state here
    this.reset();
  }

  /**
   * Reset strategy to initial state
   * Called at construction and after trade exit
   */
  reset() {
    // Example state variables:
    this.referenceCandle = null;
    this.someCounter = 0;
    this.someFlag = false;
    // Add whatever state you need...
  }

  /**
   * Called when a trade exits
   * Use this to reset your strategy state for the next setup
   */
  onTradeExit() {
    this.reset();
  }

  /**
   * Main entry check - called for EVERY candle when not in position
   * 
   * @param {Object} candle - Current candle { open, high, low, close, timestamp }
   * @param {number} index - Current candle index in the data array
   * @param {Array} allCandles - Full candle data array (use for lookback)
   * 
   * @returns {Object|null} 
   *   - Return { enter: true, entryPrice: X, referenceCandle: Y } to enter trade
   *   - Return null to keep waiting
   */
  checkEntry(candle, index, allCandles) {
    // YOUR STRATEGY LOGIC HERE
    
    // Example: Simple pattern recognition
    
    // Step 1: Look for your setup/reference
    if (!this.referenceCandle) {
      // Check if current candle meets your criteria
      if (this.isValidReference(candle, index, allCandles)) {
        this.referenceCandle = candle;
        console.log(`[${candle.timestamp}] Reference found`);
      }
      return null; // Keep looking
    }

    // Step 2: Have reference, now look for entry trigger
    if (this.referenceCandle) {
      this.someCounter++;
      
      // Check for entry condition
      if (this.shouldEnter(candle, index, allCandles)) {
        const entryPrice = this.calculateEntryPrice(candle);
        console.log(`[${candle.timestamp}] ENTRY at ${entryPrice}`);
        
        return {
          enter: true,
          entryPrice: entryPrice,
          referenceCandle: this.referenceCandle
        };
      }
      
      // Timeout or reset logic
      if (this.shouldReset(candle, index, allCandles)) {
        console.log(`[${candle.timestamp}] Resetting`);
        this.reset();
      }
    }

    return null;
  }

  /**
   * Helper method: Check if candle is valid reference
   */
  isValidReference(candle, index, allCandles) {
    // YOUR LOGIC
    // Example: return candle.open > candle.close; // Red candle
    return false; // Replace with your logic
  }

  /**
   * Helper method: Check if entry conditions are met
   */
  shouldEnter(candle, index, allCandles) {
    // YOUR LOGIC
    // Example: return candle.high > this.referenceCandle.high;
    return false; // Replace with your logic
  }

  /**
   * Helper method: Calculate entry price
   */
  calculateEntryPrice(candle) {
    // YOUR LOGIC
    // Example: return this.referenceCandle.high;
    return candle.close; // Replace with your logic
  }

  /**
   * Helper method: Check if should reset (timeout, etc.)
   */
  shouldReset(candle, index, allCandles) {
    // YOUR LOGIC
    // Example: return this.someCounter > 5; // Waited too long
    return false; // Replace with your logic
  }

  // Add any other helper methods you need...
}

/**
 * USAGE EXAMPLE:
 * 
 * import { yourStrategyName } from './strategies/YOUR_STRATEGY_NAME.js';
 * import { runBacktest } from './engine/backtestEngine.js';
 * 
 * const results = runBacktest(csvData, yourStrategyName, parameters);
 * 
 * That's it! No engine modification needed!
 */