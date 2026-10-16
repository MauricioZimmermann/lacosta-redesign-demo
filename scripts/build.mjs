import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'dist');
const ignored = new Set([
  '.git',
  '.wrangler',
  'dist',
  'node_modules',
  '.gitignore',
  'LICENSE',
  'LICENSE.txt',
  'README.md',
  'README.txt',
  'package.json',
  'package-lock.json',
  'wrangler.jsonc',
  'scripts'
]);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (ignored.has(entry.name)) continue;
  await cp(join(root, entry.name), join(out, entry.name), { recursive: true });
}

console.log(`Built static demo in ${out}`);
