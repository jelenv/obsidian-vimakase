import { Plugin } from "obsidian";
import { Explorer } from "./explorer";
import { KeyHandler } from "./keyhandler";
import type { Binding } from "./keys";
import { leaderBindings } from "./leader";
import { DEFAULT_SETTINGS, OmsidianSettingTab, OmsidianSettings } from "./settings";
import { VimLeader } from "./vim";

export default class Omsidian extends Plugin {
	settings: OmsidianSettings = { ...DEFAULT_SETTINGS };
	explorer!: Explorer;
	leader: Binding[] = [];
	private keyHandler!: KeyHandler;
	private vimLeader!: VimLeader;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.explorer = new Explorer(this.app);
		this.leader = leaderBindings(this);
		this.vimLeader = new VimLeader(this.leader);
		this.keyHandler = new KeyHandler(this, this.leader, this.explorer.bindings());
		this.keyHandler.register();

		this.addCommand({
			id: "toggle-explorer",
			name: "Toggle file explorer",
			callback: () => this.explorer.toggle(),
		});
		this.addSettingTab(new OmsidianSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.applyEditorLeader());
		// Vim mode can be switched on later; pick it up on the next editor focus.
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.applyEditorLeader()));
	}

	onunload(): void {
		this.vimLeader.disable();
	}

	async loadSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<OmsidianSettings> | null) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.keyHandler.rebuild();
		this.applyEditorLeader();
	}

	private applyEditorLeader(): void {
		if (this.settings.leaderKeys) {
			this.vimLeader.enable();
		} else if (this.vimLeader.enabled) {
			this.vimLeader.disable();
		}
	}
}
