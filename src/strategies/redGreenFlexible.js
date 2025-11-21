// src/strategies/redGreenFlexible.js
import { isRedCandle, isGreenCandle } from '../utils/helpers.js';

/**
 * RED-GREEN FLEXIBLE BREAKOUT STRATEGY (Final Fix v3)
 * Fixed "Double Reset" bug where same-candle exit wiped out cooling flags.
 */
export const redGreenFlexible = {
  id: 'red_green_flexible',
  name: 'Red-Green Flex',
  description: 'Volatility-adaptive breakout with Big Red/Green logic and persistent cooling',
  
  createInstance() {
    return new RedGreenFlexibleInstance();
  }
};

class RedGreenFlexibleInstance {
  constructor() {
    this.bigThreshold = 7; 
    this.persistCooling = false;
    this.persistCoolingReason = null; 
    this.reset();
  }

  /**
   * Reset strategy state
   * FIX: Uses '||' to ensure existing flags aren't wiped out by a second reset
   * occurring in the same candle (Entry -> Exit -> Double Reset).
   */
  reset() {
    this.referenceCandle = null;
    this.referenceType = null; 
    this.candlesSinceReference = 0;
    
    // FIX: Sticky Logic
    // If skipNextCandle is ALREADY true, keep it true.
    // OR if persistCooling is true, make it true.
    this.skipNextCandle = this.skipNextCandle || this.persistCooling;
    
    // Same for reason. If we already have a reason, keep it.
    this.coolingReason = this.coolingReason || this.persistCoolingReason;
    
    // Only clear persistence if we actually used it to set the flags
    if (this.persistCooling) {
        this.persistCooling = false;
        this.persistCoolingReason = null;
    }
  }

  onTradeEntry() {
    // console.log(`🔄 Trade entered, triggering reset...`);
    this.reset();
  }

  onTradeExit() {
    // console.log(`🔄 Trade exited, triggering reset...`);
    this.reset();
  }

  getCandlePressure(candle) {
    if (isRedCandle(candle)) {
      // Red: High - Close
      return candle.high - candle.close; 
    } 
    if (isGreenCandle(candle)) {
      // Green: Close - Low
      return candle.close - candle.low;
    }
    return 0;
  }

  checkVolatility(candle) {
    const size = this.getCandlePressure(candle);
    if (size >= this.bigThreshold) {
      if (isRedCandle(candle)) return 'red';
      if (isGreenCandle(candle)) return 'green';
    }
    return null;
  }

  checkEntry(candle, index, allCandles) {
    const volatilityType = this.checkVolatility(candle);
    const isVolatile = volatilityType !== null;

    // ==============================================
    // STAGE 0: COOLING PERIOD
    // ==============================================
    if (this.skipNextCandle) {
      console.log(`[${candle.timestamp}] ⭐️ COOLING PERIOD (${this.coolingReason}). Checking candle...`);

      // 1. If THIS candle is also volatile, extend cooling
      if (isVolatile) {
        const size = this.getCandlePressure(candle);
        console.log(`[${candle.timestamp}] 🔥 Still Volatile (${volatilityType}, Size=${size.toFixed(2)}). EXTENDING cooling.`);
        this.coolingReason = volatilityType; // Update reason
        return null; 
      }

      // 2. Cooling Complete
      console.log(`[${candle.timestamp}] ✅ Cooling COMPLETE.`);
      
      // Clean up flags NOW so they don't interfere with next steps
      // But store reason locally for decision making
      const reason = this.coolingReason;
      this.skipNextCandle = false;
      this.coolingReason = null;

      // A. If trigger was GREEN -> Hard Reset (Look for Red)
      if (reason === 'green') {
        console.log(`[${candle.timestamp}] 🛑 Post-Big-Green Reset. Looking for new Red.`);
        return null; 
      }

      // B. If trigger was RED -> Accept Reference (Red OR Green)
      if (reason === 'red') {
        if (isGreenCandle(candle)) {
           this.setReference(candle, 'green'); 
        } else if (isRedCandle(candle)) {
           this.setReference(candle, 'red');
        }
        return null;
      }
    }

    // ==============================================
    // STAGE 1: LOOKING FOR INITIAL REFERENCE
    // ==============================================
    if (!this.referenceCandle) {
      if (isVolatile) {
        const size = this.getCandlePressure(candle);
        console.log(`[${candle.timestamp}] ⚡ BIG ${volatilityType.toUpperCase()} detected! Size=${size.toFixed(2)}. Triggering Cooling.`);
        this.skipNextCandle = true;
        this.coolingReason = volatilityType;
        return null;
      }

      if (isRedCandle(candle)) {
        this.setReference(candle, 'red');
      }
      return null;
    }

    // ==============================================
    // STAGE 2: WAITING FOR BREAKOUT
    // ==============================================
    this.candlesSinceReference++;
    console.log(`[${candle.timestamp}] 📊 Waiting... Ref=${this.referenceType}, High=${this.referenceCandle.high}, Count=${this.candlesSinceReference}`);

    // 🚨 PRIORITY 1: Check Breakout
    if (candle.high > this.referenceCandle.high) {
      console.log(`[${candle.timestamp}] 🚀 BREAKOUT! Entry triggered.`);
      
      // PERSISTENCE LOGIC: If entering on a volatile candle, ensure next trade cools down
      if (isVolatile) {
        console.log(`[${candle.timestamp}] ⚠️ Entry on BIG ${volatilityType.toUpperCase()}. Setting persistence.`);
        this.persistCooling = true;
        this.persistCoolingReason = volatilityType;
      }

      return {
        enter: true,
        entryPrice: this.referenceCandle.high,
        referenceCandle: this.referenceCandle,
        referenceType: this.referenceType
      };
    }

    // 🚨 PRIORITY 2: Volatility Spike Interrupts Setup
    if (isVolatile) {
      console.log(`[${candle.timestamp}] ⚡ NEW BIG ${volatilityType.toUpperCase()} during wait. Canceling setup & Cooling.`);
      this.referenceCandle = null;
      this.candlesSinceReference = 0;
      this.skipNextCandle = true;
      this.coolingReason = volatilityType;
      return null;
    }

    // 🚨 PRIORITY 3: Normal Shift (Red to Red)
    if (isRedCandle(candle) && this.referenceType === 'red') {
      console.log(`[${candle.timestamp}] 🔄 New Normal Red. Shifting Reference.`);
      this.setReference(candle, 'red');
      return null;
    }

    // 🚨 PRIORITY 4: Timeout
    if (this.candlesSinceReference > this.getMaxWaitCandles()) {
      console.log(`[${candle.timestamp}] ⏰ Timeout. Resetting.`);
      this.reset();
      return null;
    }

    return null;
  }

  setReference(candle, type) {
    this.referenceCandle = candle;
    this.referenceType = type;
    this.candlesSinceReference = 0;
    console.log(`[${candle.timestamp}] 📍 Reference SET: ${type.toUpperCase()}, High=${candle.high}`);
  }

  getMaxWaitCandles() {
    return this.referenceType === 'green' ? 1 : 2;
  }
}