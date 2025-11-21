// src/engine/backtestEngine.js

import { TradeManager } from './tradeManager.js';
import { calculatePL } from '../utils/helpers.js';

export function runBacktest(csvData, strategy, parameters) {
  const trades = [];
  const skippedTrades = [];

  let inPosition = false;
  let tradeManager = null;

  const strategyInstance = strategy.createInstance ? strategy.createInstance() : strategy;

  for (let i = 0; i < csvData.length; i++) {
    const candle = csvData[i];

    // ✅ STEP 1: Check exit FIRST (if currently in trade)
    if (inPosition && tradeManager) {
      const exitCheck = tradeManager.checkExit(candle);

      if (exitCheck.exited) {
        const tradeSummary = tradeManager.getSummary(
          exitCheck.exitPrice,
          exitCheck.reason,
          exitCheck.time
        );
        trades.push(tradeSummary);

        inPosition = false;
        tradeManager = null;

        // Notify strategy that trade exited
        if (strategyInstance.onTradeExit) {
          strategyInstance.onTradeExit();
        }
        // DON'T continue - let strategy analyze this candle below
      }
    }

    // ✅ STEP 2: ALWAYS let strategy analyze the candle (for reference tracking)
    const entrySignal = strategyInstance.checkEntry
      ? strategyInstance.checkEntry(candle, i, csvData)
      : strategy.checkEntry?.(candle, i, csvData);

    // ✅ STEP 3: Only ACT on entry signal if NOT currently in position
    if (!inPosition && entrySignal && entrySignal.enter) {
      tradeManager = new TradeManager(parameters);
      tradeManager.enter(
        entrySignal.entryPrice,
        candle.timestamp,
        entrySignal.referenceCandle || candle,
        candle
      );
      inPosition = true;

      // ✅ Notify strategy that trade entered (reset for next setup)
      if (strategyInstance.onTradeEntry) {
        strategyInstance.onTradeEntry();
      }

      // ——— SMART SAME-CANDLE EXIT ———
      const exitCheck = tradeManager.checkExit(candle);

      if (exitCheck.exited) {
        const entryCandle = tradeManager.entryCandle;
        const isGreenEntryCandle = entryCandle.close > entryCandle.open;

        // GREEN entry candle + wicked below SL → IGNORE (valid breakout)
        if (isGreenEntryCandle && tradeManager.entryCandle === candle) {
          // Do nothing – keep trade open
        } else {
          // RED entry candle or later candle → normal exit
          const tradeSummary = tradeManager.getSummary(
            exitCheck.exitPrice,
            exitCheck.reason,
            exitCheck.time
          );
          trades.push(tradeSummary);

          inPosition = false;
          tradeManager = null;

          // Notify strategy (already reset by onTradeEntry, but just in case)
          if (strategyInstance.onTradeExit) {
            strategyInstance.onTradeExit();
          }
        }
      }
    }
  }

  // Close final trade if still open
  if (inPosition && tradeManager) {
    const lastCandle = csvData[csvData.length - 1];
    const tradeSummary = tradeManager.getSummary(
      lastCandle.close,
      'End of Data',
      lastCandle.timestamp
    );
    trades.push(tradeSummary);
  }

  const summary = calculateSummary(trades, skippedTrades, csvData);
  return { trades, skippedTrades, summary };
}

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

  const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pl)) : 0;
  const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pl)) : 0;

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