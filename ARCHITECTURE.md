# ChainPilot Architecture

## Overview

ChainPilot is an AI-powered on-chain trading copilot deployed as an OpenClaw skill on Tencent Cloud, accessed via Telegram. It follows a **wrapper skill pattern** — delegating REST data queries to `ave-data-rest`, real-time streams to `ave-data-wss`, and trade execution to `ave-trade-proxy-wallet` (all from `ave-cloud-skill v2.4.0`), while adding safety scoring, trade gating, position monitoring, alert pipelines, and cross-chain comparison as its unique intelligence layer.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        User (Telegram)                            │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                    OpenClaw 2026.4.2                              │
│              (Tencent Cloud Lighthouse)                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  ChainPilot (skill.md v3.3.0)                │ │
│  │                                                             │ │
│  │  ┌───────────────────────────────────────────────────────┐  │ │
│  │  │           ChainPilot Unique Logic                     │  │ │
│  │  │                                                       │  │ │
│  │  │  • Safety Scoring (0-100 composite)                   │  │ │
│  │  │  • Trade Gating (refuse <20, warn <40)                │  │ │
│  │  │  • Auto TP/SL Risk Management (server-side exits)     │  │ │
│  │  │  • Smart Money Copy Trading (track + mirror)          │  │ │
│  │  │  • Launch Scanner (90+ launchpads + safety filter)    │  │ │
│  │  │  • Portfolio P&L Tracking                             │  │ │
│  │  │  • Guardian Alerts (HEARTBEAT.md)                     │  │ │
│  │  │  • Daily Digest Generation                            │  │ │
│  │  │  • Price Alert System (WSS-driven, ~1s)               │  │ │
│  │  │  • Liquidity / Rug Detection (WSS LP-pull)            │  │ │
│  │  │  • Trending Scanner with Safety Filter                │  │ │
│  │  │  • Cross-Chain Price Comparison                       │  │ │
│  │  │  • WSS Daemon Subscription Reconciler                 │  │ │
│  │  └───────────────────────────────────────────────────────┘  │ │
│  │              │              │                  │            │ │
│  │  ┌───────────▼────┐ ┌───────▼────────┐ ┌──────▼──────────┐ │ │
│  │  │ ave-data-rest  │ │ ave-data-wss   │ │ ave-trade-       │ │ │
│  │  │                │ │                │ │ proxy-wallet     │ │ │
│  │  │ • search       │ │ • watch-price  │ │ • market-order   │ │ │
│  │  │ • token        │ │ • watch-tx     │ │ • limit-order    │ │ │
│  │  │ • risk         │ │ • watch-kline  │ │ • auto-slippage  │ │ │
│  │  │ • holders      │ │ • wss-repl     │ │ • gas-tip        │ │ │
│  │  │ • trending     │ │ • start-server │ │ • approve-token  │ │ │
│  │  │ • ranks        │ │ • serve        │ │ • approve-chain  │ │ │
│  │  │ • kline-token  │ │ • stop-server  │ │ • list-wallets   │ │ │
│  │  │ • smart-wallets│ │                │ │ • get-swap-orders│ │ │
│  │  │ • wallet-info  │ │ Persistent     │ │ • cancel-limit   │ │ │
│  │  │ • signals      │ │ Docker daemon  │ │ • transfer       │ │ │
│  │  │ • price (batch)│ │ for live data  │ │                  │ │ │
│  │  │                │ │ Requires       │ │ HMAC-SHA256 auth │ │ │
│  │  │ X-API-KEY auth │ │ API_PLAN=pro   │ │ handled in script│ │ │
│  │  └───────┬────────┘ └────────┬───────┘ └──────────┬───────┘ │ │
│  └──────────┼──────────────────┼────────────────────┼─────────┘ │
│             │                  │                    │            │
│  ┌──────────▼──────────────────▼────────────────────▼─────────┐ │
│  │               HEARTBEAT.md Scheduler (9 tasks)              │ │
│  │                                                            │ │
│  │  wss-daemon-ensure          5m   Reconcile WSS subs        │ │
│  │  guardian-position-check   10m   Position monitoring       │ │
│  │  whale-watch               15m   Holder movements          │ │
│  │  price-alert-check          1m   Reconciler (WSS fires)    │ │
│  │  daily-portfolio-digest    24h   Morning summary           │ │
│  │  smart-money-scan          15m   Copy trade alerts         │ │
│  │  liquidity-monitor          5m   LP/lock state (WSS fires) │ │
│  │  trending-scanner          60m   New trending tokens       │ │
│  │  launch-scanner            10m   New launch discovery      │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
   AVE Data REST    AVE Data WSS    AVE Trade API
   data.ave-api.xyz wss.ave-api.xyz bot-api.ave.ai
   (X-API-KEY)      (X-API-KEY,     (HMAC-SHA256)
                     pro plan)
```

## Data Flow: Buy Trade

```
User: "Buy $10 of TRUMP on Solana"
  │
  ▼
1. ChainPilot parses intent → BUY, $10, TRUMP, solana
  │
  ▼
2. ave-data-rest search --keyword TRUMP --chain solana
   → Resolves contract address
  │
  ▼
3. SAFETY CHECK (ChainPilot unique):
   ├── ave-data-rest risk --address <token> --chain solana
   ├── ave-data-rest holders --address <token> --chain solana
   ├── ave-data-rest token --address <token> --chain solana
   └── ChainPilot computes composite score (0-100)
  │
  ▼
4. Present safety report to user
   ├── Score < 20 → REFUSE trade, stop here
   ├── Score < 40 → Require "YES I UNDERSTAND THE RISK"
   └── Score >= 40 → Require "YES"
  │
  ▼
5. User confirms "YES"
  │
  ▼
5b. ChainPilot offers auto TP/SL (safety-score-banded defaults)
    User accepts or customizes → build --auto-sell JSON rules
  │
  ▼
6. ave-data-rest main-tokens --chain solana → get SOL price
   Calculate: $10 / SOL_price × 10^9 = lamports
  │
  ▼
7. ave-trade-proxy-wallet market-order
   --chain solana --in-token sol --out-token <address>
   --in-amount <lamports> --swap-type buy --slippage 500 --use-mev
   --auto-sell '{"priceChange":"5000","sellRatio":"5000","type":"default"}'
   --auto-sell '{"priceChange":"-2000","sellRatio":"10000","type":"default"}'
   --auto-sell '{"priceChange":"1000","sellRatio":"10000","type":"trailing"}'
  │
  ▼
8. ave-trade-proxy-wallet get-swap-orders --ids <order_id>
   → Poll until confirmed
  │
  ▼
9. Report result to user with tx details
   Guardian monitoring activated via HEARTBEAT.md
```

## Data Flow: Guardian Alert

```
HEARTBEAT.md triggers guardian-position-check (every 10m)
  │
  ▼
1a. ave-trade-proxy-wallet list-wallets → get per-chain wallet addresses
1b. ave-data-rest wallet-tokens --wallet <addr> --chain <chain> → enumerate held tokens
  │
  ▼
2. For each token:
   ├── ave-data-rest token --address <token> --chain <chain>
   ├── ave-data-rest holders --address <token> --chain <chain>
   └── Compare with previous snapshot
  │
  ▼
3. Check thresholds:
   ├── Top 10 concentration shifted >5%?
   ├── Any whale sold >3% of supply?
   ├── 24h volume dropped >70%?
   ├── TVL dropped >30%?
   └── LP lock decreased?
  │
  ▼
4. If triggered → Send Telegram alert with:
   Token name, chain, what changed, recommended action,
   AVE Pro link
```

## Data Flow: Real-Time Price Alert (WSS)

```
1. User sets price alert: "alert me when TRUMP hits $20"
   ChainPilot stores target in alert state, then:
  │
  ▼
2. wss-daemon-ensure (every 5m) reconciles subscriptions:
   ├── Confirm daemon is running (start-server if not)
   └── ave_data_wss.py → subscribe price <addr>-solana
  │
  ▼
3. AVE WSS pushes a price tick (sub-second cadence)
  │
  ▼
4. ChainPilot evaluates each tick against active alert thresholds
   ├── Below threshold → ignore
   └── Crossed → fire Telegram alert immediately
  │
  ▼
5. "🎯 TRUMP hit your target of $20! Current: $20.04 (+12.3% 24h)"
   Mark alert as triggered (idempotent)
  │
  ▼
6. price-alert-check heartbeat (1m) is a safety-net reconciler:
   ├── If WSS daemon offline → REST batch fetch via `price` endpoint
   └── Sync newly created alerts into the daemon
```

The same pattern handles **rug detection** via `subscribe tx <pair> <chain> liq` —
LP-removal events fire `🚨 LP Pull` alerts within ~1s of the on-chain event,
instead of waiting up to 20 minutes for the next REST poll.

## Safety Scoring Algorithm

```
Start: 100 points

INSTANT DISQUALIFIERS (→ 0):
  is_honeypot = 1
  cannot_buy = "1"
  cannot_sell_all = "1"

MAJOR DEDUCTIONS:
  buy/sell tax > 10%        → -30
  buy/sell tax > 5%         → -15
  has_mint_method = 1       → -15
  hidden_owner = "1"        → -15
  pair_lock_percent < 0.5   → -20
  top10 concentration > 80% → -25  (excl dead/burn/lock/null)
  top10 concentration > 50% → -15
  liquidity < $10K          → -20
  sell simulation < 90%     → -20

MINOR DEDUCTIONS:
  has_black_method = 1      → -10
  can_take_back_ownership   → -10
  transfer_pausable         → -10
  slippage_modifiable = 1   → -10
  external_call = "1"       → -5
  liquidity < $50K          → -10
  top10 concentration > 30% → -5

RESULT:
  0-39  → 🔴 HIGH RISK
  40-69 → 🟡 MODERATE RISK
  70-100→ 🟢 RELATIVELY SAFE
```

## Multi-User Architecture (v3.3.0)

```
Telegram User A ──┐
Telegram User B ──┼── OpenClaw Gateway (port 31070)
Telegram User C ──┘        │
                           │  dmScope: "per-channel-peer"
                           │  session key: agent:main:telegram:direct:<sender_id>
                           │
                    ┌──────▼──────┐
                    │  Shared     │  USER.md (multi-user, no hardcoded names)
                    │  Workspace  │  IDENTITY.md, AGENTS.md, SOUL.md
                    │             │  SKILL.md (§0 ONBOARDING, §0b ADMIN GATE)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        Session A    Session B    Session C
        (isolated)   (isolated)   (isolated)
        assetsId: X  assetsId: Y  assetsId: Z
        wallet:      wallet:      wallet:
        cp-userA     cp-userB     cp-userC
```

**Key design decisions:**
- **Per-user wallets:** Each user gets a dedicated delegate wallet (`create-wallet --name "cp-<username>"`) on first interaction. The `assetsId` is stored in the per-session context.
- **No shared `AVE_ASSETS_ID`:** Removed from `openclaw.json` skill env to prevent the LLM from using a default wallet for all users.
- **Admin gate:** Only @Oo_Jae can access heartbeat config, system commands, and other users' data. Enforced in SKILL.md §0b.
- **Session isolation:** OpenClaw's `dmScope: "per-channel-peer"` gives each Telegram user a separate conversation session, memory, and wallet context.
- **Gateway restart required:** SKILL.md changes are cached in a `skillsSnapshot` at gateway startup. Run `openclaw gateway --force` after modifying skill files.

## Landing Page Architecture (v3.3.0)

```
Browser ──── http://43.153.109.3 ──── Nginx (port 80)
                                        │
                                   proxy_pass
                                        │
                                   Node.js server.js (port 3000)
                                        │
                              ┌─────────┼──────────┐
                              ▼                    ▼
                         Static files         POST /api/safety-score
                         index.html               │
                         (Tailwind CDN)      ┌────┼────┐
                                             ▼    ▼    ▼
                                          AVE Cloud REST API
                                          /contracts/{addr}-{chain}  (risk)
                                          /tokens/holders/{addr}-{chain}
                                          /tokens/{addr}-{chain}  (liquidity)
                                                 │
                                          Composite score (0-100)
                                          Same algorithm as SKILL.md §3
```

**Stack:** Single `index.html` + `server.js` (Node.js, zero npm dependencies). Tailwind CSS via CDN.

## Deployment

| Component | Location |
|-----------|----------|
| OpenClaw server | Tencent Cloud Lighthouse |
| ChainPilot skill | `/root/.openclaw/workspace/skills/chainpilot/` |
| ave-cloud-skill | Pre-installed via OpenClaw marketplace |
| LLM | Moonshot AI (Kimi K2.5), Tier 1 |
| Bot | Telegram, connected via OpenClaw |
| Landing page | `/root/website-building/` — Nginx on port 80 → Node.js on port 3000 |

### Files deployed (v3.3.0):
- `skill.md` — main skill definition (v3.3.0 — §0 onboarding with per-user wallet creation, §0b admin gate, §4c auto TP/SL, §8 copy trading, §9 launch scanner)
- `HEARTBEAT.md` — scheduled tasks, 9 total (v3.2.0)
- `AGENTS.md` — operating rules (v3.3.0 — added multi-user isolation mandatory section)
- `IDENTITY.md` — role (v3.3.0 — dynamic Telegram display name greeting)
- `USER.md` — multi-user instructions (v3.3.0 — no hardcoded names)
- `SOUL.md` — personality (unchanged)

### Prerequisites on the OpenClaw server:
- `ave-cloud-skill v2.4.0` installed via OpenClaw marketplace (provides `ave-data-rest`, `ave-data-wss`, `ave-trade-proxy-wallet`)
- Docker available for the WSS daemon (`ave_data_wss.py start-server`)
- `API_PLAN=pro` (required for ave-data-wss streams)
- Node.js for landing page server
- Nginx for reverse proxy (port 80 → 3000)

### Environment variables on server:
- `AVE_API_KEY` — for all data + trade operations
- `AVE_SECRET_KEY` — for proxy wallet HMAC signing
- `API_PLAN=pro` — required for ave-data-wss
- Note: `AVE_ASSETS_ID` deliberately NOT set — each user creates their own wallet

## Supported Chains

| Chain | ID | Native Token | Decimals |
|-------|----|-------------|----------|
| Solana | `solana` | `sol` | 9 (lamports) |
| BSC | `bsc` | `0xeeee...eeee` | 18 (wei) |
| Ethereum | `eth` | `0xeeee...eeee` | 18 (wei) |
| Base | `base` | `0xeeee...eeee` | 18 (wei) |
