import { App, PluginSettingTab, Setting, SettingDefinition, SettingDefinitionGroup } from "obsidian";
import type Vimakase from "./main";
import type { Binding } from "./keys";

export interface VimakaseSettings {
	leaderKeys: boolean;
	explorerKeys: boolean;
	whichKey: boolean;
	confirmDelete: boolean;
	clipboardKeys: boolean;
	/** Milliseconds before an unfinished key sequence is cancelled; 0 waits like which-key. */
	pendingTimeout: number;
}

type SettingKey = keyof VimakaseSettings;
/** The definition shapes this tab emits; Obsidian allows more, and none of them are used here. */
type Item = SettingDefinition<SettingKey> | SettingDefinitionGroup<SettingKey>;

/** The settings a toggle can drive, so the list cannot drift from the interface. */
type ToggleSetting = {
	[K in SettingKey]: VimakaseSettings[K] extends boolean ? K : never;
}[SettingKey];

export const DEFAULT_SETTINGS: VimakaseSettings = {
	leaderKeys: true,
	explorerKeys: true,
	whichKey: true,
	confirmDelete: true,
	clipboardKeys: true,
	pendingTimeout: 0,
};

function toggle(name: string, desc: string, key: ToggleSetting): Item {
	return { name, desc, control: { type: "toggle", key } };
}

/** The bindings as read-only rows, so the keys are searchable next to the settings. */
function bindingList(heading: string, bindings: Binding[]): SettingDefinitionGroup<SettingKey> {
	return {
		type: "group",
		heading,
		items: bindings.map((binding) => ({ name: binding.keys, desc: binding.desc })),
	};
}

export class VimakaseSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: Vimakase,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): Item[] {
		return [
			toggle("Space leader keys", "Space key sequences in the editor (needs vim mode) and in other views.", "leaderKeys"),
			toggle("File explorer keys", "Neo-tree-style keys while the file explorer is focused.", "explorerKeys"),
			toggle("Which-key popup", "Show the keys that can follow an unfinished key sequence, bottom-right.", "whichKey"),
			toggle("Confirm before deleting", "Ask before d deletes a file or folder in the file explorer.", "confirmDelete"),
			toggle(
				"Clipboard keys",
				"In vim mode, ctrl+a/c/x/v select all, copy, cut and paste, and yanks go to the system clipboard while deletes don't.",
				"clipboardKeys",
			),
			{
				name: "Key sequence timeout",
				desc: "Milliseconds before an unfinished key sequence is cancelled. Leave at 0 to keep waiting until you press a key or escape, like which-key.",
				control: { type: "number", key: "pendingTimeout", placeholder: "0", min: 0, defaultValue: 0 },
			},
			bindingList("Leader keys", this.plugin.leader),
			bindingList("File explorer keys", this.plugin.explorer.bindings()),
		];
	}

	/** Saving has to rebuild the key trees, which the default implementation knows nothing about. */
	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === "pendingTimeout") {
			const ms = Number(value);
			this.plugin.settings.pendingTimeout = Number.isFinite(ms) && ms > 0 ? ms : 0;
		} else if (key in this.plugin.settings) {
			this.plugin.settings[key as ToggleSetting] = value === true;
		}

		await this.plugin.saveSettings();
	}

	/** Obsidian before 1.13 renders no definitions; draw the same ones by hand. */
	display(): void {
		this.containerEl.empty();
		for (const item of this.getSettingDefinitions()) {
			this.render(item);
		}
	}

	private render(item: Item): void {
		if ("type" in item) {
			if (item.heading != null) {
				new Setting(this.containerEl).setName(item.heading).setHeading();
			}
			for (const child of item.items ?? []) {
				if (!("type" in child)) {
					this.render(child);
				}
			}
			return;
		}

		const setting = new Setting(this.containerEl).setName(item.name).setDesc(item.desc ?? "");
		const control = item.control;

		if (control?.type === "toggle") {
			setting.addToggle((component) =>
				component
					.setValue(this.plugin.settings[control.key as ToggleSetting])
					.onChange((value) => void this.setControlValue(control.key, value)),
			);
		} else if (control?.type === "number") {
			setting.addText((component) =>
				component
					.setPlaceholder(control.placeholder ?? "")
					.setValue(String(this.plugin.settings.pendingTimeout))
					.onChange((value) => void this.setControlValue(control.key, Number.parseInt(value, 10))),
			);
		}
	}
}
