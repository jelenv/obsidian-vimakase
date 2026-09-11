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

/**
 * Pickers like Omnisearch select the match after opening a file, which vim turns into
 * visual mode. After the next file open, go back to normal mode with the cursor at the
 * start of the match.
 */
export function exitVisualAfterNextOpen(plugin: Plugin): void {
	const { workspace } = plugin.app;

	const ref = workspace.on("file-open", () => {
		workspace.offref(ref);

		const editor = workspace.activeEditor?.editor;
		const cm = (editor as unknown as EditorWithVim | undefined)?.cm?.cm;
		if (editor == null || cm == null) {
			return;
		}

		const check = (): void => {
			if (cm.state?.vim?.visualMode === true) {
				const from = editor.getCursor("from");
				exitVisualMode(cm);
				editor.setCursor(from);
			}
		};

		// The picker sets the selection right after the file opens.
		cm.on("vim-mode-change", check);
		window.setTimeout(check, 0);
		window.setTimeout(() => cm.off("vim-mode-change", check), 1000);
	});

	plugin.registerEvent(ref);
	// The picker may be cancelled; don't touch an unrelated later file open.
	window.setTimeout(() => workspace.offref(ref), 60_000);
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
