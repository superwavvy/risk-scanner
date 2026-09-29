require('dotenv').config();

// --- Smart Chain Detection ---
let CHAIN_ID = process.argv[3];
const CONTRACT_ADDRESS = process.argv[2] || "0x912CE59144191C1204E64559FE8253a0e49E6548";
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!CHAIN_ID) {
    if (!CONTRACT_ADDRESS.startsWith("0x") && CONTRACT_ADDRESS.length > 30) {
        CHAIN_ID = 501; // Solana
        console.log("🟣 Detected Solana address. Using Chain ID 501.");
    } else {
        CHAIN_ID = 42161; // Default to Arbitrum
        console.log("🔵 Detected EVM address. Defaulting to Arbitrum (42161).");
    }
} else {
    CHAIN_ID = parseInt(CHAIN_ID);
}

// --- Discord Webhook ---
async function sendDiscordReport(embed) {
    if (!WEBHOOK_URL) return console.log("⚠️ No Discord webhook URL found in .env");
    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
		username: "Risk Scanner 🛡️", // <--- Overrides the webhook name
                avatar_url: "https://i.imgur.com/your_image.png", // Optional: Add an image URL
		 embeds: [embed] })
        });
        console.log("✅ Report sent to Discord!");
    } catch (e) { console.error("Discord alert failed:", e.message); }
}

// --- Concentration Severity Calculator ---
function getConcentrationSeverity(percentage) {
    if (percentage >= 40) return { label: "🔴 CRITICAL", color: 0xFF0000, note: "Rug pull risk is extreme" };
    if (percentage >= 25) return { label: "🟠 HIGH", color: 0xFF8C00, note: "A few wallets control too much supply" };
    if (percentage >= 15) return { label: "🟡 MEDIUM", color: 0xFFD700, note: "Monitor whale activity closely" };
    return { label: "🟢 LOW", color: 0x00FF00, note: "Healthy holder distribution" };
}

// --- Main Scanner ---
async function scanContract(contractAddress, chainId) {
    console.log(`\n🔍 Scanning ${contractAddress} on Chain ID ${chainId}...\n`);

    let url;
    if (chainId === 501) { // Solana
        url = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${contractAddress}`;
    } else {
        url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${contractAddress}`;
    }
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        // EVM addresses need to be lowercased for the lookup.
	// Solana addresses are case-sensitive and must be looked up exactly as sent.
	let resultKey = (chainId === 501) ? contractAddress : contractAddress.toLowerCase();
	const result = data.result ? data.result[resultKey] : null;

        if (!result) {
            console.log("❌ Token not found or not a valid EVM/Solana token.");
            return;
        }

        // --- Extract Contract Risk Flags ---
	const tokenName = result.token_name || result.metadata?.name || "Unknown";
	const tokenSymbol = result.token_symbol || result.metadata?.symbol || "??";
        const isHoneypot = result.is_honeypot === "1" ? "🚨 YES" : "✅ NO";
        const isMintable = result.is_mintable === "1" ? "🚨 YES" : "✅ NO";
        const isProxy = result.is_proxy === "1" ? "🚨 YES" : "✅ NO";
        const canModifyBalance = result.owner_change_balance === "1" ? "🚨 YES" : "✅ NO";
        const isOpenSource = result.is_open_source === "1" ? "✅ YES" : "🚨 NO";

        // --- Calculate Holder Concentration ---
        let concentrationText = "N/A";
        let concentrationSeverity = { label: "🟢 LOW", color: 0x00FF00, note: "No data available" };
        let top10Percentage = 0;

       if (result.top_10_holders && result.top_10_holders.length > 0) {
    top10Percentage = result.top_10_holders.reduce((sum, holder) => {
        return sum + (parseFloat(holder.percent) * 100);
    }, 0);
    
    concentrationSeverity = getConcentrationSeverity(top10Percentage);
    concentrationText = `${top10Percentage.toFixed(2)}%\n${concentrationSeverity.label}`;
} else if (result.holder_count && parseInt(result.holder_count) > 100000) {
    // If there are over 100k holders and no top 10 data, it's extremely well distributed
    concentrationText = `Highly Distributed\n🟢 LOW`;
    concentrationSeverity = { label: "🟢 LOW", color: 0x00FF00, note: "Healthy holder distribution" };
}
        // --- Determine Overall Embed Color ---
        // Start with concentration severity, then escalate if a critical contract flag is found
        let embedColor = concentrationSeverity.color;
        if (result.is_honeypot === "1" || result.is_mintable === "1" || result.owner_change_balance === "1") {
            embedColor = 0xFF0000; // Force red if any critical contract risk
        }

        // --- Build the Discord Embed ---
        const embed = {
            title: `🛡️ Risk Report: ${tokenName} (${tokenSymbol})`,
            description: `**Concentration Note:** _${concentrationSeverity.note}_`,
            color: embedColor,
            fields: [
                { name: "📊 Holders", value: result.holder_count || "Unknown", inline: true },
                { name: "📜 Open Source", value: isOpenSource, inline: true },
                { name: "🏦 Top 10 Wallets", value: concentrationText, inline: true },
                { name: "\u200B", value: "\u200B", inline: false }, // Spacer
                { name: "🚨 Honeypot", value: isHoneypot, inline: true },
                { name: "🚨 Mintable", value: isMintable, inline: true },
                { name: "🚨 Proxy Contract", value: isProxy, inline: true },
                { name: "🚨 Modify Balances", value: canModifyBalance, inline: true }
            ],
            footer: { text: `Contract: ${contractAddress} | Chain: ${chainId}` },
            timestamp: new Date().toISOString()
        };

        // --- Print to Terminal ---
        console.log(`Token: ${tokenName} (${tokenSymbol})`);
        console.log(`Holders: ${result.holder_count || "Unknown"}`);
        console.log(`Open Source: ${isOpenSource}`);
        console.log(`Top 10 Concentration: ${top10Percentage.toFixed(2)}% -> ${concentrationSeverity.label}`);
        console.log(`Honeypot: ${isHoneypot} | Mintable: ${isMintable} | Proxy: ${isProxy}`);
        
        await sendDiscordReport(embed);

    } catch (error) {
        console.error("Scanner Error:", error.message);
    }
}

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

function promptForAddress() {
    readline.question('\n🔗 Paste the Contract Address (or type "exit" to quit): ', (address) => {
        if (address.toLowerCase() === 'exit') {
            console.log("👋 Exiting Risk Scanner...");
            readline.close();
            process.exit(0);
        }

        let chainId = 42161; // Default to Arbitrum
        if (!address.startsWith("0x") && address.length > 30) {
            chainId = 501; // Solana
            console.log("🟣 Detected Solana address. Using Chain ID 501.");
        } else {
            console.log("🔵 Detected EVM address. Defaulting to Arbitrum (42161).");
        }

        scanContract(address, chainId).then(() => {
            promptForAddress(); // Loop back for the next scan
        });
    });
}

console.log("🛡️ Welcome to the Web3 Risk Scanner!");
promptForAddress();
