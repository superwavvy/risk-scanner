const fs = require('fs');
let code = fs.readFileSync('telegram-bot.js', 'utf8');

// 1. Change the Risk Score to just Risk Level
code = code.replace(
  "msg += `${em} <b>Risk Score: ${r.score}/100 - ${lvl}</b>\\n`;",
  "msg += `${em} <b>Risk Level: ${lvl}</b>\\n`;"
);

// 2. Update the Dexscreener link text
code = code.replace(
  "msg += `📊 <a href=\"${dexUrl}\">View Chart on Dexscreener</a>\\n\\n`;",
  "msg += `📊 <a href=\"${dexUrl}\">View Chart & Socials on Dexscreener</a>\\n\\n`;"
);

// 3. Remove the colored emojis from the risk list
const oldRiskList = `    for (const f of r.flags.slice(0, 5)) {
      const icon = f.pts >= 40 ? '🔴' : f.pts >= 20 ? '🟠' : '🟡';
      msg += \`\${icon} \${esc(f.text)}\\n\`;
    }`;

const newRiskList = `    for (const f of r.flags.slice(0, 5)) {
      msg += \`• \${esc(f.text)}\\n\`;
    }`;

code = code.replace(oldRiskList, newRiskList);

fs.writeFileSync('telegram-bot.js', code);
console.log("✅ UI Updated successfully.");
