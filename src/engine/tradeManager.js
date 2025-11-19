// src/engine/tradeManager.js

import { calculatePL, parseTimestamp, formatTime } from '../utils/helpers.js';

/**
 * TradeManager – FINAL VERSION
 * 
 * Now fully compatible with smart same-candle exit:
 * - Stores entryCandle properly
 * - Correct SL checking order
 * - Works perfectly with green/red entry candle logic
 */
export class TradeManager {
  constructor(parameters) {
    this.params = parameters;
    this.entryPrice = null;
    this.entryTime = null;
    this.currentSL = null;
    this.initialSL = null;
    this.referenceCandle = null;
    this.entryCandle = null;        // ← CRITICAL: stored for green/red check
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
    this.entryCandle = entryCandle;        // ← THIS LINE WAS ALREADY THERE – PERFECT

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

    // 2. Check Profit Target
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

    // No exit → update trailing stop for next candle
    if (this.params.trailingEnabled) {
      this.updateTrailingSL(candle);
    }

    return { exited: false };
  }

  /**
   * Update trailing stop loss
   */
  updateTrailingSL(candle) {
    const currentProfit = calculatePL(this.entryPrice, candle.high);

    if (currentProfit > this.highestProfit) {
      this.highestProfit = currentProfit;
    }

    const { trailingTrigger, trailingBy, costToCost } = this.params;

    if (currentProfit >= trailingTrigger && candle.close >= this.entryPrice + trailingTrigger) {
      if (this.currentSL === this.initialSL) {
        if (costToCost) {
          this.currentSL = this.entryPrice;
        } else {
          this.currentSL = this.entryPrice + (trailingTrigger - trailingBy);
        }
        this.trailingSLHistory.push({
          time: candle.timestamp,
          profit: currentProfit,
          newSL: this.currentSL,
          reason: costToCost ? 'Moved to cost' : 'First trail'
        });
      } else {
        const profitAboveEntry = currentProfit;
        const trailIncrements = Math.floor((profitAboveEntry - trailingTrigger) / trailingBy);

        let newSL;
        if (costToCost) {
          newSL = this.entryPrice + (trailIncrements * trailingBy);
        } else {
          newSL = this.entryPrice + (trailingTrigger - trailingBy) + (trailIncrements * trailingBy);
        }

        if (newSL > this.currentSL) {
          this.currentSL = newSL;
          this.trailingSLHistory.push({
            time: candle.timestamp,
            profit: currentProfit,
            newSL: this.currentSL,
            reason: `Trailed by ${trailingBy} points`
          });
        }
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