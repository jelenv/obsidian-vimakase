// LazyVim-style <Space> leader bindings. Commands from optional plugins
// (Omnisearch, Git) fall back or show a notice when missing.
import type Vimakase from "./main";
import { runCommand } from "./commands";
import type { Binding } from "./keys";

export function leaderBindings(plugin: Vimakase): Binding[] {
	const command = (keys: string, desc: string, ...ids: string[]): Binding => ({
		keys,
		desc,
		run: () => runCommand(plugin.app, ...ids),
	});

	return [
		command("<Space><Space>", "Find files", "omnisearch:show-modal", "switcher:open"),
		{ keys: "<Space>e", desc: "Toggle file explorer", run: () => plugin.explorer.toggle() },
		command("<Space>/", "Search in vault", "global-search:open"),
		command("<Space>,", "Switch file", "switcher:open"),
		command("<Space>:", "Command palette", "command-palette:open"),
		command("<Space>-", "Split below", "workspace:split-horizontal"),
		command("<Space>|", "Split right", "workspace:split-vertical"),
		command("<Space>ff", "Find files", "omnisearch:show-modal", "switcher:open"),
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
