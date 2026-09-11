import { App, PluginSettingTab, Setting } from "obsidian";
import type Omsidian from "./main";
import type { Binding } from "./keys";

export interface OmsidianSettings {
	leaderKeys: boolean;
	explorerKeys: boolean;
}

export const DEFAULT_SETTINGS: OmsidianSettings = {
	leaderKeys: true,
	explorerKeys: true,
};

export class OmsidianSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: Omsidian,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Space leader keys")
			.setDesc("LazyVim-style space sequences in the editor (needs vim mode) and in other views.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.leaderKeys).onChange(async (value) => {
					this.plugin.settings.leaderKeys = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("File explorer keys")
			.setDesc("Neo-tree-style keys while the file explorer is focused.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.explorerKeys).onChange(async (value) => {
					this.plugin.settings.explorerKeys = value;
					await this.plugin.saveSettings();
				}),
			);

		this.renderBindings("Leader keys", this.plugin.leader);
		this.renderBindings("File explorer keys", this.plugin.explorer.bindings());
	}

	private renderBindings(title: string, bindings: Binding[]): void {
		new Setting(this.containerEl).setName(title).setHeading();
		for (const binding of bindings) {
			new Setting(this.containerEl).setName(binding.keys).setDesc(binding.desc);
		}
	}
}
