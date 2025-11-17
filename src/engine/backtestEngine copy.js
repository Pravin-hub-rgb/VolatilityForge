// src/engine/backtestEngine.js
import { TradeManager } from './tradeManager.js';
import { calculatePL } from '../utils/helpers.js';

/**
 * Main backtesting engine - CONTINUOUS REFERENCE TRACKING
 *
 * Critical Logic:
 * 1. Check if current candle is red FIRST (even if in position)
 * 2. Then check exit
 * 3. Then check entry
 * 4. Entry check has priority over shifting
 */
export function runBacktest(csvData, strategy, parameters) {
  const trades = [];
  const skippedTrades = [];

  let inPosition = false;
  let tradeManager = null;
  let referenceCandle = null;
  let candlesSinceReference = 0;

  // Loop through all candles
  for (let i = 0; i < csvData.length; i++) {
    const candle = csvData[i];

    // 🔥 STEP 1: ALWAYS check if current candle is red (even if in position)
    const isRedCandle = strategy.findReferenceCandle(candle, i, csvData);

    // 🔥 STEP 2: If in position, check for exit
    if (inPosition && tradeManager) {
      // First, store red candle as potential reference for after exit
      if (isRedCandle) {
        // Store or update reference (shifting applies)
        referenceCandle = candle;
        candlesSinceReference = 0;
      }

      // Now check exit
      const exitCheck = tradeManager.checkExit(candle);

      if (exitCheck.exited) {
        // Exit the trade
        const tradeSummary = tradeManager.getSummary(
          exitCheck.exitPrice,
          exitCheck.reason,
          exitCheck.time
        );

        trades.push(tradeSummary);

        // Reset position
        inPosition = false;
        tradeManager = null;
        
        console.log(`🚪 EXIT at ${candle.timestamp}, ref before check:`, referenceCandle?.timestamp, 'high:', referenceCandle?.high);
        
        // ✅ KEEP reference if exists and still valid
        if (referenceCandle) {
          // Check if exit candle broke reference high
          if (candle.high > referenceCandle.high) {
            console.log(`❌ Reference invalidated: ${candle.high} > ${referenceCandle.high}`);
            // High broken - invalidate reference
            referenceCandle = null;
            candlesSinceReference = 0;
          } else {
            console.log(`✅ Reference still valid: ${candle.high} <= ${referenceCandle.high}`);
          }
          // else: reference still valid, keep it
        } else {
          console.log(`⚠️ No reference after exit`);
        }
        
        // DON'T continue - check if we can enter on this same candle after exit
      } else {
        // Still in trade, skip to next candle
        continue;
      }
    }

    // 🔥 STEP 3: Not in position - look for entry

    // If we have a reference candle, check for entry FIRST
    if (referenceCandle) {
      candlesSinceReference++;

      // Check if entry triggered (BEFORE checking if current is new reference)
      const entryPrice = strategy.checkEntry(candle, referenceCandle);

      if (entryPrice) {
        // Valid entry - enter trade
        tradeManager = new TradeManager(parameters);
        tradeManager.enter(entryPrice, candle.timestamp, referenceCandle, candle);
        inPosition = true;

        // Clear reference after entry
        referenceCandle = null;
        candlesSinceReference = 0;
        
        // Now check if current candle is red (store for after this trade)
        if (isRedCandle) {
          referenceCandle = candle;
          candlesSinceReference = 0;
        }
        
        continue; // Skip to next candle
      }

      // 🔥 STEP 4: No entry, check if current candle is a newer red candle (shifting)
      if (isRedCandle) {
        // Shift to the newer red candle
        referenceCandle = candle;
        candlesSinceReference = 0;
        continue; // Skip further checks
      }

      // Check if we've waited too long (max 2 candles)
      if (candlesSinceReference > strategy.maxCandlesWait) {
        // Timeout - invalidate reference
        referenceCandle = null;
        candlesSinceReference = 0;
      }
    }

    // 🔥 STEP 5: Look for new reference candle (if don't have one)
    if (!referenceCandle && isRedCandle) {
      referenceCandle = candle;
      candlesSinceReference = 0;
    }
  }

  // If still in position at end of data, close at last candle
  if (inPosition && tradeManager) {
    const lastCandle = csvData[csvData.length - 1];
    const tradeSummary = tradeManager.getSummary(
      lastCandle.close,
      'End of Data',
      lastCandle.timestamp
    );
    trades.push(tradeSummary);
  }

  // Calculate summary statistics
  const summary = calculateSummary(trades, skippedTrades, csvData);

  return {
    trades,
    skippedTrades,
    summary
  };
}

/**
 * Calculate summary statistics
 */
function calculateSummary(trades, skippedTrades, csvData) {
  const totalTrades = trades.length;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      netPL: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      skippedTrades: skippedTrades.length,
      exitBreakdown: {},
      totalCandles: csvData.length,
      startTime: csvData[0]?.timestamp,
      endTime: csvData[csvData.length - 1]?.timestamp
    };
  }

  const winningTrades = trades.filter(t => t.pl > 0);
  const losingTrades = trades.filter(t => t.pl <= 0);

  const netPL = trades.reduce((sum, t) => sum + t.pl, 0);

  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.pl, 0) / winningTrades.length
    : 0;

  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + t.pl, 0) / losingTrades.length
    : 0;

  const largestWin = winningTrades.length > 0
    ? Math.max(...winningTrades.map(t => t.pl))
    : 0;

  const largestLoss = losingTrades.length > 0
    ? Math.min(...losingTrades.map(t => t.pl))
    : 0;

  // Exit breakdown
  const exitBreakdown = {};
  trades.forEach(trade => {
    exitBreakdown[trade.exitReason] = (exitBreakdown[trade.exitReason] || 0) + 1;
  });

  return {
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    netPL: calculatePL(0, netPL),
    avgWin: calculatePL(0, avgWin),
    avgLoss: calculatePL(0, avgLoss),
    largestWin: calculatePL(0, largestWin),
    largestLoss: calculatePL(0, largestLoss),
    skippedTrades: skippedTrades.length,
    exitBreakdown,
    totalCandles: csvData.length,
    startTime: csvData[0]?.timestamp,
    endTime: csvData[csvData.length - 1]?.timestamp
  };
}