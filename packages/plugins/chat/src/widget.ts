/**
 * Chat widget CSS and JS injected via page:fragments hook.
 * Intercom-style instant chat — no signup, just type and talk.
 */

export const WIDGET_CSS = `
.ec-chat-bubble {
	position: fixed;
	bottom: 24px;
	right: 24px;
	width: 56px;
	height: 56px;
	border-radius: 50%;
	background: var(--ec-chat-accent, #d97706);
	color: white;
	border: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 4px 12px rgba(0,0,0,0.3);
	z-index: 9999;
	transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.ec-chat-bubble:hover {
	transform: scale(1.05);
	box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}
.ec-chat-bubble svg { width: 24px; height: 24px; }
.ec-chat-bubble[data-open="true"] .ec-chat-icon-chat { display: none; }
.ec-chat-bubble[data-open="false"] .ec-chat-icon-close { display: none; }

.ec-chat-panel {
	position: fixed;
	bottom: 96px;
	right: 24px;
	width: 380px;
	max-height: 520px;
	background: #1a1a1a;
	border: 1px solid #2a2a2a;
	border-radius: 12px;
	box-shadow: 0 8px 30px rgba(0,0,0,0.4);
	z-index: 9998;
	display: none;
	flex-direction: column;
	overflow: hidden;
	font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	font-size: 14px;
	color: #f5f3ed;
}
.ec-chat-panel[data-open="true"] { display: flex; }

.ec-chat-header {
	padding: 16px;
	border-bottom: 1px solid #2a2a2a;
	font-weight: 600;
	font-size: 15px;
	color: #f5f3ed;
}

.ec-chat-messages {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 200px;
	max-height: 340px;
}

.ec-chat-msg {
	max-width: 85%;
	padding: 10px 14px;
	border-radius: 12px;
	line-height: 1.5;
	word-wrap: break-word;
	font-size: 13px;
}
.ec-chat-msg[data-sender="visitor"] {
	align-self: flex-end;
	background: #d97706;
	color: white;
	border-bottom-right-radius: 4px;
}
.ec-chat-msg[data-sender="ai"],
.ec-chat-msg[data-sender="admin"] {
	align-self: flex-start;
	background: #252525;
	color: #b8b5ad;
	border-bottom-left-radius: 4px;
}
.ec-chat-msg-label {
	font-size: 10px;
	opacity: 0.6;
	margin-bottom: 3px;
	font-family: "DM Mono", monospace;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.ec-chat-typing {
	align-self: flex-start;
	padding: 10px 14px;
	background: #252525;
	border-radius: 12px;
	border-bottom-left-radius: 4px;
	color: #76746d;
	font-size: 13px;
	font-style: italic;
}

.ec-chat-form {
	padding: 12px 16px;
	border-top: 1px solid #2a2a2a;
	display: flex;
	gap: 8px;
}
.ec-chat-form input {
	flex: 1;
	padding: 10px 14px;
	border: 1px solid #2a2a2a;
	border-radius: 8px;
	font-family: inherit;
	font-size: 14px;
	background: #0f0f0f;
	color: #f5f3ed;
	outline: none;
	box-sizing: border-box;
}
.ec-chat-form input:focus {
	border-color: #d97706;
}
.ec-chat-form input::placeholder {
	color: #76746d;
}
.ec-chat-form button {
	padding: 10px 16px;
	background: #d97706;
	color: white;
	border: none;
	border-radius: 8px;
	font-family: inherit;
	font-size: 14px;
	font-weight: 500;
	cursor: pointer;
	transition: opacity 0.15s;
	flex-shrink: 0;
}
.ec-chat-form button:hover { opacity: 0.9; }
.ec-chat-form button:disabled { opacity: 0.5; cursor: default; }

@media (max-width: 480px) {
	.ec-chat-panel {
		right: 8px;
		left: 8px;
		bottom: 88px;
		width: auto;
	}
}
`;

export function buildWidgetScript(pluginId: string, greeting: string): string {
	return `(function(){
var API = "/_emdash/api/plugins/${pluginId}";
var KEY = "ec_chat_conv";
var TOKEN_KEY = "ec_chat_token";
var convId = localStorage.getItem(KEY);
var sessionToken = localStorage.getItem(TOKEN_KEY);
var isOpen = false;
var pollTimer = null;
var fastPollCount = 0;
var sending = false;

function $(sel, el) { return (el||document).querySelector(sel); }
function h(tag, attrs, children) {
	var el = document.createElement(tag);
	if (attrs) Object.keys(attrs).forEach(function(k) {
		if (k === "textContent") el.textContent = attrs[k];
		else if (k === "innerHTML") el.innerHTML = attrs[k];
		else el.setAttribute(k, attrs[k]);
	});
	if (children) children.forEach(function(c) { if(c) el.appendChild(c); });
	return el;
}

function api(route, body) {
	return fetch(API + "/" + route, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body || {})
	}).then(function(r) { return r.json(); }).then(function(j) { return j.data || j; });
}

function mdToHtml(text) {
	var s = text;
	// Escape HTML entities
	s = s.replace(/&/g, "&amp;");
	s = s.replace(/[<]/g, "&lt;");
	s = s.replace(/[>]/g, "&gt;");
	// Markdown links: [text](url)
	s = s.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function(_, t, u) {
		return '<a href="' + u + '" target="_blank" rel="noopener noreferrer" style="color:#d97706;text-decoration:underline">' + t + "<" + "/a>";
	});
	// Bold: **text**
	s = s.replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1<" + "/strong>");
	// Split into lines so we can group consecutive bullet lines into a single <ul>
	var lines = s.split(/\\n/);
	var out = [];
	var inList = false;
	var BULLET_RE = /^[\\-\\*] (.+)$/;
	for (var i = 0; i < lines.length; i++) {
		var m = lines[i].match(BULLET_RE);
		if (m) {
			if (!inList) {
				out.push('<ul style="margin:4px 0;padding-left:18px;list-style:disc">');
				inList = true;
			}
			out.push('<li>' + m[1] + '<' + '/li>');
		} else {
			if (inList) {
				out.push('<' + '/ul>');
				inList = false;
			}
			out.push(lines[i]);
		}
	}
	if (inList) out.push('<' + '/ul>');
	// Join with <br> for non-list lines; list tags already contain no inner breaks
	// We need to be careful: only insert <br> between real text lines, not around <ul>/<li> blocks
	var joined = '';
	for (var j = 0; j < out.length; j++) {
		var part = out[j];
		var prev = out[j - 1] || '';
		var isListTag = /^<\\/?ul|^<li|^<\\/li/.test(part);
		var prevIsListTag = /^<\\/?ul|^<li|^<\\/li/.test(prev);
		if (j > 0 && !isListTag && !prevIsListTag) joined += '<br>';
		joined += part;
	}
	return joined;
}

function addMsg(sender, text) {
	var msgs = $(".ec-chat-messages");
	if (!msgs) return;
	var label = sender === "ai" ? "AI" : sender === "admin" ? "Admin" : "";
	var msg = h("div", { class: "ec-chat-msg", "data-sender": sender });
	if (label) {
		msg.appendChild(h("div", { class: "ec-chat-msg-label", textContent: label }));
	}
	var body = document.createElement("div");
	if (sender === "visitor") {
		body.textContent = text;
	} else {
		body.innerHTML = mdToHtml(text);
	}
	msg.appendChild(body);
	msgs.appendChild(msg);
	msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() {
	var t = $(".ec-chat-typing");
	if (t) t.remove();
}

function showTyping() {
	removeTyping();
	var msgs = $(".ec-chat-messages");
	if (!msgs) return;
	var t = h("div", { class: "ec-chat-typing", textContent: "Thinking..." });
	msgs.appendChild(t);
	msgs.scrollTop = msgs.scrollHeight;
}

function showMessages(data) {
	var msgs = $(".ec-chat-messages");
	if (!msgs) return;
	msgs.innerHTML = "";
	(data.messages || []).forEach(function(m) { addMsg(m.sender, m.text); });
}

function startPoll() {
	stopPoll();
	fastPollCount = 15;
	poll();
}

function poll() {
	if (!convId || !sessionToken || !isOpen) return;
	api("messages/list", { conversationId: convId, sessionToken: sessionToken }).then(function(data) {
		removeTyping();
		if (data.messages) showMessages(data);
		if (!isOpen) return;
		fastPollCount--;
		var delay = fastPollCount > 0 ? 2000 : 10000;
		pollTimer = setTimeout(poll, delay);
	}).catch(function() {
		pollTimer = setTimeout(poll, 10000);
	});
}

function stopPoll() {
	if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

function sendMessage(text) {
	if (sending || !text.trim()) return;
	sending = true;
	addMsg("visitor", text);
	showTyping();

	if (!convId || !sessionToken) {
		// First message — create conversation
		api("conversations/create", { message: text }).then(function(data) {
			if (data.conversationId && data.sessionToken) {
				convId = data.conversationId;
				sessionToken = data.sessionToken;
				localStorage.setItem(KEY, convId);
				localStorage.setItem(TOKEN_KEY, sessionToken);
				startPoll();
			}
			sending = false;
		}).catch(function() { sending = false; removeTyping(); });
	} else {
		// Subsequent messages
		api("messages/send", { conversationId: convId, sessionToken: sessionToken, message: text }).then(function() {
			startPoll();
			sending = false;
		}).catch(function() { sending = false; removeTyping(); });
	}
}

function renderChat(panel) {
	panel.innerHTML = "";
	panel.appendChild(h("div", { class: "ec-chat-header", textContent: "Chat" }));

	var msgs = h("div", { class: "ec-chat-messages" });
	// Show greeting as first AI message
	msgs.appendChild(h("div", { class: "ec-chat-msg", "data-sender": "ai" }, [
		h("div", { class: "ec-chat-msg-label", textContent: "AI" }),
		h("div", { textContent: ${JSON.stringify(greeting)} })
	]));
	panel.appendChild(msgs);

	var form = h("form", { class: "ec-chat-form" });
	var input = h("input", { type: "text", placeholder: "Ask me anything...", autocomplete: "off" });
	var btn = h("button", { type: "submit", textContent: "Send" });
	form.appendChild(input);
	form.appendChild(btn);
	panel.appendChild(form);

	// Load existing messages if returning visitor
	if (convId && sessionToken) {
		api("messages/list", { conversationId: convId, sessionToken: sessionToken }).then(function(data) {
			if (data.messages && data.messages.length > 0) {
				showMessages(data);
			}
		}).catch(function() {
			// Stale or invalid token — reset and start fresh
			localStorage.removeItem(KEY);
			localStorage.removeItem(TOKEN_KEY);
			convId = null;
			sessionToken = null;
		});
	}

	form.addEventListener("submit", function(e) {
		e.preventDefault();
		var text = input.value.trim();
		if (!text) return;
		input.value = "";
		sendMessage(text);
	});

	input.focus();
}

function init() {
	var bubble = h("button", {
		class: "ec-chat-bubble",
		"data-open": "false",
		"aria-label": "Open chat"
	});
	bubble.innerHTML = '<svg class="ec-chat-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><svg class="ec-chat-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

	var panel = h("div", { class: "ec-chat-panel", "data-open": "false" });

	document.body.appendChild(panel);
	document.body.appendChild(bubble);

	bubble.addEventListener("click", function() {
		isOpen = !isOpen;
		bubble.setAttribute("data-open", isOpen);
		panel.setAttribute("data-open", isOpen);
		if (isOpen) {
			renderChat(panel);
			if (convId && sessionToken) startPoll();
		} else {
			stopPoll();
		}
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
})();`;
}
