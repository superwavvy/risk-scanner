const fs = require('fs');
let code = fs.readFileSync('telegram-bot.js', 'utf8');
const old = "const score = Math.min(100, flags.reduce((a, f) => a + f.pts, 0));";
const neu = `let score = Math.min(100, flags.reduce((a, f) => a + f.pts, 0));
  // Floors: some flags should never read as a low or medium risk
  if (flags.some(f => /honeypot/i.test(f.text))) score = Math.max(score, 75);   // CRITICAL
  if (flags.some(f => /liquidity/i.test(f.text))) score = Math.max(score, 50);  // at least HIGH`;
if (!code.includes(old)) { console.error('❌ Line not found, nothing changed'); process.exit(1); }
fs.writeFileSync('telegram-bot.js', code.replace(old, neu));
console.log('✅ Floors added');
