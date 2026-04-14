import { z } from "astro/zod";

// ─── Public Schemas ─────────────────────────────────────────────

export const conversationCreateSchema = z.object({
	message: z.string().min(1).max(2000),
});
export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;

export const messageSendSchema = z.object({
	conversationId: z.string().min(1),
	sessionToken: z.string().min(1),
	message: z.string().min(1).max(2000),
});
export type MessageSendInput = z.infer<typeof messageSendSchema>;

export const messageListSchema = z.object({
	conversationId: z.string().min(1),
	sessionToken: z.string().min(1),
});
export type MessageListInput = z.infer<typeof messageListSchema>;

// ─── Admin Schemas ──────────────────────────────────────────────

export const conversationGetSchema = z.object({
	conversationId: z.string().min(1),
});
export type ConversationGetInput = z.infer<typeof conversationGetSchema>;

export const conversationCloseSchema = z.object({
	conversationId: z.string().min(1),
});
export type ConversationCloseInput = z.infer<typeof conversationCloseSchema>;

export const conversationDeleteSchema = z.object({
	conversationId: z.string().min(1),
});
export type ConversationDeleteInput = z.infer<typeof conversationDeleteSchema>;

export const messageReplySchema = z.object({
	conversationId: z.string().min(1),
	message: z.string().min(1).max(5000),
});
export type MessageReplyInput = z.infer<typeof messageReplySchema>;
