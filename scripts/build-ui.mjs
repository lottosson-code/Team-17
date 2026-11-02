import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, join, dirname, basename, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist/ui');
const compiler = resolve(root, 'node_modules/typescript/bin/tsc');
if (!existsSync(compiler)) throw Error('Install the locked dependencies with npm ci first.');
// Only the dedicated generated UI distribution may be cleared.
if (!output.startsWith(root.endsWith(sep) ? root : root + sep) ||
    basename(output) !== 'ui' || basename(dirname(output)) !== 'dist') {
  throw Error('Unexpected UI output directory');
}
rmSync(output, { recursive: true, force: true });
const result = spawnSync(process.execPath, [compiler, '-p', join(root, 'tsconfig.ui.json')], {
  cwd: root, stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

function copySelected(source, target, extensions) {
  for (const item of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, item.name);
    const to = join(target, item.name);
    if (item.isDirectory()) copySelected(from, to, extensions);
    else if (extensions.includes(extname(item.name))) {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
    }
  }
}
for (const module of ['main menu', 'map', 'pause menu']) {
  copySelected(join(root, module), join(output, module), ['.css']);
}
copySelected(join(root, 'assets'), join(output, 'assets'), ['.png', '.svg']);
console.log('Built current standalone modules, styles and shared artwork in dist/ui/.');
