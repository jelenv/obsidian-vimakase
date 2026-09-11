import { App, PluginSettingTab, Setting } from "obsidian";
import type Vimakase from "./main";
import type { Binding } from "./keys";

export interface VimakaseSettings {
	leaderKeys: boolean;
	explorerKeys: boolean;
	whichKey: boolean;
	confirmDelete: boolean;
	/** Milliseconds before an unfinished key sequence is cancelled; 0 waits like which-key. */
	pendingTimeout: number;
}

export const DEFAULT_SETTINGS: VimakaseSettings = {
	leaderKeys: true,
	explorerKeys: true,
	whichKey: true,
	confirmDelete: true,
	pendingTimeout: 0,
};

export class VimakaseSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: Vimakase,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.toggle("Space leader keys", "Space key sequences in the editor (needs vim mode) and in other views.", "leaderKeys");
		this.toggle("File explorer keys", "Neo-tree-style keys while the file explorer is focused.", "explorerKeys");
		this.toggle("Which-key popup", "Show the keys that can follow an unfinished key sequence, bottom-right.", "whichKey");
		this.toggle("Confirm before deleting", "Ask before d deletes a file or folder in the file explorer.", "confirmDelete");

		new Setting(containerEl)
			.setName("Key sequence timeout")
			.setDesc("Milliseconds before an unfinished key sequence is cancelled. Leave at 0 to keep waiting until you press a key or escape, like which-key.")
			.addText((text) =>
				text
					.setPlaceholder("0")
					.setValue(String(this.plugin.settings.pendingTimeout))
					.onChange(async (value) => {
						const ms = Number.parseInt(value, 10);
						this.plugin.settings.pendingTimeout = Number.isFinite(ms) && ms > 0 ? ms : 0;
						await this.plugin.saveSettings();
					}),
			);

		this.renderBindings("Leader keys", this.plugin.leader);
		this.renderBindings("File explorer keys", this.plugin.explorer.bindings());
	}

	private toggle(name: string, desc: string, key: "leaderKeys" | "explorerKeys" | "whichKey" | "confirmDelete"): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
					this.plugin.settings[key] = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	private renderBindings(title: string, bindings: Binding[]): void {
		new Setting(this.containerEl).setName(title).setHeading();
		for (const binding of bindings) {
			new Setting(this.containerEl).setName(binding.keys).setDesc(binding.desc);
		}
	}
}
