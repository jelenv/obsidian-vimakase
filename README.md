# Omsidian

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
| `d` | Delete (uses Obsidian's delete confirmation setting and trash) |
| `r` | Rename (links are updated) |
| `m` | Move to a path (missing folders are created) |
| `c` | Copy to a path |
| `x` / `y` / `p` | Cut / copy / paste into the focused folder |
| `s` / `S` / `t` | Open in vertical split / horizontal split / new tab |
| `q` | Close the explorer |
| `escape` | Back to the editor |

Multi-key sequences wait for the next key without a timeout, like vim. The keys typed so far are shown in the status bar; `escape` cancels.

## Install

Not in the community plugin list yet. Manual install:

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Put them in `<vault>/.obsidian/plugins/omsidian/`.
3. Enable **Omsidian** in Settings → Community plugins.

## Development

```sh
npm install
npm run dev     # watch build
npm run build   # typecheck + production build
```

Link `main.js`, `manifest.json` and `styles.css` into a test vault's `.obsidian/plugins/omsidian/` and reload the plugin.

## Caveats

The file explorer has no public API. Canopy uses a few undocumented internals (listed in `src/internals.ts`), so an Obsidian update can break it until Omsidian is updated. File operations use the public API.

## Credits

Inspired by [LazyVim](https://www.lazyvim.org/), [neo-tree.nvim](https://github.com/nvim-neo-tree/neo-tree.nvim) and [Sidebar Keyboard Navigation](https://github.com/denvolok/obsidian-sidebar-keyboard-navigation).

## License

MIT
