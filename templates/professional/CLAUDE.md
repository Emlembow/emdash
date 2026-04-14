Mike Lembo's professional portfolio — myepicportfolio.com

Built on EmDash CMS (Astro) with an AI chat plugin (OpenAI Responses API).
Deployed to Cloudflare Workers with D1 (database) and R2 (media storage).
x402 bot payments enabled — bots pay $0.01 USDC on Base, humans browse free.

## Commands

```bash
npx astro dev             # Local dev server
npx astro build           # Build for production
wrangler deploy           # Deploy to Cloudflare
npx emdash seed seed/seed.json  # Seed database with content
```

## Key Files

| File                | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `astro.config.mjs`  | Astro config with EmDash, x402, chat plugin |
| `wrangler.jsonc`    | Cloudflare Workers config (D1, R2, domains) |
| `seed/seed.json`    | Content schema + seed data                  |
| `.env.local`        | Local secrets (OPENAI_API_KEY)              |
| `src/pages/`        | Astro pages — all server-rendered           |
| `src/layouts/`      | Base layout with editorial dark theme       |
| `src/components/`   | Position, Education, Cert, Endorsement cards |

## Environment Variables

| Variable         | Where                  | Purpose            |
| ---------------- | ---------------------- | ------------------ |
| `OPENAI_API_KEY` | `.env.local` / CF secret | Chat AI responses |

## Collections

positions, education, certifications, endorsements, projects, posts, pages

## Plugins

- **emdash-chat** — Intercom-style AI chat widget (OpenAI Responses API)
- **x402** — Bot payment enforcement ($0.01 USDC on Base)
