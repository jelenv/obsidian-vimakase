// Reads Obsidian's CodeMirror vim state, so leader sequences only start in normal mode
// with no vim command in progress (counts, operators, f/t, registers...).
import type { App, Plugin } from "obsidian";

interface VimInputState {
	keyBuffer?: string[];
	operator?: string | null;
	motion?: string | null;
}

interface VimState {
	insertMode?: boolean;
	visualMode?: boolean;
	inputState?: VimInputState;
}

interface CodeMirrorAdapter {
	state?: { vim?: VimState };
	on(event: string, handler: () => void): void;
	off(event: string, handler: () => void): void;
}

type EditorWithVim = { cm?: { cm?: CodeMirrorAdapter } };

function exitVisualMode(cm: CodeMirrorAdapter): void {
	const vim = (window as unknown as { CodeMirrorAdapter?: { Vim?: { exitVisualMode(cm: CodeMirrorAdapter): void } } })
		.CodeMirrorAdapter?.Vim;
	vim?.exitVisualMode(cm);
}

/** The picker modal is open; Obsidian has no public way to ask. */
function pickerIsOpen(): boolean {
	return document.querySelector(".modal-container") != null;
}

/** Leaves visual mode with the cursor at the start of the match. Returns whether it did. */
function leaveVisualMode(app: App): boolean {
	const editor = app.workspace.activeEditor?.editor;
	const cm = (editor as unknown as EditorWithVim | undefined)?.cm?.cm;
	if (editor == null || cm == null || cm.state?.vim?.visualMode !== true) {
		return false;
	}

	const from = editor.getCursor("from");
	exitVisualMode(cm);
	editor.setCursor(from);
	return true;
}

const TICK_MS = 50;
/** Kept watching after the picker closed, because the editor may still be loading. */
const TAIL_MS = 2000;
const LIMIT_MS = 60_000;

/**
 * Pickers like Omnisearch select the match after opening a file, which vim turns into
 * visual mode. Watch the active editor while the picker is open and for a moment after
 * it closes, and leave visual mode once the selection appears.
 *
 * The selection can land well after the file opens, in an editor that did not exist yet
 * when it did, or in the file that was already open, so this polls the editor of the
 * moment rather than hanging onto one from a `file-open` event.
 */
export function exitVisualAfterPick(plugin: Plugin): void {
	let elapsed = 0;
	let sinceClosed = 0;

	const interval = window.setInterval(() => {
		elapsed += TICK_MS;
		sinceClosed = pickerIsOpen() ? 0 : sinceClosed + TICK_MS;

		if (leaveVisualMode(plugin.app) || sinceClosed >= TAIL_MS || elapsed >= LIMIT_MS) {
			window.clearInterval(interval);
		}
	}, TICK_MS);

	plugin.registerInterval(interval);
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
