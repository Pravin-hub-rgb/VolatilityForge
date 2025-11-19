// src/strategies/green_continuation.js

import { isGreenCandle } from '../utils/helpers.js';

export const greenContinuation = {
  id: 'green_continuation',
  name: 'Green Candle Continuation – FINAL NO-SKIP',
  description: 'Guaranteed: 09:20 → 09:23 → 09:26 all appear',

  createInstance() {
    return new GreenContinuationInstance();
  }
};

class GreenContinuationInstance {
  constructor() {
    this.ref = null;      // current reference candle
    this.wait = 0;        // candles waited after ref
  }

  onTradeExit() {
    // FULL clean reset after every exit
    this.ref = null;
    this.wait = 0;
  }

  checkEntry(candle) {
    // 1. No reference → take any green candle
    if (!this.ref) {
      if (isGreenCandle(candle)) {
        this.ref = candle;
        this.wait = 0;
      }
      return null;
    }

    this.wait++;

    // 2. BREAKOUT → ENTER
    if (candle.high > this.ref.high) {
      return {
        enter: true,
        entryPrice: this.ref.high + 0.0001,
        referenceCandle: this.ref
      };
    }

    // 3. Timeout after exactly 2 candles → reset
    if (this.wait === 2) {
      // ONLY reset reference — do NOT overwrite with current candle here
      // (this was the bug that killed 09:20/09:23)
      this.ref = null;
      this.wait = 0;

      // If the 2nd candle itself is green → take it as NEW reference
      if (isGreenCandle(candle)) {
        this.ref = candle;
        this.wait = 0;
      }
    }

    return null;
  }
}