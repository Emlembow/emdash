import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { chatPlugin } from "@emdash-cms/plugin-chat/descriptor";
import { x402 } from "@emdash-cms/x402";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			plugins: [chatPlugin()],
			mcp: true,
		}),
		x402({
			payTo: "0x1631614970BE36228cCC1e34597438bd31d0f6B2",
			network: "eip155:8453", // Base mainnet
			facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
			// CDP credentials read from CDP_API_KEY_ID / CDP_API_KEY_SECRET env/secrets
			defaultPrice: "$0.001",
			botOnly: true,
			botScoreThreshold: 30,
			bazaar: true,
		}),
	],
	devToolbar: { enabled: false },
});
