import type { RouteContext, StorageCollection } from "emdash";

import type { Message } from "../types.js";

/**
 * Resolve an env var across Node.js, Vite/Astro, and Cloudflare Workers.
 */
function getEnvVar(name: string): string | undefined {
	const prefixed = `EMDASH_${name}`;

	// @ts-ignore — import.meta.env exists at runtime in Vite
	const meta = typeof import.meta !== "undefined" && import.meta.env;
	if (meta) {
		const val = meta[prefixed] || meta[name];
		if (val) return val;
	}

	if (typeof process !== "undefined" && process.env) {
		const val = process.env[prefixed] || process.env[name];
		if (val) return val;
	}

	return undefined;
}

function messages(ctx: RouteContext): StorageCollection<Message> {
	return ctx.storage.messages as StorageCollection<Message>;
}

/**
 * Build context string from CMS content for the AI system prompt.
 */
async function buildResumeContext(ctx: RouteContext): Promise<string> {
	if (!ctx.content) return "";

	const parts: string[] = [];

	try {
		const positions = await ctx.content.list("positions", { limit: 20 });
		if (positions.items.length > 0) {
			parts.push("## Work Experience");
			for (const pos of positions.items) {
				const d = pos.data as Record<string, unknown>;
				const end = d.end_date || "Present";
				parts.push(`### ${d.title} at ${d.company} (${d.start_date} - ${end})`);
				if (d.location) parts.push(`Location: ${d.location}`);
				if (d.technologies && Array.isArray(d.technologies)) {
					parts.push(`Technologies: ${(d.technologies as string[]).join(", ")}`);
				}
			}
		}
	} catch {
		// Collection may not exist
	}

	try {
		const projects = await ctx.content.list("projects", { limit: 20 });
		if (projects.items.length > 0) {
			parts.push("\n## Projects");
			for (const proj of projects.items) {
				const d = proj.data as Record<string, unknown>;
				parts.push(`### ${d.title}`);
				if (d.summary) parts.push(d.summary as string);
			}
		}
	} catch {
		// Collection may not exist
	}

	try {
		const education = await ctx.content.list("education", { limit: 10 });
		if (education.items.length > 0) {
			parts.push("\n## Education");
			for (const edu of education.items) {
				const d = edu.data as Record<string, unknown>;
				parts.push(
					`- ${d.title} - ${d.institution}${d.end_date ? ` (${d.end_date})` : ""}`,
				);
			}
		}
	} catch {
		// Collection may not exist
	}

	try {
		const certs = await ctx.content.list("certifications", { limit: 20 });
		if (certs.items.length > 0) {
			parts.push("\n## Certifications");
			for (const cert of certs.items) {
				const d = cert.data as Record<string, unknown>;
				parts.push(`- ${d.title}${d.issuer ? ` (${d.issuer})` : ""}`);
			}
		}
	} catch {
		// Collection may not exist
	}

	return parts.join("\n");
}

/**
 * Generate an AI reply using the OpenAI Responses API.
 */
export async function generateAiReply(
	ctx: RouteContext,
	conversationId: string,
	visitorMessage: string,
): Promise<string | null> {
	const apiKey = getEnvVar("OPENAI_API_KEY") || (await ctx.kv.get<string>("settings:openaiApiKey"));
	if (!apiKey) {
		const greeting = await ctx.kv.get<string>("settings:greeting");
		return greeting || "Thanks for your message! I'll get back to you soon.";
	}

	const model =
		getEnvVar("OPENAI_MODEL") ||
		(await ctx.kv.get<string>("settings:aiModel")) ||
		"gpt-5.4-nano-2026-03-17";
	const corpus = (await ctx.kv.get<string>("settings:corpus")) || "";
	const securityPrompt = (await ctx.kv.get<string>("settings:securityPrompt")) || "";
	const siteName = ctx.site.name || "the site owner";

	const history = await messages(ctx).query({
		where: { conversationId },
		orderBy: { createdAt: "asc" },
		limit: 20,
	});

	const resumeContext = await buildResumeContext(ctx);

	const instructions = [
		`You are a helpful assistant for ${siteName}'s professional portfolio. You help visitors learn more about ${siteName}'s experience, skills, and background.`,
		`Your responses are always grammatically correct, free from spelling errors, and use proper punctuation.`,
		`Be very succinct in your responses. Assume messages are SMS-like with small viewport. Use bullet points for structure where appropriate.`,
		`If someone asks about something unrelated, politely redirect them.`,
		`If you don't know something, say so.`,
		"",
		"## Portfolio Information",
		resumeContext,
	];

	if (corpus) {
		instructions.push("", "## Additional Context", corpus);
	}

	if (securityPrompt) {
		instructions.push("", "## Security Rules", securityPrompt);
	}

	const input: Array<{ role: string; content: string }> = [];
	for (const msg of history.items) {
		const role = msg.data.sender === "visitor" ? "user" : "assistant";
		input.push({ role, content: msg.data.text });
	}
	input.push({ role: "user", content: visitorMessage });

	try {
		const response = await fetch("https://api.openai.com/v1/responses", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				instructions: instructions.join("\n"),
				input,
				max_output_tokens: 300,
				prompt_cache_retention: "24h",
			}),
		});

		if (!response.ok) {
			ctx.log.error("OpenAI API error", {
				status: response.status,
				body: await response.text(),
			});
			return "Thanks for your message! I'll get back to you soon.";
		}

		const data = (await response.json()) as {
			output: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
		};

		for (const item of data.output) {
			if (item.type === "message" && item.content) {
				const textPart = item.content.find((c) => c.type === "output_text");
				if (textPart?.text) return textPart.text;
			}
		}

		return null;
	} catch (err) {
		ctx.log.error("OpenAI API request failed", err);
		return "Thanks for your message! I'll get back to you soon.";
	}
}
