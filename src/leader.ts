// LazyVim-style <Space> leader bindings. Commands from optional plugins
// (Omnisearch, Git) fall back or show a notice when missing.
import type Vimakase from "./main";
import { runCommand } from "./commands";
import type { Binding, Groups } from "./keys";
import { exitVisualAfterPick } from "./vim";

/** Group names from LazyVim's which-key spec. */
export const LEADER_GROUPS: Groups = {
	"<Space>b": "buffer",
	"<Space>f": "file/find",
	"<Space>g": "git",
	"<Space>s": "search",
	"<Space>w": "windows",
};

export function leaderBindings(plugin: Vimakase): Binding[] {
	const command = (keys: string, desc: string, ...ids: string[]): Binding => ({
		keys,
		desc,
		run: () => runCommand(plugin.app, ...ids),
	});
	// Opening a file from the picker should land in normal mode, not in a selected match.
	const findFiles = (keys: string): Binding => ({
		keys,
		desc: "Find files",
		run: () => {
			exitVisualAfterPick(plugin);
			runCommand(plugin.app, "omnisearch:show-modal", "switcher:open");
		},
	});

	return [
		findFiles("<Space><Space>"),
		{ keys: "<Space>e", desc: "Toggle file explorer", run: () => plugin.explorer.toggle() },
		command("<Space>/", "Search in vault", "global-search:open"),
		command("<Space>,", "Switch file", "switcher:open"),
		command("<Space>:", "Command palette", "command-palette:open"),
		command("<Space>-", "Split below", "workspace:split-horizontal"),
		command("<Space>|", "Split right", "workspace:split-vertical"),
		findFiles("<Space>ff"),
		command("<Space>fn", "New note", "file-explorer:new-file"),
		command("<Space>fr", "Recent files", "switcher:open"),
		command("<Space>bd", "Close tab", "workspace:close"),
		command("<Space>bo", "Close other tabs", "workspace:close-others"),
		command("<Space>wd", "Close window", "workspace:close"),
		command("<Space>sg", "Search in vault", "global-search:open"),
		command("<Space>ss", "Outline", "outline:open"),
		command("<Space>gg", "Git", "obsidian-git:open-git-view"),
	];
}
