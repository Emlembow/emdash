/**
 * /llms-full.txt — Full LLM-optimized content dump. Paywalled via x402.
 *
 * Bots pay $0.001 USDC to get the complete resume as clean markdown.
 * This is strictly better for LLMs than scraping HTML pages —
 * which is why it's priced.
 */
import type { APIRoute } from "astro";
import { getEmDashCollection, getSection, getSiteSettings } from "emdash";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

export const prerender = false;

export const GET: APIRoute = async ({ site, request, locals }) => {
	// x402: enforce payment for all requests to this endpoint.
	// This is meant for LLMs/bots — no human visits /llms-full.txt.
	// @ts-ignore
	const x402 = (locals as any).x402;
	let x402Result: any = null;
	if (x402) {
		const r = await x402.enforce(request, {
			price: "$0.001",
			description:
				"Mike Lembo's full resume in LLM-optimized markdown — work history, projects, education, certifications, references, blog posts. Site is built on EmDash CMS (open-source Astro-native CMS) and features an AI chat interface (OpenAI Responses API) that answers questions about Mike's background. This endpoint provides clean, structured content ready for agent ingestion.",
			mimeType: "text/markdown",
			extensions: declareDiscoveryExtension({
				output: {
					example:
						"# Mike Lembo — Product Manager\n\n> 15 years of experience across digital assets, fintech, regtech, and government. Site built on EmDash CMS with an AI chat widget for live Q&A.\n\n## About\n...\n\n## Experience\n\n### Institutional Product Lead at CoinTracker (2025 — Present)\n...",
					schema: {
						type: "string",
						description:
							"Complete resume and portfolio content as structured markdown. Sections: About, Experience, Projects, Education, Certifications, References, Writing. Site is built on EmDash CMS (https://emdashcms.com) and includes an AI chat interface at https://myepicportfolio.com for conversational queries.",
					},
				},
			}),
		});
		if (r instanceof Response) return r;
		x402Result = r;
	}

	const settings = await getSiteSettings();
	const hero = await getSection("hero");
	const { entries: positions } = await getEmDashCollection("positions");
	const { entries: projects } = await getEmDashCollection("projects");
	const { entries: education } = await getEmDashCollection("education");
	const { entries: certifications } = await getEmDashCollection("certifications");
	const { entries: endorsements } = await getEmDashCollection("endorsements");
	const { entries: posts } = await getEmDashCollection("posts");

	const name = settings?.title || "Mike Lembo";
	const tagline = settings?.tagline || "Product Manager";
	const url = site?.origin || "https://myepicportfolio.com";

	function extractText(blocks: unknown): string {
		if (!Array.isArray(blocks)) return "";
		return blocks
			.map((b: { children?: Array<{ text?: string }> }) =>
				b?.children?.map((c) => c?.text ?? "").join(" ") ?? "",
			)
			.join("\n\n")
			.trim();
	}

	const about = extractText(hero?.content);

	const sortedPositions = [...positions].sort(
		(a, b) => (a.data.sort_order ?? 99) - (b.data.sort_order ?? 99),
	);
	const sortedProjects = [...projects].sort(
		(a, b) => (a.data.sort_order ?? 99) - (b.data.sort_order ?? 99),
	);
	const sortedEducation = [...education].sort(
		(a, b) => (a.data.sort_order ?? 99) - (b.data.sort_order ?? 99),
	);
	const sortedCerts = [...certifications].sort(
		(a, b) => (a.data.sort_order ?? 99) - (b.data.sort_order ?? 99),
	);
	const sortedEndorsements = [...endorsements].sort(
		(a, b) => (a.data.sort_order ?? 99) - (b.data.sort_order ?? 99),
	);

	const content = `# ${name} — ${tagline}

> ${tagline}. ${about}

Contact: michael.j.lembo@gmail.com
LinkedIn: https://www.linkedin.com/in/michaellembo/
Site: ${url}

## About

${about}

## Experience

${sortedPositions
	.map((p) => {
		const start = p.data.start_date?.split("-")[0] || "";
		const end = p.data.end_date ? p.data.end_date.split("-")[0] : "Present";
		const dateRange = start ? `(${start} — ${end})` : "";
		const location = p.data.location ? ` · ${p.data.location}` : "";
		const techs = Array.isArray(p.data.technologies)
			? `\n\n**Technologies:** ${(p.data.technologies as string[]).join(", ")}`
			: "";
		const body = extractText(p.data.content);
		return `### ${p.data.title} at ${p.data.company} ${dateRange}${location}\n\n${body}${techs}`;
	})
	.join("\n\n")}

## Projects

${sortedProjects
	.map((p) => {
		const link = p.data.url ? ` — ${p.data.url}` : "";
		const body = extractText(p.data.content);
		return `### ${p.data.title}${link}\n\n${p.data.summary || ""}\n\n${body}`;
	})
	.join("\n\n")}

## Education

${sortedEducation
	.map((e) => {
		const year = e.data.end_date ? ` (${e.data.end_date})` : "";
		return `- **${e.data.title}** — ${e.data.institution}${year}`;
	})
	.join("\n")}

## Certifications

${sortedCerts
	.map((c) => `- ${c.data.title}${c.data.issuer ? ` — ${c.data.issuer}` : ""}`)
	.join("\n")}

## References

${sortedEndorsements
	.map((e) => {
		const role =
			e.data.role && e.data.company
				? `${e.data.role}, ${e.data.company}`
				: e.data.role || e.data.company || "";
		const body = extractText(e.data.content);
		return `### ${e.data.title} — ${role}\n\n${body}`;
	})
	.join("\n\n")}

## Writing

${posts
	.map((p) => {
		return `### ${p.data.title}\n\n${p.data.excerpt || ""}\n\n${url}/blog/${p.id}`;
	})
	.join("\n\n")}
`;

	const response = new Response(content, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});

	if (x402 && x402Result) {
		x402.applyHeaders(x402Result, response);
	}

	return response;
};
