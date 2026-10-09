// Undocumented Obsidian internals used by Vimakase. Keep this surface small:
// anything here can change with an Obsidian update.
import type { TAbstractFile, TFile, TFolder, View } from "obsidian";
import type { EditorView } from "@codemirror/view";

export interface ExplorerNodeBase {
	el: HTMLElement;
	parent?: ExplorerFolderNode;
}

export interface ExplorerFileNode extends ExplorerNodeBase {
	file: TFile;
}

export interface ExplorerFolderNode extends ExplorerNodeBase {
	file: TFolder;
	collapsed: boolean;
	setCollapsed(collapsed: boolean): unknown;
	vChildren: { children: ExplorerNode[] };
}

export type ExplorerNode = ExplorerFileNode | ExplorerFolderNode;

export interface ExplorerTree {
	root: { vChildren: { children: ExplorerNode[] } };
	focusedItem: ExplorerNode | null;
	isAllCollapsed: boolean;
	onKeyArrowDown(event: KeyboardEvent): void;
	onKeyArrowUp(event: KeyboardEvent): void;
	onKeyArrowLeft(event: KeyboardEvent): void;
	onKeyArrowRight(event: KeyboardEvent): void;
	setFocusedItem(node: ExplorerNode | null, scroll?: boolean): void;
	setCollapseAll(collapsed: boolean): void;
	/** Obsidian Scope holding the tree's own key handlers; see NativeScope. */
	scope?: unknown;
}

/** A handler registered with Scope.register(); `modifiers` is "" for plain keys. */
export interface NativeKeyHandler {
	key: string | null;
	modifiers: string | null;
}

/** The parts of Obsidian's Scope that the public typings don't expose. */
export interface NativeScope {
	keys: NativeKeyHandler[];
	unregister(handler: NativeKeyHandler): void;
}

export interface FileExplorerView extends View {
	tree: ExplorerTree;
	fileItems: Record<string, ExplorerNode | undefined>;
	revealInFolder(file: TAbstractFile): void;
}

/** A keymap entry of Obsidian's CodeMirror vim (`defaultKeymap` in its vim.js). */
export interface VimKeymapEntry {
	keys: string;
	type: string;
	context?: string;
	[field: string]: unknown;
}

export interface VimRegister {
	linewise: boolean;
	blockwise: boolean;
	setText(text: string, linewise?: boolean, blockwise?: boolean): void;
	toString(): string;
}

/** The CodeMirror 5-style adapter vim actions run against. */
export interface VimAdapter {
	cm6: EditorView;
	state: { vim?: { insertMode?: boolean; visualMode?: boolean } };
	getCursor(): { line: number; ch: number };
	setCursor(pos: { line: number; ch: number }): void;
	operation(run: () => void): void;
}

export interface VimRegisterController {
	unnamedRegister: VimRegister;
	/** A property, not a method: Vimakase swaps it to also send yanks to the system clipboard. */
	pushText: (
		this: VimRegisterController,
		registerName: string | null | undefined,
		operator: string,
		text: string,
		linewise?: boolean,
		blockwise?: boolean,
	) => void;
}

/** `window.CodeMirrorAdapter.Vim`, present once Obsidian has loaded vim mode. */
export interface VimApi {
	unmap(lhs: string, ctx?: string): boolean;
	_mapCommand(command: VimKeymapEntry): void;
	defineAction(name: string, action: (cm: VimAdapter) => void): void;
	handleKey(cm: VimAdapter, key: string, origin?: string): boolean;
	getRegisterController(): VimRegisterController;
}

export function vimApi(): VimApi | undefined {
	return (window as unknown as { CodeMirrorAdapter?: { Vim?: VimApi } }).CodeMirrorAdapter?.Vim;
}

declare module "obsidian" {
	interface App {
		commands: {
			commands: Record<string, unknown>;
			executeCommandById(id: string): boolean;
		};
	}
}
