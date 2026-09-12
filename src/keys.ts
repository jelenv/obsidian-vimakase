// Vim-style key notation ("j", "A", "gg", "<Space>e", "<C-x>"), and the bindings as a
// trie (KeyMap) that a KeySequence walks like which-key in LazyVim: a pure prefix waits
// for the next key, <Esc> cancels, <BS> goes one level up.

export interface Binding {
	keys: string;
	desc: string;
	run: () => unknown;
}

/** Names for prefixes, shown as "+name" in the which-key popup. Keyed by key notation. */
export type Groups = Record<string, string>;

export interface KeyEntry {
	key: string;
	desc: string;
	isGroup: boolean;
}

export type FeedResult =
	| { type: "match"; binding: Binding }
	| { type: "pending" }
	| { type: "cancel" }
	| { type: "none" };

interface KeyNode {
	token: string;
	parent: KeyNode | null;
	children: Map<string, KeyNode>;
	binding?: Binding;
	group?: string;
}

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

const DISPLAY_NAMES: Record<string, string> = {
	"<Space>": "space",
	"<CR>": "enter",
	"<Esc>": "esc",
	"<BS>": "bs",
	"<Tab>": "tab",
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

/** Human-friendly key for the which-key popup: "<Space>" -> "space". */
export function displayKey(token: string): string {
	return DISPLAY_NAMES[token] ?? token;
}

function compareEntries(a: KeyEntry, b: KeyEntry): number {
	if (a.isGroup !== b.isGroup) {
		return a.isGroup ? 1 : -1;
	}
	return a.key.localeCompare(b.key, "en", { caseFirst: "lower" });
}

function ensureNode(root: KeyNode, tokens: string[]): KeyNode {
	let node = root;
	for (const token of tokens) {
		let child = node.children.get(token);
		if (child == null) {
			child = { token, parent: node, children: new Map() };
			node.children.set(token, child);
		}
		node = child;
	}
	return node;
}

function findNode(root: KeyNode, tokens: string[]): KeyNode | null {
	let node: KeyNode | undefined = root;
	for (const token of tokens) {
		node = node.children.get(token);
		if (node == null) {
			return null;
		}
	}
	return node;
}

/** The bindings as a trie. Built when settings change, and read-only after that. */
export class KeyMap {
	readonly root: KeyNode = { token: "", parent: null, children: new Map() };

	constructor(bindings: Binding[], groups: Groups = {}) {
		for (const binding of bindings) {
			ensureNode(this.root, parseKeys(binding.keys)).binding = binding;
		}

		for (const [keys, name] of Object.entries(groups)) {
			const node = findNode(this.root, parseKeys(keys));
			if (node != null) {
				node.group = name;
			}
		}
	}
}

/** How far the keys typed so far have got into a KeyMap. */
export class KeySequence {
	private node: KeyNode;

	constructor(readonly map: KeyMap) {
		this.node = map.root;
	}

	get hasKeys(): boolean {
		return this.node !== this.map.root;
	}

	/** Keys typed so far, e.g. ["<Space>", "f"]. */
	get keys(): string[] {
		const keys: string[] = [];
		for (let node: KeyNode | null = this.node; node != null && node !== this.map.root; node = node.parent) {
			keys.unshift(node.token);
		}
		return keys;
	}

	get group(): string | undefined {
		return this.hasKeys ? this.node.group : undefined;
	}

	/** Action of the keys so far when they are both an action and a prefix; runs after timeoutlen. */
	get binding(): Binding | undefined {
		return this.hasKeys ? this.node.binding : undefined;
	}

	reset(): void {
		this.node = this.map.root;
	}

	/** One level up, like which-key's <BS>. Returns whether any keys are still pending. */
	back(): boolean {
		this.node = this.node.parent ?? this.map.root;
		return this.hasKeys;
	}

	feed(key: string): FeedResult {
		const hadKeys = this.hasKeys;
		const next = this.node.children.get(key);

		if (next == null) {
			this.reset();
			return { type: hadKeys ? "cancel" : "none" };
		}

		if (next.children.size > 0) {
			this.node = next;
			return { type: "pending" };
		}

		this.reset();
		return next.binding != null ? { type: "match", binding: next.binding } : { type: hadKeys ? "cancel" : "none" };
	}

	/** Next keys from here, for the which-key popup. */
	entries(): KeyEntry[] {
		return [...this.node.children.values()]
			.map((node) => {
				const isGroup = node.children.size > 0;
				return {
					key: node.token,
					desc: isGroup ? `+${node.group ?? "prefix"}` : (node.binding?.desc ?? ""),
					isGroup,
				};
			})
			.sort(compareEntries);
	}
}
