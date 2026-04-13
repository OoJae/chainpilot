import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const AVE_API_KEY = process.env.AVE_API_KEY;
const AVE_BASE = 'https://data.ave-api.xyz/v2';

if (!AVE_API_KEY) {
  console.error('ERROR: AVE_API_KEY environment variable is required');
  process.exit(1);
}

// ── MIME types ──
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ── AVE API helper ──
async function aveGet(endpoint) {
  const res = await fetch(`${AVE_BASE}${endpoint}`, {
    headers: { 'X-API-KEY': AVE_API_KEY, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`AVE API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Safety scoring algorithm (matches skill.md / ARCHITECTURE.md) ──
function computeSafetyScore(riskData, holdersData, tokenData) {
  let score = 100;
  const factors = [];

  const contract = riskData?.data || riskData || {};
  const holderList = Array.isArray(holdersData?.data) ? holdersData.data : [];
  const tokenObj = tokenData?.data?.token || tokenData?.data || tokenData || {};

  // ── Instant disqualifiers ──
  if (contract.is_honeypot === 1 || contract.is_honeypot === '1' || contract.is_honeypot === true) {
    factors.push({ name: 'Honeypot Detection', status: 'FAIL', detail: 'Token is a honeypot' });
    return { score: 0, riskLevel: 'HIGH RISK', factors };
  }
  factors.push({ name: 'Honeypot Check', status: 'PASS', detail: 'Not a honeypot' });

  if (contract.cannot_buy === '1' || contract.cannot_buy === 1) {
    factors.push({ name: 'Buy Check', status: 'FAIL', detail: 'Cannot buy this token' });
    return { score: 0, riskLevel: 'HIGH RISK', factors };
  }

  if (contract.cannot_sell_all === '1' || contract.cannot_sell_all === 1) {
    factors.push({ name: 'Sell Check', status: 'FAIL', detail: 'Cannot sell all tokens' });
    return { score: 0, riskLevel: 'HIGH RISK', factors };
  }

  // ── Buy/sell tax ──
  const buyTax = parseFloat(contract.buy_tax || 0) * 100;
  const sellTax = parseFloat(contract.sell_tax || 0) * 100;
  const maxTax = Math.max(buyTax, sellTax);
  if (maxTax > 10) {
    score -= 30;
    factors.push({ name: 'Buy/Sell Tax', status: 'FAIL', detail: `${buyTax.toFixed(1)}% / ${sellTax.toFixed(1)}% (>10%)` });
  } else if (maxTax > 5) {
    score -= 15;
    factors.push({ name: 'Buy/Sell Tax', status: 'WARN', detail: `${buyTax.toFixed(1)}% / ${sellTax.toFixed(1)}% (>5%)` });
  } else {
    factors.push({ name: 'Buy/Sell Tax', status: 'PASS', detail: `${buyTax.toFixed(1)}% / ${sellTax.toFixed(1)}%` });
  }

  // ── Mint method ──
  if (contract.has_mint_method === 1 || contract.has_mint_method === '1') {
    score -= 15;
    factors.push({ name: 'Mint Method', status: 'FAIL', detail: 'Contract has mint function' });
  }

  // ── Hidden owner ──
  if (contract.hidden_owner === '1' || contract.hidden_owner === 1) {
    score -= 15;
    factors.push({ name: 'Hidden Owner', status: 'FAIL', detail: 'Ownership is hidden' });
  }

  // ── LP lock ──
  const lpLock = parseFloat(contract.pair_lock_percent || contract.lp_lock_percent || 0);
  if (lpLock < 0.5) {
    score -= 20;
    factors.push({ name: 'LP Lock', status: 'FAIL', detail: `${(lpLock * 100).toFixed(0)}% locked (<50%)` });
  } else {
    factors.push({ name: 'LP Lock', status: 'PASS', detail: `${(lpLock * 100).toFixed(0)}% locked` });
  }

  // ── Holder concentration (top 10, excluding dead/burn/lock/null) ──
  const DEAD_ADDRS = ['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead',
    '0x0000000000000000000000000000000000000001', '1nc1nerator11111111111111111111111111111111'];
  let top10Pct = 0;
  if (holderList.length > 0) {
    const filtered = holderList.filter(h => {
      const addr = (h.address || h.holder || '').toLowerCase();
      const tags = h.new_tags || [];
      const tagText = tags.map(t => (t.en || t.cn || '')).join(' ').toLowerCase();
      if (DEAD_ADDRS.some(d => addr.includes(d))) return false;
      if (/dead|burn|lock|null|hole/i.test(tagText)) return false;
      return true;
    });
    // balance_ratio is a decimal (e.g., 0.767 = 76.7%)
    top10Pct = filtered.slice(0, 10).reduce((sum, h) => {
      const ratio = parseFloat(h.balance_ratio || h.percent || h.percentage || 0);
      return sum + (ratio > 1 ? ratio / 100 : ratio); // normalize to 0-1
    }, 0);
  }

  const top10PctDisplay = (top10Pct * 100).toFixed(1);
  if (top10Pct > 0.8) {
    score -= 25;
    factors.push({ name: 'Top 10 Holders', status: 'FAIL', detail: `${top10PctDisplay}% concentration (>80%)` });
  } else if (top10Pct > 0.5) {
    score -= 15;
    factors.push({ name: 'Top 10 Holders', status: 'WARN', detail: `${top10PctDisplay}% concentration (>50%)` });
  } else if (top10Pct > 0.3) {
    score -= 5;
    factors.push({ name: 'Top 10 Holders', status: 'WARN', detail: `${top10PctDisplay}% concentration (>30%)` });
  } else if (top10Pct > 0) {
    factors.push({ name: 'Top 10 Holders', status: 'PASS', detail: `${top10PctDisplay}% concentration` });
  }

  // ── Liquidity ──
  const tvl = parseFloat(tokenObj.tvl || tokenObj.main_pair_tvl || tokenObj.liquidity || contract.tvl || 0);
  if (tvl < 10000) {
    score -= 20;
    factors.push({ name: 'Liquidity', status: 'FAIL', detail: `$${formatNum(tvl)} (<$10K)` });
  } else if (tvl < 50000) {
    score -= 10;
    factors.push({ name: 'Liquidity', status: 'WARN', detail: `$${formatNum(tvl)} (<$50K)` });
  } else {
    factors.push({ name: 'Liquidity', status: 'PASS', detail: `$${formatNum(tvl)}` });
  }

  // ── Blacklist method ──
  if (contract.has_black_method === 1 || contract.has_black_method === '1') {
    score -= 10;
    factors.push({ name: 'Blacklist Code', status: 'WARN', detail: 'Contract has blacklist function' });
  }

  // ── Take back ownership ──
  if (contract.can_take_back_ownership === '1' || contract.can_take_back_ownership === 1) {
    score -= 10;
    factors.push({ name: 'Ownership Recovery', status: 'WARN', detail: 'Owner can reclaim ownership' });
  }

  // ── Transfer pausable ──
  if (contract.transfer_pausable === '1' || contract.transfer_pausable === 1) {
    score -= 10;
    factors.push({ name: 'Transfer Pausable', status: 'WARN', detail: 'Transfers can be paused' });
  }

  // ── Slippage modifiable ──
  if (contract.slippage_modifiable === '1' || contract.slippage_modifiable === 1) {
    score -= 10;
    factors.push({ name: 'Slippage Modifiable', status: 'WARN', detail: 'Slippage can be modified' });
  }

  // ── External call ──
  if (contract.external_call === '1' || contract.external_call === 1) {
    score -= 5;
    factors.push({ name: 'External Call', status: 'WARN', detail: 'Contract makes external calls' });
  }

  score = Math.max(0, Math.min(100, score));

  let riskLevel;
  if (score >= 70) riskLevel = 'RELATIVELY SAFE';
  else if (score >= 40) riskLevel = 'MODERATE RISK';
  else riskLevel = 'HIGH RISK';

  return { score, riskLevel, factors };
}

function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

// ── Request handler ──
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── API: Safety Score ──
  if (req.method === 'POST' && req.url === '/api/safety-score') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { address, chain } = JSON.parse(body);

        if (!address || !chain) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'address and chain are required' }));
          return;
        }

        const validChains = ['solana', 'bsc', 'eth', 'base'];
        if (!validChains.includes(chain)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `chain must be one of: ${validChains.join(', ')}` }));
          return;
        }

        // Sanitize address — only allow alphanumeric and common token address chars
        if (!/^[a-zA-Z0-9]{20,60}$/.test(address) && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid token address format' }));
          return;
        }

        // Fetch data from AVE Cloud in parallel
        const [riskData, holdersData, tokenData] = await Promise.all([
          aveGet(`/contracts/${address}-${chain}`).catch(() => ({})),
          aveGet(`/tokens/holders/${address}-${chain}`).catch(() => ({})),
          aveGet(`/tokens/${address}-${chain}`).catch(() => ({})),
        ]);

        // Extract token name
        const tokenInfo = tokenData?.data?.token || tokenData?.data || tokenData || {};
        const tokenName = tokenInfo.symbol || tokenInfo.name || tokenInfo.token_name || 'Unknown';

        // Compute safety score
        const result = computeSafetyScore(riskData, holdersData, tokenData);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          score: result.score,
          riskLevel: result.riskLevel,
          factors: result.factors,
          tokenName,
          chain,
          address,
        }));
      } catch (err) {
        console.error('Safety score error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to compute safety score. Check address and try again.' }));
      }
    });
    return;
  }

  // ── Static files ──
  let filePath = req.url === '/' ? '/index.html' : req.url;

  // Prevent path traversal
  filePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(__dirname, filePath);

  // Ensure we stay within project dir
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath);
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(fullPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ChainPilot website running at http://localhost:${PORT}`);
  console.log(`Safety score API at http://localhost:${PORT}/api/safety-score`);
});
