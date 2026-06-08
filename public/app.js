// ClawOracle Dashboard — Frontend Controller

const API = '';
let eventSource = null;
let timerInterval = null;
let startTime = null;
let pnlChart = null;
let analysisRunning = false;

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initChart();
  loadPortfolio();
  checkHealth();
  connectSSE();
});

function checkHealth() {
  fetch(`${API}/api/health`)
    .then(r => r.json())
    .then(d => {
      const badge = document.getElementById('modeBadge');
      if (d.deepseekConfigured) {
        badge.textContent = '🧠 DeepSeek AI 模式';
        badge.style.color = '#00d4aa';
      } else {
        badge.textContent = '🎬 Demo 模式';
        badge.style.color = '#ff9500';
      }
    })
    .catch(() => {
      document.getElementById('modeBadge').textContent = '⚠️ 连接中...';
    });
}

// ── SSE Connection ──────────────────────────────────────────────────────────

function connectSSE() {
  if (eventSource) eventSource.close();

  eventSource = new EventSource(`${API}/api/stream`);

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      handleEvent(data);
    } catch {}
  };

  eventSource.onerror = () => {
    setTimeout(connectSSE, 3000);
  };
}

// ── Event Handler ────────────────────────────────────────────────────────────

function handleEvent(data) {
  const { type } = data;

  switch (type) {
    case 'connected':
      setStatus('ready', '就绪');
      break;

    case 'start':
      onAnalysisStart(data);
      break;

    case 'data_loaded':
      addLog(`📄 ${data.message}`, 'info');
      if (data.summary) {
        addLog(`   ${data.summary.eps}`, '');
        addLog(`   ${data.summary.revenue}`, '');
      }
      break;

    case 'fetching_market':
      addLog(data.message, '');
      break;

    case 'market_data':
      document.getElementById('mktSymbol').textContent = data.symbol || '—';
      document.getElementById('mktPrice').textContent = data.price ? `$${parseFloat(data.price).toFixed(4)}` : '—';
      addLog(data.message, data.message.includes('✅') ? 'success' : 'warn');
      break;

    case 'depth_result':
      document.getElementById('mktSpread').textContent = data.spread || '—';
      document.getElementById('mktSpread').className = 'market-val ' +
        (parseFloat(data.spread) < 0.5 ? 'bullish' : 'warn');
      addLog(data.message, data.status.includes('✅') ? 'success' : 'warn');
      break;

    case 'iv_crush':
      document.getElementById('mktIv').textContent = data.risk;
      document.getElementById('mktIv').className = 'market-val ' +
        (data.risk === 'HIGH' ? 'bearish' : 'bullish');
      addLog(data.message, data.risk === 'HIGH' ? 'warn' : 'success');
      break;

    case 'pipeline_start':
    case 'agents_launching':
      addLog(data.message, 'info');
      break;

    case 'agent_start':
      onAgentStart(data.agent);
      break;

    case 'agent_token':
      appendAgentToken(data.agent, data.token);
      break;

    case 'agent_done':
      onAgentDone(data.agent, data.score, data.fullText);
      break;

    case 'analysts_complete':
      updateScoreBars(data.scores);
      addLog(data.message, 'info');
      break;

    case 'risk_complete':
    case 'decision':
      onDecision(data);
      break;

    case 'order_routing':
    case 'trade_start':
      addLog(data.message, 'info');
      break;

    case 'trade_executed':
      onTradeExecuted(data);
      break;

    case 'trade_closed':
      onTradeClosed(data);
      break;

    case 'no_trade':
      addLog(data.message, 'warn');
      document.getElementById('tradeNoExec').textContent =
        `⏸️ 信号强度 ${Math.abs(data.finalScore)} < 60，暂缓执行`;
      break;

    case 'portfolio_update':
    case 'complete':
      updatePortfolioUI(data.portfolio, data.stats);
      if (type === 'complete') {
        onAnalysisComplete(data);
      }
      break;

    case 'portfolio_reset':
      addLog(data.message, 'info');
      loadPortfolio();
      break;

    case 'error':
      addLog(`❌ ${data.message}`, 'error');
      onAnalysisComplete({});
      break;
  }
}

// ── Analysis Lifecycle ───────────────────────────────────────────────────────

function onAnalysisStart(data) {
  analysisRunning = true;
  startTime = Date.now();

  setStatus('running', `分析中...`);
  document.getElementById('runBtn').disabled = true;
  document.getElementById('runBtn').classList.add('running');
  document.getElementById('runBtnIcon').textContent = '⏳';

  // Reset UI
  resetAgentPanels();
  resetThermometer();
  document.getElementById('tradeNoExec').textContent = '等待信号...';
  document.getElementById('tradeDetails').style.display = 'none';
  document.getElementById('tradeNoExec').style.display = 'block';

  // Start timer
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 100);

  addLog(`${'─'.repeat(40)}`, '');
  addLog(data.message, 'info');
}

function onAnalysisComplete(data) {
  analysisRunning = false;
  clearInterval(timerInterval);

  setStatus('done', data.elapsed ? `完成 ${data.elapsed}` : '完成');
  document.getElementById('runBtn').disabled = false;
  document.getElementById('runBtn').classList.remove('running');
  document.getElementById('runBtnIcon').textContent = '▶';
  document.getElementById('timerSub').textContent = data.elapsed ? `总耗时 ${data.elapsed}` : '完成';

  if (data.elapsed) addLog(`🏁 全流程完成 — ${data.elapsed}`, 'success');
}

// ── Timer ────────────────────────────────────────────────────────────────────

function updateTimer() {
  if (!startTime) return;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  document.getElementById('timerValue').textContent = elapsed + 's';
}

// ── Agent Panels ─────────────────────────────────────────────────────────────

function resetAgentPanels() {
  ['fundamental', 'sentiment', 'technical', 'risk'].forEach(a => {
    const el = document.getElementById(`output-${a}`);
    if (el) { el.innerHTML = '等待分析...'; el.classList.remove('done'); }

    const badge = document.getElementById(`badge-${a}`);
    if (badge) { badge.textContent = '等待'; badge.className = 'agent-badge'; }

    const panel = document.getElementById(`agent-${a}`);
    if (panel) { panel.className = `agent-panel${a === 'risk' ? ' risk-panel' : ''}`; }
  });
}

function onAgentStart(agent) {
  const output = document.getElementById(`output-${agent}`);
  const badge = document.getElementById(`badge-${agent}`);
  const panel = document.getElementById(`agent-${agent}`);

  if (output) output.innerHTML = '<span class="cursor"></span>';
  if (badge) { badge.textContent = '分析中'; badge.className = 'agent-badge running'; }
  if (panel) panel.classList.add('active');
}

function appendAgentToken(agent, token) {
  const output = document.getElementById(`output-${agent}`);
  if (!output) return;

  const cursor = output.querySelector('.cursor');
  const text = document.createTextNode(token);

  if (cursor) {
    output.insertBefore(text, cursor);
  } else {
    output.appendChild(text);
  }

  // Auto-scroll
  output.scrollTop = output.scrollHeight;
}

function onAgentDone(agent, score, fullText) {
  const output = document.getElementById(`output-${agent}`);
  const badge = document.getElementById(`badge-${agent}`);
  const panel = document.getElementById(`agent-${agent}`);

  if (!output) return;

  // Remove cursor
  const cursor = output.querySelector('.cursor');
  if (cursor) cursor.remove();

  // Update badge
  if (badge && score !== undefined) {
    const scoreClass = score > 30 ? 'bullish' : score < -30 ? 'bearish' : 'neutral';
    badge.textContent = `${score > 0 ? '+' : ''}${score}`;
    badge.className = `agent-badge ${scoreClass}`;
  }

  if (panel) {
    panel.classList.remove('active');
    panel.classList.add('done');
    if (score > 30) panel.classList.add('bullish');
    else if (score < -30) panel.classList.add('bearish');
  }

  // Update score bar
  updateScoreBar(agent, score);
}

function updateScoreBar(agent, score) {
  const bar = document.getElementById(`bar-${agent}`);
  const num = document.getElementById(`score-${agent}`);
  if (!bar || !num) return;

  const pct = Math.min(100, Math.abs(score));
  const color = score > 30 ? '#00c851' : score < -30 ? '#ff4444' : '#ff9500';

  bar.style.width = pct + '%';
  bar.style.background = color;
  num.textContent = (score > 0 ? '+' : '') + score;
  num.style.color = color;
}

function updateScoreBars(scores) {
  Object.entries(scores).forEach(([agent, score]) => updateScoreBar(agent, score));
}

// ── Thermometer ───────────────────────────────────────────────────────────────

function resetThermometer() {
  setThermometerScore(0, false);
  document.getElementById('thermometerLabel').textContent = '等待分析';
  ['fundamental', 'sentiment', 'technical', 'risk'].forEach(a => {
    const bar = document.getElementById(`bar-${a}`);
    const num = document.getElementById(`score-${a}`);
    if (bar) { bar.style.width = '0%'; bar.style.background = '#888'; }
    if (num) { num.textContent = '—'; num.style.color = '#888'; }
  });
}

function setThermometerScore(score, animate = true) {
  const scoreEl = document.getElementById('thermometerScore');
  const labelEl = document.getElementById('thermometerLabel');

  scoreEl.textContent = (score > 0 ? '+' : '') + score;
  scoreEl.className = 'thermometer-score ' +
    (score > 30 ? 'bullish' : score < -30 ? 'bearish' : 'neutral');

  // Update needle
  const needle = document.getElementById('gaugeNeedle');
  const arc = document.getElementById('gaugeArc');
  if (needle) {
    // Map score [-100, +100] to angle [-90°, +90°]
    const angle = (score / 100) * 90;
    const rad = ((angle - 90) * Math.PI) / 180;
    const cx = 150, cy = 140, r = 110;
    const nx = cx + r * Math.cos(rad);
    const ny = cy + r * Math.sin(rad);
    needle.setAttribute('x2', nx.toFixed(1));
    needle.setAttribute('y2', ny.toFixed(1));

    const needleColor = score > 30 ? '#00c851' : score < -30 ? '#ff4444' : '#ff9500';
    needle.setAttribute('stroke', needleColor);
    document.querySelector('#gaugeSvg circle').setAttribute('fill', needleColor);
  }

  // Update active arc
  if (arc) {
    const normalizedScore = (score + 100) / 200; // 0 to 1
    const startAngle = -90 * (Math.PI / 180);
    const endAngle = startAngle + normalizedScore * Math.PI;
    const cx = 150, cy = 140, r = 120;

    const sx = cx + r * Math.cos(startAngle + Math.PI * 0);
    const sy = cy + r * Math.sin(startAngle + Math.PI * 0);
    const ex = cx + r * Math.cos(endAngle);
    const ey = cy + r * Math.sin(endAngle);
    const largeArc = normalizedScore > 0.5 ? 1 : 0;

    const d = `M ${(30).toFixed(1)} ${(140).toFixed(1)} A 120 120 0 ${largeArc} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    arc.setAttribute('d', d);

    const arcColor = score > 30 ? '#00c851' : score < -30 ? '#ff4444' : '#ff9500';
    arc.setAttribute('stroke', arcColor);
  }
}

function onDecision(data) {
  const { finalScore, action, positionSize, reasoning } = data;

  setThermometerScore(finalScore);
  updateScoreBar('risk', finalScore);

  const labelMap = {
    BUY: `📈 做多信号 | 仓位 ${positionSize}%`,
    SELL: `📉 做空信号 | 仓位 ${positionSize}%`,
    WAIT: `⏸️ 暂缓执行 | 信号不足`
  };

  document.getElementById('thermometerLabel').textContent =
    labelMap[action] || `决策: ${action}`;

  addLog(`⚡ 温度计: ${finalScore > 0 ? '+' : ''}${finalScore} | ${action} | ${positionSize}%`, 'info');
  if (reasoning) addLog(`   ${reasoning}`, '');
}

// ── Trade UI ─────────────────────────────────────────────────────────────────

function onTradeExecuted(data) {
  const { details, trade } = data;
  if (!details) return;

  document.getElementById('tradeNoExec').style.display = 'none';
  document.getElementById('tradeDetails').style.display = 'block';

  const dir = document.getElementById('tradeDirection');
  dir.textContent = details.action;
  dir.className = 'trade-direction ' + (trade?.action === 'BUY' ? 'buy' : 'sell');

  document.getElementById('tradeAmount').textContent = details.amount;
  document.getElementById('tradePrice').textContent = details.price;
  document.getElementById('tradeTp').textContent = details.takeProfit;
  document.getElementById('tradeSl').textContent = details.stopLoss;
  document.getElementById('tradeAuto').textContent = details.autoClose;

  const statusEl = document.getElementById('tradeStatus');
  statusEl.textContent = trade?.simulated
    ? `✅ 纸面交易执行 (子账户隔离) | ID: ${(trade.orderId || 'SIM').substring(0, 16)}`
    : `✅ Bitget MCP 执行 | ID: ${trade?.orderId || '—'}`;

  addLog(data.message, 'success');
  addLog(`   止盈: ${details.takeProfit} | 止损: ${details.stopLoss}`, 'success');

  loadPortfolio();
}

function onTradeClosed(data) {
  const { trade } = data;
  if (!trade) return;

  const isProfit = trade.pnl >= 0;
  const outcomeEl = document.getElementById('tradeOutcome');
  outcomeEl.style.display = 'block';
  outcomeEl.className = 'trade-outcome ' + (isProfit ? 'profit' : 'loss');
  outcomeEl.textContent = `4h 结果: ${isProfit ? '🟢' : '🔴'} ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl} (${trade.pnlPct}%) [${trade.closeReason}]`;

  document.getElementById('tradeStatus').textContent = '已平仓';
  addLog(data.message, isProfit ? 'success' : 'error');

  loadPortfolio();
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

function loadPortfolio() {
  fetch(`${API}/api/portfolio`)
    .then(r => r.json())
    .then(({ portfolio, stats }) => {
      updatePortfolioUI(portfolio, stats);
    })
    .catch(console.warn);
}

function updatePortfolioUI(portfolio, stats) {
  if (!stats) return;

  const pnl = parseFloat(stats.totalPnl);
  const pnlPct = parseFloat(stats.totalPnlPct);

  document.getElementById('statBalance').textContent = `$${stats.totalValue}`;
  document.getElementById('statPnl').textContent = `${pnl >= 0 ? '+' : ''}$${stats.totalPnl}`;
  document.getElementById('statPnl').style.color = pnl >= 0 ? '#00c851' : '#ff4444';
  document.getElementById('statPnlPct').textContent = `${pnlPct >= 0 ? '+' : ''}${stats.totalPnlPct}%`;
  document.getElementById('statPnlPct').style.color = pnlPct >= 0 ? '#00c851' : '#ff4444';
  document.getElementById('statWinRate').textContent = stats.totalTrades > 0 ? `${stats.winRate}%` : '—';
  document.getElementById('statTrades').textContent = stats.totalTrades;

  // Update chart
  if (portfolio?.pnlCurve) updateChart(portfolio.pnlCurve);

  // Update trade history table
  if (portfolio?.tradeHistory) updateTradeHistory(portfolio.tradeHistory);
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function initChart() {
  const ctx = document.getElementById('pnlChart').getContext('2d');
  pnlChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Start'],
      datasets: [{
        label: '净值',
        data: [10000],
        borderColor: '#00d4aa',
        backgroundColor: 'rgba(0, 212, 170, 0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#00d4aa'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2535',
          borderColor: '#1e2d45',
          borderWidth: 1,
          titleColor: '#8899bb',
          bodyColor: '#e0e8f0',
          callbacks: {
            label: (ctx) => ` $${ctx.raw.toFixed(2)}`
          }
        }
      },
      scales: {
        x: { grid: { color: '#1e2d45' }, ticks: { color: '#4a6080', font: { size: 10 } } },
        y: {
          grid: { color: '#1e2d45' },
          ticks: {
            color: '#4a6080', font: { size: 10 },
            callback: v => '$' + v.toFixed(0)
          }
        }
      }
    }
  });
}

function updateChart(pnlCurve) {
  if (!pnlChart || !pnlCurve.length) return;

  pnlChart.data.labels = pnlCurve.map((p, i) => p.label || `T${i}`);
  pnlChart.data.datasets[0].data = pnlCurve.map(p => p.value);

  const lastVal = pnlCurve[pnlCurve.length - 1]?.value || 10000;
  const isUp = lastVal >= 10000;
  pnlChart.data.datasets[0].borderColor = isUp ? '#00c851' : '#ff4444';
  pnlChart.data.datasets[0].backgroundColor = isUp ? 'rgba(0,200,81,0.06)' : 'rgba(255,68,68,0.06)';

  pnlChart.update('none');
}

// ── Trade History ─────────────────────────────────────────────────────────────

function updateTradeHistory(trades) {
  const tbody = document.getElementById('tradeHistoryBody');
  if (!trades.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">暂无交易记录</td></tr>';
    return;
  }

  tbody.innerHTML = trades.slice(0, 20).map(t => {
    const time = new Date(t.timestamp).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' });
    const event = (t.earningsEvent || '').replace('财报', '').substring(0, 20);
    const action = `<span class="tag ${t.action.toLowerCase()}">${t.action}</span>`;
    const amount = `$${t.amountUsdt || '—'}`;
    const entry = t.entryPrice ? `$${parseFloat(t.entryPrice).toFixed(3)}` : '—';
    const exit = t.exitPrice ? `$${parseFloat(t.exitPrice).toFixed(3)}` : '—';
    const pnlVal = t.pnl !== null ? t.pnl : null;
    const pnlStr = pnlVal !== null
      ? `<span style="color:${pnlVal >= 0 ? '#00c851' : '#ff4444'}">${pnlVal >= 0 ? '+' : ''}$${pnlVal}</span>`
      : '—';
    const status = `<span class="tag ${t.status.toLowerCase()}">${t.status}</span>`;

    return `<tr>
      <td>${time}</td>
      <td title="${t.earningsEvent}">${event}</td>
      <td>${action}</td>
      <td>${amount}</td>
      <td>${entry}</td>
      <td>${exit}</td>
      <td>${pnlStr}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

// ── Controls ──────────────────────────────────────────────────────────────────

function runAnalysis() {
  if (analysisRunning) return;

  const mode = document.getElementById('modeSelect').value;
  const scenario = document.getElementById('scenarioSelect').value;

  fetch(`${API}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, scenario })
  })
    .then(r => r.json())
    .then(d => { if (!d.success) addLog(`启动失败: ${d.error}`, 'error'); })
    .catch(err => addLog(`连接错误: ${err.message}`, 'error'));
}

function resetPortfolio() {
  if (!confirm('确定要重置投资组合吗？')) return;
  fetch(`${API}/api/portfolio/reset`, { method: 'POST' }).then(() => loadPortfolio());
}

// ── Log ───────────────────────────────────────────────────────────────────────

function addLog(message, type = '') {
  const container = document.getElementById('logContainer');
  const entry = document.createElement('div');
  entry.className = `log-entry${type ? ' ' + type : ''}`;

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = new Date().toLocaleTimeString('zh', { hour12: false });

  entry.appendChild(time);
  entry.appendChild(document.createTextNode(message));
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  // Keep max 100 entries
  while (container.children.length > 100) {
    container.removeChild(container.firstChild);
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

function setStatus(state, text) {
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  dot.className = `status-dot ${state}`;
  statusText.textContent = text;
}
