const fs = require('fs');
let code = fs.readFileSync('telegram-bot.js', 'utf8');

const re1 = /\n\s*else if \(top10 > 0\.15\) add\(5, `Top 10 hold \$\{pct\(top10\)\}`\);/;

const old2 = 'if (nonEmpty(d.lp_holders)) {';
const new2 = 'const v4 = nonEmpty(d.dex) && d.dex.some(x => /v4/i.test(JSON.stringify(x)));\n    if (nonEmpty(d.lp_holders) && !v4) {';

const old3 = 'info = { name: d.token_name';
const new3 = "if (lpLocked === null) add(25, 'LP lock could not be verified');\n    info = { name: d.token_name";

const old4 = 'if (r.lpLocked !== undefined && r.lpLocked !== null) msg += `• LP Locked: <b>${pct(r.lpLocked)}</b>';
const new4 = 'if (r.lpLocked !== undefined) msg += `• LP Locked: <b>${r.lpLocked === null ? "Unknown" : pct(r.lpLocked)}</b>';

const missing = [];
if (!re1.test(code)) missing.push('top10 15% flag');
if (!code.includes(old2)) missing.push('lp_holders check');
if (!code.includes(old3)) missing.push('info line');
if (!code.includes(old4)) missing.push('LP Locked display');
if (missing.length) { console.error('❌ Not found, nothing changed:', missing.join(', ')); process.exit(1); }

code = code.replace(re1, '').replace(old2, new2).replace(old3, new3).replace(old4, new4);
fs.writeFileSync('telegram-bot.js', code);
console.log('✅ All 4 changes applied');
