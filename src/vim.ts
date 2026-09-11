// Leader keys inside the editor, through Obsidian's CodeMirror vim mode.
import type { Binding } from "./keys";

interface CodeMirrorVim {
	unmap(lhs: string, ctx?: string): boolean | void;
	defineAction(name: string, fn: () => void): void;
	mapCommand(
		keys: string,
		type: string,
		name: string,
		args?: Record<string, unknown>,
		extra?: Record<string, unknown>,
	): void;
}

function getVim(): CodeMirrorVim | null {
	const adapter = (window as unknown as { CodeMirrorAdapter?: { Vim?: CodeMirrorVim } }).CodeMirrorAdapter;
	return adapter?.Vim ?? null;
}

export class VimLeader {
	private mapped: string[] = [];
	private spaceUnmapped = false;

	constructor(private readonly bindings: Binding[]) {}

	get enabled(): boolean {
		return this.mapped.length > 0;
	}

	/** Returns false while Obsidian's vim mode is unavailable (vim mode off). */
	enable(): boolean {
		const vim = getVim();
		if (vim == null) {
			return false;
		}
		if (this.enabled) {
			return true;
		}

		// Vim's default <Space> moves the cursor right; it has to go for <Space> to be a prefix.
		this.spaceUnmapped = vim.unmap("<Space>") === true;

		this.bindings.forEach((binding, index) => {
			const name = `omsidian-leader-${index}`;
			vim.defineAction(name, () => void binding.run());
			vim.mapCommand(binding.keys, "action", name, {}, { context: "normal" });
			this.mapped.push(binding.keys);
		});
		return true;
	}

	disable(): void {
		const vim = getVim();
		if (vim == null) {
			return;
		}

		for (const keys of this.mapped) {
			vim.unmap(keys, "normal");
		}
		this.mapped = [];

		if (this.spaceUnmapped) {
			vim.mapCommand("<Space>", "motion", "moveByCharacters", { forward: true });
			this.spaceUnmapped = false;
		}
	}
}
