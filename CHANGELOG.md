# Changelog

Write new entries under `## Unreleased`. `npm version` dates that heading with the
version going out, and the release workflow uses the section as the release notes,
so a version cannot ship without one.

## 0.3.1 - 2026-10-09

### Added

- Clipboard keys in vim mode, like Zed and LazyVim: `ctrl+a` selects all, `ctrl+c`/`ctrl+x` copy/cut the selection or the current line, `ctrl+v` pastes. Visual block stays on `ctrl+q`; no Alt bindings are added. Yanks also go to the system clipboard, deletes and changes don't, and `p` pastes the system clipboard when it holds something newer. Can be switched off in settings.
- Select all keeps the viewport steady. Pressing Escape while that selection is intact restores the cursor and viewport from before Ctrl+A.

### Changed

- Skip unrelated typing in the key handler without resetting the status bar. Explorer first/last navigation follows the endpoint branch instead of collecting every visible item. Folder delete undo snapshots read at most eight files concurrently.

## 0.2.2 - 2026-09-12

### Changed

- Settings are declared rather than drawn, so Obsidian 1.13 and later find them in settings search. Older versions render the same definitions as before.

## 0.2.1 - 2026-09-12

### Fixed

- Opening a file from Omnisearch or the quick switcher no longer leaves the editor in visual mode. The selection is now caught wherever it lands: late, in an editor that did not exist yet, or in the file that was already open.
- Creating, moving or restoring a file focuses it in the explorer on a large vault, instead of giving up when the tree has not rendered the item yet.
- Undo no longer holds an unbounded amount of deleted content in memory. The 50 MB limit is now the budget for the whole undo stack, not for each delete.

### Changed

- Key handling no longer scans the whole document on every keystroke.

## 0.2.0 - 2026-09-11

### Added

- Which-key popup listing the keys that can follow an unfinished sequence.
- LazyVim-style key sequences, with `<Esc>` to cancel and `<BS>` to go one level up.
- Undo for explorer file operations, and a confirmation before deleting.

### Changed

- Renamed to Vimakase.

## 0.1.0 - 2026-09-11

### Added

- Space leader keys, and a neo-tree-style file explorer driven by vim keys.
