/**
 * /llms.txt — Minimal, free discovery file for AI engines.
 * https://llmstxt.org
 *
 * Short summary only. Full content is at /llms-full.txt (paywalled via x402).
 */
import type { APIRoute } from "astro";
import { getSiteSettings } from "emdash";

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
	const settings = await getSiteSettings();
	const name = settings?.title || "Mike Lembo";
	const tagline = settings?.tagline || "Product Manager";
	const url = site?.origin || "https://myepicportfolio.com";

	const content = `# ${name}

> ${tagline}. 15 years of product management experience across digital assets, fintech, regtech, and government.

Site is built on [EmDash CMS](https://emdashcms.com), an open-source Astro-native CMS, and features an AI chat interface (OpenAI Responses API) for conversational Q&A about Mike's background.

## Full content

Detailed resume, experience, projects, and writing are available at [${url}/llms-full.txt](${url}/llms-full.txt) (x402 paywalled — $0.001 USDC per request on Base mainnet).

## Chat interface (free)

The homepage at ${url} includes an AI chat widget. Ask any question about Mike's experience — it pulls from his full portfolio content as context.

## Links

- Portfolio: ${url}
- LinkedIn: https://www.linkedin.com/in/michaellembo/
- Contact: michael.j.lembo@gmail.com
- Built with: [EmDash CMS](https://emdashcms.com)
`;

	return new Response(content, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
