// Obsidian's overlays are direct body children; inspect those instead of scanning the document.
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
