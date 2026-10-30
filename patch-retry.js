const fs = require('fs');
let code = fs.readFileSync('telegram-bot.js', 'utf8');
const old = "const me = await tg('getMe', {});";
const neu = `let me;
  while (true) {
    try { me = await tg('getMe', {}); break; }
    catch (e) { console.error('Telegram unreachable, retrying in 5s:', e.cause?.code || e.message); await sleep(5000); }
  }`;
if (!code.includes(old)) { console.error('❌ Line not found, nothing changed'); process.exit(1); }
fs.writeFileSync('telegram-bot.js', code.replace(old, neu));
console.log('✅ Retry added');
