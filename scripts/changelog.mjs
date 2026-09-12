// Prints one version's section of CHANGELOG.md, which the release workflow hands
// to `gh release create` as the release notes.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const version = process.argv[2];
if (!version) {
	console.error('usage: node scripts/changelog.mjs <version>');
	process.exit(1);
}

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const lines = readFileSync(join(repo, 'CHANGELOG.md'), 'utf8').split('\n');
const heading = /^## +\[?([^\]\s]+)\]?/;

let start = -1;
let end = lines.length;
for (const [i, line] of lines.entries()) {
	const match = heading.exec(line);
	if (match == null) {
		continue;
	}
	if (start === -1) {
		if (match[1] === version) {
			start = i + 1;
		}
	} else {
		end = i;
		break;
	}
}

if (start === -1) {
	console.error(`CHANGELOG.md has no section for ${version}`);
	process.exit(1);
}

console.log(lines.slice(start, end).join('\n').trim());
