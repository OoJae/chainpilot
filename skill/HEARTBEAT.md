# ChainPilot Heartbeat

Routing:
- REST data queries → ave-data-rest
- Live streaming subscriptions → ave-data-wss (requires API_PLAN=pro)
- Trade/wallet queries → ave-trade-proxy-wallet

Latency-critical watchers (price alerts, liquidity, whale dumps) are powered by a persistent
ave-data-wss daemon. The heartbeat tasks below either reconcile that daemon's subscription set
or do periodic REST work for tasks that don't benefit from streaming.

tasks:

**SECURITY NOTE — Multi-User Scoping:**
All heartbeat tasks that call `list-wallets` MUST iterate over known user sessions and scope
queries with `--assets-ids <user_assetsId>`. Never call `list-wallets` without the filter —
unfiltered calls return ALL users' wallets and can leak cross-user data in alerts.
Route each user's alerts to their own Telegram session only.


## WSS Daemon: Ensure live stream is up
- name: wss-daemon-ensure
  interval: 5m
  prompt: >
    Ensure the ave-data-wss server daemon is running so the latency-critical watchers stay live.
    1. Check daemon status; if not running, start it:
       `python scripts/ave_data_wss.py start-server`
    2. Build the desired subscription set from current state:
       - Get wallet addresses: `python scripts/ave_trade_rest.py list-wallets`
         (returns assetsId + per-chain wallet addresses — does NOT include token holdings)
       - For each chain wallet address, enumerate held tokens:
         `python scripts/ave_data_rest.py wallet-tokens --wallet <addr> --chain <chain> --hide-sold`
       - All user-configured price alert targets
       - All pairs for held tokens (for tx + liq topics)
    3. Reconcile the daemon's subscriptions:
       - subscribe price <addr-chain> for every held token + alert target
       - subscribe tx <pair> <chain> tx and liq for every held token's primary pair
    4. If a held position was closed, unsubscribe its topics to keep the socket clean.
    5. If the daemon failed to start, fall back to REST polling for this cycle and alert the user
       once: "⚠️ Live stream offline — falling back to REST polling. Reduced latency on alerts."

## Guardian: Position Monitoring
- name: guardian-position-check
  interval: 10m
  prompt: >
    Check all open positions in the delegate wallet:
    Step 1a. Get wallet addresses:
    `python scripts/ave_trade_rest.py list-wallets`
    (returns assetsId + per-chain wallet addresses — does NOT list which tokens are held)
    Step 1b. For each chain address, enumerate held tokens:
    `python scripts/ave_data_rest.py wallet-tokens --wallet <addr> --chain <chain> --hide-sold`
    Use the returned token list for all steps below.
    For each token held:
    1. Get current data: `python scripts/ave_data_rest.py token --address <token> --chain <chain>`
    2. Get holders: `python scripts/ave_data_rest.py holders --address <token> --chain <chain> --limit 20`
    3. Compare with last check — look for:
       - Top 10 holder concentration changed by >5%
       - Any top wallet sold >3% of supply
       - 24h volume dropped >70% from previous check
       - TVL dropped >30%
       - New wallet accumulated >2% of supply
    4. If any trigger fires, send alert to user via Telegram with token name, chain, what changed, and recommended action.
    5. Log snapshot (price, top10 concentration, volume, TVL, holder count) for trend tracking.

## Whale Watch: Large Holder Movements (WSS-driven for tx, REST for holder snapshots)
- name: whale-watch
  interval: 15m
  prompt: >
    First, enumerate held tokens (same as guardian):
    `python scripts/ave_trade_rest.py list-wallets` → get per-chain wallet addresses
    `python scripts/ave_data_rest.py wallet-tokens --wallet <addr> --chain <chain> --hide-sold` → token list
    For each token the user holds, check top holders:
    `python scripts/ave_data_rest.py holders --address <token> --chain <chain> --limit 20 --sort-by balance`
    Exclude holders with dead/burn/lock/null remarks.
    Compare current balance ratios with the last snapshot.
    If any single wallet reduced holdings by >2% of total supply, alert:
    "🐋 Whale Alert: [address_short] sold [X]% of [TOKEN] supply. Top10 concentration: [Y]%."
    Include quick safety re-score if concentration shifted significantly.
    Link: https://pro.ave.ai/token/{address}-{chain}

    Note: real-time large-swap detection comes from the WSS `subscribe tx` stream — this REST
    snapshot job exists to catch slow accumulation/distribution patterns that span >15m windows
    and are not visible from individual tx events.

## Price Alerts (WSS-driven, with REST fallback)
- name: price-alert-check
  interval: 1m
  prompt: >
    Price alerts are primarily fired by the ave-data-wss daemon (see wss-daemon-ensure) — every
    `subscribe price` update is checked against active alert thresholds in real time and triggers
    a Telegram notification within ~1 second of the cross.

    This task runs every 1 minute as a safety net and reconciler:
    1. If the WSS daemon is offline, fall back to REST polling:
       `python scripts/ave_data_rest.py price --tokens <addr1>-<chain1> <addr2>-<chain2>`
       (batch up to 200 tokens in one call)
    2. For any alert that fired via WSS in the last minute, mark as triggered so it doesn't refire.
    3. For any newly created alert, register it with the WSS daemon via wss-daemon-ensure.
    4. Notification format:
       "🎯 [TOKEN] hit your target of $[X]! Current: $[Y] ([+/-Z]% 24h)"

## Daily Portfolio Digest
- name: daily-portfolio-digest
  interval: 24h
  prompt: >
    Generate morning portfolio summary:
    1a. Get wallet addresses: `python scripts/ave_trade_rest.py list-wallets`
    1b. For each chain address, enumerate held tokens:
        `python scripts/ave_data_rest.py wallet-tokens --wallet <addr> --chain <chain> --hide-sold`
    2. For each held token: `python scripts/ave_data_rest.py token --address <token> --chain <chain>`
    3. Re-run safety: `python scripts/ave_data_rest.py risk --address <token> --chain <chain>`
    4. Get native prices: `python scripts/ave_data_rest.py main-tokens --chain solana`
    Include:
    - Total portfolio value
    - Overnight P&L for each position (% and USD)
    - Top gainer and top loser
    - Safety score changes
    - SOL/ETH/BNB 24h price context
    End with: "Reply with a token name to dig deeper."

## Smart Money Copy Trading Tracker
- name: smart-money-scan
  interval: 15m
  prompt: >
    Scan smart wallets for new trades and offer copy-trade opportunities.

    **Step 1 — Discover top smart wallets (Solana + BSC):**
    `python scripts/ave_data_rest.py smart-wallets --chain solana`
    `python scripts/ave_data_rest.py smart-wallets --chain bsc`
    Use top 5 from each chain, plus any wallets the user explicitly follows (check memory).

    **Step 2 — Detect NEW buys since last scan:**
    For each tracked wallet:
    `python scripts/ave_data_rest.py address-txs --wallet <address> --chain <chain> --from-time <last_scan_unix> --page-size 20`
    Filter for buy-side transactions only. Skip tokens already seen in the previous scan.

    **Step 3 — Safety check each new buy:**
    `python scripts/ave_data_rest.py token --address <token> --chain <chain>`
    `python scripts/ave_data_rest.py risk --address <token> --chain <chain>`
    `python scripts/ave_data_rest.py holders --address <token> --chain <chain> --limit 20`
    Compute ChainPilot composite safety score (SKILL.md §3 algorithm).

    **Step 4 — Verify smart wallet track record on this token:**
    `python scripts/ave_data_rest.py address-pnl --wallet <address> --chain <chain> --token <token>`

    **Step 5 — Alert if safety >= 40 and liquidity > $10K:**
    ```
    📡 Copy Trade Alert!
    Smart wallet [addr_short] just bought:
    🪙 [TOKEN] ([chain]) — $[price]
    📊 MCap: $[X] | Vol: $[Y] | Holders: [Z]
    🧠 Wallet PnL on this token: [pnl]
    🛡️ Safety: [score]/100 — [LEVEL]
    → Reply "COPY $10" to mirror, or "SKIP"
    🔗 https://pro.ave.ai/token/{address}-{chain}
    ```

    **Rules:**
    - Maximum 3 copy-trade alerts per scan cycle (avoid spam)
    - Do NOT alert on tokens with safety < 40 (log them but skip the alert)
    - Do NOT alert on the same token twice within 1 hour
    - Save current scan timestamp to memory for next cycle's `--from-time`

## Liquidity Monitor (WSS-driven for tx, REST for lock state)
- name: liquidity-monitor
  interval: 5m
  prompt: >
    LP-pull and large-swap detection are driven by the ave-data-wss daemon's `subscribe tx <pair>
    <chain> liq` and `tx` topics. When a liquidity-removal event hits the socket, fire immediately:
       "🚨 LP Pull: [TOKEN] removed $[X] of liquidity. Pair LP now $[Y]. Consider exit."

    This task runs every 5 minutes as a reconciler for state that WSS does not stream:
    0. Enumerate held tokens (same as guardian):
       `python scripts/ave_trade_rest.py list-wallets` → per-chain wallet addresses
       `python scripts/ave_data_rest.py wallet-tokens --wallet <addr> --chain <chain> --hide-sold`
    1. For each held token: `python scripts/ave_data_rest.py token --address <token> --chain <chain>`
    2. If liquidity dropped >20% since last check (catches slow drains):
       "⚠️ Liquidity Warning: [TOKEN] LP dropped [X]% in 5 min. Current: $[Y]."
    3. Get risk report: `python scripts/ave_data_rest.py risk --address <token> --chain <chain>`
    4. If pair_lock_percent decreased:
       "🔓 LP Unlock Warning: [TOKEN] lock dropped from [X]% to [Y]%."
    These are critical safety signals — prioritize delivery.

## Trending Scanner
- name: trending-scanner
  interval: 60m
  prompt: >
    Scan trending tokens on Solana and BSC:
    `python scripts/ave_data_rest.py trending --chain solana --page-size 20`
    `python scripts/ave_data_rest.py trending --chain bsc --page-size 20`
    Identify tokens NEW to trending (not in last scan).
    For each new token:
    1. Risk check: `python scripts/ave_data_rest.py risk --address <token> --chain <chain>`
    2. If safety score >= 50 and liquidity > $50K:
       "🔥 New Trending: [TOKEN] on [chain] — $[price] (+[X]% 24h), MCap $[Y], Safety [score]/100"
    Bundle max 5 tokens per alert.
    Link: https://pro.ave.ai/token/{address}-{chain}

## Launch Scanner: New Token Discovery
- name: launch-scanner
  interval: 10m
  prompt: >
    Scan new token launches across major launchpads and alert on safety-passing tokens.

    **Step 1 — Query new launches from top platforms:**
    `python scripts/ave_data_rest.py platform-tokens --platform pump_in_new --limit 10`
    `python scripts/ave_data_rest.py platform-tokens --platform bonk_in_new --limit 5`
    `python scripts/ave_data_rest.py platform-tokens --platform boop_in_new --limit 5`
    `python scripts/ave_data_rest.py platform-tokens --platform meteora_in_new --limit 5`
    `python scripts/ave_data_rest.py platform-tokens --platform fourmeme_in_new --limit 5`

    Also check graduating tokens (about to leave bonding curve — higher signal):
    `python scripts/ave_data_rest.py platform-tokens --platform pump_in_almost --limit 5`

    **Step 2 — Deduplicate:**
    Compare returned token addresses against the previous scan's results (stored in memory).
    Only process tokens NOT seen in the last scan cycle.

    **Step 3 — Safety check each new token:**
    `python scripts/ave_data_rest.py token --address <token> --chain <chain>`
    `python scripts/ave_data_rest.py risk --address <token> --chain <chain>`
    `python scripts/ave_data_rest.py holders --address <token> --chain <chain> --limit 20`
    Compute ChainPilot composite safety score (SKILL.md §3 algorithm).

    **Step 4 — Alert if safety >= 40 AND liquidity > $5K:**
    ```
    🚀 New Launch Alert — [platform] ([chain])
    🪙 [TOKEN] — launched [X] min ago
    💰 $[price] | MCap: $[X] | Liq: $[Y]
    👥 [Z] holders
    🛡️ Safety: [score]/100 — [LEVEL]
    → Reply "SNIPE [TOKEN] $5" to buy with auto TP/SL protection
    🔗 https://pro.ave.ai/token/{address}-{chain}
    ```

    **Rules:**
    - Maximum 3 launch alerts per scan cycle (avoid spam)
    - Prioritize graduating tokens (`_in_almost`) over just-launched (`_in_new`)
    - Do NOT alert on tokens with safety < 40 or liquidity < $5K
    - Do NOT alert on the same token twice
    - Save current token list to memory for next cycle's deduplication
    - Include disclaimer: "⚠️ New launches are high-risk. Small positions ($5-10) recommended."
