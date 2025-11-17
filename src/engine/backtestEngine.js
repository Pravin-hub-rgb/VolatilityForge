// src/engine/backtestEngine.js

import { TradeManager } from './tradeManager.js';
import { calculatePL } from '../utils/helpers.js';

/**
 * UNIVERSAL BACKTEST ENGINE
 * 
 * This engine should NEVER need to be modified for new strategies.
 * All strategy-specific logic lives in the strategy file.
 * 
 * The engine is just a dumb orchestrator that:
 * 1. Loops through candles
 * 2. Asks strategy: "Should we enter?"
 * 3. Manages trades via TradeManager
 * 4. Calculates results
 * 
 * That's it. Nothing more.
 */
export function runBacktest(csvData, strategy, parameters) {
  const trades = [];
  const skippedTrades = [];
  
  let inPosition = false;
  let tradeManager = null;
  
  // Create strategy instance (strategies can maintain their own state)
  const strategyInstance = strategy.createInstance ? strategy.createInstance() : { strategy };
  
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
        
        // Notify strategy about trade exit (so it can reset its state)
        if (strategyInstance.onTradeExit) {
          strategyInstance.onTradeExit();
        }
      }
      
      continue; // Skip to next candle
    }
    
    // Not in position - ask strategy if we should enter
    const entrySignal = strategyInstance.checkEntry 
      ? strategyInstance.checkEntry(candle, i, csvData)
      : strategy.checkEntry(candle, i, csvData);
    
    if (entrySignal && entrySignal.enter) {
      // Strategy says enter!
      tradeManager = new TradeManager(parameters);
      tradeManager.enter(
        entrySignal.entryPrice, 
        candle.timestamp, 
        entrySignal.referenceCandle || candle, 
        candle
      );
      inPosition = true;
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