// src/utils/helpers.js

/**
 * Parse timestamp from CSV format to Date object
 * Format: 2025-11-12T09:40:00+05:30
 */
export function parseTimestamp(timestamp) {
  return new Date(timestamp);
}

/**
 * Format time for display (HH:MM:SS)
 */
export function formatTime(date) {
  if (!date) return '';
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format full datetime for display
 */
export function formatDateTime(date) {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const time = formatTime(date);
  
  return `${year}-${month}-${day} ${time}`;
}

/**
 * Check if candle is red (bearish)
 */
export function isRedCandle(candle) {
  return candle.open > candle.close;
}

/**
 * Check if candle is green (bullish)
 */
export function isGreenCandle(candle) {
  return candle.close > candle.open;
}

/**
 * Calculate profit/loss
 */
export function calculatePL(entryPrice, exitPrice) {
  return Number((exitPrice - entryPrice).toFixed(2));
}

/**
 * Format P&L for display with color indication
 */
export function formatPL(pl) {
  const sign = pl >= 0 ? '+' : '';
  return `${sign}${pl.toFixed(2)}`;
}

/**
 * Check if time is within trading window
 */
export function isWithinTimeWindow(timestamp, startTime, endTime) {
  const time = formatTime(parseTimestamp(timestamp));
  return time >= startTime && time <= endTime;
}

/**
 * Round to 2 decimal places
 */
export function roundTo2(num) {
  return Math.round(num * 100) / 100;
}