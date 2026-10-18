import type { EditorSelection, Extension, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Plugin } from "obsidian";
import { type VimAdapter, type VimApi, activeEditorView } from "./internals";

interface SavedPlace {
	cm: VimAdapter;
	cursor: { line: number; ch: number };
	scroll: StateEffect<unknown>;
	selection: EditorSelection;
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

/** Select all without following the selection endpoint; Esc cancels back to the starting place. */
export class SelectAll {
	private saved: SavedPlace | null = null;
	private selecting = false;

	constructor(plugin: Plugin, private readonly vim: () => VimApi | null) {
		plugin.registerDomEvent(document, "keydown", (event) => this.onKey(event, plugin), { capture: true });
		plugin.registerEditorExtension(this.extension());
	}

	clear(): void {
		this.saved = null;
	}

	private extension(): Extension {
		return [
			EditorView.scrollHandler.of((view) => this.saved?.cm.cm6 === view),
			EditorView.updateListener.of((update) => {
				const saved = this.saved;
				if (
					saved?.cm.cm6 === update.view && !this.selecting &&
					(update.docChanged || !update.state.selection.eq(saved.selection))
				) {
					this.clear();
				}
			}),
		];
	}

	private onKey(event: KeyboardEvent, plugin: Plugin): void {
		const selectAll = event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey &&
			event.key.toLowerCase() === "a";
		if ((!selectAll && this.saved == null) || MODIFIER_KEYS.has(event.key) || event.isComposing) {
			return;
		}
		const vim = this.vim();
		if (vim == null) {
			return;
		}
		const view = activeEditorView(plugin.app);
		const cm = view?.cm;
		if (cm?.state.vim == null || view?.hasFocus !== true) {
			return;
		}

		if (selectAll) {
			event.preventDefault();
			event.stopImmediatePropagation();
			this.select(cm, vim);
		} else if (event.key === "Escape" && this.saved?.cm === cm) {
			const saved = this.saved;
			this.clear();
			event.preventDefault();
			event.stopImmediatePropagation();
			vim.handleKey(cm, "<Esc>", "user");
			cm.setCursor(saved.cursor);
			cm.cm6.dispatch({ effects: saved.scroll });
		} else {
			// Ordinary movement and edits resume vim's usual cursor and scrolling behavior.
			this.clear();
		}
	}

	private select(cm: VimAdapter, vim: VimApi): void {
		if (this.saved?.cm === cm) {
			return;
		}
		const view = cm.cm6;
		const saved: SavedPlace = {
			cm,
			cursor: cm.getCursor(),
			scroll: view.scrollSnapshot(),
			selection: view.state.selection,
		};
		this.saved = saved;
		this.selecting = true;
		try {
			// Batch vim's motions into one editor update instead of updating after each key.
			cm.operation(() => {
				for (const key of ["<Esc>", "g", "g", "V", "G"]) {
					vim.handleKey(cm, key, "mapping");
				}
			});
			saved.selection = view.state.selection;
			view.dispatch({ effects: saved.scroll });
		} finally {
			this.selecting = false;
		}
	}
}
