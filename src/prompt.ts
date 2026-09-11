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

export interface ConfirmOptions {
	title: string;
	message: string;
	confirmText: string;
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

		const row = this.contentEl.createDiv({ cls: "vimakase-prompt" });
		if (this.options.prefix) {
			row.createSpan({ cls: "vimakase-prompt-prefix", text: this.options.prefix });
		}

		const input = row.createEl("input", { type: "text", cls: "vimakase-prompt-input" });
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

class ConfirmModal extends Modal {
	private confirmed = false;
	private finished = false;

	constructor(
		app: App,
		private readonly options: ConfirmOptions,
		private readonly done: (confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.options.title);
		this.contentEl.createEl("p", { text: this.options.message });
		this.contentEl.createDiv({ cls: "setting-item-description", text: "Press enter or y to confirm, escape or n to cancel." });

		const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
		const confirm = buttons.createEl("button", { cls: "mod-warning", text: this.options.confirmText });
		buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.finish(false));
		confirm.addEventListener("click", () => this.finish(true));

		for (const key of ["Enter", "y"]) {
			this.scope.register([], key, () => {
				this.finish(true);
				return false;
			});
		}
		this.scope.register([], "n", () => {
			this.finish(false);
			return false;
		});

		window.setTimeout(() => confirm.focus());
	}

	onClose(): void {
		this.contentEl.empty();
		this.done(this.confirmed);
	}

	private finish(confirmed: boolean): void {
		if (this.finished) {
			return;
		}
		this.finished = true;
		this.confirmed = confirmed;
		this.close();
	}
}

/** Resolves with the entered text, or null when cancelled or left empty. */
export function promptText(app: App, options: PromptOptions): Promise<string | null> {
	return new Promise((resolve) => {
		new PromptModal(app, options, (value) => resolve(value ? value : null)).open();
	});
}

/** Resolves true when confirmed, false when cancelled. */
export function confirmAction(app: App, options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => {
		new ConfirmModal(app, options, resolve).open();
	});
}
