// Reads Obsidian's CodeMirror vim state, so leader sequences only start in normal mode
// with no vim command in progress (counts, operators, f/t, registers...).
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { App, Plugin } from "obsidian";
import { hasBodyOverlay } from "./dom";

interface VimInputState {
	keyBuffer?: string[];
	operator?: string | null;
	motion?: string | null;
}

interface VimState {
	insertMode?: boolean;
	visualMode?: boolean;
	visualLine?: boolean;
	inputState?: VimInputState;
}

interface CodeMirrorAdapter {
	state?: { vim?: VimState };
}

type EditorWithVim = { cm?: { cm?: CodeMirrorAdapter } };

function exitVisualMode(cm: CodeMirrorAdapter): void {
	const vim = (window as unknown as { CodeMirrorAdapter?: { Vim?: { exitVisualMode(cm: CodeMirrorAdapter): void } } })
		.CodeMirrorAdapter?.Vim;
	vim?.exitVisualMode(cm);
}

const PICKER_CLASSES = ["modal-container"];

/** How long to keep watching after the picker closed; the editor may still be loading. */
const TAIL_MS = 2000;
/** Long enough for the picker to have opened; the command may not open one at all. */
const OPEN_MS = 1000;
/** The picker may be left open. */
const LIMIT_MS = 60_000;

/** Leaves visual mode with the cursor at the start of the match. */
function leaveVisualMode(app: App): void {
	const editor = app.workspace.activeEditor?.editor;
	const cm = (editor as unknown as EditorWithVim | undefined)?.cm?.cm;
	if (editor == null || cm == null || cm.state?.vim?.visualMode !== true) {
		return;
	}

	const from = editor.getCursor("from");
	exitVisualMode(cm);
	editor.setCursor(from);
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

	constructor(private readonly plugin: Plugin) {
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
				leaveVisualMode(this.plugin.app);
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

export function editorAcceptsLeader(app: App): boolean {
	const editor = app.workspace.activeEditor?.editor as unknown as EditorWithVim | undefined;
	const vim = editor?.cm?.cm?.state?.vim;
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
	const editor = app.workspace.activeEditor?.editor;
	if (editor == null || !editor.hasFocus()) {
		return false;
	}

	const vim = (editor as unknown as EditorWithVim).cm?.cm?.state?.vim;
	return !editor.somethingSelected() || vim?.visualLine === true;
}
