// src/strategies/index.js
import { redCandleHighBreak } from './redCandleHighBreak.js';
import { fourRedCandleBreak } from './fourRedCandleBreak.js';

/**
 * All available strategies
 * Add new strategies here to make them available in the dropdown
 */
export const allStrategies = [
  redCandleHighBreak,
  fourRedCandleBreak
  // Add more strategies here as you create them
  // greenContinuation,
  // flexibleEntry,
];

/**
 * Get strategy by ID
 */
export function getStrategyById(id) {
  return allStrategies.find(strategy => strategy.id === id);
}

/**
 * Get all strategy names for dropdown
 */
export function getStrategyOptions() {
  return allStrategies.map(strategy => ({
    id: strategy.id,
    name: strategy.name,
    description: strategy.description
  }));
}