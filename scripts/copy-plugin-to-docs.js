/**
 * Copies the built minified plugin from dist/assets/ to docs/assets/map-plugin.js
 * so the docs page can serve the plugin for GitHub Pages. Run after build:
 *   npm run build && npm run copy-to-docs
 * Or use: npm run build:docs (which runs both).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distAssets = path.join(root, 'dist', 'assets');
const docsAssets = path.join(root, 'docs', 'assets');
const destFile = path.join(docsAssets, 'map-plugin.js');

if (!fs.existsSync(distAssets)) {
  console.error('scripts/copy-plugin-to-docs: dist/assets not found. Run npm run build first.');
  process.exit(1);
}

const files = fs.readdirSync(distAssets).filter((f) => f.endsWith('.js'));
// Vite/Rollup entry naming: dev-HASH.js (dash) or dev.HASH.js (dot); hash is alphanumeric
const mainJs = files.find((f) => /^dev[-.][A-Za-z0-9_.-]+\.js$/.test(f)) || files[0];
if (!mainJs) {
  console.error('scripts/copy-plugin-to-docs: no JS file found in dist/assets');
  process.exit(1);
}

fs.mkdirSync(docsAssets, { recursive: true });
fs.copyFileSync(path.join(distAssets, mainJs), destFile);
console.log('Copied dist/assets/' + mainJs + ' -> docs/assets/map-plugin.js');
