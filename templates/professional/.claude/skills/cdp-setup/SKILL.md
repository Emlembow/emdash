---
name: cdp-setup
description: Install and configure the Coinbase Developer Platform CLI for API access and wallet operations. Use when the user asks to set up CDP, connect Coinbase wallets, or use x402 with the CDP facilitator.
---

# CDP CLI Setup

## Overview
Installs and configures `@coinbase/cdp-cli` for Coinbase Developer Platform API access and wallet operations.

## Prerequisites
- Node.js >= 22
- Linux: `sudo apt install -y libsecret-tools` (keyring support)

## Installation

```bash
# Install CLI globally
npm i -g @coinbase/cdp-cli

# Verify
cdp --version
```

## Configuration

1. Create API credentials at https://portal.cdp.coinbase.com (Entity-scoped, not legacy)
2. Save the JSON key file and wallet secret file locally
3. Configure live environment:
   ```bash
   cdp env live --key-file <path-to-api-key.json>
   cdp env live --wallet-secret-file <path-to-wallet-secret>
   ```
4. Validate:
   ```bash
   cdp env
   cdp evm accounts list
   ```

## MCP Integration (optional)

Grants Claude direct tool access to CDP:
```bash
claude mcp add --scope user --transport stdio cdp -- cdp mcp
```

## Skills

```bash
cdp skills add
```

## Common Issues

- **"Must use a CDP Entity scoped API key"** — legacy portal credentials won't work. Regenerate from https://portal.cdp.coinbase.com
- **Auth failures** — missing wallet secret
- **Windows** — add npm global bin to PATH
- **Node upgrades** — reinstall global packages after `nvm` switch

## Reference

- Full docs: https://docs.cdp.coinbase.com/
- LLM-friendly index: https://docs.cdp.coinbase.com/llms.txt
- CDP Portal: https://portal.cdp.coinbase.com
