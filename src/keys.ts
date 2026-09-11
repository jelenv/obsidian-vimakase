// Vim-style key notation ("j", "A", "gg", "<Space>e", "<C-x>") and a
// sequence matcher. Sequences wait for the next key without a timeout, like vim.

export interface Binding {
	keys: string;
	desc: string;
	run: () => unknown;
}

export type FeedResult =
	| { type: "match"; binding: Binding }
	| { type: "pending" }
	| { type: "cancel" }
	| { type: "none" };

const NAMED_EVENT_KEYS: Record<string, string> = {
	" ": "Space",
	Escape: "Esc",
	Enter: "CR",
	Backspace: "BS",
	Tab: "Tab",
	Delete: "Del",
	ArrowUp: "Up",
	ArrowDown: "Down",
	ArrowLeft: "Left",
	ArrowRight: "Right",
};

const NAMED_TOKENS: Record<string, string> = {
	space: "Space",
	esc: "Esc",
	escape: "Esc",
	cr: "CR",
	enter: "CR",
	return: "CR",
	bs: "BS",
	tab: "Tab",
	del: "Del",
	up: "Up",
	down: "Down",
	left: "Left",
	right: "Right",
};

const IGNORED_EVENT_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Dead", "Unidentified"]);

function formatKey(name: string, mods: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }): string {
	const prefix = `${mods.ctrl ? "C-" : ""}${mods.alt ? "A-" : ""}${mods.shift ? "S-" : ""}${mods.meta ? "D-" : ""}`;
	return `<${prefix}${name}>`;
}

/** Converts a keydown event to a key token, or null for bare modifier presses. */
export function eventToKey(event: KeyboardEvent): string | null {
	if (IGNORED_EVENT_KEYS.has(event.key)) {
		return null;
	}

	const named = NAMED_EVENT_KEYS[event.key];
	const hasCommandModifier = event.ctrlKey || event.altKey || event.metaKey;

	if (named == null && event.key.length === 1 && !hasCommandModifier) {
		// Printable key: shift is already applied ("A", "?", "|").
		return event.key;
	}

	const name = named ?? (event.key.length === 1 ? event.key.toLowerCase() : event.key);
	return formatKey(name, {
		ctrl: event.ctrlKey,
		alt: event.altKey,
		shift: event.shiftKey && (named != null || event.key.length === 1),
		meta: event.metaKey,
	});
}

function normalizeToken(token: string): string {
	if (!(token.startsWith("<") && token.endsWith(">") && token.length > 2)) {
		return token;
	}

	const parts = token.slice(1, -1).split("-");
	const rawName = parts.pop() ?? "";
	const mods = { ctrl: false, alt: false, shift: false, meta: false };

	for (const mod of parts) {
		switch (mod.toLowerCase()) {
			case "c":
				mods.ctrl = true;
				break;
			case "a":
			case "m":
				mods.alt = true;
				break;
			case "s":
				mods.shift = true;
				break;
			case "d":
				mods.meta = true;
				break;
		}
	}

	const name = NAMED_TOKENS[rawName.toLowerCase()] ?? (rawName.length === 1 ? rawName.toLowerCase() : rawName);
	return formatKey(name, mods);
}

/** Splits "<Space>ff" into ["<Space>", "f", "f"]. */
export function parseKeys(keys: string): string[] {
	return (keys.match(/<[^<>]+>|./g) ?? []).map(normalizeToken);
}

export class KeyMatcher {
	private readonly bindings = new Map<string, Binding>();
	private readonly prefixes = new Set<string>();
	private pending: string[] = [];

	constructor(bindings: Binding[]) {
		for (const binding of bindings) {
			const tokens = parseKeys(binding.keys);
			this.bindings.set(tokens.join(" "), binding);

			for (let i = 1; i < tokens.length; i++) {
				this.prefixes.add(tokens.slice(0, i).join(" "));
			}
		}
	}

	get hasPending(): boolean {
		return this.pending.length > 0;
	}

	get pendingKeys(): string {
		return this.pending.join("");
	}

	reset(): void {
		this.pending = [];
	}

	feed(key: string): FeedResult {
		const sequence = [...this.pending, key].join(" ");

		if (this.prefixes.has(sequence)) {
			this.pending.push(key);
			return { type: "pending" };
		}

		const hadPending = this.pending.length > 0;
		this.pending = [];

		const binding = this.bindings.get(sequence);
		if (binding != null) {
			return { type: "match", binding };
		}

		return { type: hadPending ? "cancel" : "none" };
	}
}
