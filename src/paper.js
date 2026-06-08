// ClawOracle — Paper Trading Engine (Virtual Portfolio)
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/portfolio.json');
const INITIAL_BALANCE = 10000;
const MAX_POSITION_USDT = 1000;

function loadPortfolio() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
      return createInitialPortfolio();
    }
  }
  return createInitialPortfolio();
}

function createInitialPortfolio() {
  return {
    balance: INITIAL_BALANCE,
    initialBalance: INITIAL_BALANCE,
    positions: [],
    tradeHistory: [],
    pnlCurve: [{ timestamp: Date.now(), value: INITIAL_BALANCE, label: 'Start' }],
    totalTrades: 0,
    wins: 0,
    losses: 0,
    biggestWin: 0,
    biggestLoss: 0
  };
}

function savePortfolio(portfolio) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(portfolio, null, 2));
}

function getPaperPortfolio() {
  return loadPortfolio();
}

function addTrade(tradeData) {
  const portfolio = loadPortfolio();
  const {
    symbol, action, price, score, earningsEvent,
    spreadPct, positionSizePct
  } = tradeData;

  const tradeAmount = (positionSizePct / 100) * MAX_POSITION_USDT;
  const quantity = tradeAmount / price;
  const stopLossPct = 0.02;
  const takeProfitPct = 0.035;

  const stopLoss = action === 'BUY'
    ? price * (1 - stopLossPct)
    : price * (1 + stopLossPct);
  const takeProfit = action === 'BUY'
    ? price * (1 + takeProfitPct)
    : price * (1 - takeProfitPct);

  const trade = {
    id: `T${Date.now()}`,
    timestamp: new Date().toISOString(),
    symbol,
    action,
    entryPrice: price,
    quantity: parseFloat(quantity.toFixed(6)),
    amountUsdt: parseFloat(tradeAmount.toFixed(2)),
    positionSizePct,
    score,
    stopLoss: parseFloat(stopLoss.toFixed(4)),
    takeProfit: parseFloat(takeProfit.toFixed(4)),
    autoCloseAfter: '4h',
    status: 'OPEN',
    earningsEvent,
    spreadPct: spreadPct || 0,
    closedAt: null,
    exitPrice: null,
    pnl: null,
    pnlPct: null
  };

  portfolio.positions.push(trade);
  portfolio.tradeHistory.unshift(trade);
  portfolio.totalTrades += 1;
  portfolio.balance -= tradeAmount;

  portfolio.pnlCurve.push({
    timestamp: Date.now(),
    value: calculatePortfolioValue(portfolio),
    label: `${action} ${symbol}`
  });

  savePortfolio(portfolio);
  return trade;
}

function closeTrade(tradeId, exitPrice, reason = 'manual') {
  const portfolio = loadPortfolio();
  const posIdx = portfolio.positions.findIndex(p => p.id === tradeId);
  if (posIdx === -1) return null;

  const trade = portfolio.positions[posIdx];
  const pnl = trade.action === 'BUY'
    ? (exitPrice - trade.entryPrice) * trade.quantity
    : (trade.entryPrice - exitPrice) * trade.quantity;
  const pnlPct = (pnl / trade.amountUsdt) * 100;

  trade.status = 'CLOSED';
  trade.closedAt = new Date().toISOString();
  trade.exitPrice = exitPrice;
  trade.closeReason = reason;
  trade.pnl = parseFloat(pnl.toFixed(2));
  trade.pnlPct = parseFloat(pnlPct.toFixed(2));

  portfolio.balance += trade.amountUsdt + pnl;
  portfolio.positions.splice(posIdx, 1);

  if (pnl > 0) {
    portfolio.wins += 1;
    if (pnl > portfolio.biggestWin) portfolio.biggestWin = pnl;
  } else {
    portfolio.losses += 1;
    if (pnl < portfolio.biggestLoss) portfolio.biggestLoss = pnl;
  }

  const histIdx = portfolio.tradeHistory.findIndex(t => t.id === tradeId);
  if (histIdx !== -1) portfolio.tradeHistory[histIdx] = trade;

  portfolio.pnlCurve.push({
    timestamp: Date.now(),
    value: calculatePortfolioValue(portfolio),
    label: `Close ${trade.symbol} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)})`
  });

  savePortfolio(portfolio);
  return trade;
}

// Simulate closing a trade after 4 hours with a mock outcome
function simulateTradeOutcome(tradeId, scenario) {
  const portfolio = loadPortfolio();
  const trade = portfolio.positions.find(p => p.id === tradeId);
  if (!trade) return null;

  // Simulate realistic outcome based on scenario
  let exitMultiplier;
  if (scenario === 'tp_hit') {
    exitMultiplier = trade.action === 'BUY' ? 1.035 : 0.965;
  } else if (scenario === 'sl_hit') {
    exitMultiplier = trade.action === 'BUY' ? 0.98 : 1.02;
  } else {
    // Random within range
    exitMultiplier = 1 + (Math.random() * 0.06 - 0.01);
  }

  const exitPrice = trade.entryPrice * exitMultiplier;
  const priceDiff = Math.abs(exitMultiplier - 1);
  const reason = priceDiff >= 0.034 ? 'take_profit' :
                 priceDiff >= 0.019 ? 'stop_loss' : 'auto_close_4h';

  return closeTrade(tradeId, exitPrice, reason);
}

function calculatePortfolioValue(portfolio) {
  const openPositionsValue = portfolio.positions.reduce((sum, p) => sum + p.amountUsdt, 0);
  return parseFloat((portfolio.balance + openPositionsValue).toFixed(2));
}

function getPortfolioStats(portfolio) {
  const totalValue = calculatePortfolioValue(portfolio);
  const totalPnl = totalValue - portfolio.initialBalance;
  const totalPnlPct = (totalPnl / portfolio.initialBalance) * 100;
  const winRate = portfolio.totalTrades > 0
    ? (portfolio.wins / (portfolio.wins + portfolio.losses)) * 100
    : 0;

  return {
    totalValue: totalValue.toFixed(2),
    totalPnl: totalPnl.toFixed(2),
    totalPnlPct: totalPnlPct.toFixed(2),
    winRate: winRate.toFixed(1),
    totalTrades: portfolio.totalTrades,
    wins: portfolio.wins,
    losses: portfolio.losses,
    biggestWin: portfolio.biggestWin.toFixed(2),
    biggestLoss: portfolio.biggestLoss.toFixed(2)
  };
}

function resetPortfolio() {
  const fresh = createInitialPortfolio();
  savePortfolio(fresh);
  return fresh;
}

module.exports = {
  getPaperPortfolio,
  addTrade,
  closeTrade,
  simulateTradeOutcome,
  calculatePortfolioValue,
  getPortfolioStats,
  resetPortfolio
};
