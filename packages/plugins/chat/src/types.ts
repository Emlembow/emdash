export interface Conversation {
	visitorName: string;
	visitorEmail: string;
	status: "open" | "closed";
	lastMessageAt: string;
	unreadCount: number;
	createdAt: string;
	/** SHA-256 hex of the visitor's session token. Required to send/list messages. */
	sessionTokenHash?: string;
}

export interface Message {
	conversationId: string;
	sender: "visitor" | "admin" | "ai";
	text: string;
	createdAt: string;
}

export interface ChatPluginOptions {
	/** Initial greeting message shown in the chat widget */
	greeting?: string;
}
