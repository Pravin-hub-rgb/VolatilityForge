// src/engine/tradeManager.js

import { calculatePL, parseTimestamp, formatTime } from '../utils/helpers.js';

/**
 * Manages an active trade (entry, stop loss, trailing, exits)
 * FIX APPLIED: 
 * 1. Trailing now supports "Jumping" steps (e.g. 0 -> +5 directly on big candles)
 * 2. Trailing triggers on HIGH (catch spikes), not CLOSE.
 */
export class TradeManager {
  constructor(parameters) {
    this.params = parameters;
    this.entryPrice = null;
    this.entryTime = null;
    this.currentSL = null;
    this.initialSL = null;
    this.referenceCandle = null;
    this.entryCandle = null;
    this.trailingSLHistory = [];
    this.highestProfit = 0;
  }

  /**
   * Enter a trade
   */
  enter(entryPrice, entryTime, referenceCandle, entryCandle) {
    this.entryPrice = entryPrice;
    this.entryTime = entryTime;
    this.referenceCandle = referenceCandle;
    this.entryCandle = entryCandle;
    
    // Calculate initial stop loss
    this.initialSL = this.calculateInitialSL();
    this.currentSL = this.initialSL;
  }

  /**
   * Calculate initial stop loss based on parameters
   */
  calculateInitialSL() {
    const { initialSL, fixedSLPoints } = this.params;

    switch (initialSL) {
      case 'reference_low':
        return this.referenceCandle.low;
      
      case 'fixed':
        return this.entryPrice - fixedSLPoints;
      
      case 'entry_low':
        return this.entryCandle.low;
      
      default:
        return this.referenceCandle.low;
    }
  }

  /**
   * Check if trade should exit on current candle
   * Returns: { exited: boolean, exitPrice: number, reason: string, time: string }
   */
  checkExit(candle) {
    const currentPrice = candle.close;
    const currentTime = candle.timestamp;

    // 1. Check Stop Loss Hit (using current SL)
    if (candle.low <= this.currentSL) {
      return {
        exited: true,
        exitPrice: this.currentSL,
        reason: this.currentSL === this.initialSL ? 'Stop Loss Hit' : 'Trailing SL Hit',
        time: currentTime
      };
    }

    // 2. Check Profit Target (if set)
    if (this.params.profitTarget) {
      const targetPrice = this.entryPrice + this.params.profitTarget;
      if (candle.high >= targetPrice) {
        return {
          exited: true,
          exitPrice: targetPrice,
          reason: 'Target Hit',
          time: currentTime
        };
      }
    }

    // 3. Check Time-Based Exit
    if (this.params.timeExit) {
      const currentTimeFormatted = formatTime(parseTimestamp(currentTime));
      if (currentTimeFormatted >= this.params.timeExit) {
        return {
          exited: true,
          exitPrice: currentPrice,
          reason: 'Time Exit',
          time: currentTime
        };
      }
    }

    // No exit - Update trailing SL for next candle
    if (this.params.trailingEnabled) {
      this.updateTrailingSL(candle);
    }

    return { exited: false };
  }

  /**
   * Update trailing stop loss
   * FIXED: Uses Formula Logic instead of Step Logic to handle big candle jumps
   */
  updateTrailingSL(candle) {
    // 1. Calculate Max Profit on this candle (High - Entry)
    const currentProfit = calculatePL(this.entryPrice, candle.high);
    
    // Track highest profit reached
    if (currentProfit > this.highestProfit) {
      this.highestProfit = currentProfit;
    }

    const { trailingTrigger, trailingBy, costToCost } = this.params;

    // 2. Check Trigger (Using Profit derived from HIGH, not Close)
    // Logic: If we hit +5 profit during the candle, we trail.
    if (currentProfit >= trailingTrigger) {
      
      let calculatedSL;

      // Calculate how much we are ABOVE the trigger
      // e.g. Profit = 12, Trigger = 5 -> Excess = 7
      const excessProfit = currentProfit - trailingTrigger;

      // Calculate how many full steps fits in the excess
      // e.g. Excess 7 / Step 5 = 1 full step
      const steps = Math.floor(excessProfit / trailingBy);

      if (costToCost) {
        // LOGIC:
        // If Profit >= Trigger (5): Move to Entry (Step 0)
        // If Profit >= Trigger + Step (10): Move to Entry + 5 (Step 1)
        // Formula: Entry + (Steps * StepSize)
        
        // For Profit 12 (Step 1): Entry + (1 * 5) = Entry + 5
        calculatedSL = this.entryPrice + (steps * trailingBy);
      } else {
        // Standard Trailing Logic (Maintain distance)
        // SL = Entry + (Trigger - Step) + (Steps * Step)
        calculatedSL = this.entryPrice + (trailingTrigger - trailingBy) + (steps * trailingBy);
      }

      // 3. Update ONLY if the new SL is higher (Never move SL down)
      if (calculatedSL > this.currentSL) {
        const previousSL = this.currentSL;
        this.currentSL = calculatedSL;
        
        this.trailingSLHistory.push({
          time: candle.timestamp,
          profit: currentProfit,
          newSL: this.currentSL,
          reason: `Trailed (High: ${currentProfit.toFixed(2)}, Steps: ${steps})`
        });
      }
    }
  }

  /**
   * Get trade summary
   */
  getSummary(exitPrice, exitReason, exitTime) {
    const pl = calculatePL(this.entryPrice, exitPrice);
    
    return {
      entryTime: this.entryTime,
      entryPrice: this.entryPrice,
      exitTime: exitTime,
      exitPrice: exitPrice,
      pl: pl,
      exitReason: exitReason,
      initialSL: this.initialSL,
      finalSL: this.currentSL,
      trailingSLHistory: this.trailingSLHistory,
      highestProfit: this.highestProfit,
      referenceCandle: this.referenceCandle,
      entryCandle: this.entryCandle
    };
  }
}