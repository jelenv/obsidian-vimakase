// Reads Obsidian's CodeMirror vim state, so leader sequences only start in normal mode
// with no vim command in progress (counts, operators, f/t, registers...).
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { App, Plugin } from "obsidian";
import { hasBodyOverlay } from "./dom";
import { type VimEditorView, activeEditorView, vimApi } from "./internals";

const PICKER_CLASSES = ["modal-container"];

/** How long to keep watching after the picker closed; the editor may still be loading. */
const TAIL_MS = 2000;
/** Long enough for the picker to have opened; the command may not open one at all. */
const OPEN_MS = 1000;
/** The picker may be left open. */
const LIMIT_MS = 60_000;

/** Leaves visual mode with the cursor at the start of the match. */
function leaveVisualMode(view: VimEditorView): void {
	const cm = view.cm;
	if (cm?.state.vim?.visualMode !== true) {
		return;
	}

	const { from } = view.state.selection.main;
	vimApi()?.exitVisualMode(cm);
	view.dispatch({ selection: { anchor: from } });
}

/**
 * Pickers like Omnisearch select the match after opening a file, which vim turns into
 * visual mode. Between opening the picker and a moment after it closes, leave visual
 * mode as soon as such a selection lands.
 *
 * The selection can arrive well after the file opens, in an editor that did not exist
 * yet when it did, or in the file that was already open. So this waits for the selection
 * itself, rather than for a `file-open` that may come too early or never come at all.
 */
export class PickWatch {
	private armed = false;
	private sawPicker = false;
	private observer: MutationObserver | null = null;
	private timers: number[] = [];

	constructor(plugin: Plugin) {
		plugin.register(() => this.stop());
	}

	/** Lives in every editor, and does nothing until a pick is expected. */
	extension(): Extension {
		return EditorView.updateListener.of((update) => {
			if (!this.armed || !update.selectionSet || update.state.selection.main.empty) {
				return;
			}

			this.armed = false;
			// Leaving visual mode dispatches, which CodeMirror forbids during an update.
			this.later(() => {
				leaveVisualMode(update.view);
				this.stop();
			}, 0);
		});
	}

	expectPick(): void {
		this.stop();
		this.armed = true;
		this.observer = new MutationObserver(() => this.onBodyChange());
		this.observer.observe(document.body, { childList: true });
		this.later(() => {
			if (!this.sawPicker) {
				this.stop();
			}
		}, OPEN_MS);
		this.later(() => this.stop(), LIMIT_MS);
	}

	/** The picker is a direct child of <body>, so its whole life shows up here. */
	private onBodyChange(): void {
		if (hasBodyOverlay(PICKER_CLASSES)) {
			this.sawPicker = true;
		} else if (this.sawPicker) {
			this.observer?.disconnect();
			this.observer = null;
			this.later(() => this.stop(), TAIL_MS);
		}
	}

	private stop(): void {
		this.armed = false;
		this.sawPicker = false;
		this.observer?.disconnect();
		this.observer = null;
		for (const timer of this.timers) {
			window.clearTimeout(timer);
		}
		this.timers = [];
	}

	private later(run: () => void, ms: number): void {
		this.timers.push(window.setTimeout(run, ms));
	}
}

/** Whether `target` is the text of the active editor, in normal mode with no vim command in progress. */
export function editorAcceptsLeader(app: App, target: Node): boolean {
	const view = activeEditorView(app);
	// The inline title, properties and vim's command line sit inside the editor too.
	if (view == null || !view.contentDOM.contains(target)) {
		return false;
	}

	const vim = view.cm?.state.vim;
	if (vim == null) {
		// Vim mode is off.
		return false;
	}

	const input = vim.inputState;
	return (
		vim.insertMode !== true &&
		vim.visualMode !== true &&
		input?.operator == null &&
		input?.motion == null &&
		(input?.keyBuffer?.length ?? 0) === 0
	);
}

/** Whether a copy in the editor right now takes whole lines: nothing selected, or visual line mode. */
export function copiesWholeLines(app: App): boolean {
	const view = activeEditorView(app);
	if (view == null || !view.hasFocus) {
		return false;
	}

	return view.state.selection.ranges.every((range) => range.empty) || view.cm?.state.vim?.visualLine === true;
}
