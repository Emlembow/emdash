import type { RouteContext } from "emdash";
import { PluginRouteError } from "emdash";

const RATE_LIMIT = 10;
const WINDOW_SECONDS = 60;

export async function hashToken(token: string): Promise<string> {
	const bytes = new TextEncoder().encode(token);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function generateSessionToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export async function verifySessionToken(
	storedHash: string | undefined,
	providedToken: string,
): Promise<boolean> {
	if (!storedHash) return false;
	const providedHash = await hashToken(providedToken);
	return constantTimeEqual(storedHash, providedHash);
}

export async function enforceRateLimit(ctx: RouteContext): Promise<void> {
	const ip = ctx.requestMeta.ip;
	if (!ip) return;
	const bucket = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
	const key = `ratelimit:${bucket}:${ip}`;
	const current = (await ctx.kv.get<number>(key)) ?? 0;
	if (current >= RATE_LIMIT) {
		throw PluginRouteError.badRequest("Too many messages. Please slow down.");
	}
	await ctx.kv.set(key, current + 1);
}
