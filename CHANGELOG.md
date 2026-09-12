# Changelog

The release workflow reads the section for the tag it is building and uses it as
the GitHub release notes, so a version needs an entry here before it can ship.

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
