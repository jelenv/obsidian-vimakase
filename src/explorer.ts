// Neo-tree-style keys for Obsidian's built-in file explorer.
import { App, Notice, TAbstractFile, TFile, TFolder, View, WorkspaceSidedock, normalizePath } from "obsidian";
import { runCommand } from "./commands";
import type { ExplorerFolderNode, ExplorerNode, FileExplorerView, NativeKeyHandler, NativeScope } from "./internals";
import type { Binding, Groups } from "./keys";
import { confirmAction, promptText } from "./prompt";
import type { VimakaseSettings } from "./settings";

export const EXPLORER_VIEW_TYPE = "file-explorer";
const UNDO_LIMIT = 50;
/** How much deleted content `u` keeps in memory, per delete and across the whole stack. */
const UNDO_MEMORY_LIMIT = 50 * 1024 * 1024;
/** Limit simultaneous reads when snapshotting folders with many small files. */
const SNAPSHOT_BATCH_SIZE = 8;
/** How long to keep asking the explorer for a just-created item, and how often. */
const REVEAL_INTERVAL = 25;
const REVEAL_ATTEMPTS = 20;

export const EXPLORER_GROUPS: Groups = { g: "goto" };

type Clipboard = { mode: "cut" | "copy"; path: string } | null;
type ArrowKey = "ArrowDown" | "ArrowUp" | "ArrowLeft" | "ArrowRight";

interface UndoEntry {
	label: string;
	run: () => Promise<void>;
	/** Bytes of deleted content the entry holds on to; 0 for everything else. */
	bytes: number;
}

interface Snapshot {
	folders: string[];
	files: { path: string; data: ArrayBuffer }[];
	bytes: number;
}

function isFolderNode(node: ExplorerNode): node is ExplorerFolderNode {
	return node.file instanceof TFolder;
}

function parentPath(path: string): string {
	const idx = path.lastIndexOf("/");
	return idx > 0 ? path.slice(0, idx) : "";
}

function joinPath(folder: TFolder, name: string): string {
	return normalizePath(folder.isRoot() ? name : `${folder.path}/${name}`);
}

function notifyError(err: unknown): void {
	new Notice(`Vimakase: ${err instanceof Error ? err.message : String(err)}`);
}

function isNativeScope(scope: unknown): scope is NativeScope {
	return Array.isArray((scope as NativeScope | null | undefined)?.keys);
}

export class Explorer {
	private clipboard: Clipboard = null;
	private undoStack: UndoEntry[] = [];
	private removedNativeKeys: { scope: NativeScope; handler: NativeKeyHandler }[] = [];

	constructor(
		private readonly app: App,
		private readonly settings: () => VimakaseSettings,
	) {}

	isActive(): boolean {
		return this.app.workspace.getActiveViewOfType(View)?.getViewType() === EXPLORER_VIEW_TYPE;
	}

	/** Neo-tree's toggle: open and focus the explorer (revealing the active file), or close it. */
	toggle(): void {
		if (this.isActive()) {
			this.close();
			return;
		}

		runCommand(this.app, this.app.workspace.getActiveFile() ? "file-explorer:reveal-active-file" : "file-explorer:open");
	}

	/**
	 * Obsidian's explorer opens the focused item on space and Enter, and its key scope runs
	 * before any plugin keydown listener. Remove those so space can be the leader and
	 * Enter isn't handled twice. Safe to call repeatedly; restores first.
	 */
	syncNativeKeys(remove: { space: boolean; enter: boolean }): void {
		this.restoreNativeKeys();

		const view = this.view;
		if (view == null) {
			return;
		}

		for (const scope of [view.scope, view.tree.scope].filter(isNativeScope)) {
			for (const handler of [...scope.keys]) {
				const plain = (handler.modifiers ?? "") === "";
				if (plain && ((remove.space && handler.key === " ") || (remove.enter && handler.key === "Enter"))) {
					scope.unregister(handler);
					this.removedNativeKeys.push({ scope, handler });
				}
			}
		}
	}

	restoreNativeKeys(): void {
		for (const { scope, handler } of this.removedNativeKeys) {
			if (!scope.keys.includes(handler)) {
				scope.keys.push(handler);
			}
		}
		this.removedNativeKeys = [];
	}

	bindings(): Binding[] {
		const bind = (keys: string, desc: string, run: () => unknown): Binding => ({
			keys,
			desc,
			run: () => Promise.resolve(run()).catch(notifyError),
		});

		return [
			bind("j", "Move down", () => this.arrow("ArrowDown")),
			bind("k", "Move up", () => this.arrow("ArrowUp")),
			bind("h", "Close folder / go to parent", () => this.arrow("ArrowLeft")),
			bind("l", "Open file / expand folder", () => this.open(false)),
			bind("<CR>", "Open file / toggle folder", () => this.open(true)),
			bind("gg", "First item", () => this.focusEdge("first")),
			bind("G", "Last item", () => this.focusEdge("last")),
			bind("z", "Collapse all folders", () => this.collapseAll()),
			bind("a", "Add file (end with / for a folder)", () => this.add(false)),
			bind("A", "Add folder", () => this.add(true)),
			bind("d", "Delete", () => this.delete()),
			bind("r", "Rename", () => this.rename()),
			bind("m", "Move", () => this.move()),
			bind("c", "Copy to path", () => this.copyTo()),
			bind("x", "Cut", () => this.setClipboard("cut")),
			bind("y", "Copy", () => this.setClipboard("copy")),
			bind("p", "Paste", () => this.paste()),
			bind("u", "Undo last file operation", () => this.undo()),
			bind("s", "Open in vertical split", () => this.openIn("vertical")),
			bind("S", "Open in horizontal split", () => this.openIn("horizontal")),
			bind("t", "Open in new tab", () => this.openIn("tab")),
			bind("q", "Close explorer", () => this.close()),
			bind("<Esc>", "Back to editor", () => this.focusEditor()),
		];
	}

	/** The loaded explorer view; null while Obsidian still has it as a deferred placeholder. */
	private get view(): FileExplorerView | null {
		const view = this.app.workspace.getLeavesOfType(EXPLORER_VIEW_TYPE)[0]?.view as Partial<FileExplorerView> | undefined;
		return view?.tree != null ? (view as FileExplorerView) : null;
	}

	private focused(): ExplorerNode | null {
		return this.view?.tree.focusedItem ?? null;
	}

	/** Target folder for new items and paste: the focused folder, or the focused file's folder. */
	private targetFolder(): TFolder {
		const node = this.focused();
		if (node == null) {
			return this.app.vault.getRoot();
		}
		return isFolderNode(node) ? node.file : (node.file.parent ?? this.app.vault.getRoot());
	}

	private arrow(key: ArrowKey): void {
		const tree = this.view?.tree;
		if (tree == null) {
			return;
		}

		const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
		switch (key) {
			case "ArrowDown":
				tree.onKeyArrowDown(event);
				break;
			case "ArrowUp":
				tree.onKeyArrowUp(event);
				break;
			case "ArrowLeft":
				tree.onKeyArrowLeft(event);
				break;
			case "ArrowRight":
				tree.onKeyArrowRight(event);
				break;
		}
	}

	private async open(toggleFolder: boolean): Promise<void> {
		const node = this.focused();
		if (node == null) {
			return;
		}

		if (isFolderNode(node)) {
			if (node.collapsed) {
				node.setCollapsed(false);
			} else if (toggleFolder) {
				node.setCollapsed(true);
			} else {
				this.arrow("ArrowRight");
			}
			return;
		}

		const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
		await leaf.openFile(node.file);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	private async openIn(kind: "vertical" | "horizontal" | "tab"): Promise<void> {
		const node = this.focused();
		if (node == null || isFolderNode(node)) {
			return;
		}

		// getLeaf splits/tabs the active leaf, which is the sidebar explorer right now.
		const recent = this.app.workspace.getMostRecentLeaf();
		if (recent != null) {
			this.app.workspace.setActiveLeaf(recent, { focus: false });
		}

		const leaf = kind === "tab" ? this.app.workspace.getLeaf("tab") : this.app.workspace.getLeaf("split", kind);
		await leaf.openFile(node.file);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	private focusEdge(edge: "first" | "last"): void {
		const tree = this.view?.tree;
		const nodes = tree?.root.vChildren.children ?? [];
		let node = edge === "first" ? nodes[0] : nodes[nodes.length - 1];
		if (edge === "last") {
			while (node != null && isFolderNode(node) && !node.collapsed) {
				const children = node.vChildren.children;
				if (children.length === 0) {
					break;
				}
				node = children[children.length - 1];
			}
		}
		if (node == null) {
			return;
		}

		tree?.setFocusedItem(node);
		node.el.scrollIntoView({ block: "nearest" });
	}

	private collapseAll(): void {
		const tree = this.view?.tree;
		if (tree == null) {
			return;
		}

		tree.isAllCollapsed = false;
		tree.setCollapseAll(true);
	}

	private async add(folderOnly: boolean): Promise<void> {
		const folder = this.targetFolder();
		const input = await promptText(this.app, {
			title: folderOnly ? "New folder" : "New file",
			prefix: folder.isRoot() ? "/" : `${folder.path}/`,
			hint: folderOnly ? undefined : "End with / to create a folder. Nested paths like a/b/note work. No extension means a .md note.",
		});
		if (input == null) {
			return;
		}

		const isFolder = folderOnly || input.endsWith("/");
		let path = joinPath(folder, input);

		if (this.app.vault.getAbstractFileByPath(path) != null) {
			new Notice(`Already exists: ${path}`);
			return;
		}

		if (isFolder) {
			const created = await this.ensureFolder(path);
			this.pushUndo(`create ${path}`, () => this.removeEmptyFolders(created));
			this.reveal(path);
			return;
		}

		const name = path.split("/").pop() ?? "";
		if (!name.includes(".")) {
			path = `${path}.md`;
		}

		if (this.app.vault.getAbstractFileByPath(path) != null) {
			new Notice(`Already exists: ${path}`);
			return;
		}

		const created = await this.ensureFolder(parentPath(path));
		await this.app.vault.create(path, "");
		this.pushUndo(`create ${path}`, async () => {
			await this.trashIfExists(path);
			await this.removeEmptyFolders(created);
		});
		this.reveal(path);
	}

	private async delete(): Promise<void> {
		const node = this.focused();
		if (node == null) {
			return;
		}

		const file = node.file;
		if (this.settings().confirmDelete) {
			const confirmed = await confirmAction(this.app, {
				title: "Delete",
				message: `Delete "${file.path}"${file instanceof TFolder ? " and everything in it" : ""}?`,
				confirmText: "Delete",
			});
			if (!confirmed) {
				return;
			}
		}

		const snapshot = await this.snapshot(file);
		// trashFile follows the user's trash setting (system trash, .trash folder, or delete).
		await this.app.fileManager.trashFile(file);

		if (snapshot == null) {
			new Notice(`Deleted ${file.name}. It is too large to undo here; restore it from the trash.`);
			return;
		}

		this.pushUndo(
			`delete ${file.path}`,
			async () => {
				for (const folder of snapshot.folders) {
					await this.ensureFolder(folder);
				}
				for (const { path, data } of snapshot.files) {
					if (this.app.vault.getAbstractFileByPath(path) == null) {
						await this.ensureFolder(parentPath(path));
						await this.app.vault.createBinary(path, data);
					}
				}
				this.reveal(file.path);
			},
			snapshot.bytes,
		);
	}

	private async rename(): Promise<void> {
		const node = this.focused();
		if (node == null) {
			return;
		}

		const file = node.file;
		const name = await promptText(this.app, {
			title: "Rename",
			value: file.name,
			selectBaseName: file instanceof TFile,
		});
		if (name == null || name === file.name) {
			return;
		}

		await this.moveTo(file, joinPath(file.parent ?? this.app.vault.getRoot(), name));
	}

	private async move(): Promise<void> {
		const node = this.focused();
		if (node == null) {
			return;
		}

		const dest = await promptText(this.app, {
			title: "Move to",
			value: node.file.path,
			hint: "Full path from the vault root. Missing folders are created.",
		});
		if (dest == null || normalizePath(dest) === node.file.path) {
			return;
		}

		await this.moveTo(node.file, normalizePath(dest));
	}

	private async copyTo(): Promise<void> {
		const node = this.focused();
		if (node == null) {
			return;
		}

		const dest = await promptText(this.app, {
			title: "Copy to",
			value: this.availablePath(node.file, node.file.parent ?? this.app.vault.getRoot()),
			hint: "Full path from the vault root. Missing folders are created.",
		});
		if (dest == null) {
			return;
		}

		await this.copyFile(node.file, normalizePath(dest));
	}

	private setClipboard(mode: "cut" | "copy"): void {
		const node = this.focused();
		if (node == null) {
			return;
		}

		this.clipboard = { mode, path: node.file.path };
		new Notice(`${mode === "cut" ? "Cut" : "Copied"}: ${node.file.name} (p to paste)`);
	}

	private async paste(): Promise<void> {
		if (this.clipboard == null) {
			new Notice("Nothing to paste. Cut or copy an item first.");
			return;
		}

		const source = this.app.vault.getAbstractFileByPath(this.clipboard.path);
		if (source == null) {
			this.clipboard = null;
			new Notice("The cut or copied item no longer exists");
			return;
		}

		const folder = this.targetFolder();

		if (this.clipboard.mode === "copy") {
			await this.copyFile(source, this.availablePath(source, folder));
			return;
		}

		if (source instanceof TFolder && (folder === source || folder.path.startsWith(`${source.path}/`))) {
			new Notice("Cannot move a folder into itself");
			return;
		}

		await this.moveTo(source, joinPath(folder, source.name));
		this.clipboard = null;
	}

	private async undo(): Promise<void> {
		const entry = this.undoStack.pop();
		if (entry == null) {
			new Notice("Nothing to undo");
			return;
		}

		await entry.run();
		new Notice(`Undid ${entry.label}`);
	}

	private pushUndo(label: string, run: () => Promise<void>, bytes = 0): void {
		this.undoStack.push({ label, run, bytes });

		let held = this.undoStack.reduce((total, entry) => total + entry.bytes, 0);
		while (this.undoStack.length > UNDO_LIMIT || held > UNDO_MEMORY_LIMIT) {
			held -= this.undoStack.shift()?.bytes ?? 0;
		}
	}

	private async moveTo(file: TAbstractFile, dest: string): Promise<void> {
		if (this.app.vault.getAbstractFileByPath(dest) != null) {
			new Notice(`Already exists: ${dest}`);
			return;
		}

		const from = file.path;
		const created = await this.ensureFolder(parentPath(dest));
		// fileManager (not vault) so links to the file are updated.
		await this.app.fileManager.renameFile(file, dest);
		this.pushUndo(`move ${from} → ${dest}`, async () => {
			const moved = this.app.vault.getAbstractFileByPath(dest);
			if (moved != null) {
				await this.ensureFolder(parentPath(from));
				await this.app.fileManager.renameFile(moved, from);
			}
			await this.removeEmptyFolders(created);
			this.reveal(from);
		});
		this.reveal(dest);
	}

	private async copyFile(file: TAbstractFile, dest: string): Promise<void> {
		if (this.app.vault.getAbstractFileByPath(dest) != null) {
			new Notice(`Already exists: ${dest}`);
			return;
		}

		const created = await this.ensureFolder(parentPath(dest));
		await this.app.vault.copy(file, dest);
		this.pushUndo(`copy ${file.path} → ${dest}`, async () => {
			await this.trashIfExists(dest);
			await this.removeEmptyFolders(created);
		});
		this.reveal(dest);
	}

	/** Keeps the contents of a file or folder in memory so a delete can be undone. */
	private async snapshot(file: TAbstractFile): Promise<Snapshot | null> {
		const files: TFile[] = [];
		const folders: string[] = [];
		const walk = (item: TAbstractFile): void => {
			if (item instanceof TFile) {
				files.push(item);
			} else if (item instanceof TFolder) {
				folders.push(item.path);
				item.children.forEach(walk);
			}
		};
		walk(file);

		const bytes = files.reduce((total, item) => total + item.stat.size, 0);
		if (bytes > UNDO_MEMORY_LIMIT) {
			return null;
		}

		const contents: Snapshot["files"] = [];
		for (let i = 0; i < files.length; i += SNAPSHOT_BATCH_SIZE) {
			const batch = await Promise.all(
				files.slice(i, i + SNAPSHOT_BATCH_SIZE)
					.map(async (item) => ({ path: item.path, data: await this.app.vault.readBinary(item) })),
			);
			contents.push(...batch);
		}
		return { folders, files: contents, bytes };
	}

	private async trashIfExists(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file != null) {
			await this.app.fileManager.trashFile(file);
		}
	}

	/** Removes folders created by an operation, deepest first, if they are still empty. */
	private async removeEmptyFolders(paths: string[]): Promise<void> {
		for (const path of [...paths].reverse()) {
			const folder = this.app.vault.getAbstractFileByPath(path);
			if (folder instanceof TFolder && folder.children.length === 0) {
				await this.app.fileManager.trashFile(folder);
			}
		}
	}

	/** "note.md" -> "note 1.md", like Obsidian's own duplicates. */
	private availablePath(file: TAbstractFile, folder: TFolder): string {
		const ext = file instanceof TFile ? file.extension : "";
		const base = file instanceof TFile ? file.basename : file.name;
		const build = (suffix: string): string => joinPath(folder, `${base}${suffix}${ext ? `.${ext}` : ""}`);

		let path = build("");
		for (let i = 1; this.app.vault.getAbstractFileByPath(path) != null; i++) {
			path = build(` ${i}`);
		}
		return path;
	}

	/** Creates missing folders along `path` and returns the ones it created, shallowest first. */
	private async ensureFolder(path: string): Promise<string[]> {
		const created: string[] = [];
		const normalized = normalizePath(path);
		if (normalized === "" || normalized === "/") {
			return created;
		}

		let current = "";
		for (const segment of normalized.split("/")) {
			current = current ? `${current}/${segment}` : segment;
			const existing = this.app.vault.getAbstractFileByPath(current);

			if (existing == null) {
				await this.app.vault.createFolder(current);
				created.push(current);
			} else if (!(existing instanceof TFolder)) {
				throw new Error(`Not a folder: ${current}`);
			}
		}
		return created;
	}

	/**
	 * Focuses a path in the explorer. The tree builds its item from the vault event, which
	 * has not necessarily arrived yet, so ask again until it has rather than guess at a
	 * delay that is long enough.
	 */
	private reveal(path: string): void {
		let attempts = 0;

		const focus = (): void => {
			const file = this.app.vault.getAbstractFileByPath(path);
			const view = this.view;
			if (file == null || view == null) {
				return;
			}

			// Expands the parents, which is what creates the item for a collapsed folder.
			view.revealInFolder(file);

			const node = view.fileItems[file.path];
			if (node != null) {
				view.tree.setFocusedItem(node);
			} else if (++attempts < REVEAL_ATTEMPTS) {
				window.setTimeout(focus, REVEAL_INTERVAL);
			}
		};

		window.setTimeout(focus, REVEAL_INTERVAL);
	}

	private close(): void {
		const leaf = this.app.workspace.getLeavesOfType(EXPLORER_VIEW_TYPE)[0];
		const root = leaf?.getRoot();
		if (root instanceof WorkspaceSidedock) {
			root.collapse();
		}
		this.focusEditor();
	}

	private focusEditor(): void {
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (leaf != null) {
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
		}
	}
}
