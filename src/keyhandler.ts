// One key engine for every view: explorer keys + leader while the file explorer is
// focused, leader in the editor (vim normal mode) and in other non-typing views.
import { View } from "obsidian";
import type Vimakase from "./main";
import { hasBodyOverlay } from "./dom";
import { EXPLORER_VIEW_TYPE } from "./explorer";
import { Binding, Groups, KeyMap, KeySequence, displayKey, eventToKey } from "./keys";
import { editorAcceptsLeader } from "./vim";
import { WhichKey } from "./whichkey";

/** which-key's default delay before the popup shows. */
const WHICH_KEY_DELAY = 200;
/** LazyVim's timeoutlen; only applies to keys that are both an action and a prefix. */
const TIMEOUTLEN = 300;
/** Views where space is pointer-panning, not a key to steal. */
const EXCLUDED_VIEW_TYPES = new Set(["canvas", "excalidraw"]);

type Context = "explorer" | "editor" | "view";

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	return (
		target.isContentEditable ||
		target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.tagName === "SELECT" ||
		target.closest(".is-being-renamed") != null
	);
}

/** Overlays that take over the keyboard, as direct children of <body>. */
const OVERLAY_CLASSES = ["modal-container", "menu"];

function isOverlayOpen(): boolean {
	return hasBodyOverlay(OVERLAY_CLASSES);
}

export class KeyHandler {
	private explorerMap = new KeyMap([]);
	private leaderMap = new KeyMap([]);
	private sequence: KeySequence | null = null;
	private readonly whichKey = new WhichKey();
	private timeout: number | null = null;
	private pendingEl: HTMLElement | null = null;

	constructor(
		private readonly plugin: Vimakase,
		private readonly leader: Binding[],
		private readonly explorer: Binding[],
		private readonly groups: { leader: Groups; explorer: Groups },
	) {}

	register(): void {
		this.rebuild();
		this.pendingEl = this.plugin.addStatusBarItem();
		// Capture phase so the editor and Obsidian's views don't see keys of a sequence.
		this.plugin.registerDomEvent(document, "keydown", this.onKeyDown, { capture: true });
		this.plugin.registerDomEvent(window, "blur", () => this.reset());
		this.plugin.registerEvent(this.plugin.app.workspace.on("active-leaf-change", () => this.reset()));
		this.plugin.register(() => this.reset());
	}

	/** Call after settings change. */
	rebuild(): void {
		const { leaderKeys, explorerKeys } = this.plugin.settings;
		const leader = leaderKeys ? this.leader : [];

		this.explorerMap = new KeyMap([...(explorerKeys ? this.explorer : []), ...leader], {
			...this.groups.leader,
			...(explorerKeys ? this.groups.explorer : {}),
		});
		this.leaderMap = new KeyMap(leader, this.groups.leader);
		this.reset();
	}

	private context(event: KeyboardEvent, key: string): Context | null {
		if (isTypingTarget(event.target)) {
			if (!this.sequence?.hasKeys && !this.leaderMap.root.children.has(key)) {
				return null;
			}
			const inEditor = event.target instanceof HTMLElement && event.target.closest(".cm-editor") != null;
			return inEditor && editorAcceptsLeader(this.plugin.app) ? "editor" : null;
		}

		const viewType = this.plugin.app.workspace.getActiveViewOfType(View)?.getViewType();
		if (viewType === EXPLORER_VIEW_TYPE) {
			return "explorer";
		}

		return viewType != null && EXCLUDED_VIEW_TYPES.has(viewType) ? null : "view";
	}

	private onKeyDown = (event: KeyboardEvent): void => {
		if (event.isComposing) {
			return;
		}

		const key = eventToKey(event);
		if (key == null || (!this.sequence?.hasKeys &&
			!this.leaderMap.root.children.has(key) && !this.explorerMap.root.children.has(key))) {
			return;
		}

		if (isOverlayOpen()) {
			return;
		}
		const context = this.context(event, key);
		if (context == null) {
			this.reset();
			return;
		}

		const map = context === "explorer" ? this.explorerMap : this.leaderMap;
		if (!this.sequence?.hasKeys && !map.root.children.has(key)) {
			return;
		}
		if (this.sequence?.map !== map) {
			this.reset();
			this.sequence = new KeySequence(map);
		}
		const sequence = this.sequence;

		if (sequence.hasKeys && key === "<Esc>") {
			this.swallow(event);
			this.reset();
			return;
		}

		if (sequence.hasKeys && key === "<BS>") {
			this.swallow(event);
			if (sequence.back()) {
				this.showPending(sequence);
			} else {
				this.reset();
			}
			return;
		}

		const result = sequence.feed(key);
		if (result.type === "none") {
			return;
		}

		this.swallow(event);

		if (result.type === "pending") {
			this.showPending(sequence);
			return;
		}

		this.reset();
		if (result.type === "match") {
			void result.binding.run();
		}
	};

	private showPending(sequence: KeySequence): void {
		this.clearTimeout();

		const keys = sequence.keys.map(displayKey).join(" ");
		this.pendingEl?.setText(keys);

		if (this.plugin.settings.whichKey) {
			const group = sequence.group;
			this.whichKey.schedule(
				() => ({ title: group ? `${keys} · ${group}` : keys, entries: sequence.entries() }),
				WHICH_KEY_DELAY,
			);
		}

		const action = sequence.binding;
		if (action != null) {
			this.timeout = window.setTimeout(() => {
				this.reset();
				void action.run();
			}, TIMEOUTLEN);
		} else if (this.plugin.settings.pendingTimeout > 0) {
			this.timeout = window.setTimeout(() => this.reset(), this.plugin.settings.pendingTimeout);
		}
	}

	private reset(): void {
		if (this.sequence == null) {
			return;
		}
		this.clearTimeout();
		this.sequence = null;
		this.whichKey.hide();
		this.pendingEl?.setText("");
	}

	private clearTimeout(): void {
		if (this.timeout != null) {
			window.clearTimeout(this.timeout);
			this.timeout = null;
		}
	}

	private swallow(event: KeyboardEvent): void {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}
