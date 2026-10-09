// Zed/LazyVim-style clipboard for Obsidian's vim mode.
//
// Keys: <C-a> selects all, <C-c>/<C-x> copy/cut the selection or the current line, and
// <C-v> pastes, all through the system clipboard. With a selection, and in insert mode,
// Obsidian's own copy (which then leaves visual mode), cut and paste do this.
// Visual block stays on <C-q>.
//
// Registers, like Zed's `use_system_clipboard = "on_yank"`: yanks also go to the system
// clipboard, deletes and changes stay in vim registers, and p pastes the system clipboard
// once it holds something newer than the last yank, copy or delete.
import type { Plugin } from "obsidian";
import { VimAdapter, VimApi, VimKeymapEntry, VimRegisterController, vimApi } from "./internals";
import { copiesWholeLines } from "./vim";
import { SelectAll } from "./select-all";

const PASTE_ACTION = "vimakasePaste";

const increment = (keys: string, increase: boolean): VimKeymapEntry => ({
	keys,
	type: "action",
	action: "incrementNumberToken",
	isEdit: true,
	actionArgs: { increase, backtrack: false },
});

const keyToKey = (keys: string, toKeys: string, context: string): VimKeymapEntry => ({
	keys,
	type: "keyToKey",
	toKeys,
	context,
});

/** Vim's own entries for the keys taken over, to restore on disable. */
const REPLACED: VimKeymapEntry[] = [
	increment("<C-a>", true),
	increment("<C-x>", false),
	{ keys: "<C-v>", type: "action", action: "toggleVisualMode", actionArgs: { blockwise: true } },
	{ keys: "<C-c>", type: "keyToKey", toKeys: "<Esc>" },
	{ keys: "<C-c>", type: "keyToKey", toKeys: "<Esc>", context: "insert" },
];

const ADDED: VimKeymapEntry[] = [
	keyToKey("<C-c>", '"+yy', "normal"),
	keyToKey("<C-x>", '"+dd', "normal"),
	keyToKey("<C-x>", '"+d', "visual"),
	{ keys: "<C-v>", type: "action", action: PASTE_ACTION, isEdit: true, context: "normal" },
	{ keys: "<C-v>", type: "action", action: PASTE_ACTION, isEdit: true, context: "visual" },
];

type PushText = VimRegisterController["pushText"];

export class Clipboard {
	private vim: VimApi | null = null;
	private registers: VimRegisterController | null = null;
	private originalPushText: PushText | null = null;
	private removed: VimKeymapEntry[] = [];
	/** System clipboard text as of the last yank, copy or sync. */
	private lastSeen: string | null = null;
	/** The editor copies whole lines without their final newline (no selection, visual line). */
	private lineCopy: string | null = null;
	/** Discard clipboard reads if a vim edit or a setting change happened while waiting. */
	private revision = 0;
	private readonly selectAll: SelectAll;

	constructor(plugin: Plugin) {
		this.selectAll = new SelectAll(plugin, () => this.vim);
		plugin.register(() => this.disable());
		// Text copied in another app, or by the editor's own copy and cut.
		plugin.registerDomEvent(window, "focus", () => void this.sync());
		const onCopy = (): void => {
			if (this.registers == null) {
				return;
			}
			const wholeLine = copiesWholeLines(plugin.app);
			const revision = this.revision;
			window.setTimeout(() => {
				if (revision === this.revision) {
					void this.sync(wholeLine);
				}
			}, 0);
		};
		plugin.registerDomEvent(document, "copy", onCopy);
		plugin.registerDomEvent(document, "cut", onCopy);
	}

	/** Safe to call repeatedly; vim mode may only load later. */
	enable(): void {
		const vim = vimApi();
		if (vim == null || this.vim != null) {
			return;
		}

		this.vim = vim;
		vim.defineAction(PASTE_ACTION, (cm) => void this.paste(cm));
		for (const entry of REPLACED) {
			if (vim.unmap(entry.keys, entry.context)) {
				this.removed.push(entry);
			}
		}
		for (const entry of ADDED) {
			vim._mapCommand(entry);
		}

		this.registers = vim.getRegisterController();
		const registers = this.registers;
		const original = registers.pushText;
		this.originalPushText = original;
		registers.pushText = (registerName, operator, text, linewise, blockwise) => {
			this.revision++;
			original.call(registers, registerName, operator, text, linewise, blockwise);
			const unnamed = registerName == null || registerName === '"';
			// Vim itself writes "+ to the clipboard.
			if ((operator === "yank" && unnamed) || registerName === "+") {
				const copied = linewise === true && !text.endsWith("\n") ? `${text}\n` : text;
				this.lastSeen = copied;
				if (unnamed) {
					void navigator.clipboard.writeText(copied).catch(() => {});
				}
			}
		};

		void this.sync();
	}

	disable(): void {
		this.selectAll.clear();
		this.revision++;
		this.lastSeen = null;
		this.lineCopy = null;
		const vim = this.vim;
		if (vim == null) {
			return;
		}

		for (const entry of ADDED) {
			vim.unmap(entry.keys, entry.context);
		}
		for (const entry of this.removed) {
			vim._mapCommand(entry);
		}
		if (this.registers != null && this.originalPushText != null) {
			this.registers.pushText = this.originalPushText;
		}

		this.vim = null;
		this.registers = null;
		this.originalPushText = null;
		this.removed = [];
	}

	/** Puts newer system clipboard text into vim's unnamed register, so p pastes it. */
	private async sync(wholeLine?: boolean): Promise<void> {
		const registers = this.registers;
		const revision = this.revision;
		if (registers == null) {
			return;
		}

		const text = await readClipboard();
		if (text === "" || registers !== this.registers || revision !== this.revision) {
			return;
		}
		if (wholeLine != null) {
			this.lineCopy = wholeLine ? text : null;
		}
		if (wholeLine == null && text === this.lastSeen) {
			return;
		}

		this.lastSeen = text;
		registers.unnamedRegister.setText(...this.asRegister(text));
	}

	/**
	 * P with the system clipboard in place of the unnamed register, which is put back
	 * afterwards: vim's own "+P reads the clipboard but not whether it holds whole lines.
	 */
	private async paste(cm: VimAdapter): Promise<void> {
		const revision = this.revision;
		const text = await readClipboard();
		const vim = this.vim;
		const unnamed = this.registers?.unnamedRegister;
		if (text === "" || vim == null || unnamed == null || revision !== this.revision) {
			return;
		}

		const saved = [unnamed.toString(), unnamed.linewise, unnamed.blockwise] as const;
		unnamed.setText(...this.asRegister(text));
		try {
			vim.handleKey(cm, "P", "mapping");
		} finally {
			unnamed.setText(...saved);
		}
	}

	private asRegister(text: string): [string, boolean] {
		if (text.endsWith("\n")) {
			return [text, true];
		}
		return text === this.lineCopy ? [`${text}\n`, true] : [text, false];
	}
}

async function readClipboard(): Promise<string> {
	return navigator.clipboard.readText().catch(() => "");
}
