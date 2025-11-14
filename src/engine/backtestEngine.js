// src/engine/backtestEngine.js

import { TradeManager } from './tradeManager.js';
import { calculatePL } from '../utils/helpers.js';

/**
 * Main backtesting engine
 * Takes CSV data, strategy, and parameters
 * Returns trade results and summary
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
    
    // If in position, check for exit
    if (inPosition && tradeManager) {
      const exitCheck = tradeManager.checkExit(candle);
      
      if (exitCheck.exited) {
        // Exit the trade
        const tradeSummary = tradeManager.getSummary(
          exitCheck.exitPrice,
          exitCheck.reason,
          exitCheck.time
        );
        
        trades.push(tradeSummary);
        
        // Reset for next trade
        inPosition = false;
        tradeManager = null;
        referenceCandle = null;
        candlesSinceReference = 0;
      }
      
      continue; // Skip to next candle
    }
    
    // Not in position - look for setup
    
    // If we have a reference candle, check for entry
    if (referenceCandle) {
      candlesSinceReference++;
      
      // Check if entry triggered
      const entryPrice = strategy.checkEntry(candle, referenceCandle);
      
      if (entryPrice) {
        // Check for ambiguous case (both entry and SL hit in same candle)
        const initialSL = calculateInitialSL(referenceCandle, candle, entryPrice, parameters);
        
        if (candle.low <= initialSL && candle.high >= entryPrice) {
          // Ambiguous - skip this trade
          skippedTrades.push({
            referenceCandle: referenceCandle,
            entryCandle: candle,
            reason: 'Entry and SL both hit in same candle (ambiguous)',
            timestamp: candle.timestamp
          });
          
          // Reset and look for new reference
          referenceCandle = null;
          candlesSinceReference = 0;
          continue;
        }
        
        // Valid entry - enter trade
        tradeManager = new TradeManager(parameters);
        tradeManager.enter(entryPrice, candle.timestamp, referenceCandle, candle);
        inPosition = true;
        
        // Reset reference tracking
        referenceCandle = null;
        candlesSinceReference = 0;
        continue;
      }
      
      // Check if we've waited too long
      if (candlesSinceReference > strategy.maxCandlesWait) {
        // Reset and look for new reference
        referenceCandle = null;
        candlesSinceReference = 0;
      }
    }
    
    // Look for reference candle (if not already waiting for entry)
    if (!referenceCandle) {
      if (strategy.findReferenceCandle(candle, i, csvData)) {
        referenceCandle = candle;
        candlesSinceReference = 0;
      }
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
 * Calculate initial SL for ambiguity check
 */
function calculateInitialSL(referenceCandle, entryCandle, entryPrice, parameters) {
  const { initialSL, fixedSLPoints } = parameters;

  switch (initialSL) {
    case 'reference_low':
      return referenceCandle.low;
    
    case 'fixed':
      return entryPrice - fixedSLPoints;
    
    case 'entry_low':
      return entryCandle.low;
    
    default:
      return referenceCandle.low;
  }
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