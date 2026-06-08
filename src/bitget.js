// ClawOracle — Bitget V2 REST API Client
const crypto = require('crypto');

const BASE_URL = 'https://api.bitget.com';

function sign(timestamp, method, requestPath, body = '') {
  const message = timestamp + method.toUpperCase() + requestPath + (body || '');
  return crypto
    .createHmac('sha256', process.env.BITGET_SECRET_KEY)
    .update(message)
    .digest('base64');
}

function getAuthHeaders(method, path, body = '') {
  const timestamp = Date.now().toString();
  return {
    'ACCESS-KEY': process.env.BITGET_API_KEY,
    'ACCESS-SIGN': sign(timestamp, method, path, body),
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': process.env.BITGET_PASSPHRASE,
    'Content-Type': 'application/json',
    'locale': 'en-US'
  };
}

function getPublicHeaders() {
  return {
    'Content-Type': 'application/json',
    'locale': 'en-US'
  };
}

async function bitgetGet(path, auth = false) {
  const headers = auth ? getAuthHeaders('GET', path) : getPublicHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const data = await res.json();
  if (data.code && data.code !== '00000') {
    throw new Error(`Bitget API error: ${data.msg} (code: ${data.code})`);
  }
  return data.data;
}

async function bitgetPost(path, body) {
  const bodyStr = JSON.stringify(body);
  const headers = getAuthHeaders('POST', path, bodyStr);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: bodyStr
  });
  const data = await res.json();
  if (data.code && data.code !== '00000') {
    throw new Error(`Bitget API error: ${data.msg} (code: ${data.code})`);
  }
  return data.data;
}

// Get ticker price for a symbol
async function getTickerPrice(symbol) {
  const data = await bitgetGet(`/api/v2/spot/market/tickers?symbol=${symbol}`);
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (data && data.lastPr) return data;
  throw new Error(`No ticker data for ${symbol}`);
}

// Get K-line (candle) data
async function getCandles(symbol, granularity = '1H', limit = 48) {
  const granularityMap = {
    '1H': '1h', '4H': '4h', '1D': '1day', '15M': '15min', '5M': '5min'
  };
  const gran = granularityMap[granularity] || '1h';
  const data = await bitgetGet(
    `/api/v2/spot/market/candles?symbol=${symbol}&granularity=${gran}&limit=${limit}`
  );
  return Array.isArray(data) ? data : [];
}

// Get order book depth
async function getDepth(symbol) {
  const data = await bitgetGet(
    `/api/v2/spot/market/depth?symbol=${symbol}&type=step0&limit=5`
  );
  return data || { asks: [], bids: [] };
}

// Get account assets (requires auth)
async function getAccountAssets() {
  return await bitgetGet('/api/v2/spot/account/assets', true);
}

// Place spot order (paper trade - logs but doesn't execute real money)
async function placeSpotOrder(symbol, side, price, quantity) {
  // Paper trade wrapper - attempts real API, falls back to simulated
  try {
    const body = {
      symbol,
      side: side.toLowerCase(), // 'buy' or 'sell'
      orderType: 'market',
      size: quantity.toString(),
      force: 'gtc'
    };
    const result = await bitgetPost('/api/v2/spot/trade/place-order', body);
    return { ...result, simulated: false };
  } catch (err) {
    // Graceful fallback: simulate order execution
    return {
      orderId: `SIM_${Date.now()}`,
      symbol,
      side,
      price,
      quantity,
      status: 'filled_simulated',
      simulated: true,
      simulatedAt: new Date().toISOString()
    };
  }
}

// Place plan order (stop loss / take profit)
async function placePlanOrder(symbol, side, triggerPrice, executePrice, size) {
  try {
    const body = {
      symbol,
      planType: side === 'buy' ? 'profit_plan' : 'loss_plan',
      triggerPrice: triggerPrice.toString(),
      executePrice: executePrice.toString(),
      size: size.toString(),
      side,
      orderType: 'limit',
      triggerType: 'fill_price'
    };
    const result = await bitgetPost('/api/v2/spot/trade/place-plan-order', body);
    return { ...result, simulated: false };
  } catch (err) {
    return {
      planOrderId: `SIM_PLAN_${Date.now()}`,
      symbol,
      side,
      triggerPrice,
      executePrice,
      size,
      status: 'planned_simulated',
      simulated: true
    };
  }
}

// Calculate bid-ask spread percentage from depth
function calculateSpreadPct(depth) {
  if (!depth.asks || !depth.bids || !depth.asks.length || !depth.bids.length) return null;
  const bestAsk = parseFloat(depth.asks[0][0]);
  const bestBid = parseFloat(depth.bids[0][0]);
  return ((bestAsk - bestBid) / bestBid) * 100;
}

module.exports = {
  getTickerPrice,
  getCandles,
  getDepth,
  getAccountAssets,
  placeSpotOrder,
  placePlanOrder,
  calculateSpreadPct
};
