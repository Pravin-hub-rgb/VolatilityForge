// src/engine/csvParser.js

import Papa from 'papaparse';

/**
 * Parse CSV file and return clean data
 * CSV format: timestamp,open,high,low,close,volume,oi
 * Note: CSV data is in REVERSE chronological order (newest first)
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Remove any whitespace from headers
        return header.trim().toLowerCase();
      },
      complete: (results) => {
        try {
          // Validate data
          if (!results.data || results.data.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }

          // Clean and validate each row
          const cleanData = results.data
            .filter(row => row.timestamp && row.open && row.high && row.low && row.close)
            .map(row => ({
              timestamp: row.timestamp,
              open: Number(row.open),
              high: Number(row.high),
              low: Number(row.low),
              close: Number(row.close),
              volume: Number(row.volume || 0),
              oi: Number(row.oi || 0)
            }));

          // CSV is in reverse chronological order, so reverse it
          // We want oldest first (chronological order for backtesting)
          const chronologicalData = cleanData.reverse();

          if (chronologicalData.length === 0) {
            reject(new Error('No valid data found in CSV'));
            return;
          }

          resolve({
            data: chronologicalData,
            metadata: {
              totalCandles: chronologicalData.length,
              startTime: chronologicalData[0].timestamp,
              endTime: chronologicalData[chronologicalData.length - 1].timestamp,
              fileName: file.name
            }
          });

        } catch (error) {
          reject(new Error(`Error processing CSV: ${error.message}`));
        }
      },
      error: (error) => {
        reject(new Error(`Error parsing CSV: ${error.message}`));
      }
    });
  });
}

/**
 * Validate CSV structure
 */
export function validateCSV(data) {
  const requiredColumns = ['timestamp', 'open', 'high', 'low', 'close'];
  
  if (!data || data.length === 0) {
    return { valid: false, error: 'No data provided' };
  }

  const firstRow = data[0];
  const missingColumns = requiredColumns.filter(col => !(col in firstRow));

  if (missingColumns.length > 0) {
    return {
      valid: false,
      error: `Missing required columns: ${missingColumns.join(', ')}`
    };
  }

  return { valid: true };
}