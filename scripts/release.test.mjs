import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function fixture(t, { notes = '- A change.', check = '', manifestVersion = '1.2.3' } = {}) {
	const cwd = mkdtempSync(join(tmpdir(), 'vimakase-release-test-'));
	t.after(() => rmSync(cwd, { recursive: true, force: true }));
	const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	const write = (name, text) => writeFileSync(join(cwd, name), text);
	const json = (name, data) => write(name, JSON.stringify(data, null, '\t') + '\n');
	mkdirSync(join(cwd, 'scripts'));
	for (const name of ['release.mjs', 'changelog.mjs']) {
		copyFileSync(new URL(`./${name}`, import.meta.url), join(cwd, 'scripts', name));
	}
	write('scripts/check.mjs', check);
	json('package.json', { version: '1.2.3' });
	json('package-lock.json', { version: '1.2.3', packages: { '': { version: '1.2.3' } } });
	json('manifest.json', { version: manifestVersion, minAppVersion: '1.8.7' });
	json('versions.json', { '1.2.3': '1.8.7' });
	write('CHANGELOG.md', '# Changelog\n\nWrite new entries under `## Unreleased`.\n\n'
		+ `## Unreleased\n\n${notes}\n\n## 1.2.3 - 2026-01-01\n\n- Old change.\n`);
	git('init', '-q');
	git('config', 'user.name', 'Release Test');
	git('config', 'user.email', 'release-test@example.com');
	git('config', 'commit.gpgsign', 'false');
	git('config', 'tag.gpgsign', 'false');
	git('config', 'core.hooksPath', join(cwd, 'no-hooks'));
	git('add', '.');
	git('commit', '-qm', 'Fixture');
	return {
		git, write,
		read: (name) => JSON.parse(git('show', `HEAD:${name}`)),
		notes: (version) => execFileSync(process.execPath, ['scripts/changelog.mjs', version], {
			cwd, encoding: 'utf8',
		}).trim(),
		release: (version) => spawnSync(process.execPath, ['scripts/release.mjs', version], {
			cwd, encoding: 'utf8', env: { ...process.env, npm_config_ignore_scripts: 'true' },
		}),
	};
}

test('release commits matching metadata and tags the commit with npm scripts disabled', (t) => {
	const f = fixture(t);
	const result = f.release('1.3.0');
	assert.equal(result.status, 0, result.stderr);
	for (const name of ['package.json', 'package-lock.json', 'manifest.json']) {
		assert.equal(f.read(name).version, '1.3.0');
	}
	assert.equal(f.read('package-lock.json').packages[''].version, '1.3.0');
	assert.equal(f.read('versions.json')['1.3.0'], '1.8.7');
	assert.match(f.git('show', '1.3.0:CHANGELOG.md'), /^## 1\.3\.0 - \d{4}-\d{2}-\d{2}$/m);
	assert.match(f.git('show', '1.3.0:CHANGELOG.md'), /^Write new entries under `## Unreleased`\.$/m);
	assert.equal(f.notes('1.3.0'), '- A change.');
	assert.equal(f.notes('1.2.3'), '- Old change.');
	assert.equal(f.git('rev-parse', '1.3.0^{}'), f.git('rev-parse', 'HEAD'));
	assert.equal(f.git('cat-file', '-t', '1.3.0'), 'tag');
	assert.equal(f.git('status', '--porcelain'), '');
});

test('failed validation leaves metadata, commit and tags untouched', (t) => {
	const f = fixture(t, { check: 'console.error("simulated-check-failure"); process.exit(1);' });
	const head = f.git('rev-parse', 'HEAD');
	const result = f.release('1.3.0');
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /simulated-check-failure/);
	assert.equal(f.git('rev-parse', 'HEAD'), head);
	assert.equal(f.git('tag', '--list'), '');
	assert.equal(f.git('status', '--porcelain'), '');
});

for (const [name, opts, version, prepare] of [
	['empty notes', { notes: '' }, '1.3.0'],
	['inconsistent metadata', { manifestVersion: '1.2.2' }, '1.3.0'],
	['older version', {}, '1.2.2'],
	['invalid version', {}, '01.3.0'],
	['existing tag', {}, '1.3.0', (f) => f.git('tag', '1.3.0')],
	['dirty worktree', {}, '1.3.0', (f) => f.write('uncommitted.txt', 'work')],
]) {
	test(`rejects ${name} before changing files or creating a commit`, (t) => {
		const f = fixture(t, opts);
		prepare?.(f);
		const head = f.git('rev-parse', 'HEAD');
		const status = f.git('status', '--porcelain');
		const tags = f.git('tag', '--list');
		assert.notEqual(f.release(version).status, 0);
		assert.equal(f.git('rev-parse', 'HEAD'), head);
		assert.equal(f.git('status', '--porcelain'), status);
		assert.equal(f.git('tag', '--list'), tags);
	});
}
