// Obsidian appends modals, menus and popovers to <body>, next to the app container, so
// those few children answer "is something over the app?" without the document-wide scan
// a querySelector does when nothing matches. That scan is ~100us on a real vault's DOM,
// and the key handler asks on every keystroke.
export function hasBodyOverlay(classes: readonly string[]): boolean {
	const { children } = document.body;
	for (let i = 0; i < children.length; i++) {
		const el = children[i];
		if (el != null && classes.some((cls) => el.classList.contains(cls))) {
			return true;
		}
	}
	return false;
}
