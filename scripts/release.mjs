import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const parseVersion = (version) => {
	if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '')) {
		throw new Error('usage: node scripts/release.mjs <major.minor.patch>');
	}
	return version.split('.').map(BigInt);
};

try {
	const version = process.argv[2];
	const target = parseVersion(version);
	if (process.argv.length !== 3) {
		throw new Error('usage: node scripts/release.mjs <major.minor.patch>');
	}
	if (git('status', '--porcelain')) {
		throw new Error('Commit your changes, including the Unreleased notes, before releasing.');
	}
	if (git('tag', '--list', version)) {
		throw new Error(`Tag ${version} already exists.`);
	}
	const names = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json'];
	const files = names.map((name) => ({ name, text: read(name) }));
	const [pkg, lock, manifest, versions] = files.map(({ text }) => JSON.parse(text));
	const current = parseVersion(pkg.version);
	const differing = target.findIndex((part, index) => part !== current[index]);
	if (differing === -1 || target[differing] < current[differing]) {
		throw new Error(`Version ${version} must be newer than ${pkg.version}.`);
	}
	if (manifest.version !== pkg.version || lock.version !== pkg.version
		|| lock.packages[''].version !== pkg.version) {
		throw new Error('Current package, lockfile and manifest versions disagree.');
	}
	if (version in versions) {
		throw new Error(`versions.json already contains ${version}.`);
	}
	const changelog = read('CHANGELOG.md');
	const unreleased = /^## Unreleased\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m;
	const notes = unreleased.exec(changelog);
	if (!notes || !notes[1].trim()) {
		throw new Error('CHANGELOG.md needs a nonempty ## Unreleased section.');
	}

	// Run before touching release metadata; failed checks cannot create a tag.
	execFileSync(process.execPath, ['scripts/check.mjs'], { cwd, stdio: 'inherit' });
	if (git('status', '--porcelain')) {
		throw new Error('Worktree changed during release checks; inspect and commit those changes first.');
	}
	pkg.version = lock.version = lock.packages[''].version = manifest.version = version;
	versions[version] = manifest.minAppVersion;
	for (const [index, data] of [pkg, lock, manifest, versions].entries()) {
		const { name, text } = files[index];
		writeFileSync(new URL(`../${name}`, import.meta.url),
			JSON.stringify(data, null, '\t') + (text.endsWith('\n') ? '\n' : ''));
	}
	writeFileSync(new URL('../CHANGELOG.md', import.meta.url), changelog.replace(
		/^## Unreleased\r?$/m, `## ${version} - ${new Date().toISOString().slice(0, 10)}`,
	));
	git('diff', '--check');
	git('add', '--', ...names, 'CHANGELOG.md');
	git('commit', '-m', `Release ${version}`);
	git('tag', '-a', version, '-m', `Release ${version}`);
	console.log(`Prepared ${version}. Publish with: git push origin HEAD refs/tags/${version}`);
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
