/**
 * Chat plugin descriptor.
 *
 * Imported at build time in astro.config.mjs. Must be side-effect-free
 * and must NOT import anything that depends on astro/zod or runtime modules.
 */

import type { PluginDescriptor } from "emdash";

import type { ChatPluginOptions } from "./types.js";

export function chatPlugin(options: ChatPluginOptions = {}): PluginDescriptor<ChatPluginOptions> {
	return {
		id: "emdash-chat",
		version: "0.0.1",
		entrypoint: "@emdash-cms/plugin-chat",
		adminEntry: "@emdash-cms/plugin-chat/admin",
		options,
		capabilities: ["page:inject", "read:content", "network:fetch"],
		allowedHosts: ["api.openai.com"],
		adminPages: [{ path: "/", label: "Conversations", icon: "message-circle" }],
		adminWidgets: [{ id: "unread-messages", title: "Unread Messages", size: "quarter" }],
		storage: {
			conversations: {
				indexes: ["status", "lastMessageAt", "createdAt"],
			},
			messages: {
				indexes: ["conversationId", "createdAt"],
			},
		},
	};
}
