# 🛡️ Risk Scanner

A multi-chain token security scanner that checks EVM and Solana tokens for rug-pull indicators. Sends formatted reports to Discord via webhook.

## What It Detects

- 🚨 Honeypots (can't sell after buying)
- 🚨 Mintable tokens (dev can print infinite supply)
- 🚨 Proxy contracts (logic can change after launch)
- 🚨 Balance modification (dev can alter wallet balances)
- 🏦 Holder concentration (top 10 wallets % of supply)
- 📜 Open source status
- 📊 Total holder count

## Supported Chains

| Chain | Chain ID |
|:---|:---|
| Ethereum | 1 |
| BSC | 56 |
| Polygon | 137 |
| Arbitrum | 42161 |
| Optimism | 10 |
| Base | 8453 |
| Solana | 501 |

## Usage

```bash
node risk-scanner.js
```

The bot prompts you to paste a contract address. It auto-detects Solana vs. EVM, fetches risk data from the GoPlus API, and sends a Discord embed with the findings.

Example output:

```
🛡️ Risk Report: Bonk (Bonk)
Concentration Note: Healthy holder distribution

📊 Holders: 1,022,688
📜 Open Source: ✅ YES
🏦 Top 10 Wallets: Highly Distributed (🟢 LOW)

🚨 Honeypot: ✅ NO
🚨 Mintable: ✅ NO
🚨 Proxy Contract: ✅ NO
🚨 Modify Balances: ✅ NO
```

Tech Stack

· Runtime: Node.js
· Data Source: GoPlus Security API (free tier)
· Alerts: Discord webhooks
· Chains: EVM (Ethereum, Arbitrum, Base, etc.) + Solana

Setup

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a .env file:
   ```env
   DISCORD_WEBHOOK_URL=your_discord_webhook_url
   ```
4. Run:
   ```bash
   node risk-scanner.js
   ```

Skills Demonstrated

· Multi-chain API integration (EVM + Solana)
· Base58 vs. checksummed address handling
· Discord webhook formatting (embeds)
· Interactive CLI (readline)
· Risk scoring / severity classification

License

MIT
