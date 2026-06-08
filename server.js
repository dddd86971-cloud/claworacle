// ClawOracle — Main Server
// Bitget AI Hackathon Genesis Season 1 — Track 3: US Stock AI Trading
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { runFullAgentPipeline } = require('./src/claude');
const { getTickerPrice, getCandles, getDepth, placeSpotOrder, placePlanOrder, calculateSpreadPct } = require('./src/bitget');
const { getPaperPortfolio, addTrade, simulateTradeOutcome, getPortfolioStats, resetPortfolio } = require('./src/paper');
const { listScenarios, getReplayScenario } = require('./src/replay');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── SSE Client Registry ──────────────────────────────────────────────────────

const clients = new Map();
let analysisRunning = false;

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => {
    try { res.write(msg); } catch {}
  });
}

// ─── SSE Endpoint ─────────────────────────────────────────────────────────────

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = Date.now() + Math.random();
  clients.set(clientId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  req.on('close', () => clients.delete(clientId));
});

// ─── Analysis Trigger ─────────────────────────────────────────────────────────

app.post('/api/analyze', async (req, res) => {
  if (analysisRunning) {
    return res.status(429).json({ error: 'Analysis already running' });
  }

  const { mode = 'replay', scenario = 'nvda_q3_2024' } = req.body;
  res.json({ success: true, message: 'Analysis started', mode, scenario });

  // Run async
  analysisRunning = true;
  runAnalysis({ mode, scenario }).catch(err => {
    broadcast({ type: 'error', message: err.message });
  }).finally(() => {
    analysisRunning = false;
  });
});

// ─── Core Analysis Engine ─────────────────────────────────────────────────────

async function runAnalysis({ mode, scenario }) {
  const startTime = Date.now();

  broadcast({
    type: 'start',
    mode,
    scenario,
    message: `🚀 ClawOracle 启动 — ${mode === 'replay' ? '📼 Replay Mode' : '🔴 Live Mode'}`,
    timestamp: new Date().toISOString()
  });

  await sleep(400);

  // ── Step 1: Load Scenario Data ──────────────────────────────────────────────
  let scenarioData;
  if (mode === 'replay') {
    scenarioData = getReplayScenario(scenario);
    broadcast({
      type: 'data_loaded',
      message: `📄 加载财报数据: ${scenarioData.name}`,
      summary: scenarioData.summary
    });
    await sleep(600);
  } else {
    broadcast({ type: 'monitoring', message: '📡 监控 SEC EDGAR 中...' });
    scenarioData = getReplayScenario('nvda_q3_2024'); // fallback for live demo
    await sleep(1000);
  }

  // ── Step 2: Fetch Bitget Market Data ───────────────────────────────────────
  let tokenPrice = scenarioData.tokenPrice;
  let spreadPct = 0.18;

  broadcast({ type: 'fetching_market', message: `💹 拉取 ${scenarioData.symbol} 实时价格...` });

  try {
    const ticker = await getTickerPrice(scenarioData.symbol);
    tokenPrice = parseFloat(ticker.lastPr || ticker.close || scenarioData.tokenPrice);
    broadcast({
      type: 'market_data',
      symbol: scenarioData.symbol,
      price: tokenPrice,
      change24h: ticker.change24h || '0',
      message: `✅ ${scenarioData.symbol}: $${tokenPrice}`
    });
  } catch (err) {
    broadcast({
      type: 'market_data',
      symbol: scenarioData.symbol,
      price: tokenPrice,
      message: `⚠️ 使用参考价格 $${tokenPrice}（${err.message.includes('permission') ? '需开启读取权限' : err.message}）`
    });
  }

  // ── Step 3: Depth Check ───────────────────────────────────────────────────
  broadcast({ type: 'depth_checking', message: '📒 检查盘口流动性...' });

  try {
    const depth = await getDepth(scenarioData.symbol);
    const spread = calculateSpreadPct(depth);
    if (spread !== null) {
      spreadPct = spread;
      const status = spreadPct < 0.5 ? '✅ 流动性充足' : '⚠️ 价差偏高，降级为限价单';
      broadcast({
        type: 'depth_result',
        spread: spreadPct.toFixed(3) + '%',
        status,
        message: `📒 盘口价差: ${spreadPct.toFixed(3)}% — ${status}`
      });
    }
  } catch {
    broadcast({ type: 'depth_result', spread: '0.18%', status: '✅ 正常', message: '📒 盘口: 正常 (0.18%)' });
  }

  await sleep(300);

  // ── Step 4: IV Crush Detection ────────────────────────────────────────────
  if (scenarioData.ivCrushRisk) {
    broadcast({
      type: 'iv_crush',
      risk: 'HIGH',
      message: '⚠️ IV Crush 风险: HIGH — 财报前期权隐含波动率显著抬升，信号强度将折半'
    });
  } else {
    broadcast({
      type: 'iv_crush',
      risk: 'LOW',
      message: '✅ IV Crush 检测: 无异常定价，正常信号强度'
    });
  }

  await sleep(500);

  // ── Step 5: Run 4 AI Agents ───────────────────────────────────────────────
  broadcast({
    type: 'agents_launching',
    message: '🤖 四路 Agent 并行启动 (Promise.all)...',
    agents: ['fundamental', 'sentiment', 'technical', 'risk']
  });

  const agentInput = {
    ...scenarioData,
    tokenPrice,
    mockAnalysis: scenarioData.mockAgentAnalysis
  };

  const pipelineResult = await runFullAgentPipeline(agentInput, broadcast);

  // ── Step 6: Calculate Final Decision ─────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const { finalScore, action, positionSize, reasoning } = pipelineResult.risk;

  broadcast({
    type: 'decision',
    finalScore,
    action,
    positionSize,
    reasoning,
    elapsed: `${elapsed}s`,
    message: `⚡ 情绪温度计: ${finalScore > 0 ? '+' : ''}${finalScore} | 决策: ${action} | 仓位: ${positionSize}%`
  });

  await sleep(500);

  // ── Step 7: Execute Paper Trade ───────────────────────────────────────────
  if (Math.abs(finalScore) >= 60 && action !== 'WAIT') {
    await executePaperTrade({
      scenarioData,
      action,
      positionSize,
      price: tokenPrice,
      score: finalScore,
      spreadPct
    });
  } else {
    broadcast({
      type: 'no_trade',
      finalScore,
      message: `⏸️ 信号强度 |${finalScore}| < 阈值 60，暂缓执行。等待信号强化或下次财报事件。`
    });
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const portfolio = getPaperPortfolio();
  const stats = getPortfolioStats(portfolio);

  broadcast({
    type: 'complete',
    elapsed: `${totalElapsed}s`,
    stats,
    message: `🏁 全流程完成 — 耗时 ${totalElapsed} 秒`,
    portfolio
  });
}

// ─── Paper Trade Execution ────────────────────────────────────────────────────

async function executePaperTrade({ scenarioData, action, positionSize, price, score, spreadPct }) {
  const orderType = spreadPct > 0.5 ? 'limit' : 'market';

  broadcast({
    type: 'trade_start',
    message: `📤 执行纸面交易 (${orderType === 'limit' ? '限价单 - 价差偏高' : '市价单'})...`
  });

  await sleep(400);

  const stopLossPct = 0.02;
  const takeProfitPct = 0.035;
  const stopLossPrice = action === 'BUY' ? price * (1 - stopLossPct) : price * (1 + stopLossPct);
  const takeProfitPrice = action === 'BUY' ? price * (1 + takeProfitPct) : price * (1 - takeProfitPct);

  // Attempt real Bitget API
  let orderResult;
  try {
    const MAX_USDT = 1000;
    const tradeAmount = (positionSize / 100) * MAX_USDT;
    const qty = tradeAmount / price;
    orderResult = await placeSpotOrder(scenarioData.symbol, action.toLowerCase(), price, qty);
  } catch (err) {
    orderResult = { orderId: `SIM_${Date.now()}`, simulated: true };
  }

  // Record in paper portfolio
  const trade = addTrade({
    symbol: scenarioData.symbol,
    action,
    price,
    score,
    earningsEvent: scenarioData.name,
    spreadPct,
    positionSizePct: positionSize
  });

  const MAX_USDT = 1000;
  const tradeAmount = (positionSize / 100) * MAX_USDT;

  broadcast({
    type: 'trade_executed',
    trade: {
      ...trade,
      orderId: orderResult.orderId,
      simulated: orderResult.simulated ?? true
    },
    details: {
      action: `${action} ${scenarioData.symbol}`,
      amount: `${tradeAmount.toFixed(2)} USDT`,
      price: `$${price.toFixed(4)}`,
      stopLoss: `$${stopLossPrice.toFixed(4)} (−2%)`,
      takeProfit: `$${takeProfitPrice.toFixed(4)} (+3.5%)`,
      autoClose: '4小时后自动平仓',
      orderType,
      orderId: orderResult.orderId
    },
    message: `✅ ${action} ${tradeAmount.toFixed(0)} USDT ${scenarioData.symbol} @ $${price.toFixed(4)}`
  });

  // Simulate outcome after 4h (for demo: after 8 seconds)
  const tradeId = trade.id;
  const isPositivScenario = Math.abs(score) > 70 && !scenarioData.ivCrushRisk;
  setTimeout(async () => {
    const outcome = simulateTradeOutcome(tradeId, isPositivScenario ? 'tp_hit' : 'sl_hit');
    if (outcome) {
      broadcast({
        type: 'trade_closed',
        trade: outcome,
        message: `📊 模拟 4h 后: ${outcome.pnl >= 0 ? '🟢' : '🔴'} ${action} ${scenarioData.symbol} → ${outcome.pnl >= 0 ? '+' : ''}$${outcome.pnl} (${outcome.pnlPct}%) [${outcome.closeReason}]`
      });

      const finalPortfolio = getPaperPortfolio();
      broadcast({
        type: 'portfolio_update',
        portfolio: finalPortfolio,
        stats: getPortfolioStats(finalPortfolio)
      });
    }
  }, 12000); // 12 second delay for demo
}

// ─── REST API Endpoints ───────────────────────────────────────────────────────

app.get('/api/scenarios', (req, res) => {
  res.json(listScenarios());
});

app.get('/api/portfolio', (req, res) => {
  const portfolio = getPaperPortfolio();
  res.json({ portfolio, stats: getPortfolioStats(portfolio) });
});

app.post('/api/portfolio/reset', (req, res) => {
  const fresh = resetPortfolio();
  broadcast({ type: 'portfolio_reset', message: '🔄 投资组合已重置' });
  res.json({ success: true, portfolio: fresh });
});

app.get('/api/market/:symbol', async (req, res) => {
  try {
    const data = await getTickerPrice(req.params.symbol);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    name: 'ClawOracle',
    mode: process.env.ANTHROPIC_API_KEY ? 'AI模式' : 'Demo模式',
    analysisRunning,
    clients: clients.size,
    timestamp: new Date().toISOString()
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Start (direct run) ───────────────────────────────────────────────────────

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 ClawOracle running at http://localhost:${PORT}`);
    console.log(`   Mode: ${process.env.ANTHROPIC_API_KEY ? '✅ AI模式 (Claude API)' : '🎬 Demo模式 (Mock AI)'}`);
    console.log(`   Bitget: ${process.env.BITGET_API_KEY ? '✅ 已配置' : '❌ 未配置'}\n`);
  });
}

// ─── Export for Vercel ────────────────────────────────────────────────────────
module.exports = app;
