# Vimakase

Opinionated, LazyVim-style keyboard setup for [Obsidian](https://obsidian.md). Omakase: install it and the keys are already chosen for you.

- **Space leader keys** in the editor (vim mode) and in other views: `space space` to find files, `space e` for the explorer, and more.
- **Canopy**: neo-tree-style keys for Obsidian's built-in file explorer in the sidebar (`j`/`k`/`h`/`l`, `a` add, `d` delete, `r` rename, `m` move, `x`/`y`/`p` cut/copy/paste).

Desktop only. Editor leader keys need Obsidian's vim mode (Settings → Editor → Vim key bindings).

## Leader keys

| Keys | Action |
| --- | --- |
| `space space` / `space f f` | Find files ([Omnisearch](https://github.com/scambier/obsidian-omnisearch) if installed, otherwise the quick switcher) |
| `space e` | Toggle file explorer (reveals the current file) |
| `space /` / `space s g` | Search in vault |
| `space ,` / `space f r` | Switch file (quick switcher) |
| `space :` | Command palette |
| `space f n` | New note |
| `space -` / `space \|` | Split below / right |
| `space b d` / `space w d` | Close tab |
| `space b o` | Close other tabs |
| `space s s` | Outline |
| `space g g` | Git view ([Obsidian Git](https://github.com/Vinzent03/obsidian-git)) |

## File explorer keys (Canopy)

Active while the file explorer is focused.

| Key | Action |
| --- | --- |
| `j` / `k` | Move down / up |
| `h` | Close folder, or go to parent |
| `l` | Open file, or expand folder |
| `enter` | Open file, or toggle folder |
| `g g` / `G` | First / last item |
| `z` | Collapse all folders |
| `a` | Add file. End with `/` for a folder; nested paths like `a/b/note` work; no extension means `.md` |
| `A` | Add folder |
| `d` | Delete, after a confirmation (`enter`/`y` confirms, `escape`/`n` cancels). Uses Obsidian's trash setting |
| `r` | Rename (links are updated) |
| `m` | Move to a path (missing folders are created) |
| `c` | Copy to a path |
| `x` / `y` / `p` | Cut / copy / paste into the focused folder |
| `u` | Undo the last add, rename, move, copy, paste or delete (this session) |
| `s` / `S` / `t` | Open in vertical split / horizontal split / new tab |
| `q` | Close the explorer |
| `escape` | Back to the editor |

Obsidian's own `space` and `enter` handling in the explorer is switched off while Vimakase handles those keys, so `space` works as the leader there.

## Key sequences

Sequences behave like which-key in LazyVim:

- After 200 ms, a popup in the bottom-right corner lists the keys that can follow, with groups such as `+file/find`.
- An unfinished sequence waits for the next key. `escape` cancels, `backspace` goes one level up, and any other key cancels.
- Settings → Vimakase → **Key sequence timeout** cancels unfinished sequences after a set time instead (0, the default, waits).

In the editor, leader keys start only in vim normal mode with no vim command in progress, so counts, operators and `f`/`t` keep working. Canvas and Excalidraw views are skipped, because `space` pans there.

## Install

Not in the community plugin list yet. Manual install:

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Put them in `<vault>/.obsidian/plugins/vimakase/`.
3. Enable **Vimakase** in Settings → Community plugins.

## Development

```sh
npm install
npm run dev     # watch build
npm run build   # typecheck + production build
npm run lint    # Obsidian's plugin lint rules
```

Release: `npm version patch` (bumps `package.json`, `manifest.json` and `versions.json`, commits and tags without a `v`), then `git push --follow-tags`. The tag push triggers `.github/workflows/release.yml`, which checks the tag against the manifest, builds, attests build provenance and creates the GitHub release with `main.js`, `manifest.json` and `styles.css` attached. Obsidian picks the release up on its own.

Link `main.js`, `manifest.json` and `styles.css` into a test vault's `.obsidian/plugins/vimakase/` and reload the plugin.

## Caveats

The file explorer has no public API. Vimakase uses a few undocumented internals (listed in `src/internals.ts`), so an Obsidian update can break it until Vimakase is updated. File operations use the public API.

## Credits

Inspired by [LazyVim](https://www.lazyvim.org/), [neo-tree.nvim](https://github.com/nvim-neo-tree/neo-tree.nvim) and [Sidebar Keyboard Navigation](https://github.com/denvolok/obsidian-sidebar-keyboard-navigation).

## License

MIT
