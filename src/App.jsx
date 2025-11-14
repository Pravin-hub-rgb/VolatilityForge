import React, { useState } from 'react';
import { Upload, Flame, TrendingUp, Play, AlertCircle } from 'lucide-react';
import { parseCSV } from './engine/csvParser';
import { runBacktest } from './engine/backtestEngine';
import { allStrategies, getStrategyById } from './strategies';
import { formatTime, formatPL, formatDateTime } from './utils/helpers';

function App() {
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [selectedStrategyId, setSelectedStrategyId] = useState('');
  const [parameters, setParameters] = useState({
    initialSL: 'reference_low',
    fixedSLPoints: 10,
    trailingEnabled: true,
    trailingTrigger: 5,
    trailingBy: 5,
    costToCost: true,
    profitTarget: null,
    timeExit: '09:40'
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle file drop/select
  const handleFileSelect = async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please select a valid CSV file');
      return;
    }

    setFileName(file.name);
    setCsvFile(file);
    setError(null);
    setLoading(true);

    try {
      const parsed = await parseCSV(file);
      setCsvData(parsed);
      setError(null);
    } catch (err) {
      setError(`Error parsing CSV: ${err.message}`);
      setCsvData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  // Run backtest
  const handleRunBacktest = () => {
    if (!csvData || !selectedStrategyId) return;

    setLoading(true);
    setError(null);

    try {
      const strategy = getStrategyById(selectedStrategyId);
      const backtestResults = runBacktest(csvData.data, strategy, parameters);
      setResults(backtestResults);
    } catch (err) {
      setError(`Backtest error: ${err.message}`);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Flame className="w-12 h-12 text-orange-500" />
            <h1 className="text-6xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              VolatilityForge
            </h1>
          </div>
          <p className="text-slate-400 text-lg">
            Forge your strategies in the fire of volatility
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT SIDE - Controls */}
          <div className="space-y-6">
            
            {/* File Drop Zone */}
            <div className="bg-slate-800 rounded-lg p-6 border-2 border-slate-700">
              <h2 className="text-xl font-semibold text-orange-400 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                1. Upload CSV Data
              </h2>
              
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-orange-500 transition-colors cursor-pointer"
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400 mb-2">
                    Drag & drop your CSV file here
                  </p>
                  <p className="text-slate-500 text-sm">or click to browse</p>
                  {fileName && csvData && (
                    <div className="mt-3">
                      <p className="text-green-400 font-semibold">✓ {fileName}</p>
                      <p className="text-slate-400 text-sm mt-1">
                        {csvData.metadata.totalCandles} candles loaded
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Strategy Selector */}
            <div className="bg-slate-800 rounded-lg p-6 border-2 border-slate-700">
              <h2 className="text-xl font-semibold text-orange-400 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                2. Select Strategy
              </h2>
              
              <select
                value={selectedStrategyId}
                onChange={(e) => setSelectedStrategyId(e.target.value)}
                disabled={!csvData}
                className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 border-2 border-slate-600 focus:border-orange-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Choose a strategy...</option>
                {allStrategies.map(strategy => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
              
              {selectedStrategyId && (
                <p className="text-slate-400 text-sm mt-3">
                  {getStrategyById(selectedStrategyId)?.description}
                </p>
              )}
            </div>

            {/* Parameter Form */}
            <div className="bg-slate-800 rounded-lg p-6 border-2 border-slate-700">
              <h2 className="text-xl font-semibold text-orange-400 mb-4">
                3. Configure Parameters
              </h2>
              
              <div className="space-y-6">
                {/* Initial Stop Loss */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Initial Stop Loss
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="initialSL"
                        value="reference_low"
                        checked={parameters.initialSL === 'reference_low'}
                        onChange={(e) => setParameters({...parameters, initialSL: e.target.value})}
                        className="text-orange-500"
                        disabled={!selectedStrategyId}
                      />
                      <span className="text-slate-300">Reference Candle Low</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="initialSL"
                        value="fixed"
                        checked={parameters.initialSL === 'fixed'}
                        onChange={(e) => setParameters({...parameters, initialSL: e.target.value})}
                        className="text-orange-500"
                        disabled={!selectedStrategyId}
                      />
                      <span className="text-slate-300">Fixed Points:</span>
                      <input
                        type="number"
                        value={parameters.fixedSLPoints}
                        onChange={(e) => setParameters({...parameters, fixedSLPoints: Number(e.target.value)})}
                        disabled={parameters.initialSL !== 'fixed' || !selectedStrategyId}
                        className="w-20 bg-slate-700 text-white rounded px-3 py-1 border border-slate-600 disabled:opacity-50"
                      />
                      <span className="text-slate-400 text-sm">points below entry</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="initialSL"
                        value="entry_low"
                        checked={parameters.initialSL === 'entry_low'}
                        onChange={(e) => setParameters({...parameters, initialSL: e.target.value})}
                        className="text-orange-500"
                        disabled={!selectedStrategyId}
                      />
                      <span className="text-slate-300">Entry Candle Low</span>
                    </label>
                  </div>
                </div>

                {/* Trailing Stop Loss */}
                <div className="border-t border-slate-700 pt-6">
                  <label className="flex items-center gap-2 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={parameters.trailingEnabled}
                      onChange={(e) => setParameters({...parameters, trailingEnabled: e.target.checked})}
                      disabled={!selectedStrategyId}
                      className="w-5 h-5 text-orange-500"
                    />
                    <span className="text-sm font-medium text-slate-300">Enable Trailing Stop Loss</span>
                  </label>
                  
                  {parameters.trailingEnabled && (
                    <div className="ml-7 space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-slate-400 text-sm w-32">Trigger at:</label>
                        <input
                          type="number"
                          value={parameters.trailingTrigger}
                          onChange={(e) => setParameters({...parameters, trailingTrigger: Number(e.target.value)})}
                          disabled={!selectedStrategyId}
                          className="w-20 bg-slate-700 text-white rounded px-3 py-1 border border-slate-600"
                        />
                        <span className="text-slate-400 text-sm">points profit</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-slate-400 text-sm w-32">Trail by:</label>
                        <input
                          type="number"
                          value={parameters.trailingBy}
                          onChange={(e) => setParameters({...parameters, trailingBy: Number(e.target.value)})}
                          disabled={!selectedStrategyId}
                          className="w-20 bg-slate-700 text-white rounded px-3 py-1 border border-slate-600"
                        />
                        <span className="text-slate-400 text-sm">points</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={parameters.costToCost}
                          onChange={(e) => setParameters({...parameters, costToCost: e.target.checked})}
                          disabled={!selectedStrategyId}
                          className="w-4 h-4 text-orange-500"
                        />
                        <span className="text-slate-400 text-sm">Move to cost on first trigger</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Time Exit */}
                <div className="border-t border-slate-700 pt-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Time-Based Exit (optional)
                  </label>
                  <input
                    type="time"
                    value={parameters.timeExit}
                    onChange={(e) => setParameters({...parameters, timeExit: e.target.value})}
                    disabled={!selectedStrategyId}
                    className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-orange-500 focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* Run Button */}
                <button
                  onClick={handleRunBacktest}
                  disabled={!selectedStrategyId || !csvData || loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-3 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Run Backtest
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Results */}
          <div className="bg-slate-800 rounded-lg p-6 border-2 border-slate-700">
            <h2 className="text-xl font-semibold text-orange-400 mb-4">
              Results
            </h2>
            
            {!results ? (
              <div className="flex items-center justify-center h-64 text-slate-500">
                <div className="text-center">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Run a backtest to see results</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-slate-900 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-slate-200 mb-3">Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Total Trades</p>
                      <p className="text-2xl font-bold text-white">{results.summary.totalTrades}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Net P&L</p>
                      <p className={`text-2xl font-bold ${results.summary.netPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPL(results.summary.netPL)} pts
                      </p>
                    </div>
                    {results.summary.totalTrades > 0 && (
                      <>
                        <div>
                          <p className="text-slate-400 text-sm">Winning</p>
                          <p className="text-green-400 font-semibold">{results.summary.winningTrades} trades</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Losing</p>
                          <p className="text-red-400 font-semibold">{results.summary.losingTrades} trades</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Trade List */}
                {results.trades.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-3">Trade Log</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {results.trades.map((trade, idx) => (
                        <div key={idx} className="bg-slate-900 rounded-lg p-4 border-l-4" style={{
                          borderLeftColor: trade.pl >= 0 ? '#4ade80' : '#f87171'
                        }}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-400 text-sm">Trade #{idx + 1}</span>
                            <span className={`font-bold ${trade.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatPL(trade.pl)} pts
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-slate-500">Entry</p>
                              <p className="text-slate-300">{formatTime(new Date(trade.entryTime))}</p>
                              <p className="text-slate-400">{trade.entryPrice.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Exit</p>
                              <p className="text-slate-300">{formatTime(new Date(trade.exitTime))}</p>
                              <p className="text-slate-400">{trade.exitPrice.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-700">
                            <p className="text-slate-400 text-xs">Exit: {trade.exitReason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Trades Message */}
                {results.trades.length === 0 && (
                  <div className="bg-slate-900 rounded-lg p-6 text-center">
                    <p className="text-slate-400">No trades were taken with these parameters.</p>
                    {results.skippedTrades.length > 0 && (
                      <p className="text-yellow-500 text-sm mt-2">
                        {results.skippedTrades.length} trade(s) skipped due to ambiguous entry/SL
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;