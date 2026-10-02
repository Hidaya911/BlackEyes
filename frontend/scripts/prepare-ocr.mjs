// Ship the exact installed worker, WASM cores and English model on our own origin.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public/ocr');
await mkdir(join(output, 'core'), { recursive: true });
await mkdir(join(output, 'lang'), { recursive: true });
await copyFile(require.resolve('tesseract.js/dist/worker.min.js'), join(output, 'worker.min.js'));
const core = dirname(require.resolve('tesseract.js-core/package.json'));
for (const name of await readdir(core)) {
  if (name.startsWith('tesseract-core') && (name.endsWith('.wasm') || name.endsWith('.wasm.js'))) {
    await copyFile(join(core, name), join(output, 'core', name));
  }
}
const language = require('@tesseract.js-data/eng');
await copyFile(join(language.langPath, 'eng.traineddata.gz'), join(output, 'lang/eng.traineddata.gz'));
