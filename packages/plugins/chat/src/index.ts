/**
 * Chat Plugin for EmDash CMS
 *
 * AI-powered Intercom-style chat widget using OpenAI's Responses API.
 * Visitors ask questions about your portfolio and get instant replies.
 * Admin can view conversations, respond manually, and configure AI settings.
 *
 * @example
 * ```typescript
 * // astro.config.mjs — import descriptor from the /descriptor path
 * import { chatPlugin } from "@emdash-cms/plugin-chat/descriptor";
 *
 * export default defineConfig({
 *   plugins: [chatPlugin()],
 * });
 * ```
 */

import type { ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

import {
	conversationCreateHandler,
	conversationListHandler,
	conversationGetHandler,
	conversationCloseHandler,
	conversationDeleteHandler,
} from "./routes/conversations.js";
import { messageSendHandler, messageListHandler, messageReplyHandler } from "./routes/messages.js";
import {
	conversationCreateSchema,
	conversationGetSchema,
	conversationCloseSchema,
	conversationDeleteSchema,
	messageSendSchema,
	messageListSchema,
	messageReplySchema,
} from "./schemas.js";
import { CHAT_STORAGE_CONFIG } from "./storage.js";
import type { ChatPluginOptions } from "./types.js";
import { WIDGET_CSS, buildWidgetScript } from "./widget.js";

// Re-export descriptor for convenience
export { chatPlugin } from "./descriptor.js";

// ─── Plugin Implementation (loaded at runtime via entrypoint) ───

export function createPlugin(options: ChatPluginOptions = {}): ResolvedPlugin {
	const greeting = options.greeting || "Hi! Ask me anything about my professional background.";

	return definePlugin({
		id: "emdash-chat",
		version: "0.0.1",
		capabilities: ["page:inject", "read:content", "network:fetch"],
		allowedHosts: ["api.openai.com"],

		storage: CHAT_STORAGE_CONFIG,

		hooks: {
			"page:fragments": {
				handler: async (_event, ctx) => {
					const customGreeting = (await ctx.kv.get<string>("settings:greeting")) || greeting;
					return [
						{
							kind: "html" as const,
							placement: "head" as const,
							html: `<style>${WIDGET_CSS}</style>`,
							key: "emdash-chat-css",
						},
						{
							kind: "inline-script" as const,
							placement: "body:end" as const,
							code: buildWidgetScript("emdash-chat", customGreeting),
							key: "emdash-chat-js",
						},
					];
				},
			},
		},

		routes: {
			"conversations/create": {
				public: true,
				input: conversationCreateSchema,
				handler: conversationCreateHandler as never,
			},
			"messages/send": {
				public: true,
				input: messageSendSchema,
				handler: messageSendHandler as never,
			},
			"messages/list": {
				public: true,
				input: messageListSchema,
				handler: messageListHandler as never,
			},
			"conversations/list": {
				handler: conversationListHandler,
			},
			"conversations/get": {
				input: conversationGetSchema,
				handler: conversationGetHandler as never,
			},
			"conversations/close": {
				input: conversationCloseSchema,
				handler: conversationCloseHandler as never,
			},
			"conversations/delete": {
				input: conversationDeleteSchema,
				handler: conversationDeleteHandler as never,
			},
			"messages/reply": {
				input: messageReplySchema,
				handler: messageReplyHandler as never,
			},
		},

		admin: {
			settingsSchema: {
				openaiApiKey: {
					type: "secret",
					label: "OpenAI API Key",
				},
				aiModel: {
					type: "string",
					label: "Model (e.g. gpt-4o-mini, gpt-4o, gpt-4.1-nano)",
				},
				greeting: {
					type: "string",
					label: "Greeting Message",
				},
				corpus: {
					type: "string",
					label: "Corpus (additional context for AI - resume details, FAQs, etc.)",
				},
				securityPrompt: {
					type: "string",
					label: "Security Prompt (rules the AI must follow)",
				},
			},
			pages: [{ path: "/", label: "Conversations", icon: "message-circle" }],
			widgets: [{ id: "unread-messages", title: "Unread Messages", size: "quarter" }],
		},
	});
}

export default createPlugin;

export type * from "./types.js";
export type { ChatStorage } from "./storage.js";
