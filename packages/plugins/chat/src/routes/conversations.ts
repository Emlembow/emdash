import type { RouteContext, StorageCollection } from "emdash";
import { PluginRouteError } from "emdash";
import { ulid } from "ulidx";

import type {
	ConversationCreateInput,
	ConversationGetInput,
	ConversationCloseInput,
	ConversationDeleteInput,
} from "../schemas.js";
import type { Conversation, Message } from "../types.js";
import { generateAiReply } from "./ai.js";
import { enforceRateLimit, generateSessionToken, hashToken } from "./security.js";

function conversations(ctx: RouteContext): StorageCollection<Conversation> {
	return ctx.storage.conversations as StorageCollection<Conversation>;
}

function messages(ctx: RouteContext): StorageCollection<Message> {
	return ctx.storage.messages as StorageCollection<Message>;
}

// ─── Create Conversation (Public) ───────────────────────────────

export async function conversationCreateHandler(ctx: RouteContext<ConversationCreateInput>) {
	await enforceRateLimit(ctx);

	const { message } = ctx.input;
	const now = new Date().toISOString();
	const conversationId = ulid();
	const messageId = ulid();
	const sessionToken = generateSessionToken();
	const sessionTokenHash = await hashToken(sessionToken);

	await conversations(ctx).put(conversationId, {
		visitorName: "Visitor",
		visitorEmail: "",
		status: "open",
		lastMessageAt: now,
		unreadCount: 1,
		createdAt: now,
		sessionTokenHash,
	});

	await messages(ctx).put(messageId, {
		conversationId,
		sender: "visitor",
		text: message,
		createdAt: now,
	});

	// Generate AI reply
	try {
		const aiReply = await generateAiReply(ctx, conversationId, message);
		if (aiReply) {
			const aiMessageId = ulid();
			await messages(ctx).put(aiMessageId, {
				conversationId,
				sender: "ai",
				text: aiReply,
				createdAt: new Date().toISOString(),
			});
			await conversations(ctx).put(conversationId, {
				visitorName: "Visitor",
				visitorEmail: "",
				status: "open",
				lastMessageAt: new Date().toISOString(),
				unreadCount: 1,
				createdAt: now,
				sessionTokenHash,
			});
		}
	} catch (err) {
		ctx.log.warn("AI reply failed", err);
	}

	return { conversationId, sessionToken };
}

// ─── List Conversations (Admin) ─────────────────────────────────

export async function conversationListHandler(ctx: RouteContext) {
	const result = await conversations(ctx).query({
		orderBy: { lastMessageAt: "desc" },
		limit: 50,
	});

	return {
		items: result.items.map((item) => ({ id: item.id, ...item.data })),
	};
}

// ─── Get Conversation with Messages (Admin) ─────────────────────

export async function conversationGetHandler(ctx: RouteContext<ConversationGetInput>) {
	const { conversationId } = ctx.input;
	const conversation = await conversations(ctx).get(conversationId);
	if (!conversation) {
		throw PluginRouteError.notFound("Conversation not found");
	}

	const msgs = await messages(ctx).query({
		where: { conversationId },
		orderBy: { createdAt: "asc" },
		limit: 100,
	});

	// Mark as read
	if (conversation.unreadCount > 0) {
		await conversations(ctx).put(conversationId, {
			...conversation,
			unreadCount: 0,
		});
	}

	return {
		conversation: { id: conversationId, ...conversation },
		messages: msgs.items.map((m) => ({ id: m.id, ...m.data })),
	};
}

// ─── Close Conversation (Admin) ─────────────────────────────────

export async function conversationCloseHandler(ctx: RouteContext<ConversationCloseInput>) {
	const { conversationId } = ctx.input;
	const conversation = await conversations(ctx).get(conversationId);
	if (!conversation) {
		throw PluginRouteError.notFound("Conversation not found");
	}

	await conversations(ctx).put(conversationId, {
		...conversation,
		status: "closed",
	});

	return { success: true };
}

// ─── Delete Conversation (Admin) ────────────────────────────────

export async function conversationDeleteHandler(ctx: RouteContext<ConversationDeleteInput>) {
	const { conversationId } = ctx.input;

	// Delete all messages
	const msgs = await messages(ctx).query({
		where: { conversationId },
		limit: 1000,
	});
	if (msgs.items.length > 0) {
		await messages(ctx).deleteMany(msgs.items.map((m) => m.id));
	}

	await conversations(ctx).delete(conversationId);
	return { success: true };
}
