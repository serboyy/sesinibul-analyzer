// Independent static asset packaging. SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) throw new Error('Provide an explicit static output directory.');
const output = resolve(process.argv[2]);
if (output === root || output === '/') throw new Error('Invalid output directory.');
const provenance = JSON.parse(await readFile(resolve(root, 'dist/provenance.json'), 'utf8'));
for (const file of ['engine.js', 'engine.wasm']) {
  const hash = createHash('sha256').update(await readFile(resolve(root, 'dist', file))).digest('hex');
  if (hash !== provenance.sha256[file]) throw new Error('Engine integrity mismatch: ' + file);
}
const files = ['web/production.html', 'web/style.css', 'web/app.js', 'web/worker.js',
  'web/fonts/InstrumentSans.ttf', 'web/fonts/OFL.txt', 'LICENSE',
  'dist/engine.js', 'dist/engine.wasm', 'dist/provenance.json'];
for (const file of files) {
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, file), destination);
}
console.log('Exported verified independent analyzer assets:', files.length);
