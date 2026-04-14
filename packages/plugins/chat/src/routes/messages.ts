import type { RouteContext, StorageCollection } from "emdash";
import { PluginRouteError } from "emdash";
import { ulid } from "ulidx";

import type { MessageSendInput, MessageListInput, MessageReplyInput } from "../schemas.js";
import type { Conversation, Message } from "../types.js";
import { generateAiReply } from "./ai.js";
import { enforceRateLimit, verifySessionToken } from "./security.js";

function conversations(ctx: RouteContext): StorageCollection<Conversation> {
	return ctx.storage.conversations as StorageCollection<Conversation>;
}

function messages(ctx: RouteContext): StorageCollection<Message> {
	return ctx.storage.messages as StorageCollection<Message>;
}

// ─── Send Message (Public - visitor sends) ──────────────────────

export async function messageSendHandler(ctx: RouteContext<MessageSendInput>) {
	await enforceRateLimit(ctx);

	const { conversationId, sessionToken, message } = ctx.input;
	const conversation = await conversations(ctx).get(conversationId);
	if (!conversation) {
		throw PluginRouteError.notFound("Conversation not found");
	}

	if (!(await verifySessionToken(conversation.sessionTokenHash, sessionToken))) {
		throw PluginRouteError.notFound("Conversation not found");
	}

	if (conversation.status === "closed") {
		throw PluginRouteError.badRequest("Conversation is closed");
	}

	const now = new Date().toISOString();
	const messageId = ulid();

	await messages(ctx).put(messageId, {
		conversationId,
		sender: "visitor",
		text: message,
		createdAt: now,
	});

	await conversations(ctx).put(conversationId, {
		...conversation,
		lastMessageAt: now,
		unreadCount: conversation.unreadCount + 1,
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
			const updated = await conversations(ctx).get(conversationId);
			if (updated) {
				await conversations(ctx).put(conversationId, {
					...updated,
					lastMessageAt: new Date().toISOString(),
				});
			}
		}
	} catch (err) {
		ctx.log.warn("AI reply failed", err);
	}

	return { success: true };
}

// ─── List Messages (Public - visitor polls) ─────────────────────

export async function messageListHandler(ctx: RouteContext<MessageListInput>) {
	const { conversationId, sessionToken } = ctx.input;
	const conversation = await conversations(ctx).get(conversationId);
	if (!conversation) {
		throw PluginRouteError.notFound("Conversation not found");
	}

	if (!(await verifySessionToken(conversation.sessionTokenHash, sessionToken))) {
		throw PluginRouteError.notFound("Conversation not found");
	}

	const msgs = await messages(ctx).query({
		where: { conversationId },
		orderBy: { createdAt: "asc" },
		limit: 100,
	});

	return {
		messages: msgs.items.map((m) => ({ id: m.id, ...m.data })),
		status: conversation.status,
	};
}

// ─── Reply (Admin) ──────────────────────────────────────────────

export async function messageReplyHandler(ctx: RouteContext<MessageReplyInput>) {
	const { conversationId, message } = ctx.input;
	const conversation = await conversations(ctx).get(conversationId);
	if (!conversation) {
		throw PluginRouteError.notFound("Conversation not found");
	}

	const now = new Date().toISOString();
	const messageId = ulid();

	await messages(ctx).put(messageId, {
		conversationId,
		sender: "admin",
		text: message,
		createdAt: now,
	});

	await conversations(ctx).put(conversationId, {
		...conversation,
		lastMessageAt: now,
	});

	return { success: true };
}
