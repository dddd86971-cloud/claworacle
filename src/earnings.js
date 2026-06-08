// ClawOracle — Real Earnings Data Engine
// Primary:  Alpha Vantage API (free key at alphavantage.co, 25 req/day)
// Fallback: Yahoo Finance (crumb auth, free, may rate-limit under heavy testing)
// Cache:    30-min in-memory + /tmp file (persists across Vercel warm instances)

const fs   = require('fs');
const path = require('path');

const TICKER_TO_SYMBOL = {
  NVDA:  'NVDAONUSDT',
  TSLA:  'TSLAONUSDT',
  AAPL:  'AAPLONUSDT',
  GOOGL: 'GOOGLONUSDT'
};
const TRACKED_TICKERS = Object.keys(TICKER_TO_SYMBOL);

const UA         = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CACHE_TTL  = 30 * 60 * 1000;  // 30 minutes
const TMP_DIR    = '/tmp';

// ─── Dual cache: in-memory + /tmp file ───────────────────────────────────────

const _memCache  = new Map();
let   _ySession  = null;   // Yahoo session (crumb + cookie)

function readCache(key) {
  const mem = _memCache.get(key);
  if (mem && Date.now() - mem.ts < CACHE_TTL) return mem.data;

  // Try /tmp file
  try {
    const file = path.join(TMP_DIR, `claw_${key}.json`);
    if (fs.existsSync(file)) {
      const f = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (f && Date.now() - f.ts < CACHE_TTL) {
        _memCache.set(key, f);
        return f.data;
      }
    }
  } catch {}
  return null;
}

function writeCache(key, data) {
  const entry = { ts: Date.now(), data };
  _memCache.set(key, entry);
  try {
    const file = path.join(TMP_DIR, `claw_${key}.json`);
    fs.writeFileSync(file, JSON.stringify(entry));
  } catch {}
}

// ─── Source A: Alpha Vantage ─────────────────────────────────────────────────

async function fetchAlphaVantage(ticker) {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) throw new Error('ALPHA_VANTAGE_KEY not configured');

  // Earnings: EPS actual vs estimate + dates
  const epRes = await fetch(
    `https://www.alphavantage.co/query?function=EARNINGS&symbol=${ticker}&apikey=${key}`,
    { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }
  );
  if (!epRes.ok) throw new Error(`Alpha Vantage HTTP ${epRes.status}`);
  const epJson = await epRes.json();

  if (epJson.Information) throw new Error('Alpha Vantage rate limit — upgrade or wait');
  if (!epJson.quarterlyEarnings?.length) throw new Error('No earnings from Alpha Vantage');

  const latest = epJson.quarterlyEarnings[0];
  const epsActual   = parseFloat(latest.reportedEPS);
  const epsEstimate = parseFloat(latest.estimatedEPS);
  const epsSurprisePct = !isNaN(epsActual) && !isNaN(epsEstimate) && epsEstimate !== 0
    ? parseFloat(((epsActual - epsEstimate) / Math.abs(epsEstimate) * 100).toFixed(2))
    : parseFloat(latest.surprisePercentage) || null;

  // Historical comps (prior 3 quarters)
  const historicalComps = (epJson.quarterlyEarnings || []).slice(1, 4).map(h => ({
    event: `${ticker} ${h.reportedDate || h.fiscalDateEnding}`,
    surprise: h.surprisePercentage
      ? `${parseFloat(h.surprisePercentage) > 0 ? '+' : ''}${parseFloat(h.surprisePercentage).toFixed(1)}%`
      : 'N/A',
    priceChange4h: 'N/A'
  }));

  // Income statement for revenue (separate call)
  let revActualB = null, revGrowthYoY = null, grossMarginPct = null;
  try {
    await new Promise(r => setTimeout(r, 300)); // small delay between calls
    const isRes = await fetch(
      `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${ticker}&apikey=${key}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }
    );
    if (isRes.ok) {
      const isJson = await isRes.json();
      const qReports = isJson.quarterlyReports || [];
      if (qReports.length > 0) {
        revActualB = parseFloat(qReports[0].totalRevenue) / 1e9 || null;
        const gp = parseFloat(qReports[0].grossProfit);
        const rv = parseFloat(qReports[0].totalRevenue);
        grossMarginPct = rv && gp ? parseFloat((gp / rv * 100).toFixed(1)) : null;

        // YoY growth vs same quarter last year
        const prevYear = qReports[4] || qReports[3];
        if (prevYear) {
          const rv1 = parseFloat(qReports[0].totalRevenue);
          const rv0 = parseFloat(prevYear.totalRevenue);
          revGrowthYoY = rv0 ? parseFloat(((rv1 - rv0) / rv0 * 100).toFixed(1)) : null;
        }
      }
    }
  } catch {}

  return {
    source: 'alpha_vantage',
    ticker,
    symbol: TICKER_TO_SYMBOL[ticker],
    reportedDate: latest.reportedDate || latest.fiscalDateEnding,
    nextEarningsDate: null, // AV doesn't provide this in free tier
    epsActual:       !isNaN(epsActual)   ? epsActual   : null,
    epsEstimate:     !isNaN(epsEstimate) ? epsEstimate : null,
    epsSurprisePct,
    revActualB,
    revEstimateB:    null, // not in AV free
    revSurprisePct:  null,
    revGrowthYoY,
    grossMarginPct,
    operatingMarginPct: null,
    freeCashflowB:   null,
    nextQRevEstB:    null,
    nextQEpsEst:     null,
    historicalComps
  };
}

// ─── Source B: Yahoo Finance (crumb auth) ────────────────────────────────────

async function getYahooSession() {
  // Reuse session if < 45 min old
  if (_ySession && Date.now() - _ySession.ts < 45 * 60 * 1000) return _ySession;

  // Try to load persisted session from /tmp
  try {
    const sf = path.join(TMP_DIR, 'claw_yf_session.json');
    if (fs.existsSync(sf)) {
      const s = JSON.parse(fs.readFileSync(sf, 'utf8'));
      if (s && Date.now() - s.ts < 45 * 60 * 1000) {
        _ySession = s;
        return s;
      }
    }
  } catch {}

  // Get cookie from Yahoo Finance's fraud-check endpoint (lightweight)
  const fcRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA, 'Accept': '*/*' },
    signal: AbortSignal.timeout(10000)
  });
  const cookies = [];
  fcRes.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') cookies.push(v.split(';')[0]);
  });
  const cookie = cookies.join('; ');

  await new Promise(r => setTimeout(r, 400));

  // Exchange cookie for crumb
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, 'Cookie': cookie, 'Referer': 'https://finance.yahoo.com/' },
    signal: AbortSignal.timeout(10000)
  });
  if (!crumbRes.ok) throw new Error(`Yahoo crumb failed (${crumbRes.status})`);
  const crumb = await crumbRes.text();
  if (!crumb || crumb.length < 3 || crumb.includes('<')) throw new Error('Invalid crumb');

  const session = { crumb, cookie, ts: Date.now() };
  _ySession = session;

  // Persist session to /tmp
  try {
    fs.writeFileSync(path.join(TMP_DIR, 'claw_yf_session.json'), JSON.stringify(session));
  } catch {}

  return session;
}

async function fetchYahoo(ticker) {
  const session = await getYahooSession();
  const modules = 'earningsHistory,incomeStatementHistoryQuarterly,earningsTrend,calendarEvents,financialData';
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}` +
    `?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Cookie': session.cookie, 'Accept': 'application/json, */*', 'Referer': 'https://finance.yahoo.com/' },
    signal: AbortSignal.timeout(12000)
  });

  // Stale session: clear and retry once
  if (res.status === 401) {
    _ySession = null;
    return fetchYahoo(ticker);
  }
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);

  const json = await res.json();
  if (json.quoteSummary?.error) throw new Error(json.quoteSummary.error.description || 'Yahoo error');
  const raw = json.quoteSummary?.result?.[0];
  if (!raw) throw new Error(`No Yahoo data for ${ticker}`);

  // Parse EPS
  const epsHist  = raw.earningsHistory?.history || [];
  const latest   = epsHist[0] || {};
  const epsActual   = latest.epsActual?.raw   ?? null;
  const epsEstimate = latest.epsEstimate?.raw ?? null;
  const reportedDateRaw = latest.quarter?.raw;
  const reportedDate = reportedDateRaw
    ? new Date(reportedDateRaw * 1000).toISOString().split('T')[0]
    : null;
  const epsSurprisePct = epsActual != null && epsEstimate != null && epsEstimate !== 0
    ? parseFloat(((epsActual - epsEstimate) / Math.abs(epsEstimate) * 100).toFixed(2))
    : (latest.surprisePercent?.raw != null ? parseFloat((latest.surprisePercent.raw * 100).toFixed(2)) : null);

  // Parse revenue
  const incHist  = raw.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
  const latestI  = incHist[0] || {};
  const prevYr   = incHist[4] || incHist[3] || {};
  const revActual = latestI.totalRevenue?.raw ?? null;
  const gp        = latestI.grossProfit?.raw ?? null;
  const grossMarginPct = revActual && gp ? parseFloat((gp / revActual * 100).toFixed(1)) : null;
  const revGrowthYoY = revActual && prevYr.totalRevenue?.raw
    ? parseFloat(((revActual - prevYr.totalRevenue.raw) / prevYr.totalRevenue.raw * 100).toFixed(1))
    : null;
  const opIncome = latestI.operatingIncome?.raw ?? null;
  const operatingMarginPct = revActual && opIncome ? parseFloat((opIncome / revActual * 100).toFixed(1)) : null;

  // Revenue estimate from earningsTrend
  const trends = raw.earningsTrend?.trend || [];
  const prevQT  = trends.find(t => t.period === '-1q') || trends[1] || {};
  const revEstimate  = prevQT.revenueEstimate?.avg?.raw ?? null;
  const revSurprisePct = revActual && revEstimate
    ? parseFloat(((revActual - revEstimate) / revEstimate * 100).toFixed(2))
    : null;

  // Next earnings date
  const nextTs = raw.calendarEvents?.earnings?.earningsDate?.[0]?.raw ?? null;
  const nextEarningsDate = nextTs ? new Date(nextTs * 1000).toISOString().split('T')[0] : null;

  // Forward guidance
  const q0T = trends.find(t => t.period === '0q') || {};
  const nextQRevEstB = q0T.revenueEstimate?.avg?.raw ? q0T.revenueEstimate.avg.raw / 1e9 : null;
  const nextQEpsEst  = q0T.earningsEstimate?.avg?.raw ?? null;
  const fd = raw.financialData || {};
  const freeCashflowB = fd.freeCashflow?.raw ? fd.freeCashflow.raw / 1e9 : null;

  // Historical comps
  const historicalComps = epsHist.slice(1, 4).map(h => {
    const hDate = h.quarter?.raw ? new Date(h.quarter.raw * 1000).toISOString().split('T')[0] : '?';
    const hSurp = h.surprisePercent?.raw != null
      ? `${h.surprisePercent.raw > 0 ? '+' : ''}${(h.surprisePercent.raw * 100).toFixed(1)}%`
      : 'N/A';
    return { event: `${ticker} ${hDate}`, surprise: hSurp, priceChange4h: 'N/A (live)' };
  });

  return {
    source: 'yahoo_finance',
    ticker,
    symbol: TICKER_TO_SYMBOL[ticker],
    reportedDate,
    nextEarningsDate,
    epsActual, epsEstimate, epsSurprisePct,
    revActualB:       revActual   ? revActual / 1e9   : null,
    revEstimateB:     revEstimate ? revEstimate / 1e9 : null,
    revSurprisePct,
    revGrowthYoY,
    grossMarginPct,
    operatingMarginPct,
    freeCashflowB,
    nextQRevEstB,
    nextQEpsEst,
    historicalComps
  };
}

// ─── Main: getEarningsData (tries AV first, then Yahoo) ──────────────────────

async function getEarningsData(ticker) {
  const cacheKey = `earnings_${ticker}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  let result, lastError;

  // Source A: Alpha Vantage (preferred — reliable, predictable quota)
  if (process.env.ALPHA_VANTAGE_KEY) {
    try {
      result = await fetchAlphaVantage(ticker);
    } catch (err) {
      lastError = err;
      console.warn(`[earnings] Alpha Vantage failed for ${ticker}: ${err.message}`);
    }
  }

  // Source B: Yahoo Finance (free, no key needed)
  if (!result) {
    try {
      result = await fetchYahoo(ticker);
    } catch (err) {
      lastError = err;
      console.warn(`[earnings] Yahoo Finance failed for ${ticker}: ${err.message}`);
    }
  }

  if (!result) {
    throw new Error(
      `Cannot fetch earnings for ${ticker}. ` +
      `Get a free key at alphavantage.co and add ALPHA_VANTAGE_KEY to .env. ` +
      `Last error: ${lastError?.message || 'unknown'}`
    );
  }

  // Add computed fields
  result.hoursAgoReported = result.reportedDate
    ? (Date.now() - new Date(result.reportedDate).getTime()) / 3600000
    : null;

  writeCache(cacheKey, result);
  return result;
}

// ─── Build live scenario (mirrors Replay scenario structure) ─────────────────

function buildLiveScenario(ed, tokenPrice) {
  const {
    ticker, symbol, reportedDate,
    epsActual, epsEstimate, epsSurprisePct,
    revActualB, revEstimateB, revSurprisePct, revGrowthYoY,
    grossMarginPct, operatingMarginPct, freeCashflowB,
    nextQRevEstB, nextQEpsEst,
    historicalComps, source
  } = ed;

  const beatMiss = epsSurprisePct > 0 ? 'BEAT' : 'MISS';
  const f  = (v, d = 2) => v != null ? v.toFixed(d) : 'N/A';
  const pct = v => v != null ? `(${v > 0 ? '+' : ''}${f(v, 1)}%)` : '';

  const fundamentalData = [
    `${ticker} Earnings Results — ${reportedDate} [LIVE DATA via ${source}]`,
    ``,
    `EPS: $${f(epsActual)} actual vs $${f(epsEstimate)} estimate → ${epsSurprisePct != null ? `${epsSurprisePct > 0 ? '+' : ''}${f(epsSurprisePct, 1)}% ${beatMiss}` : 'N/A'}`,
    revActualB != null
      ? `Revenue: $${f(revActualB)}B actual${revEstimateB ? ` vs estimate $${f(revEstimateB)}B ${pct(revSurprisePct)}` : ''}`
      : `Revenue: data not available`,
    revGrowthYoY    != null ? `Revenue Growth YoY: ${revGrowthYoY > 0 ? '+' : ''}${f(revGrowthYoY, 1)}%` : null,
    grossMarginPct  != null ? `Gross Margin: ${f(grossMarginPct, 1)}%` : null,
    operatingMarginPct != null ? `Operating Margin: ${f(operatingMarginPct, 1)}%` : null,
    freeCashflowB   != null ? `Free Cash Flow: $${f(freeCashflowB)}B` : null,
    (nextQRevEstB || nextQEpsEst) ? `` : null,
    nextQRevEstB != null ? `Next Quarter Revenue Estimate: $${f(nextQRevEstB)}B` : null,
    nextQEpsEst  != null ? `Next Quarter EPS Estimate: $${f(nextQEpsEst)}` : null,
  ].filter(Boolean).join('\n');

  const sentimentData = [
    `${ticker} Earnings Sentiment Context — ${reportedDate} [LIVE]`,
    ``,
    `EPS surprise: ${epsSurprisePct != null ? `${epsSurprisePct > 0 ? '+' : ''}${f(epsSurprisePct, 1)}% ${beatMiss}` : 'N/A'}`,
    revSurprisePct != null ? `Revenue surprise: ${revSurprisePct > 0 ? '+' : ''}${f(revSurprisePct, 1)}%` : null,
    revGrowthYoY   != null ? `Revenue trajectory: ${revGrowthYoY > 0 ? '+' : ''}${f(revGrowthYoY, 1)}% YoY` : null,
    grossMarginPct != null ? `Gross margin: ${f(grossMarginPct, 1)}%` : null,
    ``,
    `Real-time earnings call transcript not yet parsed.`,
    `Based on the quantitative results and your knowledge of ${ticker}'s management patterns, infer:`,
    `1. Management tone confidence level (confident vs defensive, given ${epsSurprisePct > 0 ? 'beat' : 'miss'} magnitude)`,
    `2. Risk language density typical for this outcome`,
    `3. "Future promise" vs "current reality" ratio in ${ticker}'s typical communication`,
    `4. Implied guidance quality based on EPS/revenue trajectory`
  ].filter(Boolean).join('\n');

  return {
    id: `live_${ticker.toLowerCase()}_${Date.now()}`,
    name: `${ticker} 实时财报 (${reportedDate}) 🔴 LIVE`,
    ticker,
    symbol,
    tokenPrice: tokenPrice || 100,
    epsActual,
    epsEstimate,
    epsSuprise: epsSurprisePct || 0,
    revActualB,
    revEstimateB,
    revSurprisePct,
    ivCrushRisk: false,  // computed from real Bitget candles in pipeline
    fundamentalData,
    sentimentData,
    historicalComps: historicalComps?.length > 0 ? historicalComps : [
      { event: `${ticker} prior quarter`, surprise: 'N/A', priceChange4h: 'N/A (live mode)' }
    ],
    candles: [],
    summary: {
      headline: `${ticker} 实时财报分析 (LIVE)`,
      eps: `EPS $${f(epsActual)} vs 预期 $${f(epsEstimate)} ${pct(epsSurprisePct)}`,
      revenue: revActualB != null
        ? `营收 $${f(revActualB)}B${revEstimateB ? ` vs 预期 $${f(revEstimateB)}B ${pct(revSurprisePct)}` : ''}`
        : '营收数据获取中',
      guidance: nextQRevEstB ? `下季度营收预期 $${f(nextQRevEstB)}B` : '实时 DeepSeek AI 分析中...'
    },
    isLive: true,
    reportedDate,
    dataSource: source
  };
}

// ─── Earnings calendar ────────────────────────────────────────────────────────

async function getEarningsCalendar() {
  const results = [];
  await Promise.allSettled(
    TRACKED_TICKERS.map(async ticker => {
      try {
        const d = await getEarningsData(ticker);
        const h = d.hoursAgoReported;
        results.push({
          ticker,
          symbol:          TICKER_TO_SYMBOL[ticker],
          reportedDate:    d.reportedDate,
          nextEarningsDate: d.nextEarningsDate,
          epsSurprisePct:  d.epsSurprisePct,
          revSurprisePct:  d.revSurprisePct,
          hoursAgoReported: h != null ? Math.round(h) : null,
          inMomentumWindow: h != null && h >= 0 && h < 4,
          isRecent:         h != null && h >= 0 && h < 24 * 3,
          daysUntilNext:    d.nextEarningsDate
            ? Math.ceil((new Date(d.nextEarningsDate) - Date.now()) / 86400000)
            : null,
          dataSource: d.source
        });
      } catch (err) {
        results.push({ ticker, symbol: TICKER_TO_SYMBOL[ticker], error: err.message });
      }
    })
  );
  return results.sort((a, b) => {
    if (a.inMomentumWindow && !b.inMomentumWindow) return -1;
    if (!a.inMomentumWindow && b.inMomentumWindow) return 1;
    return (a.hoursAgoReported ?? Infinity) - (b.hoursAgoReported ?? Infinity);
  });
}

module.exports = {
  getEarningsData,
  buildLiveScenario,
  getEarningsCalendar,
  TICKER_TO_SYMBOL,
  TRACKED_TICKERS
};
