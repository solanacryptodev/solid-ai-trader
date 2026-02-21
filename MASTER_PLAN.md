# Solana Second-Pump Trading Bot - Master Plan & Context Document

## Project Overview

**Goal:** Build an automated trading system that identifies and capitalizes on "second pump" opportunities in Solana memecoins by filtering for established tokens (400-600 holders, 1+ hour old) that show consolidation patterns after their initial pump.

**Core Strategy:** NOT chasing fresh launches or first pumps. Instead, targeting tokens that have survived the initial rug zone and are setting up for a second wave of buying.

**Key Insight:** Tokens with 400-500 holders that enter consolidation often experience second pumps with identifiable patterns. This is a less crowded opportunity than launch sniping.

---

## Why This Strategy Works

### The Second Pump Advantage
- **Survival bias works in our favor:** Tokens at 400-600 holders have already survived the "rug zone"
- **Better information:** We have price history, holder patterns, and established liquidity
- **Different competition:** Not racing sniper bots, competing with human traders and slower systems
- **More time to analyze:** Can use time series models (Chronos) effectively since we're not chasing microsecond execution

### Realistic Performance Targets
- **Win rate goal:** 45-55% (achievable with good filters)
- **Average win:** +30-40% (second pumps can be substantial)
- **Average loss:** -10-15% (tighter stops, better entries)
- **Risk/Reward:** ~2.5:1 to 3:1
- **Monthly return target:** 5-10% (conservative, sustainable)

---

## Current Status

### What We Have
- Basic filter using Jupiter's `/recent` API
- Fetching tokens from Solana network
- Foundation for token discovery
- Basic Social Media analysis using Twitter API
- Initial Implementation of LangChain's DeepAgent architecture

### What We're Building Next
- Reference IMPLEMENTATION.md for the full implementation plan

### Next Steps (Phased Approach)
1. **Phase 1 (Week 1-2):** Filter system + manual trading + data collection (partially complete minus manual trading)
2. **Phase 2 (Week 3-4):** Pattern detection + scoring system + alerts (incomplete)
3. **Phase 3 (Month 2):** Chronos ML model integration + semi-automation (incomplete)
4. **Phase 4 (Month 3+):** Full automation with oversight (incomplete)

---

## Technical Architecture

### Core Technology Stack

**Primary APIs:**
- **Helius** - Token discovery, holder tracking, real-time monitoring
  - Start with Growth plan ($49/mo for 5M credits)
  - Webhooks for real-time updates (can start with polling)
  - Enhanced Transaction API for DEX swap parsing
  - Token Metadata API for holder counts
  
- **Jupiter** - Price data, liquidity info, trade execution
  - Price API for current token prices
  - Quote API for slippage estimates
  - Swap API for executing trades
  - 100% free, no API key required

**Supporting Services:**
- **Birdeye API** or **DexScreener** - Historical price data (OHLCV)
  - Needed for Chronos model and consolidation detection
  - Birdeye Premium: $99/mo or DexScreener: $50/mo
  - Can also build your own time series database

- **RugCheck API** - Security validation (free)
- **Solscan API** - LP lock status, holder distribution (free tier OK)

**Infrastructure:**
- **Database:** PostgreSQL with TimescaleDB extension (for time series data)
- **Caching:** Redis (optional, for real-time state)
- **Hosting:** Basic VPS ($20/mo) - don't need ultra-low latency

### What We DON'T Need
- ❌ Jito bundles (not sniping launches)
- ❌ Ultra-low latency RPC (seconds matter, not milliseconds)
- ❌ Complex MEV protection (less critical for second pumps)
- ❌ Websocket connections initially (polling is fine)

---

## Data Architecture

### The Anti-Complexity Philosophy

**Core Principle:** Track ONLY what predicts second pumps. Ignore dashboard noise from platforms like GMGN.

### Minimal Essential Data Points

**1. Holder Metrics** (Critical)
- Current holder count
- Holder growth rate (1hr, 6hr, 24hr deltas)
- Top 10 holder concentration (>60% = red flag)

**2. Price Action** (Critical)
- Current price
- 24hr high (to identify first pump peak)
- Consolidation range (support/resistance levels)
- Volume trend (looking for decline → spike pattern)

**3. Liquidity Health** (Critical)
- Total liquidity in pool (minimum $8k)
- LP token status (burned/locked = good)

**4. Security & Age** (Critical)
- Token age (must be >1 hour)
- Mint/freeze authority status (renounced = good)
- Basic rug check validation

**5. Market Cap** (Filter criteria)
- Minimum $10k market cap

**6. Social Momentum** (Phase 2 - Nice to Have)
- Twitter mention count change (1hr vs 6hr)
- Just volume change, not sentiment analysis initially

**7. Whale Activity** (Phase 3 - Nice to Have)
- Large buys >$1k in last 30min
- Simple flag, not detailed tracking

### Database Schema

**tokens table:**
```sql
CREATE TABLE tokens (
    token_address VARCHAR(44) PRIMARY KEY,
    symbol VARCHAR(20),
    name VARCHAR(100),
    creation_time TIMESTAMP,
    current_holders INTEGER,
    liquidity_usd DECIMAL(15,2),
    market_cap_usd DECIMAL(15,2),
    security_flags JSONB,
    last_updated TIMESTAMP,
    status VARCHAR(20) -- 'monitoring', 'consolidating', 'pumping', 'exited'
);
```

**price_snapshots table (TimescaleDB hypertable):**
```sql
CREATE TABLE price_snapshots (
    token_address VARCHAR(44),
    timestamp TIMESTAMP,
    price DECIMAL(20,10),
    volume_1h DECIMAL(15,2),
    holder_count INTEGER,
    liquidity_usd DECIMAL(15,2),
    PRIMARY KEY (token_address, timestamp)
);
```

**trades table:**
```sql
CREATE TABLE trades (
    trade_id SERIAL PRIMARY KEY,
    token_address VARCHAR(44),
    entry_time TIMESTAMP,
    entry_price DECIMAL(20,10),
    position_size_usd DECIMAL(10,2),
    exit_time TIMESTAMP,
    exit_price DECIMAL(20,10),
    profit_loss_usd DECIMAL(10,2),
    profit_loss_pct DECIMAL(6,2),
    exit_reason VARCHAR(50), -- 'take_profit', 'stop_loss', 'timeout', 'manual'
    notes TEXT
);
```

### Data We're NOT Tracking

- ❌ Real-time transaction feeds
- ❌ Detailed holder wallet analysis
- ❌ Token creator history
- ❌ Related token networks
- ❌ Every DEX the token trades on
- ❌ 20 different technical indicators
- ❌ Live chat/comments

---

## The Scoring System

### Composite Score (0-10 scale)

**Weighted Factors:**
- ✅ Holders 400-600: **+2 points**
- ✅ Holder growth accelerating: **+2 points**
- ✅ Pullback 25-40% from 24h peak: **+2 points**
- ✅ Consolidation duration 1-3 hours: **+1 point**
- ✅ Liquidity >$8k: **+1 point**
- ✅ Security checks pass (renounced, LP locked): **+1 point**
- ✅ Volume increasing (vs 6hr average): **+1 point**

**Interpretation:**
- **Score 8-10:** Strong candidate - enter on breakout
- **Score 6-7:** Watch closely
- **Score <6:** Skip

**Note:** Chronos model will eventually adjust these weights based on what actually predicts profitable trades.

---

## Pattern Recognition: What We're Looking For

### Second Pump Setup Characteristics

**Price Pattern:**
1. Clear first pump (2-10x move)
2. Pullback of 25-40% from peak
3. Consolidation (sideways price action) for 1-3 hours
4. Volume declining during consolidation
5. Volume spike signaling breakout

**Holder Pattern:**
1. Holders continuing to grow (or stable) during consolidation
2. NOT declining holder count (distribution = bad)
3. Acceleration in holder growth rate = bullish

**Liquidity Pattern:**
1. Liquidity NOT being pulled during consolidation
2. LP tokens still locked/burned
3. No whale dumps during quiet period

**Triggers for Second Pump:**
- Consolidation breakout (price breaks above resistance)
- Increasing holder velocity
- Social re-ignition (Twitter mentions picking up)
- Whale re-entry
- Exchange/platform listings

### Red Flags to Avoid

Even at 400-500 holders:
- ❌ Dead cat bounce (weak volume on attempted pump)
- ❌ Coordinated pump groups (check holder timing patterns)
- ❌ Liquidity already removed
- ❌ Top 10 holders own >60% (distribution risk)
- ❌ Multiple failed breakout attempts (3+ failed pumps = skip)
- ❌ Declining holder count during consolidation

---

## Implementation Phases

### Phase 1: Foundation & Manual Trading (Week 1-2)

**Goals:**
- Build filtering system (Helius + Jupiter)
- Set up database and data collection
- Create simple dashboard/alerts
- Manually trade to learn patterns
- Collect data for model training

**Deliverables:**
- [ ] Helius integration for token discovery
- [ ] Jupiter integration for price/liquidity
- [ ] Database schema implemented
- [ ] Polling loop (every 60 seconds) to scan tokens
- [ ] Basic security checks (RugCheck integration)
- [ ] Simple dashboard showing filtered tokens
- [ ] Manual trade logging system

**Testing Approach:**
- Paper trading only OR
- Tiny positions ($25-50) if using real capital
- Focus on learning, not profits

### Phase 2: Pattern Detection & Scoring (Week 3-4)

**Goals:**
- Implement consolidation pattern detection
- Build scoring system
- Add automated alerts
- Semi-automated entry signals

**Deliverables:**
- [ ] Historical price analysis (identify first pump peak, pullback %, consolidation time)
- [ ] Scoring algorithm implementation
- [ ] Alert system (Telegram bot or similar)
- [ ] Entry signal generation
- [ ] Enhanced dashboard with scores and patterns

**Testing Approach:**
- Continue paper trading or small positions
- Track score accuracy vs. actual outcomes
- Refine scoring weights based on data

### Phase 3: ML Model Integration (Month 2)

**Goals:**
- Train Chronos model on collected data
- Integrate predictions into scoring
- Semi-automated entries with manual approval
- Backtesting framework

**Deliverables:**
- [ ] Chronos model training pipeline
- [ ] Feature engineering (price/volume time series)
- [ ] Model inference integration
- [ ] Prediction confidence scoring
- [ ] Backtesting system on historical data
- [ ] Performance analytics dashboard

**Key ML Approach:**
- **Input:** Last 6 hours of price/volume data (5-minute intervals = 72 data points)
- **Output:** Binary prediction - "Will this pump again in next 2-6 hours?" + confidence %
- **Keep it simple:** Don't predict exact prices, just "good setup vs. bad setup"

### Phase 4: Full Automation (Month 3+)

**Goals:**
- Automated trading with oversight
- Risk management enforcement
- Performance tracking
- Continuous model improvement

**Deliverables:**
- [ ] Automated entry/exit execution via Jupiter
- [ ] Position sizing based on account balance
- [ ] Stop-loss and take-profit automation
- [ ] Daily/weekly performance reports
- [ ] Emergency shutdown conditions
- [ ] Model retraining pipeline

**Safety Features:**
- Maximum position size limits
- Maximum daily loss limits
- Maximum number of open positions
- Emergency manual override
- Detailed logging of all decisions

---

## Risk Management Rules

### Position Sizing
- **Start:** $25-50 per trade (learning phase)
- **Scale to:** $100-150 per trade (after proving profitability)
- **Max position:** 5-10% of total trading capital
- **Never** risk more than you can afford to lose completely

### Entry Rules
- Only enter on confirmed breakout (price above consolidation range)
- Volume must be increasing
- Score must be ≥7
- Maximum 3 open positions at once

### Exit Rules

**Stop Loss:**
- Set at -10% to -15% from entry
- No exceptions, no "holding through dips"
- If hit, exit immediately

**Take Profit:**
- Take 33% at +20% gain
- Take 33% at +40% gain
- Let 33% ride with trailing stop (-20% from peak)

**Time-Based Exit:**
- If no movement after 4-6 hours in position, re-evaluate
- If consolidating again, consider exiting
- Don't hold overnight unless strong conviction

**Manual Override:**
- Obvious rug pull indicators = exit immediately
- Market-wide crash = exit all positions
- Gut feeling something is wrong = trust it, exit

### Portfolio Limits
- Maximum 10% of capital at risk at any time
- Maximum 3 simultaneous positions
- If down 20% in a week, STOP trading and re-evaluate
- If down 40% total, shut down system and reassess completely

---

## API Integration Details

### Polling Loop (Every 60 seconds)

**Step 1: Token Discovery** (Helius)
```
Query: Tokens created in last 1-6 hours with 400-600 holders
Endpoint: Helius Token Metadata API
Rate: 1 call per minute
```

**Step 2: Price Data** (Jupiter)
```
Query: Current prices for discovered tokens
Endpoint: Jupiter Price API
Rate: 1 call per token (batch if possible)
```

**Step 3: Historical Analysis** (Your DB or Birdeye)
```
Query: Last 6 hours of price data
Calculate: First pump peak, pullback %, consolidation duration
```

**Step 4: Security Validation** (RugCheck, Solscan)
```
Query: Token security status (on-demand for new candidates)
Check: Mint authority, LP status, holder distribution
```

**Step 5: Scoring**
```
Calculate composite score
Update dashboard
Generate alerts for score ≥7
```

### On-Demand Checks (When Evaluating Specific Token)

**Detailed Security:**
- RugCheck API for comprehensive security scan
- Solscan for LP lock verification and top holder analysis

**Social Sentiment** (Phase 2):
- Twitter API for mention count
- Compare current hour vs. previous 6 hours

**Liquidity Depth:**
- Jupiter Quote API to test slippage on theoretical trade

---

## Chronos Model Specification

### Model Details
- **Model:** Amazon Chronos-bolt-base (pre-trained time series foundation model)
- **Use Case:** Binary classification - "Will this token pump again?"
- **Not using it for:** Exact price predictions or timing

### Training Approach

**Data Collection:**
- Label historical tokens from your trading data
- **Positive class:** Tokens that had second pump (>20% gain within 6 hours of consolidation breakout)
- **Negative class:** Tokens that failed to pump or declined

**Features (Input to Model):**
- Price time series (last 6 hours, 5-min intervals)
- Volume time series (last 6 hours, 5-min intervals)
- Holder count time series (last 6 hours, hourly data)
- Consolidation duration (derived feature)
- Pullback percentage from peak (derived feature)

**Output:**
- Probability score (0-1) that token will pump
- Threshold: >0.6 = consider, >0.75 = strong signal

**Integration:**
- Chronos score becomes a component of composite score
- Weight it as +2 points if confidence >0.75
- Use it to break ties between similar-scoring tokens

### Model Updates
- Retrain weekly on new data
- Track prediction accuracy vs. actual outcomes
- Adjust confidence thresholds based on performance

---

## Dashboard/Interface Design

### Philosophy: Extreme Simplicity

**Goal:** Sniper rifle, not machine gun. Show only actionable signals.

### Dashboard View (Table Format)

```
Token   | Age | Holders | Δ1h | Price   | 24h High | Pull% | Consol | Liq   | Score | Action
--------|-----|---------|-----|---------|----------|-------|--------|-------|-------|-------
BONK2   | 3h  | 487     | +23 | 0.00300 | 0.00450  | -33%  | 1.2h   | $12k  | 8.2   | [BUY]
PEPE3   | 5h  | 612     | +45 | 0.00800 | 0.00900  | -11%  | 0.8h   | $8k   | 7.8   | [WATCH]
```

**Click token → Shows:**
- Simple 6hr price chart
- Holder growth chart
- Security check results
- Entry decision: [BUY $X] [SKIP] [MORE INFO]

### Alert System (Telegram Bot Preferred)

**Example Alert:**
```
🎯 BONK2 - Score: 8.2
Holders: 487 (+23/hr)
Setup: Consolidation breakout
Entry: $0.003
Liquidity: $12k
Security: ✅ All clear

[BUY $100] [SKIP] [MORE INFO]
```

**Alert Triggers:**
- New token score ≥8 (immediate alert)
- Watched token breaking out of consolidation
- Stop loss hit on open position
- Take profit level reached

### Workflow Example

**1:00 PM - Check dashboard:**
- See 2 tokens with score >7
- BONK2: 8.2 (consolidating)
- PEPE3: 7.8 (consolidating)

**1:05 PM - Validate:**
- Click BONK2 → Review chart ✓
- Check security → Green ✓
- Breakout? Not yet, set alert

**1:30 PM - Alert fires:**
- "BONK2 breaking consolidation, volume spike"
- Enter $100 position via Jupiter
- Set stop loss -12% ($0.00264)
- Set TP alerts at +20% ($0.0036), +40% ($0.0042)

**3:00 PM - TP alert:**
- BONK2 up 22%, exit 50% ($61 profit on that half)
- Move stop to breakeven on remaining 50%
- Let it ride with trailing stop

**Total time spent:** ~10 minutes across 2 hours

---

## Testing & Validation Strategy

### Phase 1: Paper Trading (Week 1-2)
- Track theoretical trades in spreadsheet/database
- Pretend to enter at alert signals
- Record what would have happened
- NO real money at risk
- **Goal:** Validate filters and scoring

### Phase 2: Tiny Capital Testing (Week 3-4)
- Start with $250-500 total capital
- $25-50 positions maximum
- Real trades, real losses possible
- **Goal:** Test execution, learn emotional discipline

### Phase 3: Small Capital Validation (Month 2)
- If profitable in Phase 2, scale to $1,000-2,000
- $75-100 positions
- Track ALL metrics (win rate, avg win/loss, fees)
- **Goal:** Prove consistency over 30+ trades

### Phase 4: Scaling (Month 3+)
- Only if maintaining >45% win rate and positive returns
- Scale to $5,000-10,000 capital
- $250-500 positions
- **Goal:** Generate meaningful income

### Performance Metrics to Track

**Per Trade:**
- Entry time/price
- Exit time/price
- Profit/loss ($)
- Profit/loss (%)
- Fees paid
- Exit reason
- Score at entry
- Chronos prediction (if applicable)

**Aggregate (Weekly/Monthly):**
- Win rate
- Average win %
- Average loss %
- Risk/reward ratio
- Total return
- Sharpe ratio
- Maximum drawdown
- Number of trades
- Time in market

**Model Performance:**
- Chronos prediction accuracy
- Score correlation with outcomes
- False positive rate (high score but didn't pump)
- False negative rate (low score but did pump)

---

## Development Workflow with Cline

### Session Management

**At Start of Each Session:**
1. Reference this document: "Review SOLANA_TRADING_BOT_MASTER_PLAN.md"
2. Check current phase and deliverables
3. Identify specific task for this session

**During Development:**
- Break tasks into small, testable chunks
- Write tests alongside code
- Document any deviations from plan in this file
- Update deliverable checkboxes as completed

**End of Session:**
- Update this document with progress
- Document any learnings or issues
- Set clear next steps for next session

### Code Organization

```
project/
├── src/
│   ├── data/
│   │   ├── helius_client.py      # Helius API wrapper
│   │   ├── jupiter_client.py     # Jupiter API wrapper
│   │   ├── birdeye_client.py     # Birdeye API wrapper
│   │   └── security_checks.py    # RugCheck, Solscan integration
│   ├── analysis/
│   │   ├── pattern_detector.py   # Consolidation pattern detection
│   │   ├── scoring.py            # Composite scoring system
│   │   └── chronos_model.py      # ML model integration
│   ├── trading/
│   │   ├── executor.py           # Trade execution via Jupiter
│   │   ├── risk_manager.py       # Position sizing, stop loss
│   │   └── portfolio.py          # Portfolio tracking
│   ├── database/
│   │   ├── models.py             # SQLAlchemy models
│   │   └── queries.py            # Database queries
│   └── utils/
│       ├── alerts.py             # Telegram bot
│       └── logger.py             # Logging configuration
├── tests/
│   └── (mirror src structure)
├── scripts/
│   ├── polling_loop.py           # Main scanning loop
│   ├── backtest.py               # Backtesting framework
│   └── dashboard.py              # Simple web dashboard (Flask/FastAPI)
├── data/
│   └── (local data storage)
├── config/
│   ├── config.yaml               # Configuration
│   └── .env.example              # API keys template
└── docs/
    ├── MASTER_PLAN.md            # This file
    └── LEARNINGS.md              # Track what works/doesn't
```

### Prompt Templates for Cline

**For new feature:**
```
Context: Review SOLANA_TRADING_BOT_MASTER_PLAN.md, we're in Phase [X].

Task: Implement [specific feature] following the architecture defined in the master plan.

Requirements:
- Follow the data schema defined in the plan
- Write unit tests
- Keep it simple (remember: anti-complexity philosophy)
- Document any deviations from plan

Acceptance criteria: [specific, testable criteria]
```

**For debugging:**
```
Context: Review SOLANA_TRADING_BOT_MASTER_PLAN.md for strategy context.

Issue: [describe problem]

Expected behavior: [what should happen]
Actual behavior: [what is happening]

Debug approach:
1. [step 1]
2. [step 2]
```

---

## Critical Reminders

### Financial Safety
- ⚠️ **NEVER trade with money you can't afford to lose completely**
- ⚠️ Start with $250-500 maximum during testing
- ⚠️ Keep your day job while building and testing this
- ⚠️ Plan for 2-3 months of testing before significant capital
- ⚠️ If you lose 20% in a week, STOP and reassess

### Emotional Discipline
- Don't chase trades out of FOMO
- Don't hold losers hoping for recovery
- Don't revenge trade after losses
- Stick to the rules even when they feel wrong
- The market doesn't care about your needs

### Technical Discipline
- Test everything before deploying
- Log every decision for later analysis
- Review trades weekly to find patterns
- Update this document with learnings
- Don't over-optimize on small sample sizes

### Strategy Evolution
- What works today might not work next month
- Be ready to adapt scoring weights
- Monitor win rate and adjust if needed
- Consider market regime (bull vs. bear)
- Don't be emotionally attached to any particular approach

---

## Success Metrics

### Month 1 Success = Learning
- System is stable and running
- Collecting quality data
- No catastrophic bugs
- Understanding what tokens pump and why
- Win/loss ratio doesn't matter yet

### Month 2 Success = Consistency
- 30+ trades completed
- Win rate >40%
- No losing streaks >7 trades
- System requires minimal manual intervention
- Refinements based on data

### Month 3 Success = Profitability
- Win rate >45%
- Positive returns after fees
- Risk management working (max drawdown <25%)
- Can scale position sizes
- Confidence in strategy

### Month 6 Success = Income
- Monthly returns 5-10%
- Win rate 48-55%
- Generating $500-1,000/month
- System mostly automated
- Can consider job transition

---

## Resources & Links

### APIs
- Helius: https://helius.dev
- Jupiter: https://station.jup.ag/docs/apis/swap-api
- Birdeye: https://docs.birdeye.so
- DexScreener: https://docs.dexscreener.com
- RugCheck: https://rugcheck.xyz/docs

### Documentation
- Solana Web3.js: https://solana-labs.github.io/solana-web3.js/
- Amazon Chronos: https://github.com/amazon-science/chronos-forecasting

### Learning
- Track learnings in `docs/LEARNINGS.md`
- Review successful vs. failed trades weekly
- Document pattern changes in market

---

## Version History

**v1.0 - Initial Plan** (Current)
- Core strategy defined
- Architecture designed
- Phased approach outlined
- Risk management established

**Future versions:**
- Update with actual learnings from trading
- Refine scoring weights based on data
- Add new patterns discovered
- Document strategy adaptations

---

## Notes for Cline

**When I reference this document:**
- This is the single source of truth for the project
- Follow the architecture and philosophy defined here
- Don't overcomplicate - simplicity is key
- If you need to deviate from plan, document why
- Update deliverable checkboxes as we complete them

**Current Priority:**
- We just updated the filter from Jupiter `/recent` API
- Next: Implement Helius + Jupiter integration for 400+ holder tokens created in last hour
- Focus on Phase 1 deliverables

**Remember:**
- This is a real trading bot that will handle real money (eventually)
- Prioritize correctness over speed
- Test everything thoroughly
- Log all important decisions and data

---

**Last Updated:** [Current Date]
**Current Phase:** Phase 1 - Foundation & Manual Trading
**Current Focus:** Helius + Jupiter filter implementation