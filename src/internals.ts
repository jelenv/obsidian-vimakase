// Undocumented Obsidian internals used by Vimakase. Keep this surface small:
// anything here can change with an Obsidian update.
import type { TAbstractFile, TFile, TFolder, View } from "obsidian";

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

declare module "obsidian" {
	interface App {
		commands: {
			commands: Record<string, unknown>;
			executeCommandById(id: string): boolean;
		};
	}
}
