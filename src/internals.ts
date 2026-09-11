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
