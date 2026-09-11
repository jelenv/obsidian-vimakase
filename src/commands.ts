import { App, Notice } from "obsidian";

export function hasCommand(app: App, id: string): boolean {
	return id in app.commands.commands;
}

/** Runs the first available command; commands from optional plugins may be missing. */
export function runCommand(app: App, ...ids: string[]): void {
	const id = ids.find((candidate) => hasCommand(app, candidate));

	if (id == null) {
		new Notice(`Omsidian: command not available: ${ids.join(" / ")}`);
		return;
	}

	app.commands.executeCommandById(id);
}
