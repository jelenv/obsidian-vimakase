import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
for (const args of [
	['--test', 'scripts/release.test.mjs'],
	['node_modules/eslint/bin/eslint.js', '.'],
	['node_modules/typescript/bin/tsc', '-noEmit', '-skipLibCheck'],
	['esbuild.config.mjs', 'production'],
]) {
	execFileSync(process.execPath, args, { cwd, stdio: 'inherit' });
}
