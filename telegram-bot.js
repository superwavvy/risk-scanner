const fs = require('fs');
const path = require('path');

try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('Missing TELEGRAM_BOT_TOKEN in .env'); process.exit(1); }
const BRAND = process.env.BRAND_NAME || 'Risk Scanner';
const TG = `https://api.telegram.org/bot${TOKEN}`;
const GOPLUS = 'https://api.gopluslabs.io/api/v1';
const EVM_CHAINS = { 1: 'Ethereum', 56: 'BSC', 8453: 'Base', 42161: 'Arbitrum', 137: 'Polygon', 10: 'Optimism', 4663: 'Robinhood' };

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const flag = v => v === '1' || v === 1 || v === true;
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const pct = f => (f * 100).toFixed(1) + '%';
const nonEmpty = v => Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : !!v;
const isEvm = a => /^0x[a-fA-F0-9]{40}$/.test(a);
const isSol = a => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Dexscreener URL builder
function getDexUrl(chain, addr) {
  const c = chain.toLowerCase();
  const map = { 'ethereum': 'ethereum', 'bsc': 'bsc', 'base': 'base', 'arbitrum': 'arbitrum', 'polygon': 'polygon', 'optimism': 'optimism', 'solana': 'solana', 'robinhood': 'robinhood' };
  return `https://dexscreener.com/${map[c] || 'ethereum'}/${addr}`;
}

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function topShare(holders = [], keep = () => true) {
  const ps = holders.filter(keep).map(h => num(h.percent)).sort((a, b) => b - a).slice(0, 10);
  const sum = ps.reduce((a, b) => a + b, 0);
  return (ps[0] || 0) > 1 ? sum / 100 : sum;
}

// Rebalanced Concentration Logic
function concentrationPts(top10, add) {
  if (top10 > 0.7) add(60, `Extreme whale concentration (Top 10: ${pct(top10)})`);
  else if (top10 > 0.5) add(40, `High whale concentration (Top 10: ${pct(top10)})`);
  else if (top10 > 0.3) add(20, `Moderate whale concentration (Top 10: ${pct(top10)})`);
}

async function scanEvm(addr) {
  const key = addr.toLowerCase();
  const res = await Promise.allSettled(Object.keys(EVM_CHAINS).map(async id => {
    const j = await getJson(`${GOPLUS}/token_security/${id}?contract_addresses=${key}`);
    const d = j?.result?.[key];
    return d && (d.token_name || d.holder_count) ? { id, d } : null;
  }));
  if (res.every(r => r.status === 'rejected')) throw new Error('GoPlus API unreachable');
  const hits = res.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
  if (!hits.length) return null;
  hits.sort((a, b) => num(b.d.holder_count) - num(a.d.holder_count));
  return { chain: EVM_CHAINS[hits[0].id], d: hits[0].d, kind: 'evm' };
}

async function scanSol(addr) {
  const j = await getJson(`${GOPLUS}/solana/token_security?contract_addresses=${addr}`);
  const d = j?.result?.[addr];
  return d ? { chain: 'Solana', d, kind: 'sol' } : null;
}

// Rebalanced Scoring
function analyze({ d, kind }) {
  const flags = [];
  const add = (pts, text) => flags.push({ pts, text });
  let info = {};

  if (kind === 'evm') {
    if (flag(d.is_honeypot)) add(100, 'Honeypot: Cannot sell');
    if (flag(d.cannot_sell_all)) add(80, 'Cannot sell full balance');
    if (flag(d.owner_change_balance)) add(60, 'Owner can change balances');
    
    const sell = num(d.sell_tax), buy = num(d.buy_tax);
    if (sell >= 0.5) add(50, `Extreme sell tax (${pct(sell)})`);
    else if (sell >= 0.2) add(25, `High sell tax (${pct(sell)})`);
    else if (sell >= 0.1) add(10, `Sell tax ${pct(sell)}`);
    
    if (buy >= 0.3) add(25, `High buy tax (${pct(buy)})`);
    else if (buy >= 0.1) add(10, `Buy tax ${pct(buy)}`);

    if (!flag(d.is_open_source)) add(30, 'Source code unverified');
    if (flag(d.is_mintable)) add(25, 'Mintable (Supply can inflate)');
    if (flag(d.slippage_modifiable)) add(20, 'Owner can change taxes');
    if (flag(d.transfer_pausable)) add(20, 'Transfers can be paused');
    if (flag(d.is_blacklisted)) add(20, 'Owner can blacklist wallets');
    
    if (num(d.creator_percent) > 0.1) add(15, `Creator holds ${pct(num(d.creator_percent))}`);
    
    const top10 = topShare(d.holders, h => !flag(h.is_contract));
    concentrationPts(top10, add);
    
    let lpLocked = null;
    const v4 = nonEmpty(d.dex) && d.dex.some(x => /v4/i.test(JSON.stringify(x)));
    if (nonEmpty(d.lp_holders) && !v4) {
      lpLocked = d.lp_holders.filter(h => flag(h.is_locked)).reduce((a, h) => a + num(h.percent), 0);
      if (lpLocked < 0.5) add(25, `Low liquidity locked (${pct(lpLocked)})`);
    }
    if (num(d.holder_count) < 50) add(10, 'Very few holders');
    if (lpLocked === null) add(25, 'LP lock could not be verified');
    info = { name: d.token_name, symbol: d.token_symbol, holders: num(d.holder_count), top10, buy, sell, lpLocked };

  } else {
    const on = o => flag(o?.status);
    if (on(d.mintable)) add(40, 'Mint authority active');
    if (on(d.freezable)) add(40, 'Freeze authority active');
    if (on(d.balance_mutable_authority)) add(50, 'Authority can change balances');
    if (on(d.closable)) add(20, 'Account closable by authority');
    if (on(d.non_transferable)) add(40, 'Non-transferable token');
    if (nonEmpty(d.transfer_fee)) add(25, 'Transfer fee enabled');
    if (nonEmpty(d.transfer_hook)) add(25, 'Transfer hook present');
    
    const top10 = topShare(d.holders);
    concentrationPts(top10, add);
    if (num(d.holder_count) < 50) add(10, 'Very few holders');
    info = { name: d.metadata?.name, symbol: d.metadata?.symbol, holders: num(d.holder_count), top10 };
  }

  flags.sort((a, b) => b.pts - a.pts);
  let score = Math.min(100, flags.reduce((a, f) => a + f.pts, 0));
  // Floors: some flags should never read as a low or medium risk
  if (flags.some(f => /honeypot/i.test(f.text))) score = Math.max(score, 75);   // CRITICAL
  if (flags.some(f => /liquidity/i.test(f.text))) score = Math.max(score, 50);  // at least HIGH
  return { flags, score, ...info };
}

function verdict(s) {
  if (s >= 75) return ['🔴', 'CRITICAL'];
  if (s >= 50) return ['🟠', 'HIGH'];
  if (s >= 25) return ['🟡', 'MEDIUM'];
  return ['🟢', 'LOW'];
}

// NEW Clean UI Format
function format(r, addr, chain) {
  const [em, lvl] = verdict(r.score);
  const dexUrl = getDexUrl(chain, addr);
  
  let msg = `🛡️ <b>${esc(r.name || 'Unknown')}</b> (${esc(r.symbol || '?')})\n`;
  msg += `└ <i>${chain}</i>\n\n`;
  
  msg += `${em} <b>Risk Level: ${lvl}</b>\n`;
  msg += `📊 <a href="${dexUrl}">View Chart & Socials on Dexscreener</a>\n\n`;

  if (r.flags.length) {
    msg += `<b>🚩 Detected Risks:</b>\n`;
    for (const f of r.flags.slice(0, 5)) {
      msg += `• ${esc(f.text)}\n`;
    }
    if (r.flags.length > 5) msg += `<i>...and ${r.flags.length - 5} more.</i>\n`;
  } else {
    msg += `<b>✅ No major risks detected</b>\n`;
  }

  msg += `\n<b>📋 Metrics:</b>\n`;
  msg += `• Holders: <b>${r.holders.toLocaleString('en-US')}</b>\n`;
  msg += `• Top 10: <b>${pct(r.top10)}</b>\n`;
  if (r.buy !== undefined) msg += `• Tax: Buy <b>${pct(r.buy)}</b> / Sell <b>${pct(r.sell)}</b>\n`;
  if (r.lpLocked !== undefined) msg += `• LP Locked: <b>${r.lpLocked === null ? "Unknown" : pct(r.lpLocked)}</b>\n`;

  msg += `\n<blockquote><code>${esc(addr)}</code></blockquote>\n`;
  msg += `<i>⚠️ Not financial advice. DYOR.</i>`;
  return msg;
}

async function tg(method, body) {
  const r = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40000)
  });
  return r.json();
}
const reply = (msg, text) => tg('sendMessage', {
  chat_id: msg.chat.id, text, parse_mode: 'HTML',
  disable_web_page_preview: true, reply_to_message_id: msg.message_id
});

const cache = new Map();
const lastUse = new Map();

async function handle(msg) {
  const text = (msg.text || '').trim();
  if (!text) return;
  const isPrivate = msg.chat.type === 'private';
  const m = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  const cmd = m ? m[1].toLowerCase() : null;
  const arg = m ? m[2].trim() : (isPrivate ? text : '');

  if (cmd === 'start' || cmd === 'help') {
    return reply(msg, `🛡️ <b>${esc(BRAND)}</b>\nSend <code>/scan &lt;contract address&gt;</code> (EVM or Solana).\n\nIn private chat you can just paste the address.`);
  }
  if (cmd && cmd !== 'scan') return;
  if (!cmd && !arg) return;

  const addr = arg.split(/\s+/)[0];
  if (!addr || (!isEvm(addr) && !isSol(addr))) {
    if (cmd || isPrivate) return reply(msg, 'Send a valid EVM (0x…) or Solana contract address.');
    return;
  }

  const uid = msg.from?.id || msg.chat.id;
  if (Date.now() - (lastUse.get(uid) || 0) < 4000) return;
  lastUse.set(uid, Date.now());

  const cached = cache.get(addr);
  if (cached && Date.now() - cached.t < 5 * 60 * 1000) return reply(msg, cached.text);

  tg('sendChatAction', { chat_id: msg.chat.id, action: 'typing' });
  try {
    const found = isEvm(addr) ? await scanEvm(addr) : await scanSol(addr);
    if (!found) return reply(msg, 'No data found for that address.');
    const out = format(analyze(found), addr, found.chain);
    cache.set(addr, { t: Date.now(), text: out });
    await reply(msg, out);
  } catch (e) {
    console.error('scan error:', e.message);
    await reply(msg, 'Scan failed (data provider error). Try again.');
  }
}

(async function main() {
  let me;
  while (true) {
    try { me = await tg('getMe', {}); break; }
    catch (e) { console.error('Telegram unreachable, retrying in 5s:', e.cause?.code || e.message); await sleep(5000); }
  }
  if (!me.ok) { console.error('Bad bot token:', me.description); process.exit(1); }
  console.log(`Bot @${me.result.username} is running`);
  let offset = 0;
  while (true) {
    try {
      const r = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      if (!r.ok) { console.error('getUpdates:', r.description); await sleep(5000); continue; }
      for (const u of r.result) {
        offset = u.update_id + 1;
        if (u.message) handle(u.message).catch(e => console.error('handler error:', e));
      }
    } catch (e) {
      console.error('poll error:', e.message);
      await sleep(3000);
    }
  }
})();
