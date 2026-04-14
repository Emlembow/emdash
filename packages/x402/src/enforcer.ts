/**
 * x402 Payment Enforcer
 *
 * Creates the x402 enforcement interface. Uses the @x402/core SDK
 * to handle the payment protocol negotiation.
 */

import {
	decodePaymentSignatureHeader,
	encodePaymentRequiredHeader,
	encodePaymentResponseHeader,
} from "@x402/core/http";
import { HTTPFacilitatorClient, x402ResourceServer, type ResourceConfig } from "@x402/core/server";

import type { EnforceOptions, EnforceResult, X402Config, X402Enforcer } from "./types.js";

const PAYMENT_SIGNATURE_HEADER = "payment-signature";
const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

const DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";
const DEFAULT_SCHEME = "exact";
const DEFAULT_MAX_TIMEOUT_SECONDS = 60;
const DEFAULT_BOT_SCORE_THRESHOLD = 30;

/**
 * Cached resource server instance.
 * Initialized once per process, reused across requests.
 */
let _resourceServer: x402ResourceServer | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Build CDP auth headers using ES256 JWT.
 * Uses @coinbase/cdp-sdk's generateJwt when CDP credentials are configured.
 */
async function buildCdpAuthHeaders(
	keyId: string,
	keySecret: string,
	facilitatorUrl: string,
) {
	const { generateJwt } = await import("@coinbase/cdp-sdk/auth");
	const url = new URL(facilitatorUrl);
	const host = url.host;
	const basePath = url.pathname.replace(/\/$/, "");
	const makeFor = async (method: string, subpath: string) => {
		const token = await generateJwt({
			apiKeyId: keyId,
			apiKeySecret: keySecret,
			requestMethod: method,
			requestHost: host,
			requestPath: `${basePath}/${subpath}`,
		});
		return { Authorization: `Bearer ${token}` };
	};
	return async () => ({
		verify: await makeFor("POST", "verify"),
		settle: await makeFor("POST", "settle"),
		supported: await makeFor("GET", "supported"),
	});
}

/**
 * Get or create the x402ResourceServer singleton.
 */
async function getResourceServer(config: X402Config): Promise<x402ResourceServer> {
	if (!_resourceServer) {
		const facilitatorUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL;

		const facilitatorOptions: {
			url: string;
			createAuthHeaders?: () => Promise<{
				verify: Record<string, string>;
				settle: Record<string, string>;
				supported: Record<string, string>;
			}>;
		} = { url: facilitatorUrl };

		// Resolve CDP credentials from config or env (Node/Cloudflare)
		const envKeyId =
			(typeof process !== "undefined" && process.env?.CDP_API_KEY_ID) ||
			// @ts-ignore — import.meta.env exists at runtime in Vite
			(typeof import.meta !== "undefined" && import.meta.env?.CDP_API_KEY_ID);
		const envKeySecret =
			(typeof process !== "undefined" && process.env?.CDP_API_KEY_SECRET) ||
			// @ts-ignore — import.meta.env exists at runtime in Vite
			(typeof import.meta !== "undefined" && import.meta.env?.CDP_API_KEY_SECRET);

		const cdpKeyId = config.cdpApiKeyId || envKeyId;
		const cdpKeySecret = config.cdpApiKeySecret || envKeySecret;

		if (cdpKeyId && cdpKeySecret) {
			facilitatorOptions.createAuthHeaders = await buildCdpAuthHeaders(
				cdpKeyId,
				cdpKeySecret,
				facilitatorUrl,
			);
		}

		const facilitator = new HTTPFacilitatorClient(facilitatorOptions);
		const server = new x402ResourceServer(facilitator);

		// Register EVM scheme (default)
		if (config.evm !== false) {
			try {
				const evmMod = await import("@x402/evm/exact/server");
				const evmScheme = new evmMod.ExactEvmScheme();
				server.register("eip155:*" as `${string}:${string}`, evmScheme);
			} catch {
				// @x402/evm not installed -- skip EVM support
			}
		}

		// Register Bazaar discovery extension (opt-in)
		if (config.bazaar) {
			try {
				const bazaarMod = await import("@x402/extensions/bazaar");
				server.registerExtension(bazaarMod.bazaarResourceServerExtension);
			} catch {
				// @x402/extensions not installed — skip Bazaar discovery
			}
		}

		// Register SVM scheme (opt-in)
		if (config.svm) {
			try {
				const svmMod = await import("@x402/svm/exact/server");
				const svmScheme = new svmMod.ExactSvmScheme();
				server.register("solana:*" as `${string}:${string}`, svmScheme);
			} catch {
				// @x402/svm not installed -- skip Solana support
			}
		}

		_resourceServer = server;
		_initPromise = server.initialize();
	}

	if (_initPromise) {
		await _initPromise;
		_initPromise = null;
	}

	return _resourceServer;
}

/**
 * Known AI scraper/bot User-Agent patterns.
 * Used as fallback when Cloudflare Bot Management scores are unavailable.
 */
const BOT_UA_PATTERNS =
	/GPTBot|ChatGPT|ClaudeBot|Claude-Web|Anthropic|CCBot|Google-Extended|Bytespider|Amazonbot|FacebookBot|Applebot-Extended|PerplexityBot|YouBot|Diffbot|Scrapy|PetalBot|Seekport|DataForSeoBot|Semrush|AhrefsBot|DotBot|Barkrowler|MJ12bot/i;

/**
 * Check if a request is from a bot.
 * Uses Cloudflare Bot Management score when available, falls back to
 * User-Agent pattern matching for known AI scrapers and crawlers.
 */
function isBot(request: Request, threshold: number): boolean {
	// Try Cloudflare Bot Management score first
	const cf: unknown = Reflect.get(request, "cf");
	if (cf != null && typeof cf === "object") {
		const bm: unknown = Reflect.get(cf, "botManagement");
		if (bm != null && typeof bm === "object") {
			const score: unknown = Reflect.get(bm, "score");
			if (typeof score === "number") {
				return score < threshold;
			}
		}
	}

	// Fallback: User-Agent pattern matching
	const ua = request.headers.get("user-agent") ?? "";
	return BOT_UA_PATTERNS.test(ua);
}

/**
 * Create an X402Enforcer for the given configuration.
 * Called once by the middleware, reused across requests.
 */
export function createEnforcer(config: X402Config): X402Enforcer {
	const botScoreThreshold = config.botScoreThreshold ?? DEFAULT_BOT_SCORE_THRESHOLD;

	return {
		async enforce(request: Request, options?: EnforceOptions): Promise<Response | EnforceResult> {
			// In botOnly mode, skip enforcement for humans
			if (config.botOnly) {
				const ua = request.headers.get("user-agent") ?? "";
				const detected = isBot(request, botScoreThreshold);
				console.log(`[x402] UA="${ua}" isBot=${detected}`);
				if (!detected) {
					return { paid: false, skipped: true, responseHeaders: {} };
				}
			}

			const server = await getResourceServer(config);

			const price = options?.price ?? config.defaultPrice;
			if (price == null) {
				throw new Error(
					"x402: No price specified. Pass a price in enforce() options or set defaultPrice in the config.",
				);
			}

			const payTo = options?.payTo ?? config.payTo;
			const network = options?.network ?? config.network;
			const scheme = options?.scheme ?? config.scheme ?? DEFAULT_SCHEME;
			const maxTimeoutSeconds = config.maxTimeoutSeconds ?? DEFAULT_MAX_TIMEOUT_SECONDS;

			const resourceConfig: ResourceConfig = {
				scheme,
				payTo,
				price: normalizePrice(price),
				network,
				maxTimeoutSeconds,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				...(options?.extensions ? { extensions: options.extensions as any } : {}),
			};

			const url = new URL(request.url);
			const resourceInfo = {
				url: url.pathname,
				description: options?.description,
				mimeType: options?.mimeType,
			};

			// Check for payment signature header
			const paymentHeader =
				request.headers.get(PAYMENT_SIGNATURE_HEADER) || request.headers.get("PAYMENT-SIGNATURE");

			if (!paymentHeader) {
				return make402(server, resourceConfig, resourceInfo, "Payment required");
			}

			// Payment present -- decode and verify
			const paymentPayload = decodePaymentSignatureHeader(paymentHeader);
			const requirements = await server.buildPaymentRequirements(resourceConfig);
			const matchingReqs = server.findMatchingRequirements(requirements, paymentPayload);

			if (!matchingReqs) {
				return make402(
					server,
					resourceConfig,
					resourceInfo,
					"Payment does not match accepted requirements",
				);
			}

			// Verify with facilitator
			const verifyResult = await server.verifyPayment(paymentPayload, matchingReqs);

			if (!verifyResult.isValid) {
				return make402(
					server,
					resourceConfig,
					resourceInfo,
					verifyResult.invalidReason ?? "Payment verification failed",
				);
			}

			// Settle
			const settleResult = await server.settlePayment(paymentPayload, matchingReqs);

			const responseHeaders: Record<string, string> = {};
			if (settleResult) {
				responseHeaders[PAYMENT_RESPONSE_HEADER] = encodePaymentResponseHeader(settleResult);
			}

			return {
				paid: true,
				skipped: false,
				payer: verifyResult.payer,
				settlement: settleResult,
				responseHeaders,
			};
		},

		applyHeaders(result: EnforceResult, response: { headers: Headers }): void {
			for (const [key, value] of Object.entries(result.responseHeaders)) {
				response.headers.set(key, value);
			}
		},

		hasPayment(request: Request): boolean {
			return !!(
				request.headers.get(PAYMENT_SIGNATURE_HEADER) || request.headers.get("PAYMENT-SIGNATURE")
			);
		},
	};
}

/** Build and return a 402 Response */
async function make402(
	server: x402ResourceServer,
	resourceConfig: ResourceConfig,
	resourceInfo: { url: string; description?: string; mimeType?: string },
	error: string,
): Promise<Response> {
	const requirements = await server.buildPaymentRequirements(resourceConfig);
	const paymentRequired = await server.createPaymentRequiredResponse(
		requirements,
		resourceInfo,
		error,
	);

	return new Response(JSON.stringify(paymentRequired), {
		status: 402,
		headers: {
			"Content-Type": "application/json",
			[PAYMENT_REQUIRED_HEADER]: encodePaymentRequiredHeader(paymentRequired),
		},
	});
}

/**
 * Normalize a user-friendly price into the format expected by x402 SDK.
 */
function normalizePrice(
	price: string | number | { amount: string; asset: string; extra?: Record<string, unknown> },
): string | number | { amount: string; asset: string; extra?: Record<string, unknown> } {
	if (typeof price === "string" && price.startsWith("$")) {
		return price.slice(1);
	}
	return price;
}
