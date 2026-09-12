import { readFileSync, writeFileSync } from 'fs';

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
	throw new Error('npm_package_version is not set; run this through `npm version`');
}

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

// update versions.json with target version and minAppVersion from manifest.json
// but only if the target version is not already in versions.json
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
if (!(targetVersion in versions)) {
	versions[targetVersion] = minAppVersion;
	writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
}

// Give the unreleased changelog section the version it is going out as; the release
// workflow looks the notes up by tag.
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const dated = `## ${targetVersion} - ${new Date().toISOString().slice(0, 10)}`;
if (changelog.includes('## Unreleased')) {
	writeFileSync('CHANGELOG.md', changelog.replace('## Unreleased', dated));
} else if (!changelog.includes(`## ${targetVersion} `)) {
	throw new Error(`CHANGELOG.md has neither an Unreleased section nor one for ${targetVersion}`);
}
