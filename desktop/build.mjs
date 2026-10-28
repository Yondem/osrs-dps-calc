// Copies the static Next.js export into desktop/app and packages a Windows executable.
// Run `corepack yarn build` in the repo root first (or use `corepack yarn desktop`).
import { packager } from '@electron/packager';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const exportDir = path.join(desktopDir, '..', 'out');
const appDir = path.join(desktopDir, 'app');

if (!fs.existsSync(path.join(exportDir, 'index.html'))) {
  console.error('No static export found in out/. Run `corepack yarn build` in the repo root first.');
  process.exit(1);
}

fs.rmSync(appDir, { recursive: true, force: true });
fs.cpSync(exportDir, appDir, { recursive: true });

const [outPath] = await packager({
  dir: desktopDir,
  name: 'DPS Calc',
  executableName: 'DPS Calc',
  platform: 'win32',
  arch: 'x64',
  icon: path.join(desktopDir, 'icon.ico'),
  out: path.join(desktopDir, 'dist'),
  overwrite: true,
  asar: true,
  prune: true,
  ignore: [/^\/dist($|\/)/, /^\/build\.mjs$/],
});

console.log(`Packaged to ${outPath}`);
