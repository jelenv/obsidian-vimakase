// Links this working copy into a vault as a separate "Vimakase (dev)" plugin, so
// the community build can stay installed alongside it. main.js and styles.css are
// symlinks into the repo; manifest.json is generated, because it needs its own id.
import { mkdirSync, readFileSync, symlinkSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vault = process.argv[2];
if (!vault) {
	console.error('usage: node scripts/link-dev.mjs <vault>');
	process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(repo, 'manifest.json'), 'utf8'));
const target = join(resolve(vault), '.obsidian', 'plugins', `${manifest.id}-dev`);
mkdirSync(target, { recursive: true });

for (const file of ['main.js', 'styles.css']) {
	const link = join(target, file);
	rmSync(link, { force: true });
	symlinkSync(join(repo, file), link);
}

writeFileSync(
	join(target, 'manifest.json'),
	JSON.stringify({ ...manifest, id: `${manifest.id}-dev`, name: `${manifest.name} (dev)` }, null, '\t'),
);

console.log(`linked ${target}`);
