/**
 * Chat Plugin - Admin UI
 *
 * React components for conversation management and dashboard widget.
 */

import type { PluginAdminExports } from "emdash";
import { apiFetch as baseFetch, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";

const API = "/_emdash/api/plugins/emdash-chat";

function apiFetch(route: string, body?: unknown): Promise<Response> {
	return baseFetch(`${API}/${route}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body ?? {}),
	});
}

// ─── Types ──────────────────────────────────────────────────────

interface ConversationItem {
	id: string;
	visitorName: string;
	visitorEmail: string;
	status: "open" | "closed";
	lastMessageAt: string;
	unreadCount: number;
	createdAt: string;
}

interface MessageItem {
	id: string;
	conversationId: string;
	sender: "visitor" | "admin" | "ai";
	text: string;
	createdAt: string;
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = {
	container: { padding: "24px", fontFamily: "inherit" } as React.CSSProperties,
	header: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: "24px",
	} as React.CSSProperties,
	title: { fontSize: "20px", fontWeight: 600, margin: 0 } as React.CSSProperties,
	list: { display: "flex", flexDirection: "column", gap: "1px" } as React.CSSProperties,
	item: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		padding: "14px 16px",
		background: "var(--color-surface, #f9fafb)",
		borderRadius: "8px",
		cursor: "pointer",
		transition: "background 0.1s",
	} as React.CSSProperties,
	itemLeft: { display: "flex", flexDirection: "column", gap: "4px" } as React.CSSProperties,
	itemName: { fontWeight: 500, fontSize: "14px" } as React.CSSProperties,
	itemEmail: { fontSize: "12px", color: "var(--color-muted, #9ca3af)" } as React.CSSProperties,
	itemRight: { display: "flex", alignItems: "center", gap: "8px" } as React.CSSProperties,
	badge: {
		fontSize: "11px",
		padding: "2px 8px",
		borderRadius: "10px",
		fontWeight: 500,
	} as React.CSSProperties,
	badgeOpen: { background: "#dcfce7", color: "#166534" } as React.CSSProperties,
	badgeClosed: { background: "#f3f4f6", color: "#6b7280" } as React.CSSProperties,
	unread: {
		background: "#2563eb",
		color: "white",
		borderRadius: "50%",
		width: "22px",
		height: "22px",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: "11px",
		fontWeight: 600,
	} as React.CSSProperties,
	time: { fontSize: "12px", color: "var(--color-muted, #9ca3af)" } as React.CSSProperties,
	empty: {
		textAlign: "center",
		padding: "48px",
		color: "var(--color-muted, #9ca3af)",
	} as React.CSSProperties,
	backBtn: {
		background: "none",
		border: "none",
		color: "var(--color-accent, #2563eb)",
		cursor: "pointer",
		fontSize: "14px",
		padding: 0,
		marginBottom: "16px",
	} as React.CSSProperties,
	messages: {
		display: "flex",
		flexDirection: "column",
		gap: "10px",
		padding: "16px 0",
		maxHeight: "400px",
		overflowY: "auto",
	} as React.CSSProperties,
	msg: {
		maxWidth: "80%",
		padding: "10px 14px",
		borderRadius: "12px",
		lineHeight: 1.4,
		fontSize: "14px",
	} as React.CSSProperties,
	msgVisitor: {
		alignSelf: "flex-end",
		background: "#2563eb",
		color: "white",
		borderBottomRightRadius: "4px",
	} as React.CSSProperties,
	msgReply: {
		alignSelf: "flex-start",
		background: "var(--color-surface, #f3f4f6)",
		borderBottomLeftRadius: "4px",
	} as React.CSSProperties,
	msgLabel: { fontSize: "11px", opacity: 0.7, marginBottom: "4px" } as React.CSSProperties,
	replyForm: {
		display: "flex",
		gap: "8px",
		marginTop: "16px",
	} as React.CSSProperties,
	input: {
		flex: 1,
		padding: "8px 12px",
		border: "1px solid var(--color-border, #e5e7eb)",
		borderRadius: "8px",
		fontFamily: "inherit",
		fontSize: "14px",
	} as React.CSSProperties,
	btn: {
		padding: "8px 16px",
		background: "#2563eb",
		color: "white",
		border: "none",
		borderRadius: "8px",
		fontFamily: "inherit",
		fontSize: "14px",
		fontWeight: 500,
		cursor: "pointer",
	} as React.CSSProperties,
	btnDanger: {
		padding: "6px 12px",
		background: "#ef4444",
		color: "white",
		border: "none",
		borderRadius: "6px",
		fontFamily: "inherit",
		fontSize: "12px",
		cursor: "pointer",
	} as React.CSSProperties,
	btnSecondary: {
		padding: "6px 12px",
		background: "var(--color-surface, #f3f4f6)",
		color: "var(--color-text, #111827)",
		border: "1px solid var(--color-border, #e5e7eb)",
		borderRadius: "6px",
		fontFamily: "inherit",
		fontSize: "12px",
		cursor: "pointer",
	} as React.CSSProperties,
	actions: { display: "flex", gap: "8px", marginTop: "16px" } as React.CSSProperties,
	widgetNumber: {
		fontSize: "36px",
		fontWeight: 700,
		color: "var(--color-text, #111827)",
	} as React.CSSProperties,
	widgetLabel: {
		fontSize: "13px",
		color: "var(--color-muted, #9ca3af)",
		marginTop: "4px",
	} as React.CSSProperties,
};

// ─── Conversations Page ─────────────────────────────────────────

function ConversationsPage() {
	const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
	const [selected, setSelected] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(true);

	const loadList = React.useCallback(async () => {
		try {
			const res = await apiFetch("conversations/list");
			const data = await parseApiResponse<{ items: ConversationItem[] }>(res);
			setConversations(data.items || []);
		} catch {
			// Ignore
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		loadList();
	}, [loadList]);

	if (selected) {
		return (
			<ConversationDetail
				conversationId={selected}
				onBack={() => {
					setSelected(null);
					loadList();
				}}
			/>
		);
	}

	if (loading) {
		return <div style={styles.container}>Loading...</div>;
	}

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h2 style={styles.title}>Conversations</h2>
			</div>
			{conversations.length === 0 ? (
				<div style={styles.empty as React.CSSProperties}>
					<p>No conversations yet.</p>
					<p style={{ fontSize: "13px", marginTop: "8px" }}>
						When visitors use the chat widget, their conversations will appear here.
					</p>
				</div>
			) : (
				<div style={styles.list as React.CSSProperties}>
					{conversations.map((conv) => (
						<div
							key={conv.id}
							style={styles.item}
							onClick={() => setSelected(conv.id)}
							onKeyDown={(e) => e.key === "Enter" && setSelected(conv.id)}
							role="button"
							tabIndex={0}
						>
							<div style={styles.itemLeft as React.CSSProperties}>
								<span style={styles.itemName}>{conv.visitorName}</span>
								<span style={styles.itemEmail}>{conv.visitorEmail}</span>
							</div>
							<div style={styles.itemRight as React.CSSProperties}>
								{conv.unreadCount > 0 && (
									<span style={styles.unread as React.CSSProperties}>{conv.unreadCount}</span>
								)}
								<span
									style={{
										...styles.badge,
										...(conv.status === "open" ? styles.badgeOpen : styles.badgeClosed),
									}}
								>
									{conv.status}
								</span>
								<span style={styles.time}>{new Date(conv.lastMessageAt).toLocaleDateString()}</span>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ─── Conversation Detail ────────────────────────────────────────

function ConversationDetail({
	conversationId,
	onBack,
}: {
	conversationId: string;
	onBack: () => void;
}) {
	const [conversation, setConversation] = React.useState<ConversationItem | null>(null);
	const [msgs, setMsgs] = React.useState<MessageItem[]>([]);
	const [reply, setReply] = React.useState("");
	const [sending, setSending] = React.useState(false);
	const messagesEndRef = React.useRef<HTMLDivElement>(null);

	const load = React.useCallback(async () => {
		try {
			const res = await apiFetch("conversations/get", { conversationId });
			const data = await parseApiResponse<{
				conversation: ConversationItem;
				messages: MessageItem[];
			}>(res);
			setConversation(data.conversation);
			setMsgs(data.messages || []);
		} catch {
			// Ignore
		}
	}, [conversationId]);

	React.useEffect(() => {
		load();
	}, [load]);

	React.useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [msgs]);

	async function handleReply(e: React.FormEvent) {
		e.preventDefault();
		if (!reply.trim() || sending) return;
		setSending(true);
		try {
			await apiFetch("messages/reply", { conversationId, message: reply });
			setReply("");
			await load();
		} finally {
			setSending(false);
		}
	}

	async function handleClose() {
		await apiFetch("conversations/close", { conversationId });
		onBack();
	}

	async function handleDelete() {
		if (!confirm("Delete this conversation and all messages?")) return;
		await apiFetch("conversations/delete", { conversationId });
		onBack();
	}

	if (!conversation) {
		return <div style={styles.container}>Loading...</div>;
	}

	return (
		<div style={styles.container}>
			<button type="button" style={styles.backBtn} onClick={onBack}>
				&larr; Back to conversations
			</button>
			<div style={styles.header}>
				<div>
					<h2 style={styles.title}>{conversation.visitorName}</h2>
					<span style={styles.itemEmail}>{conversation.visitorEmail}</span>
				</div>
				<span
					style={{
						...styles.badge,
						...(conversation.status === "open" ? styles.badgeOpen : styles.badgeClosed),
					}}
				>
					{conversation.status}
				</span>
			</div>

			<div style={styles.messages as React.CSSProperties}>
				{msgs.map((m) => {
					const isVisitor = m.sender === "visitor";
					const label =
						m.sender === "ai"
							? "AI Assistant"
							: m.sender === "admin"
								? "You"
								: conversation.visitorName;
					return (
						<div
							key={m.id}
							style={{
								...styles.msg,
								...(isVisitor ? styles.msgVisitor : styles.msgReply),
							}}
						>
							<div style={styles.msgLabel}>{label}</div>
							<div>{m.text}</div>
						</div>
					);
				})}
				<div ref={messagesEndRef} />
			</div>

			{conversation.status === "open" && (
				<form style={styles.replyForm} onSubmit={handleReply}>
					<input
						type="text"
						style={styles.input}
						value={reply}
						onChange={(e) => setReply(e.target.value)}
						placeholder="Type a reply..."
					/>
					<button type="submit" style={styles.btn} disabled={sending}>
						{sending ? "Sending..." : "Reply"}
					</button>
				</form>
			)}

			<div style={styles.actions as React.CSSProperties}>
				{conversation.status === "open" && (
					<button type="button" style={styles.btnSecondary} onClick={handleClose}>
						Close conversation
					</button>
				)}
				<button type="button" style={styles.btnDanger} onClick={handleDelete}>
					Delete
				</button>
			</div>
		</div>
	);
}

// ─── Dashboard Widget ───────────────────────────────────────────

function UnreadWidget() {
	const [count, setCount] = React.useState<number | null>(null);

	React.useEffect(() => {
		async function load() {
			try {
				const res = await apiFetch("conversations/list");
				const data = await parseApiResponse<{ items: ConversationItem[] }>(res);
				const unread = (data.items || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
				setCount(unread);
			} catch {
				setCount(0);
			}
		}
		load();
	}, []);

	return (
		<div style={{ padding: "16px", textAlign: "center" }}>
			<div style={styles.widgetNumber}>{count ?? "..."}</div>
			<div style={styles.widgetLabel}>unread messages</div>
		</div>
	);
}

// ─── Exports ────────────────────────────────────────────────────

export const pages: PluginAdminExports["pages"] = {
	"/": ConversationsPage,
};

export const widgets: PluginAdminExports["widgets"] = {
	"unread-messages": UnreadWidget,
};
