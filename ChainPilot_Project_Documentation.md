# ChainPilot: AI-Powered On-Chain Trading Copilot

## Comprehensive Project Documentation

**AVE Claw Hackathon 2026 | Team: OoJae | April 2026**

Powered by OpenClaw + AVE Cloud + Moonshot AI (Kimi K2.5) | Deployed on Tencent Cloud | Delivered via Telegram

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Key Features](#4-key-features)
5. [System Architecture](#5-system-architecture)
6. [Tech Stack](#6-tech-stack)
7. [Safety Scoring Engine](#7-safety-scoring-engine)
8. [AVE Cloud Skills Used](#8-ave-cloud-skills-used)
9. [ChainPilot Value-Add vs Raw AVE Skills](#9-chainpilot-value-add-vs-raw-ave-skills)
10. [Guardian Monitoring (Heartbeat Tasks)](#10-guardian-monitoring-heartbeat-tasks)
11. [Security Design](#11-security-design)
12. [Multi-User Isolation](#12-multi-user-isolation)
13. [Landing Page & Safety Widget](#13-landing-page--safety-widget)
14. [Supported Chains](#14-supported-chains)
15. [Project Structure](#15-project-structure)
16. [Setup & Deployment](#16-setup--deployment)
17. [Environment Variables](#17-environment-variables)
18. [Live Testing Results](#18-live-testing-results)
19. [Known Limitations](#19-known-limitations)
20. [Roadmap & Future Work](#20-roadmap--future-work)

---

## 1. Executive Summary

ChainPilot is an AI-powered conversational on-chain trading copilot, delivered as a Telegram bot via the OpenClaw skill framework. It unifies the entire trading lifecycle -- discover, analyze, validate, trade, and monitor -- into a single natural language interface.

Built as a **wrapper skill** on top of AVE Cloud Skill v2.4.0, ChainPilot delegates REST data queries to `ave-data-rest`, real-time streams to `ave-data-wss`, and trade execution to `ave-trade-proxy-wallet`, while adding **safety scoring, trade gating, guardian monitoring, portfolio tracking, smart money copy trading, and token launch scanning** as its unique intelligence layer.

ChainPilot supports trading across four chains: **Solana, BSC, Ethereum, and Base**. It is deployed on Tencent Cloud and uses Moonshot AI (Kimi K2.5) as its LLM backbone.

---

## 2. Problem Statement

On-chain trading today is fragmented and dangerous for most users:

- **Fragmented tools**: Users juggle multiple tools for research (block explorers, analytics dashboards), execution (DEX frontends), and monitoring (portfolio trackers, alert bots)
- **Hidden dangers**: Contract security analysis requires technical knowledge most traders lack -- honeypot detection, tax analysis, holder concentration, LP lock verification
- **Instant losses**: A single trade on an unaudited contract can drain a wallet in seconds via honeypot traps, hidden mint functions, or rug pulls
- **No monitoring**: Real-time monitoring of positions, whale movements, and liquidity changes requires custom infrastructure most individual traders cannot build
- **Speed gap**: New token launches on platforms like pump.fun move too fast for manual research

ChainPilot solves all of these problems through a single conversational interface with mandatory safety checks and autonomous monitoring.

---

## 3. Solution Overview

### Wrapper Skill Pattern

Rather than reimplementing API integrations, ChainPilot delegates all data and trade operations to proven AVE Cloud scripts. This means less code, fewer bugs, and automatic improvements when the underlying skill suite updates. ChainPilot focuses exclusively on what makes it unique: safety scoring, trade gating, guardian alerts, portfolio tracking, and copy trading pipelines.

### Natural Language Interface

Users interact with ChainPilot through plain English on Telegram. Over **100 trigger phrases** are supported, covering token discovery, safety checks, trading, portfolio management, smart money tracking, and launch scanning. The LLM (Kimi K2.5) interprets user intent and routes to the appropriate AVE Cloud skill with the correct parameters.

---

## 4. Key Features

### 4.1 Composite Safety Scoring (0-100)
Every token gets a composite safety score computed from live on-chain data. The algorithm checks for honeypots, tax rates, mint functions, hidden ownership, LP lock status, holder concentration, liquidity depth, and sell simulation success.

### 4.2 Mandatory Trade Gating
All trades must pass the safety check. Tokens scoring below 20 are **refused outright**. Tokens scoring 20-39 require explicit risk acknowledgment ("YES I UNDERSTAND THE RISK"). This prevents users from accidentally trading dangerous tokens.

### 4.3 Auto Take-Profit / Stop-Loss
Every market order includes automatic TP/SL rules banded by safety score. Up to 10 default TP/SL rules plus 1 trailing stop per order. Rules are enforced **server-side by AVE**, meaning exits execute even if the bot is offline.

### 4.4 Smart Money Copy Trading
Discover top-performing wallets, track their transaction history, and receive alerts when tracked wallets make new buys. One-command copy trade (`COPY $X`) with automatic safety gating. Background scan runs every 15 minutes.

### 4.5 Token Launch Scanner
Monitor **90+ launchpads** (pump.fun, bonk, boop, fourmeme, meteora, etc.). Filter by stage: new, hot, almost graduating, graduated. Safety-gated snipe flow (`SNIPE $X`) with aggressive auto TP/SL defaults. Background scan every 10 minutes.

### 4.6 Guardian Monitoring
9 heartbeat tasks run autonomously: position monitoring, whale watch, price alerts, daily digest, smart money scan, liquidity monitor, trending scanner, launch scanner, and WSS daemon management.

### 4.7 Cross-Chain Price Comparison
Compare the same token's price across Solana, BSC, ETH, and Base to identify the best chain for buying or selling.

### 4.8 Portfolio P&L Tracking
Real-time holdings across all 4 chains with P&L calculations, USD equivalents, and health indicators.

### 4.9 Real-Time Price Alerts
WSS-driven price alerts with approximately 1-second latency. Users set target prices and receive instant Telegram notifications.

### 4.10 Liquidity / Rug Detection
Real-time monitoring of LP pool changes via WebSocket. Detects liquidity pulls and lock state changes, alerting users before damage occurs.

---

## 5. System Architecture

```
User (Telegram)
      |
      v
OpenClaw 2026.4.2 (Tencent Cloud Lighthouse)
      |
      v
ChainPilot (SKILL.md v3.3.0)
      |--- ChainPilot Unique Logic
      |    - Safety Scoring (0-100 composite)
      |    - Trade Gating (refuse <20, warn <40)
      |    - Auto TP/SL Risk Management
      |    - Smart Money Copy Trading
      |    - Launch Scanner (90+ launchpads)
      |    - Portfolio P&L Tracking
      |    - Guardian Alerts (9 heartbeat tasks)
      |    - Price Alert System (WSS, ~1s latency)
      |    - Liquidity / Rug Detection
      |    - Cross-Chain Price Comparison
      |
      |--- ave-data-rest       ave-data-wss       ave-trade-proxy-wallet
      |    (REST queries)      (live streams)     (trade execution)
      |    search, token,      watch-price,       market-order,
      |    risk, holders,      watch-tx,          limit-order,
      |    trending, ranks,    watch-kline        approve, transfer,
      |    smart-wallets       (Docker daemon)    list-wallets
      |
      v
HEARTBEAT.md Scheduler (9 autonomous tasks)
      |
      v
AVE Cloud APIs
  data.ave-api.xyz  |  wss.ave-api.xyz  |  bot-api.ave.ai
```

**Key principle**: ChainPilot never calls AVE APIs directly. All data goes through `ave-data-rest` scripts, all trades through `ave-trade-proxy-wallet` scripts. ChainPilot only adds the intelligence layer on top.

### Data Flow: Buy Trade

1. User says "Buy 0.002 SOL of TRUMP"
2. ChainPilot searches for TRUMP via `ave-data-rest search`
3. ChainPilot fetches risk data via `ave-data-rest risk + holders`
4. ChainPilot computes composite safety score (0-100)
5. If score >= 40: present safety report and ask for confirmation
   If score 20-39: present HIGH RISK warning, require explicit acknowledgment
   If score < 20: refuse trade entirely
6. On confirmation: execute via `ave-trade-proxy-wallet market-order` with auto TP/SL
7. Verify execution via `get-swap-orders`
8. Add position to guardian monitoring (HEARTBEAT.md)

---

## 6. Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Skill Framework | OpenClaw 2026.4.2 | AI skill hosting, Telegram integration, heartbeat scheduling |
| REST Data Layer | ave-data-rest (v2.4.0) | Token search, price, risk, holders, trending, klines, smart wallets |
| Streaming Layer | ave-data-wss (v2.4.0) | Real-time price, transaction, and kline WebSocket streams |
| Trading Layer | ave-trade-proxy-wallet (v2.4.0) | Market/limit orders, wallet management, auto TP/SL |
| LLM | Moonshot AI (Kimi K2.5) | Natural language understanding and response generation |
| Bot Interface | Telegram | User-facing chat interface via OpenClaw |
| Hosting | Tencent Cloud Lighthouse | Server infrastructure |
| Landing Page | Node.js + Tailwind CSS | Public website with live safety score widget |

---

## 7. Safety Scoring Engine

ChainPilot's core differentiator is its composite safety scoring algorithm. Before any trade, a safety score is computed from live on-chain data fetched via ave-data-rest. The score starts at 100 and deductions are applied based on risk factors.

### Data Sources

Three ave-data-rest commands provide the raw data:
- `risk` -- contract security flags (honeypot, mint, blacklist, tax, LP lock, etc.)
- `holders` -- top holder addresses with balances and remarks
- `token` -- price, liquidity, volume, and market data

### Instant Disqualifiers (Score = 0)

| Risk Factor | Condition |
|-------------|-----------|
| Honeypot | `is_honeypot` = 1 |
| Cannot Buy | `cannot_buy` = "1" |
| Cannot Sell | `cannot_sell_all` = "1" |

### Major Deductions (-15 to -30)

| Risk Factor | Condition | Deduction |
|-------------|-----------|-----------|
| Buy/Sell Tax | > 10% | -30 |
| Buy/Sell Tax | > 5% | -15 |
| Mint Function | `has_mint_method` = 1 | -15 |
| Hidden Owner | `hidden_owner` = "1" | -15 |
| LP Lock | `pair_lock_percent` < 0.5 | -20 |
| Holder Concentration | Top 10 > 80% (excl. dead/burn/lock) | -25 |
| Holder Concentration | Top 10 > 50% | -15 |
| Low Liquidity | < $10,000 | -20 |
| Sell Simulation | Success rate < 90% | -20 |

### Minor Deductions (-5 to -10)

| Risk Factor | Condition | Deduction |
|-------------|-----------|-----------|
| Blacklist Function | `has_black_method` = 1 | -10 |
| Ownership Recovery | `can_take_back_ownership` = "1" | -10 |
| Transfer Pausable | `transfer_pausable` = "1" | -10 |
| Slippage Modifiable | `slippage_modifiable` = 1 | -10 |
| External Call | `external_call` = "1" | -5 |
| Low Liquidity | < $50,000 | -10 |
| Holder Concentration | Top 10 > 30% | -5 |

### Risk Levels

| Score | Level | Action |
|-------|-------|--------|
| 0-19 | CRITICAL RISK | Trade refused entirely |
| 20-39 | HIGH RISK | Explicit risk acknowledgment required |
| 40-69 | MODERATE RISK | Proceed with caution |
| 70-100 | RELATIVELY SAFE | Standard trading allowed |

### Live Test Result

TRUMP token on Solana scored **55/100** (MODERATE RISK):
- LP lock 0% (-20 deduction)
- Top 10 holder concentration 90.1% (-25 deduction)
- All other checks passed
- Result: 100 - 20 - 25 = **55/100**

---

## 8. AVE Cloud Skills Used

ChainPilot is built on top of the **AVE Cloud Skill suite v2.4.0**, which provides three core skills for on-chain data and trading. All interaction with AVE Cloud APIs goes through these skill scripts -- ChainPilot never calls the APIs directly.

### 8.1 ave-data-rest (REST Data Queries)

The primary data retrieval skill. Uses X-API-KEY header authentication against `data.ave-api.xyz`. Available on all API plans (free/normal/pro).

#### Token Discovery Commands

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `search` | Find tokens by keyword, symbol, or address | `--keyword, --chain, --limit, --orderby` |
| `search-details` | Batch lookup full token details (max 50) | `--tokens <addr-chain> [...]` |
| `trending` | Get trending tokens on a chain | `--chain, --page, --page-size` |
| `ranks` | Token rankings by topic (hot, meme, gainer, loser, ai, etc.) | `--topic` |
| `rank-topics` | List all available ranking topics | (none) |
| `platform-tokens` | Browse 90+ launchpad feeds (pump.fun, bonk, fourmeme, etc.) | `--platform, --limit, --orderby` |
| `signals` | Public trading signal feed | `--chain, --page-size, --page-no` |

#### Token Detail Commands

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `token` | Full token detail (price, liquidity, volume, pairs, summary) | `--address, --chain` |
| `price` | Batch price lookup (up to 200 tokens) | `--tokens <addr-chain> [...]` |
| `risk` | Contract security and honeypot report | `--address, --chain` |
| `holders` | Top token holders with balances and remarks | `--address, --chain, --limit, --sort-by` |
| `main-tokens` | Native/main tokens for a chain | `--chain` |
| `chains` | List all 130+ supported chain identifiers | (none) |

#### Kline / Chart Commands (OHLCV)

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `kline-token` | OHLCV candles by token address | `--address, --chain, --interval (1/5/15/30/60/120/240/1440/4320/10080 min), --size` |
| `kline-pair` | OHLCV candles by pair address | `--address, --chain, --interval, --size` |

#### Transaction Commands

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `txs` | Recent swap transactions for a pair | `--address, --chain` |
| `liq-txs` | Liquidity add/remove/create events for a pair | `--address, --chain, --limit, --type, --from-time, --to-time` |
| `tx-detail` | Look up specific transaction by hash | `--chain, --account, --tx-hash` |

#### Wallet / Address Commands

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `smart-wallets` | List smart wallets with profit-tier filters | `--chain, --keyword, --sort, --sort-dir, profit tier filters` |
| `wallet-info` | Wallet overview and stats | `--wallet, --chain` |
| `wallet-tokens` | Paginated token holdings for a wallet | `--wallet, --chain, --hide-sold, --hide-small, --blue-chips` |
| `address-txs` | Swap transactions for a wallet address | `--wallet, --chain, --token, --from-time` |
| `address-pnl` | Profit/loss for a wallet on a specific token | `--wallet, --chain, --token` |

### 8.2 ave-data-wss (WebSocket Streaming)

Real-time data streaming via WebSocket. **Requires API_PLAN=pro.** Connects to `wss.ave-api.xyz` for sub-second latency on price changes, swap transactions, and kline updates. ChainPilot uses a persistent Docker daemon to maintain WebSocket connections across sessions.

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `watch-price` | Stream live price changes for tokens | `--tokens <addr-chain> [...]` |
| `watch-tx` | Stream live swap or liquidity events for a pair | `--address, --chain, --topic (tx\|liq)` |
| `watch-kline` | Stream live kline/candle updates for a pair | `--address, --chain, --interval (s1/k1/k5/.../k10080)` |
| `wss-repl` | Interactive WebSocket REPL for multi-topic monitoring | Interactive commands: subscribe/unsubscribe/quit |
| `start-server` | Start persistent Docker-backed WSS server | (none) |
| `stop-server` | Stop persistent WSS server | (none) |
| `serve` | Run WSS server daemon (internal) | (none) |

### 8.3 ave-trade-proxy-wallet (Trade Execution)

Server-managed proxy wallet trading. Uses **HMAC-SHA256 authentication** against `bot-api.ave.ai`. Requires API_PLAN=normal or pro. Trading fee: 0.8% with 25% rebate option.

The proxy wallet model means users don't need to manage private keys locally -- AVE manages delegate wallets with per-user isolation.

#### Wallet Management

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `list-wallets` | List proxy wallets | `--assets-ids (filter)` |
| `create-wallet` | Create a delegate proxy wallet | `--name` |
| `delete-wallet` | Delete delegate proxy wallets | `--assets-ids` |

#### Trading Orders

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `market-order` | Place immediate market swap order | `--chain, --assets-id, --in-token, --out-token, --in-amount, --swap-type, --slippage, --use-mev, --auto-sell` |
| `limit-order` | Place limit order at target USD price | `--chain, --assets-id, --in-token, --out-token, --in-amount, --limit-price, --expire-time` |
| `get-swap-orders` | Query market order status by IDs | `--chain, --ids` |
| `get-limit-orders` | Query limit orders (paginated) | `--chain, --assets-id, --status` |
| `cancel-limit-order` | Cancel pending limit orders | `--chain, --ids` |

#### Token Approval & Transfer

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `approve-token` | Approve ERC-20 for proxy wallet trading (EVM only) | `--chain, --assets-id, --token-address` |
| `get-approval` | Query approval status | `--chain, --ids` |
| `transfer` | Transfer tokens from delegate wallet | `--chain, --assets-id, --from-address, --to-address, --token-address, --amount` |
| `get-transfer` | Query transfer status | `--chain, --ids` |

#### Utility Commands

| Command | Description | Key Parameters |
|---------|-------------|----------------|
| `auto-slippage` | Query recommended slippage for a token | `--chain, --token` |
| `gas-tip` | Query recommended gas prices per chain | (none) |

### 8.4 Auto-Sell (TP/SL) Configuration

The `market-order` command supports `--auto-sell` flags for server-side take-profit and stop-loss rules. Each rule is a JSON object:

```json
{
  "priceChange": "5000",
  "sellRatio": "5000",
  "type": "default"
}
```

- `priceChange` > 0 = take-profit (basis points, 5000 = +50%)
- `priceChange` < 0 = stop-loss (basis points, -5000 = -50%)
- `sellRatio` = percentage of position to sell (basis points, 10000 = 100%)
- `type` = "default" or "trailing" (drawdown-based)
- Maximum 10 default-type rules + 1 trailing-type rule per order

**Example**: `--auto-sell '{"priceChange":"5000","sellRatio":"5000","type":"default"}'` means: when price rises 50%, sell 50% of position.

### 8.5 API Authentication

#### Data REST API
- **Header**: `X-API-KEY: <your_api_key>`
- **Base URL**: `https://data.ave-api.xyz/v2`

#### Proxy Wallet Trading API
- **HMAC-SHA256 signature authentication**:
  ```
  SignatureString = Timestamp + HTTP_METHOD + RequestPath + RequestBody
  Signature = Base64(HMAC-SHA256(ApiSecret, SignatureString))
  ```
- **Required headers**: `AVE-ACCESS-KEY`, `AVE-ACCESS-TIMESTAMP`, `AVE-ACCESS-SIGN`
- **Base URL**: `https://bot-api.ave.ai`

### 8.6 API Rate Limits

| Plan | Data REST | Trade REST | WebSocket |
|------|-----------|------------|-----------|
| free | 1 RPS | 1 TPS | Not available |
| normal | 5 RPS | 5 TPS | Not available |
| pro | 20 RPS | 20 TPS | 20 TPS |

### 8.7 Supported Chains

Primary focus chains: **bsc, eth, base, solana** (full trading support)

130+ total chains supported for data queries including: tron, polygon, arbitrum, avalanche, sui, ton, aptos, and more.

### 8.8 Important Conventions

- **EVM native token placeholder**: `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`
- **Solana native token**: Use `"sol"` (NOT the full mint address)
- **Token identifiers in batch operations**: Use `address-chain` format (e.g., `0xabc-eth`)
- **EVM amounts**: wei (1 BNB = 10^18 wei)
- **Solana amounts**: lamports (1 SOL = 10^9 lamports)
- **Slippage/rates**: basis points (1 bps = 0.01%, 500 bps = 5%, 10000 bps = 100%)
- **EVM sell requirement**: Must run `approve-token` before first sell of any ERC-20
- **Solana gas**: Minimum 1,000,000 lamports with `--use-mev`

---

## 9. ChainPilot Value-Add vs Raw AVE Skills

| Feature | ave-cloud-skill provides | ChainPilot adds |
|---------|--------------------------|-----------------|
| Token data | Raw search, price, detail | Telegram-optimized formatting |
| Risk analysis | Contract security flags | **Composite safety score (0-100)** with weighted deductions |
| Holder analysis | Top holders list | **Concentration risk scoring** excluding dead/burn/lock |
| Trading | Market/limit orders | **Mandatory safety gate** (refuse <20, warn <40) |
| TP/SL | Auto-sell config on orders | **Safety-score-banded defaults**, always included |
| Wallet mgmt | Create/list/delete | **Portfolio P&L tracking** with health indicators |
| Smart wallets | List top wallets | **Copy trading pipeline** with safety filter |
| Trending | Trending token list | **Trending scanner** with safety pre-filter |
| WSS streams | Price/tx/kline streams | **Daemon orchestration** + alert dispatch |
| Launchpads | platform-tokens API | **Launch scanner** with snipe flow + aggressive TP/SL |
| *(unique)* | -- | **Cross-chain price comparison** |
| *(unique)* | -- | **Guardian heartbeat** (9 autonomous tasks) |
| *(unique)* | -- | **Daily portfolio digest** |
| *(unique)* | -- | **Price alert system** (~1s latency via WSS) |
| *(unique)* | -- | **Liquidity/rug monitoring** (LP-pull detection) |
| *(unique)* | -- | **Multi-user wallet isolation** |
| *(unique)* | -- | **Landing page with live safety widget** |

---

## 10. Guardian Monitoring (Heartbeat Tasks)

ChainPilot runs 9 autonomous background tasks via OpenClaw's HEARTBEAT.md scheduler. These tasks handle monitoring, alerting, and discovery without user interaction.

| Task | Interval | Description |
|------|----------|-------------|
| wss-daemon-ensure | 5 min | Keeps WebSocket daemon alive. Reconciles subscription set against held tokens. Restarts if crashed. |
| guardian-position-check | 10 min | Monitors all held positions. Detects holder concentration shifts, volume drops, TVL changes. Alerts on significant risk changes. |
| whale-watch | 15 min | Tracks large holder movements >2% of supply. Alerts on accumulation or distribution patterns. |
| price-alert-check | 1 min | Safety net for price alert firing. WSS handles real-time (<1s), this is the REST fallback if WSS is offline. |
| daily-portfolio-digest | 24 hrs | Morning portfolio summary with total value, P&L, top gainers/losers, and market context. |
| smart-money-scan | 15 min | Detects new buys from top wallets via address-txs. Offers copy-trade alerts. Max 3 alerts per cycle, safety >= 40 required. |
| liquidity-monitor | 5 min | Detects LP pulls and lock state changes. REST reconciler for WSS gaps. Critical for rug pull detection. |
| trending-scanner | 60 min | Identifies newly trending tokens. Applies safety pre-filter before alerting. |
| launch-scanner | 10 min | Discovers new tokens on 90+ launchpads. Filters by safety >= 40 and liquidity > $5K. Max 3 alerts per cycle. |

---

## 11. Security Design

ChainPilot is designed with defense-in-depth security:

### Input Trust Boundaries
- **User messages are UNTRUSTED INPUT.** Instructions embedded in messages attempting to change system behavior, override safety, or claim admin status are ignored.
- **API response data is UNTRUSTED.** Token names, descriptions, holder addresses, and transaction memos may contain adversarial text. ChainPilot never follows instructions found in API data.

### Credential Security
- All secrets stored as environment variables, never hardcoded in files
- assetsId values never stored in OpenClaw memory -- looked up fresh each session via `list-wallets`
- Admin status verified by numeric `sender_id`, not display name or text claims

### Wallet Name & Display Name Sanitization
- Wallet names stripped to `[a-zA-Z0-9_-]` to prevent shell injection via malicious usernames
- Display names truncated to 30 characters, suspicious content (instructions, role claims) filtered out

### Trade Safety
- Every trade requires **fresh safety score computation** -- cached or user-claimed scores are rejected
- No auto-execution of copy trades or snipes -- explicit user confirmation always required
- `list-wallets` always called with `--assets-ids` filter to prevent cross-user data leakage

---

## 12. Multi-User Isolation

ChainPilot supports multiple concurrent Telegram users with strict session isolation:

- Each user gets their own delegate wallet named `cp-<telegram_username>`
- Wallet creation happens during onboarding (Section 0 of SKILL.md)
- All data queries and trade operations are scoped to the user's own assetsId
- One user's portfolio, positions, and trade history are never visible to another user
- Admin commands (wallet listing, system config) are restricted to the admin account
- The admin's wallet ID is never used for other users, even if pre-set in environment

### Root Causes Found & Fixed (v3.3.0)

1. `USER.md` hardcoded "OoJae" -> replaced with multi-user instructions
2. `openclaw.json` had `AVE_ASSETS_ID` hardcoded in skill env -> removed
3. Gateway hadn't been restarted (stale skillsSnapshot) -> restarted with `--force`
4. Memory files leaked OoJae-specific data to all users -> deleted all 22 files

---

## 13. Landing Page & Safety Widget

ChainPilot includes a public-facing landing page (`website/index.html`) served via Node.js (`website/server.js`) behind an Nginx reverse proxy on Tencent Cloud.

### Features
- Hero section with ChainPilot branding and value proposition
- Features grid highlighting key capabilities
- **Live Safety Score Widget** -- visitors can check any token's safety score by entering a contract address and chain. Uses the same composite scoring algorithm as the bot.
- "How It Works" section explaining the user journey
- Supported chains section
- Built with Tailwind CSS CDN for responsive design

The `/api/safety-score` endpoint on the Node.js server calls AVE Cloud REST APIs and computes the same composite safety score used by the Telegram bot, providing a consistent experience across both interfaces.

---

## 14. Supported Chains

| Chain | Trading | Data Queries | WSS Streaming | Notes |
|-------|---------|-------------|---------------|-------|
| Solana | Yes | Yes | Yes | Primary chain. MEV protection. Use `sol` for native token. |
| BSC | Yes | Yes | Yes | ERC-20 approval before selling. Use `0xeee...eee` for native BNB. |
| Ethereum | Yes | Yes | Yes | ERC-20 approval before selling. Higher gas costs. |
| Base | Yes | Yes | Yes | ERC-20 approval before selling. L2 with lower gas. |

---

## 15. Project Structure

```
chainpilot/
|-- README.md                    Project documentation
|-- ARCHITECTURE.md              Detailed architecture docs
|-- .env.example                 Required environment variables
|-- .gitignore
|
|-- skill/                       OpenClaw skill files (production)
|   |-- SKILL.md                 Main skill definition (all routing, safety scoring, trade flows)
|   |-- HEARTBEAT.md             9 scheduled monitoring tasks
|   |-- AGENTS.md                Operating rules & safety constraints
|   |-- SOUL.md                  Personality config (direct, data-driven, safety-first)
|   |-- IDENTITY.md              Agent role definition & greeting rules
|   |-- chainpilot_trade.py      Legacy trade helper (HMAC-SHA256 signing)
|
|-- website/                     Landing page
    |-- index.html               Single-page site (Tailwind CSS CDN)
    |-- server.js                Node.js server + /api/safety-score endpoint
    |-- brand_assets/
        |-- chainpilot_logo.svg
        |-- chainpilot_logo_dark.svg
        |-- ChainPilot_Brand_Guidelines.pdf
```

### What Runs in Production

In production, only the `skill/` files are deployed to the OpenClaw server. All data retrieval and trade execution is handled by `ave-cloud-skill v2.4.0` scripts already installed on the server. ChainPilot adds the intelligence layer on top.

---

## 16. Setup & Deployment

### Prerequisites
- OpenClaw account and server (openclaw.ai)
- AVE Cloud API key -- Pro plan recommended for WSS (cloud.ave.ai)
- Telegram bot token from @BotFather
- Moonshot AI API key (platform.moonshot.cn)
- Node.js 18+ (for landing page only)

### Step 1: Configure Environment
```bash
cp .env.example .env
# Edit .env with your actual API keys
```

### Step 2: Deploy Skill to OpenClaw
Upload `skill/` files to your OpenClaw workspace:
- `SKILL.md` -> `skills/chainpilot/SKILL.md`
- `HEARTBEAT.md` -> workspace root
- `AGENTS.md`, `SOUL.md`, `IDENTITY.md` -> workspace root

### Step 3: Install AVE Cloud Skill (Dependency)
Install `ave-cloud-skill v2.4.0` from the OpenClaw skill store. This provides ave-data-rest, ave-data-wss, and ave-trade-proxy-wallet.

### Step 4: Launch Landing Page (Optional)
```bash
cd website
AVE_API_KEY=your_key node server.js
# Serves on http://localhost:3000
# Configure Nginx reverse proxy for production
```

### Step 5: Connect Telegram Bot
Link your Telegram bot token in OpenClaw settings. The bot will be accessible via Telegram immediately.

---

## 17. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AVE_API_KEY` | Yes | AVE Cloud API key for data queries and trading |
| `AVE_SECRET_KEY` | Yes | HMAC-SHA256 signing secret for proxy wallet authentication |
| `API_PLAN` | Yes | Service tier: `free`, `normal`, or `pro` (pro recommended) |
| `TELEGRAM_BOT_TOKEN` | For Telegram | Bot token from @BotFather |
| `MOONSHOT_API_KEY` | For LLM | Moonshot AI (Kimi K2.5) API key |
| `PORT` | Optional | Landing page server port (default: 3000) |

---

## 18. Live Testing Results

ChainPilot has been tested end-to-end on a live Telegram bot. Results from v3.2.0 testing:

| Feature | Test | Result |
|---------|------|--------|
| Launch Scanner | "What's new on pump.fun?" | **PASS** -- Returns fresh launches + graduating tokens |
| Graduating Tokens | "Show me what's about to graduate" | **PASS** -- pump_in_almost stage working |
| Smart Wallets | "Show me smart wallets on Solana" | **PASS** -- Top wallets with stats |
| Buy + Safety Gate | "Buy 0.002 SOL of TRUMP" | **PASS** -- Safety check -> report -> confirmation |
| Portfolio | "Show me my portfolio" | **PASS** -- Holdings, P&L, market context |
| Cross-Chain | "Compare TRUMP price across chains" | **PASS** -- 4 chains compared |
| Follow + Copy Trade | "Follow wallet HhUX..." | **PASS** -- Trade history, copy trade offer |
| Auto TP/SL on Buy | Buy with --auto-sell flags | **PARTIAL** -- LLM inconsistency, fixed in v3.2.1 |

**7/8 features passing.** All test positions (TRUMP, Bugs) were successfully closed -- sold back to SOL.

---

## 19. Known Limitations

- **Native token withdrawals not supported**: `ave-trade-proxy-wallet transfer` only handles SPL tokens (Solana) and ERC-20 tokens (EVM). Cannot send native SOL/BNB/ETH. **Workaround**: swap native to USDC via market-order, then transfer the USDC.

- **LLM compliance variability**: Kimi K2.5 occasionally omits `--auto-sell` flags despite explicit instructions in SKILL.md. **Workaround**: auto TP/SL is now default-included without user interaction step (v3.2.1).

- **WSS requires Pro plan**: Real-time streaming features (price alerts, liquidity monitoring) require `API_PLAN=pro`. REST fallbacks exist but with higher latency.

- **`transfer` CLI flags**: The correct flags are `--from-address`, `--to-address`, `--token-address` (NOT `--from`, `--to`, `--token`). The `--from-address` is required and must be the delegate wallet address from `list-wallets`.

- **`list-wallets` returns addresses only**: To enumerate held tokens, call `wallet-tokens --wallet <addr> --chain <chain> --hide-sold` after `list-wallets`.

---

## 20. Roadmap & Future Work

- Demo recording (5 min max) for hackathon submission
- Multi-language support (Chinese, Korean, Japanese)
- Advanced charting integration in Telegram (inline kline images)
- Social sentiment analysis integration
- Cross-chain arbitrage detection and execution
- Advanced portfolio analytics (Sharpe ratio, drawdown analysis)
- Native token withdrawal support when AVE adds wrap/unwrap commands
- Custom safety scoring weights per user preference

---

*Built for the AVE Claw Hackathon 2026 by OoJae*
*Powered by OpenClaw + AVE Cloud + Moonshot AI (Kimi K2.5)*
