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

## Clipboard keys

Enabled by default in vim mode; switch off **Settings → Vimakase → Clipboard keys** to restore the original vim bindings.

| Key | Action |
| --- | --- |
| `Ctrl+A` | Select the whole note as visual lines without scrolling; `Esc` returns to the original cursor and view |
| `Ctrl+C` / `Ctrl+X` | Copy / cut the selection, or the whole current line when nothing is selected |
| `Ctrl+V` | Paste the system clipboard; replace a selection, or paste copied whole lines above the cursor in normal mode |
| `Ctrl+Q` | Visual block selection |

Select all, copy, cut and paste also work in insert mode. Obsidian's native copy leaves visual mode after copying a selection.

The return point lasts while the Ctrl+A selection is intact. Repeating Ctrl+A keeps the original return point; moving, editing, or replacing the selection resumes normal vim behavior. Esc returns to normal mode even if you started in insert mode.

These bindings replace vim's `Ctrl+A` / `Ctrl+X` number increment and decrement. Vimakase adds no Alt bindings, so Obsidian shortcuts on those keys stay available.

Yanks (`y`, `yy`) also copy to the system clipboard. Deletes and changes (`dd`, `ciw`, `x`) keep their text in vim registers without overwriting the clipboard. Use `Ctrl+X` when you want a deletion copied to another app.

`p` / `P` use vim registers, so `dd` then `p` still moves a line. When Obsidian regains focus after you copy different text elsewhere, that clipboard text becomes vim's unnamed register and `p` / `P` paste it. `Ctrl+V` always reads the system clipboard. Explicit named registers keep their usual behavior.

Clipboard access uses Obsidian's desktop clipboard support. Vim register syncing uses undocumented CodeMirror vim internals and may need updating after an Obsidian upgrade.

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

The repo pins Node through [mise](https://mise.jdx.dev); `mise install` once, or use your own Node 24.

```sh
npm install
npm run dev     # watch build
npm run build   # typecheck + production build
npm run lint    # Obsidian's plugin lint rules
npm run check   # lint + build, the gate the release runs behind
```

`npm install` points `core.hooksPath` at `.githooks`, whose `pre-push` hook runs
`npm run check`, so a broken build cannot leave the machine. `git push --no-verify`
skips it.

Release: write what changed under `## Unreleased` in `CHANGELOG.md`, then `npm version patch` (bumps `package.json`, `manifest.json` and `versions.json`, dates the `Unreleased` section, commits and tags without a `v`), then `git push --follow-tags`. The tag push triggers `.github/workflows/release.yml`, which checks the tag against the manifest, builds, attests build provenance and creates the GitHub release with `main.js`, `manifest.json` and `styles.css` attached. Obsidian picks the release up on its own.

`npm run link:dev -- <vault>` links this working copy into a vault as a separate plugin, `Vimakase (dev)`, so the community build can stay installed next to it. Reload plugins in Obsidian after linking or rebuilding, and keep only one of the two enabled, since both bind the same keys.

## Caveats

The file explorer has no public API. Vimakase uses a few undocumented internals (listed in `src/internals.ts`), so an Obsidian update can break it until Vimakase is updated. File operations use the public API.

## Credits

Inspired by [LazyVim](https://www.lazyvim.org/), [neo-tree.nvim](https://github.com/nvim-neo-tree/neo-tree.nvim) and [Sidebar Keyboard Navigation](https://github.com/denvolok/obsidian-sidebar-keyboard-navigation).

## License

MIT
