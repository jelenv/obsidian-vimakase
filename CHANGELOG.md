# Changelog

Write new entries under `## Unreleased`. `node scripts/release.mjs <version>` dates
that heading with the version going out. The release workflow uses its release notes,
so a version cannot ship without one.

## Unreleased

### Changed

- Prepare releases with an explicit Node command that validates and updates all version metadata, runs checks and creates the commit and tag without npm lifecycle hooks.

### Fixed

- Space types a space again in the inline title, properties and Vim's `/` and `:` command line instead of starting a leader sequence.
- Table cells follow their own Vim mode: space types in insert mode, `Ctrl+A` selects within the cell instead of the whole note, and copying in a cell no longer marks the text as whole lines.

## 0.3.1 - 2026-10-09

### Added

- Standard clipboard shortcuts in Vim mode: `Ctrl+A` selects all, `Ctrl+C` copies, `Ctrl+X` cuts, and `Ctrl+V` pastes. Copy and cut act on the selection, or the current line when nothing is selected. These shortcuts can be disabled in settings. `Ctrl+Q` enters visual block mode.
- Yanking copies text to the system clipboard. Deleting and changing text keep the system clipboard intact. `p` uses text copied from another app when the clipboard has changed; otherwise it pastes from Vim's register.
- Select all keeps the view steady. Pressing `Esc` while the selection is intact restores the previous cursor position and view.

### Changed

- Reduced keyboard-handling overhead and improved navigation to the first and last explorer items in large vaults. Preparing folder-deletion undo now limits concurrent file reads to reduce resource usage.

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
