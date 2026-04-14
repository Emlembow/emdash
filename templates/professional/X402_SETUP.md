# x402 Payment Setup Guide

## Status

Currently configured for **Base Sepolia testnet** (`eip155:84532`) using the default facilitator (`https://x402.org/facilitator`). This works end-to-end with test USDC — no CDP account needed.

Mainnet (`eip155:8453`) requires either Coinbase CDP API keys OR a community facilitator.

## Facilitator Options

| Facilitator | URL | Networks | Auth Required |
|---|---|---|---|
| x402.org | `https://x402.org/facilitator` | Testnet only (Base Sepolia) | No |
| x402.rs | `https://facilitator.x402.rs` | Many testnets, no Base mainnet | No |
| Coinbase CDP | `https://api.cdp.coinbase.com/platform/v2/x402` | Base, Polygon, Solana mainnet | **Yes (CDP API key)** |
| open.x402.host | `https://open.x402.host` | Claims mainnet (currently unresponsive) | No |

## Option A: Stay on Testnet (current)

No changes needed. Bots that hit the site get a 402 with Base Sepolia payment instructions. They pay test USDC (free from a faucet) and get the content.

**Good for:** proving the concept, demos, no-risk testing.

## Option B: Move to Mainnet with Coinbase CDP

This is the production path. Real bots pay real USDC to your wallet.

### 1. Create a CDP account

Go to https://portal.cdp.coinbase.com:
1. Sign up / sign in
2. Create a new **Project** (any name, e.g. "myepicportfolio")
3. Navigate to **API Keys** in the project
4. Click **Create API Key** → choose **Entity-scoped** (NOT legacy)
5. Download the API key JSON file — keep it safe, you can't retrieve it again
6. Note the key ID (looks like `organizations/{org}/apiKeys/{id}`)

### 2. Install CDP CLI (optional, for local testing)

```bash
npm i -g @coinbase/cdp-cli
cdp env live --key-file /path/to/api-key.json
cdp evm accounts list   # verify it works
```

### 3. Extend the x402 integration

The `@emdash-cms/x402` integration currently doesn't support custom auth headers on the facilitator. To use CDP, we need to either:

**Option B.1 — Wait for emdash to support `createAuthHeaders`**

The underlying `@x402/core` SDK supports `FacilitatorConfig.createAuthHeaders` but the emdash wrapper doesn't expose it. File a feature request at https://github.com/emdash-cms/emdash.

**Option B.2 — Fork/vendor the x402 integration**

Copy `packages/x402` into your project as `packages/my-x402` and add a `cdpApiKey` config option that creates CDP JWT auth headers:

```ts
// packages/my-x402/src/enforcer.ts
import jwt from "jsonwebtoken";

async function createCdpAuthHeaders(keyId: string, keySecret: string, method: string, path: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      sub: keyId,
      iss: "cdp",
      nbf: now,
      exp: now + 120,
      uri: `${method} api.cdp.coinbase.com/platform/v2/x402/${path}`,
    },
    keySecret,
    { algorithm: "ES256", header: { kid: keyId, nonce: crypto.randomUUID() } },
  );
  return { Authorization: `Bearer ${token}` };
}

const facilitator = new HTTPFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402",
  createAuthHeaders: async () => ({
    verify: await createCdpAuthHeaders(keyId, keySecret, "POST", "verify"),
    settle: await createCdpAuthHeaders(keyId, keySecret, "POST", "settle"),
    supported: await createCdpAuthHeaders(keyId, keySecret, "GET", "supported"),
  }),
});
```

### 4. Store CDP credentials as Cloudflare secrets

```bash
wrangler secret put CDP_API_KEY_ID
wrangler secret put CDP_API_KEY_SECRET
```

### 5. Update astro.config.mjs

```js
x402({
  payTo: "0x1631614970BE36228cCC1e34597438bd31d0f6B2",
  network: "eip155:8453",
  facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
  cdpApiKeyId: import.meta.env.CDP_API_KEY_ID,
  cdpApiKeySecret: import.meta.env.CDP_API_KEY_SECRET,
  defaultPrice: "$0.01",
  botOnly: true,
}),
```

### 6. Deploy

```bash
npx astro build && wrangler deploy
```

## Testing

### Test in browser (bot UA)

1. Open Chrome DevTools (F12)
2. Three-dot menu → More tools → **Network conditions**
3. Uncheck **Use browser default** under User Agent
4. Enter `GPTBot/1.0`
5. Reload the page

You should get a `402 Payment Required` JSON response with payment instructions. A real AI scraper with an x402-compatible wallet would auto-pay. You won't be able to pay from the browser — you're just confirming the 402 fires.

### Test programmatically

```bash
curl -i -H "User-Agent: GPTBot/1.0" https://myepicportfolio.com/
# Should return: HTTP/1.1 402 Payment Required
# With: PAYMENT-REQUIRED header + JSON body
```

### View earnings

- **Testnet**: https://sepolia.basescan.org/address/0x1631614970BE36228cCC1e34597438bd31d0f6B2
- **Mainnet**: https://basescan.org/address/0x1631614970BE36228cCC1e34597438bd31d0f6B2

## Bot Detection

The integration checks (in order):
1. Cloudflare Bot Management score from `request.cf.botManagement.score` (requires Enterprise plan — you don't have this)
2. User-Agent pattern matching — catches GPTBot, ClaudeBot, CCBot, Google-Extended, Bytespider, PerplexityBot, Amazonbot, FacebookBot, Applebot-Extended, YouBot, Diffbot, Scrapy, and more

UA detection catches well-behaved bots and those identifying themselves. Malicious bots can spoof UAs but most AI scrapers send real UAs for transparency.

## CDP Free Tier

Coinbase CDP offers 1,000 free facilitator transactions per month. At $0.01 per bot request that's $10/mo in revenue before you need to pay CDP fees.
