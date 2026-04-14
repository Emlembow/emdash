import type { PluginStorageConfig } from "emdash";

export type ChatStorage = PluginStorageConfig & {
	conversations: {
		indexes: ["status", "lastMessageAt", "createdAt"];
	};
	messages: {
		indexes: ["conversationId", "createdAt", ["conversationId", "createdAt"]];
	};
};

export const CHAT_STORAGE_CONFIG = {
	conversations: {
		indexes: ["status", "lastMessageAt", "createdAt"] as const,
	},
	messages: {
		indexes: ["conversationId", "createdAt", ["conversationId", "createdAt"]] as const,
	},
} satisfies PluginStorageConfig;
