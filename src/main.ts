import { Plugin } from "obsidian";
import { EXPLORER_GROUPS, Explorer } from "./explorer";
import { KeyHandler } from "./keyhandler";
import type { Binding } from "./keys";
import { LEADER_GROUPS, leaderBindings } from "./leader";
import { DEFAULT_SETTINGS, VimakaseSettingTab, VimakaseSettings } from "./settings";

export default class Vimakase extends Plugin {
	settings: VimakaseSettings = { ...DEFAULT_SETTINGS };
	explorer!: Explorer;
	leader: Binding[] = [];
	private keyHandler!: KeyHandler;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.explorer = new Explorer(this.app, () => this.settings);
		this.leader = leaderBindings(this);
		this.keyHandler = new KeyHandler(this, this.leader, this.explorer.bindings(), {
			leader: LEADER_GROUPS,
			explorer: EXPLORER_GROUPS,
		});
		this.keyHandler.register();

		this.addCommand({
			id: "toggle-explorer",
			name: "Toggle file explorer",
			callback: () => this.explorer.toggle(),
		});
		this.addSettingTab(new VimakaseSettingTab(this.app, this));

		// The explorer view can be created or recreated at any time.
		this.app.workspace.onLayoutReady(() => this.syncExplorerKeys());
		this.registerEvent(this.app.workspace.on("layout-change", () => this.syncExplorerKeys()));
		// A deferred explorer only gets its tree once it is shown.
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncExplorerKeys()));
	}

	onunload(): void {
		this.explorer.restoreNativeKeys();
	}

	async loadSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<VimakaseSettings> | null) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.keyHandler.rebuild();
		this.syncExplorerKeys();
	}

	private syncExplorerKeys(): void {
		this.explorer.syncNativeKeys({ space: this.settings.leaderKeys, enter: this.settings.explorerKeys });
	}
}
