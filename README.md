# ChainPilot ⛓️

**AI-Powered On-Chain Trading Copilot**

> Discover, analyze, validate, trade, and monitor — all through natural language on Telegram.

Built for the **AVE Claw Hackathon 2026** | Powered by [OpenClaw](https://openclaw.ai) + [AVE Cloud](https://ave.ai)

🌐 **Website**: [chainpilot.site](http://chainpilot.site/) | 🤖 **Telegram Bot**: [@ChainPilot_bot](https://t.me/ChainPilot_bot)

---

## What is ChainPilot?

ChainPilot is a conversational on-chain trading copilot delivered as a Telegram bot. It unifies the entire trading lifecycle into a single natural language interface — from discovering trending tokens and analyzing contract safety, to executing trades with automatic risk management and monitoring positions with real-time alerts.

ChainPilot follows a **wrapper skill pattern**: it delegates REST data queries to `ave-data-rest`, real-time streams to `ave-data-wss`, and trade execution to `ave-trade-proxy-wallet` (all from AVE Cloud Skill v2.4.0), while adding **safety scoring, trade gating, guardian monitoring, portfolio tracking, smart money copy trading, and launch scanning** as its unique intelligence layer.

### Why ChainPilot?

On-chain trading is fragmented — users juggle multiple tools for research, execution, and monitoring. One wrong trade on an unaudited contract can drain a wallet in seconds. ChainPilot solves both problems:

- **One interface**: Ask questions in plain English, get data-driven answers, execute trades — all in Telegram
- **Safety-first**: Every trade goes through a composite safety check. Dangerous tokens (score < 20) are refused outright
- **Always watching**: 9 background tasks monitor positions, detect rug pulls, track whale movements, and surface opportunities

---

## Key Features

### Safety Scoring Engine (0-100)
ChainPilot's core differentiator. Before any trade, a composite safety score is computed from live on-chain data:

| Check | Impact |
|-------|--------|
| Honeypot / cannot sell | **Instant disqualifier** (Score = 0) |
| Buy/sell tax > 10% | -30 |
| Mint function present | -15 |
| Hidden owner | -15 |
| LP lock < 50% | -20 |
| Top 10 holder concentration > 80% | -25 |
| Low liquidity (< $10K) | -20 |
| Sell simulation < 90% success | -20 |
| Blacklist / pausable / external call | -5 to -10 each |

**Risk Levels:**
- 🔴 **HIGH RISK** (0-39) — Trade refused if < 20, explicit risk acknowledgment required if < 40
- 🟡 **MODERATE RISK** (40-69) — Proceed with caution
- 🟢 **RELATIVELY SAFE** (70-100) — Standard trading allowed

### Trade Execution with Auto TP/SL
- Market orders and limit orders across 4 chains
- Automatic take-profit / stop-loss rules banded by safety score
- Up to 10 TP/SL rules + 1 trailing stop per order
- Server-side enforcement by AVE (exits execute even if bot is offline)

### Smart Money Copy Trading
- Discover top-performing wallets via `smart-wallets`
- Track their transaction history with `address-txs`
- Get alerts when tracked wallets make new buys
- One-command copy trade: `COPY $X` with automatic safety gating

### Token Launch Scanner
- Monitor 90+ launchpads (pump.fun, bonk, boop, fourmeme, meteora, and more)
- Filter by stage: new, hot, almost graduating, graduated
- Safety-gated snipe flow with aggressive auto TP/SL defaults

### Guardian Monitoring (9 Heartbeat Tasks)
| Task | Interval | Purpose |
|------|----------|---------|
| WSS Daemon Ensure | 5m | Keep WebSocket streams alive |
| Guardian Position Check | 10m | Detect holder shifts, volume drops |
| Whale Watch | 15m | Track large holder movements (>2% supply) |
| Price Alert Check | 1m | Real-time price alerts via WSS (~1s latency) |
| Daily Portfolio Digest | 24h | Morning P&L summary with top gainers/losers |
| Smart Money Scan | 15m | New buys from top wallets → copy trade alerts |
| Liquidity Monitor | 5m | LP pull detection, lock state changes |
| Trending Scanner | 60m | New trending tokens with safety pre-filter |
| Launch Scanner | 10m | New token launches across 90+ launchpads |

### Portfolio Tracking
- Real-time holdings across all 4 chains
- P&L tracking with USD equivalents
- Health indicators and market context

### Cross-Chain Price Comparison
- Compare the same token's price across Solana, BSC, ETH, and Base
- Identify the best chain for buying or selling

### Landing Page with Live Safety Widget
- Public-facing website where visitors can check any token's safety score
- Same composite scoring algorithm used by the bot
- Served via Nginx reverse proxy on Tencent Cloud

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User (Telegram)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    OpenClaw 2026.4.2                             │
│              (Tencent Cloud Lighthouse)                          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              ChainPilot (SKILL.md v3.3.0)                  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │           ChainPilot Unique Logic                    │  │  │
│  │  │                                                      │  │  │
│  │  │  • Safety Scoring (0-100 composite)                  │  │  │
│  │  │  • Trade Gating (refuse <20, warn <40)               │  │  │
│  │  │  • Auto TP/SL Risk Management                        │  │  │
│  │  │  • Smart Money Copy Trading                          │  │  │
│  │  │  • Launch Scanner (90+ launchpads)                   │  │  │
│  │  │  • Portfolio P&L Tracking                            │  │  │
│  │  │  • Guardian Alerts (9 heartbeat tasks)               │  │  │
│  │  │  • Price Alert System (WSS, ~1s latency)             │  │  │
│  │  │  • Liquidity / Rug Detection                         │  │  │
│  │  │  • Cross-Chain Price Comparison                      │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │          │                │                  │             │  │
│  │  ┌───────▼──────┐ ┌──────▼───────┐ ┌───────▼───────────┐ │  │
│  │  │ave-data-rest │ │ave-data-wss  │ │ave-trade-proxy    │ │  │
│  │  │              │ │              │ │-wallet            │ │  │
│  │  │ search       │ │ watch-price  │ │ market-order      │ │  │
│  │  │ token        │ │ watch-tx     │ │ limit-order       │ │  │
│  │  │ risk         │ │ watch-kline  │ │ auto-slippage     │ │  │
│  │  │ holders      │ │              │ │ gas-tip           │ │  │
│  │  │ trending     │ │ Persistent   │ │ approve-token     │ │  │
│  │  │ ranks        │ │ Docker WSS   │ │ list-wallets      │ │  │
│  │  │ smart-wallets│ │ daemon       │ │ transfer          │ │  │
│  │  └──────────────┘ └──────────────┘ └───────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────▼─────────────────────────────────┐  │
│  │            HEARTBEAT.md Scheduler (9 tasks)                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     AVE Data REST    AVE Data WSS    AVE Trade API
     data.ave-api.xyz wss.ave-api.xyz bot-api.ave.ai
```

**Key principle**: ChainPilot never calls AVE APIs directly. All data goes through `ave-data-rest` scripts, all trades through `ave-trade-proxy-wallet` scripts. ChainPilot only adds the intelligence layer on top.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Skill Framework | OpenClaw 2026.4.2 |
| REST Data Layer | ave-data-rest (AVE Cloud Skill v2.4.0) |
| Streaming Layer | ave-data-wss (AVE Cloud Skill v2.4.0) |
| Trading Layer | ave-trade-proxy-wallet (AVE Cloud Skill v2.4.0) |
| LLM | Moonshot AI (Kimi K2.5) |
| Bot Interface | Telegram via OpenClaw |
| Hosting | Tencent Cloud Lightweight Server |
| Landing Page | Node.js + Tailwind CSS CDN |

---

## Supported Chains

| Chain | Trading | Data | WSS Streaming |
|-------|---------|------|---------------|
| Solana | ✅ | ✅ | ✅ |
| BSC | ✅ | ✅ | ✅ |
| Ethereum | ✅ | ✅ | ✅ |
| Base | ✅ | ✅ | ✅ |

---

## Project Structure

```
chainpilot/
├── README.md                         # This file
├── ARCHITECTURE.md                   # Detailed architecture documentation
├── .env.example                      # Required environment variables
├── .gitignore
│
├── skill/                            # OpenClaw skill files (production deployment)
│   ├── SKILL.md                      # Main skill definition — all routing, safety scoring, trade flows
│   ├── HEARTBEAT.md                  # 9 scheduled monitoring tasks
│   ├── AGENTS.md                     # Operating rules, safety constraints, credential security
│   ├── SOUL.md                       # Personality: direct, data-driven, safety-first
│   ├── IDENTITY.md                   # Agent role and greeting rules
│   └── chainpilot_trade.py           # Legacy trade helper (HMAC-SHA256 signing for AVE API)
│
└── website/                          # Landing page with live safety score widget
    ├── index.html                    # Single-page site (Tailwind CSS CDN)
    ├── server.js                     # Node.js server with /api/safety-score endpoint
    └── brand_assets/
        ├── chainpilot_logo.svg       # Primary logo
        ├── chainpilot_logo_dark.svg  # Dark theme logo
        └── ChainPilot_Brand_Guidelines.pdf
```

### What Runs in Production

In production, only the `skill/` files are deployed to the OpenClaw server:
- **SKILL.md** — The complete skill definition with all logic
- **HEARTBEAT.md** — Background task scheduler
- **AGENTS.md, SOUL.md, IDENTITY.md** — Behavior configuration

All data retrieval and trade execution is handled by `ave-cloud-skill v2.4.0` scripts already installed on the OpenClaw server. ChainPilot adds the intelligence layer on top.

---

## What ChainPilot Adds vs Raw AVE Cloud Skill

| Feature | ave-cloud-skill provides | ChainPilot adds |
|---------|--------------------------|-----------------|
| Token search & price data | ✅ | Telegram-optimized formatting |
| Contract risk report | ✅ | **Composite safety score (0-100)** with weighted deductions |
| Holder analysis | ✅ | **Concentration risk scoring** excluding dead/burn/lock addresses |
| Trade execution | ✅ | **Mandatory safety gate** — refuse < 20, warn < 40 |
| Limit orders, TP/SL | ✅ | Safety check before every order |
| Wallet management | ✅ | **Portfolio P&L tracking** with health indicators |
| Smart wallets | ✅ | **Smart money copy trading pipeline** with safety filter |
| Trending tokens | ✅ | **Trending scanner** with safety pre-filter |
| Real-time WSS streams | ✅ | **WSS daemon orchestration** + alert dispatch |
| Auto-slippage & gas tips | ✅ | Auto-applied as defaults on every order |
| — | — | **Cross-chain price comparison** |
| — | — | **Guardian heartbeat** (holder shifts, volume drops, whale alerts) |
| — | — | **Daily portfolio digest** |
| — | — | **Price alert system** (WSS-driven, ~1s latency) |
| — | — | **Liquidity / rug monitoring** (LP-pull detection) |
| — | — | **Token launch scanner** (90+ launchpads) |
| — | — | **Multi-user wallet isolation** |
| — | — | **Landing page with live safety widget** |

---

## Setup & Deployment

### Prerequisites
- [OpenClaw](https://openclaw.ai) account and server
- [AVE Cloud](https://ave.ai) API key (Pro plan recommended for WSS streaming)
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- [Moonshot AI](https://platform.moonshot.cn) API key
- Node.js 18+ (for landing page only)

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual API keys
```

### 2. Deploy Skill to OpenClaw

Upload the `skill/` files to your OpenClaw workspace:
- `SKILL.md` → `skills/chainpilot/SKILL.md`
- `HEARTBEAT.md` → workspace root
- `AGENTS.md`, `SOUL.md`, `IDENTITY.md` → workspace root

### 3. Install AVE Cloud Skill (Dependency)

Install `ave-cloud-skill v2.4.0` from the OpenClaw skill store. This provides:
- `ave-data-rest` — REST data queries
- `ave-data-wss` — WebSocket streaming
- `ave-trade-proxy-wallet` — Trade execution

### 4. Launch Landing Page (Optional)

```bash
cd website
AVE_API_KEY=your_key node server.js
# Serves on http://localhost:3000
# Configure Nginx reverse proxy for production
```

### 5. Connect Telegram Bot

Link your Telegram bot token in OpenClaw settings. The bot will be accessible via Telegram immediately.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AVE_API_KEY` | Yes | AVE Cloud API key |
| `AVE_SECRET_KEY` | Yes | HMAC-SHA256 signing secret for proxy wallet |
| `API_PLAN` | Yes | Service tier: `free`, `normal`, or `pro` |
| `TELEGRAM_BOT_TOKEN` | For Telegram | Bot token from @BotFather |
| `MOONSHOT_API_KEY` | For LLM | Moonshot AI (Kimi K2.5) API key |

---

## Security

ChainPilot is designed with security as a first-class concern:

- **Input trust boundaries**: User messages and API response data are treated as untrusted input
- **assetsId isolation**: Each user gets their own delegate wallet (`cp-<username>`), never shared
- **Display name sanitization**: Prevents prompt injection via Telegram display names
- **Wallet name sanitization**: Strips dangerous characters before shell execution
- **No hardcoded credentials**: All secrets via environment variables
- **Admin gating**: Admin commands verified by numeric `sender_id`, not display name

See [AGENTS.md](skill/AGENTS.md) for the complete security rules.

---

## Demo

<!-- Add demo video link here -->
*Demo video coming soon*

### Sample Interactions

**Safety Check:**
> "Safety check TRUMP on Solana"
> → Returns 55/100 MODERATE RISK with detailed breakdown (LP lock, holder concentration, tax analysis)

**Buy with Safety Gate:**
> "Buy 0.002 SOL of TRUMP"
> → Safety check → Risk report → Confirmation required → Execute with auto TP/SL

**Launch Scanner:**
> "What's new on pump.fun?"
> → Fresh launches + graduating tokens with safety scores

**Smart Money:**
> "Show me smart wallets on Solana"
> → Top performing wallets → Follow → Copy trade alerts

**Cross-Chain:**
> "Compare TRUMP price across chains"
> → Price on Solana, BSC, ETH, Base with liquidity comparison

---

## Built With

- [AVE Cloud](https://ave.ai) — On-chain data and trading infrastructure
- [OpenClaw](https://openclaw.ai) — AI skill framework and Telegram bot platform
- [Moonshot AI (Kimi K2.5)](https://platform.moonshot.cn) — Large language model
- [Tailwind CSS](https://tailwindcss.com) — Landing page styling

---

## Hackathon

**AVE Claw Hackathon 2026** | April 2026

**Team:** OoJae

---

## License

MIT
