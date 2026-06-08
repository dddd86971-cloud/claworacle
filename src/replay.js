// ClawOracle Replay Mode — Historical earnings scenarios for demo
// All data based on real events from 2024

const scenarios = {
  nvda_q3_2024: {
    id: 'nvda_q3_2024',
    name: 'NVDA FY2025 Q3 财报 (2024-11-20)',
    ticker: 'NVDA',
    symbol: 'NVDAONUSDT',
    tokenPrice: 148.50,
    epsActual: 0.81,
    epsEstimate: 0.75,
    epsSuprise: 8.0,
    revenueActual: 35.08,
    revenueEstimate: 33.17,
    revenueSurprisePct: 5.76,
    ivCrushRisk: false,
    summary: {
      headline: 'NVDA Q3 FY2025 大幅超预期',
      eps: 'EPS $0.81 vs 预期 $0.75（+8.0%）',
      revenue: '营收 $35.08B vs 预期 $33.17B（+5.76%）',
      guidance: 'Q4 指引 $37.5B ± 2%，高于分析师共识 $37.07B'
    },
    fundamentalData: `NVIDIA Corporation Q3 FY2025 Earnings Results

Revenue: $35.08 billion (+93.6% YoY, +17.2% QoQ)
  - Data Center: $30.77 billion (+112% YoY) vs consensus $28.53B
  - Gaming: $3.28 billion (+14.7% YoY) vs consensus $3.09B
  - Professional Visualization: $486 million

Non-GAAP EPS: $0.81 vs consensus estimate $0.75 (+8.0% beat)
GAAP EPS: $0.78

Gross Margin: 74.6% (Non-GAAP), vs prior quarter 75.1%
Operating Income: $21.87 billion (Non-GAAP)

Q4 FY2025 Guidance:
  Revenue: $37.5 billion ± 2% (consensus: $37.07B)
  Gross Margin: 73.5% ± 50bps (Non-GAAP)

Key metric: Blackwell GPU revenue ramping faster than expected.
Hopper demand remains strong while Blackwell transitions.`,

    sentimentData: `From NVIDIA CEO Jensen Huang's prepared remarks:

"The age of AI is in full steam. Demand for Blackwell is extraordinary."

"We shipped in volume Blackwell AI supercomputers — the world's most capable systems
for training and inference. Blackwell is in full production."

"We expect demand will exceed supply well into next year."

"Our data center business is achieving double-digit sequential growth as global
cloud infrastructure spending accelerates dramatically."

CFO Commentary: "We are extremely pleased with our execution. Blackwell ramp is
ahead of schedule. Customer demand visibility has never been clearer."

Management tone shift vs Q2: More assertive, fewer hedging phrases.
Risk language frequency: Low — "uncertain" used 1x vs 4x last quarter.
"Demand" referenced 23 times vs 15 times in Q2.`,

    historicalComps: [
      { event: 'NVDA Q2 FY2025 (Aug 2024)', surprise: '+8.5%', priceChange4h: '+4.8%' },
      { event: 'NVDA Q1 FY2025 (May 2024)', surprise: '+10.2%', priceChange4h: '+7.1%' },
      { event: 'NVDA Q4 FY2024 (Feb 2024)', surprise: '+12.4%', priceChange4h: '+9.2%' },
    ],

    candles: generateCandles(148.50, 24, 'bullish'),

    mockAgentAnalysis: {
      fundamental: `分析 NVDA Q3 FY2025 财报基本面：

EPS: $0.81 实际 vs $0.75 预期，超预期 **+8.0%**，显著高于科技股平均超预期幅度（3-5%）。

数据中心营收 $30.77B，同比增长 +112%，超分析师预期 $28.53B 达 +7.9%。这是本季度最强信号——机构预期低估了 Blackwell 的早期渗透速度。

Q4 指引 $37.5B 高于共识 $37.07B，且附带正面毛利率指引（73.5%），未出现常见的"保守指引"现象。

综合评估：全面超预期，无隐藏弱点。数据中心加速增长且可持续性强。

SCORE: +88`,

      sentiment: `分析 NVDA 管理层语气和财报情绪信号：

Jensen Huang 本季度用词显著升温。"extraordinary demand"出现2次，上季度为0次。"full production" 表明 Blackwell 供应瓶颈正在缓解，而非放大。

关键句："We expect demand will exceed supply well into next year" — 这是供需持续失衡的直接承认，意味着 ASP（平均售价）压力极小，定价权完整。

管理层风险用语减少75%（"uncertain" 1次 vs 上季度4次），CFO措辞"never been clearer"属于历史罕见的强烈正面表述。

语气变化方向：明确升温，无疲态信号。

SCORE: +82`,

      technical: `分析 NVDAONUSDT 技术面与历史财报后走势：

历史同类事件（超预期 ≥8%）分析：
• Q2 FY2025: +4.8%（4小时）
• Q1 FY2025: +7.1%（4小时）
• Q4 FY2024: +9.2%（4小时）
→ 历史平均 4 小时涨幅：+7.0%，样本方向一致性 100%。

当前 NVDAONUSDT @ $148.50，处于近期盘整区间上沿 $145-$150。
财报前 48 小时价格基本横盘（+0.8%），说明市场"预期定价"程度较低，上涨空间更充分。

IV Crush 风险：低，盘前期权活动未异常放大。

SCORE: +75`,

      risk: `汇总三路分析师意见：

基本面分析师: +88（强烈看多）
情绪分析师: +82（强烈看多）
技术分析师: +75（看多）

方向一致性：100%（三路全部看多）
分歧程度：分数差距13分，属正常范围
IV Crush 风险：未检测到，放行

情绪温度计最终读数计算：加权平均 = (88×0.40 + 82×0.35 + 75×0.25) = +82

决策：信号强度 82 >> 阈值 60，方向一致，批准执行满仓80%。

FINAL_SCORE: +82
ACTION: BUY
POSITION_SIZE: 80
REASONING: 三路信号高度一致，基本面超预期幅度强，历史同类事件4小时胜率100%，IV Crush风险低，批准做多，仓位80%。`
    }
  },

  tsla_q2_2024: {
    id: 'tsla_q2_2024',
    name: 'TSLA Q2 2024 财报 (2024-07-23)',
    ticker: 'TSLA',
    symbol: 'TSLAONUSDT',
    tokenPrice: 232.00,
    epsActual: 0.52,
    epsEstimate: 0.62,
    epsSuprise: -16.1,
    revenueActual: 25.18,
    revenueEstimate: 24.77,
    revenueSurprisePct: 1.65,
    ivCrushRisk: true,
    summary: {
      headline: 'TSLA Q2 2024 EPS 大幅不及预期',
      eps: 'EPS $0.52 vs 预期 $0.62（-16.1%）',
      revenue: '营收 $25.18B vs 预期 $24.77B（小幅超预期）',
      guidance: '毛利率 17.9% vs 预期 18.7%，连续第三季度下滑'
    },
    fundamentalData: `Tesla Q2 2024 Earnings Results

Revenue: $25.18 billion (+2.3% YoY) — small beat vs $24.77B estimate
Automotive Revenue: $19.88 billion (-7% YoY, vs $20.30B estimate — MISS)

Non-GAAP EPS: $0.52 vs estimate $0.62 (-16.1% MISS)
GAAP EPS: $0.42

Gross Margin: 17.9% vs estimate 18.7% — MISS (third consecutive decline)
Operating Income: $1.60B (-33% YoY)
Free Cash Flow: $1.34B (positive, but -47% YoY)

Energy Generation & Storage: $3.01B (+100% YoY) — positive outlier
Services: $2.61B (+21% YoY)

Vehicle deliveries: 443,956 units vs estimate 445,000 (slight miss)
Cybertruck: Positive contribution starting, but minimal scale

Q3 2024 Guidance: No specific revenue guidance provided
Management flagged "uncertain macroeconomic environment"`,

    sentimentData: `Tesla CEO Elon Musk Q2 2024 Earnings Call Key Statements:

"We're in a difficult macroeconomic environment with high interest rates."

"The robotaxi product will be unveiled on August 8th." (key attention diversion)

"We continue to invest heavily in AI and autonomy, which pressures near-term margins."

"Price reductions were necessary to maintain volume in a competitive market."

CFO Commentary: "Margin pressure reflects deliberate strategic choices,
not fundamental business deterioration."

Management tone: Defensive, with repeated deflection to "future optionality"
(FSD, Robotaxi, Optimus robot). Classic "look over there" communication pattern.

Risk language: "uncertain" 6x, "challenging" 4x, "pressure" 8x
Future-forward promises: 7 distinct forward-looking initiatives mentioned
Tone vs Q1: Noticeably more defensive, less specific on near-term recovery path.`,

    historicalComps: [
      { event: 'TSLA Q1 2024 (Apr 2024)', surprise: '-4.1%', priceChange4h: '-3.2%' },
      { event: 'TSLA Q4 2023 (Jan 2024)', surprise: '-10.5%', priceChange4h: '-8.7%' },
      { event: 'TSLA Q2 2023 (Jul 2023)', surprise: '-15.2%', priceChange4h: '-6.1%' },
    ],

    candles: generateCandles(232.00, 24, 'bearish'),

    mockAgentAnalysis: {
      fundamental: `分析 TSLA Q2 2024 财报基本面：

EPS：$0.52 实际 vs $0.62 预期，**不及预期 -16.1%**，是近12个季度最大幅度缺口。

更关键的是毛利率：17.9%，连续第三季度下滑（20.2% → 19.3% → 17.9%），方向性恶化信号明确。汽车业务营收同比下滑 -7%，说明降价策略无法抵消需求疲软。

唯一亮点：储能业务 $3.01B（+100% YoY），但占总营收仅12%，无法对冲主业下滑。

指引：缺乏具体营收指引，管理层仅提及"宏观不确定性"，这是典型的回避信号——当管理层不给指引时，通常是因为他们自己也不确定。

综合评估：EPS 重大失误 + 毛利率持续恶化 + 指引缺失 = 强烈看空信号。

SCORE: -78`,

      sentiment: `分析 TSLA 管理层语气和财报情绪信号：

Musk 本次电话会有大量注意力转移行为。提及 Robotaxi（8月8日发布）、FSD进展、Optimus机器人等7个未来方向，明显超过历史同期（通常3-4个）。这种"未来多点布局"话术在业绩承压时是典型的防御策略。

风险语言密度极高："uncertain"出现6次、"challenging"4次、"pressure"8次，是过去8季度最高水平。CFO"deliberate strategic choices"这一表述含蓄承认了问题的结构性特征。

没有管理层对下季度毛利率恢复给出任何承诺，这在以往强季度中从未发生。

管理层信心指数：低，措辞防御性强，正面表述缺乏具体性。

SCORE: -71`,

      technical: `分析 TSLAONUSDT 技术面与历史财报后走势：

历史同类事件（EPS 不及预期 ≥10%）分析：
• Q4 2023: -8.7%（4小时）
• Q2 2023: -6.1%（4小时）
• Q1 2024 (小幅miss): -3.2%（4小时）
→ 历史 EPS 重大失误后 4 小时平均跌幅：-6.0%，方向一致性 100%。

当前 TSLAONUSDT @ $232.00，财报前5天已上涨约 +4.8%（存在预期过度定价）。
IV Crush 风险标记为 HIGH：期权市场在财报前有明显 IV 抬升，实际结果公布后 IV 将快速塌陷，初期可能出现"利空不跌"短暂反应。

鉴于 IV Crush 风险，建议将信号强度折半处理。

SCORE: -65`,

      risk: `汇总三路分析师意见：

基本面分析师: -78（强烈看空）
情绪分析师: -71（强烈看空）
技术分析师: -65（看空，已应用IV Crush折减）

方向一致性：100%（三路全部看空）
IV Crush 风险：HIGH — 按规则信号强度折半

原始加权均值：(78×0.40 + 71×0.35 + 65×0.25) = -73
IV Crush 折减50%后：-73 × 0.5 = -37

注：IV Crush 折减后信号强度 37 < 阈值 60。
→ 防御优先，暂缓执行，等待 IV Crush 消化后（约30-60分钟）再评估。

FINAL_SCORE: -37
ACTION: WAIT
POSITION_SIZE: 0
REASONING: IV Crush风险高，原始看空信号被折减至37，低于执行阈值60。建议等待期权IV消化（约30-60分钟）后重新评估，届时信号可能重新激活做空策略。`
    }
  },

  aapl_q4_2024: {
    id: 'aapl_q4_2024',
    name: 'AAPL Q4 FY2024 财报 (2024-10-31)',
    ticker: 'AAPL',
    symbol: 'AAPLONUSDT',
    tokenPrice: 225.50,
    epsActual: 1.64,
    epsEstimate: 1.60,
    epsSuprise: 2.5,
    revenueActual: 94.93,
    revenueEstimate: 94.58,
    revenueSurprisePct: 0.37,
    ivCrushRisk: true,
    summary: {
      headline: 'AAPL Q4 FY2024 小幅超预期，市场反应平淡',
      eps: 'EPS $1.64 vs 预期 $1.60（+2.5%）',
      revenue: '营收 $94.93B vs 预期 $94.58B（+0.37%）',
      guidance: 'iPhone 中国销售同比下滑，AI 功能尚未显现营收贡献'
    },
    fundamentalData: `Apple Q4 FY2024 Earnings Results

Revenue: $94.93 billion (+6.1% YoY) vs estimate $94.58B — slight beat
iPhone: $46.22B vs estimate $45.96B (+0.6% beat, +5.5% YoY)
Mac: $7.74B vs estimate $7.47B
Services: $24.97B (+11.9% YoY, record) vs estimate $25.27B — slight miss
Wearables, Home: $9.04B (-3% YoY) — miss

EPS (Non-GAAP): $1.64 vs $1.60 estimate (+2.5% beat)
Gross Margin: 46.2% vs 45.2% estimate — beat

China revenue: $15.03B vs estimate $16.80B — MISS (-10.5%)
Apple Intelligence (AI) features: Initial rollout, no material revenue contribution yet

Q1 FY2025 Guidance:
Revenue: +$89-93B range (vs consensus $90.7B) — roughly in-line
Gross Margin: 46.5-47.5%`,

    sentimentData: `Apple CEO Tim Cook Q4 FY2024 Commentary:

"We are very excited about Apple Intelligence. The initial response from customers
has been overwhelmingly positive."

"Services reached an all-time high with 1 billion paid subscriptions."

"We're seeing strong performance across our product lineup."

On China weakness: "The market is competitive. We remain committed to our
long-term opportunity in China."

Management tone: Measured confidence, consistent with Apple's typical communication style.
AI narrative present but not over-promised. China weakness acknowledged but minimized.

Risk language: Low frequency — "competitive" 3x, "uncertain" 0x
Forward-looking: Primarily AI feature rollout timeline, no aggressive growth promises
Tone vs Q3: Essentially flat, slight uptick in AI enthusiasm`,

    historicalComps: [
      { event: 'AAPL Q3 FY2024 (Aug 2024)', surprise: '+1.8%', priceChange4h: '+0.7%' },
      { event: 'AAPL Q2 FY2024 (May 2024)', surprise: '+4.4%', priceChange4h: '+2.8%' },
      { event: 'AAPL Q1 FY2024 (Feb 2024)', surprise: '+3.2%', priceChange4h: '-0.4%' },
    ],

    candles: generateCandles(225.50, 24, 'neutral'),

    mockAgentAnalysis: {
      fundamental: `分析 AAPL Q4 FY2024 财报基本面：

EPS 小幅超预期 +2.5%，低于科技大盘均值，属于"符合预期"范畴而非"惊喜"。

结构性问题：中国营收 $15.03B vs 预期 $16.80B，缺口达 -10.5%，是近6季度最大中国区偏差。这不仅影响当季业绩，更对 Q1 指引的可信度产生质疑。

亮点：服务营收创历史新高 $24.97B，但略低于预期（-$0.30B），成长故事出现微裂缝。毛利率 46.2% 超预期，成本控制能力仍强。

Apple Intelligence 功能刚开始推出，暂时没有营收贡献，但这是"期权价值"而非当季催化剂。

综合评估：轻微超预期但有中国隐患，信号偏中性略偏弱。

SCORE: +18`,

      sentiment: `分析 AAPL 管理层语气和财报情绪信号：

Tim Cook 本季度措辞平稳，没有特别兴奋也没有明显防御。对中国疲软的回应是典型的苹果式"我们对长期前景有信心"套话，既不否认问题也不提供解决方案。

Apple Intelligence 提及频率中等，措辞"overwhelmingly positive"来自用户反馈，但缺乏具体数据支撑。管理层刻意回避了对 AI 变现时间表的承诺。

服务业务 1 billion 付费订阅是真实里程碑，但市场早已 priced in。

整体语气：稳定中立，没有超预期的积极信号也没有令人担忧的防御性表述。

SCORE: +12`,

      technical: `分析 AAPLONUSDT 技术面与历史财报后走势：

历史数据显示 AAPL 轻微超预期（+1-4%）的财报后 4 小时走势极为分散：
• Q3 FY2024: +0.7%（EPS beat +1.8%）
• Q2 FY2024: +2.8%（EPS beat +4.4%）
• Q1 FY2024: -0.4%（EPS beat +3.2%）
→ 历史平均：+1.0%，但标准差高，方向不稳定。

当前 AAPLONUSDT @ $225.50，财报前5天已涨约 +2.2%，存在一定预期定价。
IV 水平中等偏高（财报前常见），IV Crush 风险存在。

此类"轻微超预期+结构性隐患"组合历史上价格反应接近随机，无明确方向性优势。

SCORE: +8`,

      risk: `汇总三路分析师意见：

基本面分析师: +18（中性偏多）
情绪分析师: +12（中性）
技术分析师: +8（中性，IV Crush 风险存在）

方向一致性：勉强一致（均偏多但分数极低）
IV Crush 风险：存在，触发折减50%

原始加权均值：(18×0.40 + 12×0.35 + 8×0.25) = +13.4
IV Crush 折减后：+13.4 × 0.5 = +6.7

分析：信号强度 6.7 远低于阈值 60。三路分析师虽方向一致，但信号极弱，在 IV Crush 环境下执行性价比极低。

FINAL_SCORE: +7
ACTION: WAIT
POSITION_SIZE: 0
REASONING: 信号强度7，远低于执行阈值60。中国区营收缺口-10.5%抵消了EPS轻微超预期，IV Crush风险高，整体风险收益比不佳，暂缓执行。`
    }
  }
};

function generateCandles(basePrice, count, trend) {
  const candles = [];
  let price = basePrice;
  const trendMultiplier = trend === 'bullish' ? 1.002 : trend === 'bearish' ? 0.998 : 1.0;

  for (let i = count; i >= 0; i--) {
    const volatility = price * 0.008;
    const change = (Math.random() - 0.5) * volatility * 2 + (price * (trendMultiplier - 1));
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const timestamp = Date.now() - i * 3600000;
    const volume = 10000 + Math.random() * 50000;

    candles.push([timestamp, open.toFixed(4), high.toFixed(4), low.toFixed(4), close.toFixed(4), volume.toFixed(2)]);
    price = close;
  }
  return candles;
}

function listScenarios() {
  return Object.values(scenarios).map(s => ({
    id: s.id,
    name: s.name,
    ticker: s.ticker,
    symbol: s.symbol,
    epsSurprise: s.epsSuprise,
    ivCrushRisk: s.ivCrushRisk
  }));
}

function getReplayScenario(id) {
  return scenarios[id] || scenarios['nvda_q3_2024'];
}

module.exports = { listScenarios, getReplayScenario };
