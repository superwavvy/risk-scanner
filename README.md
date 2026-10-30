# Risk Scanner

A lightweight, zero-dependency token security scanner for EVM and Solana chains. It runs as a Telegram bot, allowing users to instantly check for honeypots, malicious taxes, unverified code, and dangerous mint authorities.

## Features

- **Multi-Chain Support:** Automatically detects and scans EVM chains (Ethereum, BSC, Base, Arbitrum, Polygon, Optimism, Robinhood Chain) and Solana.
- **Categorical Risk Scoring:** Assigns a clear verdict (LOW, MEDIUM, HIGH, CRITICAL) based on weighted red flags.
- **Deep Analytics:** Integrates with Dexscreener to provide direct links to charts and socials, along with 24h trading volume and buy/sell activity.
- **EVM Checks:** Honeypots, buy/sell tax, source code verification, mintable supply, transfer pausability, and liquidity lock status.
- **Solana Checks:** Mint authority, freeze authority, balance mutability, and transfer fees.
- **Smart Caching:** Caches results for 5 minutes and limits each user to one scan every 4 seconds to protect free API tiers.

## Setup

1. **Install Node.js:** Requires Node 18+ (for native fetch support).
2. **Clone the repo:**
    git clone https://github.com/superwavvy/risk-scanner.git
    cd risk-scanner
3. **Create a Telegram Bot:**
    - Message @BotFather on Telegram.
    - Send `/newbot` and follow the prompts.
    - Copy the HTTP API Token.
4. **Environment Variables:**
    Create a `.env` file in the root directory:
    TELEGRAM_BOT_TOKEN=your_bot_token_here
    BRAND_NAME=Risk Scanner
5. **Run the Bot:**
    node telegram-bot.js

## Commands

- `/scan <address>` - Scan an EVM or Solana token.
- `/start` or `/help` - Show usage instructions.

*(In private chat, you can just paste a contract address directly without the `/scan` command).*

## Disclaimer

This is an automated scan, not a manual audit or financial advice. A clean result does not guarantee safety. Always do your own research (DYOR).

---
*Built by [Superwavvy](https://github.com/superwavvy)*
