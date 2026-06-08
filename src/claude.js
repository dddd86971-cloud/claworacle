// ClawOracle — DeepSeek AI Agent Engine (OpenAI-compatible API)
// Uses DeepSeek-V3 (deepseek-chat) with streaming via openai npm package
// Fallback: mock streaming demo mode if no API key

const AGENT_CONFIG = {
  fundamental: {
    name: '基本面分析师',
    emoji: '📊',
    system: `You are a fundamental analyst specializing in US tech stock earnings for Bitget tokenized US stock trading.
Analyze the provided earnings data and output:
1. EPS beat/miss vs consensus (percentage and magnitude)
2. Revenue and gross margin assessment
3. Forward guidance quality (bullish/bearish/neutral)
4. Key metric changes that matter for near-term price action (next 4 hours)

End with a signal score on a new line:
SCORE: [number from -100 to +100]

Keep analysis under 200 words. Be direct and specific. No preamble.`,
    userTemplate: (data) => `Analyze ${data.ticker} earnings:\n\n${data.fundamentalData}`
  },

  sentiment: {
    name: '情绪分析师',
    emoji: '🧠',
    system: `You are a behavioral finance expert analyzing management communication and earnings call sentiment for Bitget tokenized US stock trading.
Analyze:
1. Management tone confidence level (vs prior quarter)
2. Risk language frequency (count hedging words: uncertain/challenging/pressure/headwinds)
3. Hidden signals in word choice and emphasis shifts
4. "Future promise" vs "current reality" ratio in messaging

End with on a new line:
SCORE: [number from -100 to +100]

Under 200 words. Be direct.`,
    userTemplate: (data) => `Analyze ${data.ticker} management sentiment:\n\n${data.sentimentData}`
  },

  technical: {
    name: '技术分析师',
    emoji: '📈',
    system: `You are a technical analyst specializing in post-earnings price action for Bitget tokenized US stocks.
Based on historical comparables and current setup, analyze:
1. Historical pattern: what happened after similar earnings surprises (use exact data provided)
2. Current price momentum heading into the print
3. Key price levels (support/resistance)
4. IV Crush risk assessment and impact

End with on a new line:
SCORE: [number from -100 to +100]

Under 200 words. Be specific about historical data provided.`,
    userTemplate: (data) => `Technical analysis for ${data.ticker}:
Token price: $${data.tokenPrice}
EPS surprise: ${data.epsSuprise}%
Historical comps: ${JSON.stringify(data.historicalComps, null, 2)}
IV Crush Risk: ${data.ivCrushRisk ? 'HIGH' : 'LOW'}`
  },

  risk: {
    name: '风险官',
    emoji: '⚖️',
    system: `You are a risk management officer making final trading decisions for ClawOracle, a Bitget AI trading system.

Given signals from 3 analysts, calculate the final decision using these rules:
- All 3 agree direction: weighted average (fundamental 40%, sentiment 35%, technical 25%)
- 2/3 agree: reduce position by 20%
- Split: reduce by 50% or output WAIT
- IV_CRUSH_RISK HIGH: halve all signal strengths before calculation
- Execution threshold: |final_score| >= 60

Output FORMAT (strictly, no other text):
FINAL_SCORE: [number]
ACTION: [BUY or SELL or WAIT]
POSITION_SIZE: [0-100]
REASONING: [2 sentences max]`,
    userTemplate: (f, s, t, ivCrush) => `
Fundamental Score: ${f.score} — ${f.text.substring(0, 250)}
Sentiment Score: ${s.score} — ${s.text.substring(0, 250)}
Technical Score: ${t.score} — ${t.text.substring(0, 250)}
IV_CRUSH_RISK: ${ivCrush ? 'HIGH' : 'LOW'}

Make your final decision.`
  }
};

// Stream mock analysis character by character (for demo without API key)
async function* streamMockAnalysis(text, delayMs = 18) {
  for (const char of text) {
    yield char;
    if (char === '\n') {
      await new Promise(r => setTimeout(r, 35));
    } else {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// Extract score from agent output text
function extractScore(text) {
  const match = text.match(/SCORE:\s*([+-]?\d+)/i);
  return match ? Math.max(-100, Math.min(100, parseInt(match[1]))) : 0;
}

// Extract risk officer structured output
function extractRiskOutput(text) {
  const scoreMatch  = text.match(/FINAL_SCORE:\s*([+-]?\d+)/i);
  const actionMatch = text.match(/ACTION:\s*(BUY|SELL|WAIT)/i);
  const sizeMatch   = text.match(/POSITION_SIZE:\s*(\d+)/i);
  const reasonMatch = text.match(/REASONING:\s*(.+?)(?:\n|$)/is);

  return {
    finalScore:   scoreMatch  ? parseInt(scoreMatch[1])        : 0,
    action:       actionMatch ? actionMatch[1].toUpperCase()   : 'WAIT',
    positionSize: sizeMatch   ? parseInt(sizeMatch[1])         : 0,
    reasoning:    reasonMatch ? reasonMatch[1].trim()          : text.trim()
  };
}

// Run a single agent with streaming — broadcasts via SSE callback
async function runAgent(agentType, scenarioData, broadcastFn) {
  const config = AGENT_CONFIG[agentType];
  broadcastFn({ type: 'agent_start', agent: agentType, name: config.name });

  const hasApiKey = !!process.env.DEEPSEEK_API_KEY;
  let fullText = '';

  if (hasApiKey) {
    // ── Real DeepSeek API (OpenAI-compatible streaming) ──────────────────────
    try {
      const OpenAI = require('openai');
      const client = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com'
      });

      const userContent = agentType === 'risk'
        ? config.userTemplate(
            { score: scenarioData.fundamentalScore, text: scenarioData.fundamentalText || '' },
            { score: scenarioData.sentimentScore,   text: scenarioData.sentimentText   || '' },
            { score: scenarioData.technicalScore,   text: scenarioData.technicalText   || '' },
            scenarioData.ivCrushRisk
          )
        : config.userTemplate(scenarioData);

      const stream = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: config.system },
          { role: 'user',   content: userContent   }
        ],
        max_tokens: 450,
        temperature: 0.3,
        stream: true
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          fullText += token;
          broadcastFn({ type: 'agent_token', agent: agentType, token });
        }
      }
    } catch (err) {
      console.warn(`DeepSeek API error for ${agentType}:`, err.message);
      fullText = ''; // fall through to mock
    }
  }

  // ── Mock fallback (no key or API error) ──────────────────────────────────
  if (!fullText) {
    const mockText = scenarioData.mockAnalysis?.[agentType]
      || `${config.name}: 分析中...\n\nSCORE: 0`;

    for await (const char of streamMockAnalysis(mockText)) {
      fullText += char;
      broadcastFn({ type: 'agent_token', agent: agentType, token: char });
    }
  }

  const score = extractScore(fullText);
  broadcastFn({ type: 'agent_done', agent: agentType, score, fullText });
  return { agent: agentType, score, fullText };
}

// Run all 4 agents: 3 analysts in parallel, then risk officer
async function runFullAgentPipeline(scenarioData, broadcastFn) {
  const mode = process.env.DEEPSEEK_API_KEY ? '🧠 DeepSeek AI模式' : '🎬 Demo模式';
  broadcastFn({
    type: 'pipeline_start',
    message: `🤖 四路 Agent 并行启动 — ${mode}`,
    mode
  });

  // Stage 1: 3 analysts in parallel (Promise.all)
  const [fundamentalResult, sentimentResult, technicalResult] = await Promise.all([
    runAgent('fundamental', scenarioData, broadcastFn),
    runAgent('sentiment',   scenarioData, broadcastFn),
    runAgent('technical',   scenarioData, broadcastFn)
  ]);

  broadcastFn({
    type: 'analysts_complete',
    scores: {
      fundamental: fundamentalResult.score,
      sentiment:   sentimentResult.score,
      technical:   technicalResult.score
    },
    message: '✅ 三路分析完成 → 风险官汇总中...'
  });

  // Stage 2: Risk officer synthesizes
  const riskInput = {
    ...scenarioData,
    fundamentalScore: fundamentalResult.score,
    fundamentalText:  fundamentalResult.fullText,
    sentimentScore:   sentimentResult.score,
    sentimentText:    sentimentResult.fullText,
    technicalScore:   technicalResult.score,
    technicalText:    technicalResult.fullText,
    mockAnalysis: { risk: scenarioData.mockAnalysis?.risk }
  };

  const riskResult = await runAgent('risk', riskInput, broadcastFn);
  const parsed = extractRiskOutput(riskResult.fullText);

  broadcastFn({ type: 'risk_complete', ...parsed, rawText: riskResult.fullText });

  return {
    fundamental: fundamentalResult,
    sentiment:   sentimentResult,
    technical:   technicalResult,
    risk:        { ...riskResult, ...parsed }
  };
}

module.exports = {
  runFullAgentPipeline,
  runAgent,
  extractScore,
  extractRiskOutput,
  AGENT_CONFIG
};
