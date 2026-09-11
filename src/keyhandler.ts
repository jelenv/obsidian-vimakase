// Keys outside the editor: explorer keys when the file explorer is focused,
// leader keys in every other non-editing view. The editor itself is handled by vim.ts.
import type Omsidian from "./main";
import { Binding, KeyMatcher, eventToKey } from "./keys";

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

function isOverlayOpen(): boolean {
	return document.querySelector(".modal-container, .menu") != null;
}

export class KeyHandler {
	private explorerMatcher = new KeyMatcher([]);
	private leaderMatcher = new KeyMatcher([]);
	private current: KeyMatcher | null = null;
	private pendingEl: HTMLElement | null = null;

	constructor(
		private readonly plugin: Omsidian,
		private readonly leader: Binding[],
		private readonly explorer: Binding[],
	) {}

	register(): void {
		this.rebuild();
		this.pendingEl = this.plugin.addStatusBarItem();
		this.pendingEl.addClass("omsidian-pending");
		// Capture phase: runs before Obsidian's own explorer key handling.
		this.plugin.registerDomEvent(document, "keydown", this.onKeyDown, { capture: true });
		this.plugin.registerEvent(this.plugin.app.workspace.on("active-leaf-change", () => this.reset()));
	}

	/** Call after settings change. */
	rebuild(): void {
		const { leaderKeys, explorerKeys } = this.plugin.settings;
		const leader = leaderKeys ? this.leader : [];

		this.explorerMatcher = new KeyMatcher([...(explorerKeys ? this.explorer : []), ...leader]);
		this.leaderMatcher = new KeyMatcher(leader);
		this.reset();
	}

	private reset(): void {
		this.current?.reset();
		this.current = null;
		this.showPending("");
	}

	private showPending(keys: string): void {
		this.pendingEl?.setText(keys.replace(/<Space>/g, "␣"));
	}

	private onKeyDown = (event: KeyboardEvent): void => {
		if (event.isComposing || isTypingTarget(event.target) || isOverlayOpen()) {
			return;
		}

		const key = eventToKey(event);
		if (key == null) {
			return;
		}

		const matcher = this.plugin.explorer.isActive() ? this.explorerMatcher : this.leaderMatcher;
		if (matcher !== this.current) {
			this.reset();
			this.current = matcher;
		}

		if (key === "<Esc>" && matcher.hasPending) {
			this.swallow(event);
			this.reset();
			return;
		}

		const result = matcher.feed(key);
		if (result.type === "none") {
			return;
		}

		this.swallow(event);
		this.showPending(matcher.pendingKeys);

		if (result.type === "match") {
			void result.binding.run();
		}
	};

	private swallow(event: KeyboardEvent): void {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}
