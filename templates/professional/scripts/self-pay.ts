/**
 * self-pay.ts — Loop self-pay to the x402-enabled site until the wallet's
 * USDC balance is effectively drained. Each loop pays $0.001 USDC.
 *
 * Each successful payment strengthens Bazaar cataloging (more signal)
 * and demonstrates the integration works at volume.
 */
import { CdpClient } from "@coinbase/cdp-sdk";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, erc20Abi } from "viem";
import { base } from "viem/chains";

const URL_TO_HIT = process.argv[2] || "https://myepicportfolio.com/llms-full.txt";
const WALLET_NAME = "x402-test";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
// Price is $0.001 USDC = 1000 atomic units (USDC has 6 decimals)
const PRICE_ATOMIC = 1000n;
// Reserve a little dust so we don't try a final payment that can't settle
const DUST_RESERVE = 100n;
// Delay between payments (ms) — respect rate limits, give the facilitator room to breathe
const DELAY_MS = 1500;

async function main() {
	const cdp = new CdpClient({
		apiKeyId: process.env.CDP_API_KEY_ID,
		apiKeySecret: process.env.CDP_API_KEY_SECRET,
		walletSecret: process.env.CDP_WALLET_SECRET,
	});

	const cdpAccount = await cdp.evm.getAccount({ name: WALLET_NAME });
	console.log(`Paying from: ${cdpAccount.address}`);

	// Export raw private key (64-char hex string)
	const exportedHex = (await cdp.evm.exportAccount({
		address: cdpAccount.address,
	})) as unknown as string;
	const privateKey = (
		exportedHex.startsWith("0x") ? exportedHex : "0x" + exportedHex
	) as `0x${string}`;

	const signer = privateKeyToAccount(privateKey);

	const client = new x402Client().register(
		"eip155:8453",
		new ExactEvmScheme(signer),
	);

	const paidFetch = wrapFetchWithPayment(fetch, client);

	const publicClient = createPublicClient({
		chain: base,
		transport: http(),
	});

	async function getBalance(): Promise<bigint> {
		return (await publicClient.readContract({
			address: USDC_BASE,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [cdpAccount.address as `0x${string}`],
		})) as bigint;
	}

	const startBalance = await getBalance();
	console.log(`Starting USDC balance: ${Number(startBalance) / 1_000_000}`);
	console.log(`Each request costs: ${Number(PRICE_ATOMIC) / 1_000_000} USDC\n`);
	console.log(`Target URL: ${URL_TO_HIT}\n`);

	let attempts = 0;
	let successes = 0;
	let failures = 0;

	while (true) {
		const balance = await getBalance();
		if (balance < PRICE_ATOMIC + DUST_RESERVE) {
			console.log(
				`\nBalance (${Number(balance) / 1_000_000} USDC) below threshold. Stopping.`,
			);
			break;
		}

		attempts++;
		try {
			const response = await paidFetch(URL_TO_HIT, {
				method: "GET",
				headers: {
					"User-Agent": "GPTBot/1.0 (x402 self-test)",
				},
			});
			if (response.status === 200) {
				successes++;
				const paymentResponse = response.headers.get("payment-response");
				process.stdout.write(
					`[${attempts}] ✅ 200 · balance=${Number(balance) / 1_000_000} USDC${paymentResponse ? " · settled" : ""}\n`,
				);
			} else {
				failures++;
				console.log(`[${attempts}] ⚠️ ${response.status} ${response.statusText}`);
			}
		} catch (err) {
			failures++;
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`[${attempts}] ❌ ${msg.slice(0, 150)}`);
			// Back off a bit after an error
			await sleep(DELAY_MS * 3);
			continue;
		}

		await sleep(DELAY_MS);
	}

	const endBalance = await getBalance();
	const spent = startBalance - endBalance;
	console.log(`\n── Summary ──`);
	console.log(`Attempts:  ${attempts}`);
	console.log(`Successes: ${successes}`);
	console.log(`Failures:  ${failures}`);
	console.log(`Spent:     ${Number(spent) / 1_000_000} USDC`);
	console.log(`Remaining: ${Number(endBalance) / 1_000_000} USDC`);
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
