import { App, Modal } from "obsidian";

export interface PromptOptions {
	title: string;
	value?: string;
	/** Read-only text shown before the input, e.g. the parent folder. */
	prefix?: string;
	hint?: string;
	/** Preselect the name without its extension, like neo-tree's rename. */
	selectBaseName?: boolean;
}

class PromptModal extends Modal {
	private result: string | null = null;

	constructor(
		app: App,
		private readonly options: PromptOptions,
		private readonly done: (value: string | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.options.title);

		const row = this.contentEl.createDiv({ cls: "omsidian-prompt" });
		if (this.options.prefix) {
			row.createSpan({ cls: "omsidian-prompt-prefix", text: this.options.prefix });
		}

		const input = row.createEl("input", { type: "text", cls: "omsidian-prompt-input" });
		input.value = this.options.value ?? "";

		if (this.options.hint) {
			this.contentEl.createDiv({ cls: "setting-item-description", text: this.options.hint });
		}

		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.isComposing) {
				event.preventDefault();
				this.result = input.value.trim();
				this.close();
			}
		});

		window.setTimeout(() => {
			input.focus();
			const dot = this.options.selectBaseName ? input.value.lastIndexOf(".") : -1;
			input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
		});
	}

	onClose(): void {
		this.contentEl.empty();
		this.done(this.result);
	}
}

/** Resolves with the entered text, or null when cancelled or left empty. */
export function promptText(app: App, options: PromptOptions): Promise<string | null> {
	return new Promise((resolve) => {
		new PromptModal(app, options, (value) => resolve(value ? value : null)).open();
	});
}
