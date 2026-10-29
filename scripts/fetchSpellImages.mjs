// Downloads the spell icons listed in cdn/json/spells.json that cdn/spells/ doesn't have yet, so self-hosted builds
// can serve them instead of loading them from the wiki. Run it after spells.json gains new spells:
//   node scripts/fetchSpellImages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'cdn', 'spells');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const spells = JSON.parse(fs.readFileSync(path.join(ROOT, 'cdn', 'json', 'spells.json'), 'utf8'));
const images = [...new Set(spells.map((s) => s.image).filter(Boolean))];
const missing = images.filter((img) => !fs.existsSync(path.join(OUT_DIR, img)));

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`${images.length} spell icons, ${missing.length} to download`);

let failed = 0;
for (const img of missing) {
  // Same URL the calculator used, so it's likely already in the wiki's cache
  const url = `https://oldschool.runescape.wiki/images/${encodeURIComponent(img.replaceAll(' ', '_'))}?11111`;
  const res = await fetch(url, { headers: { 'User-Agent': 'osrs-dps-calc fork (github.com/Yondem/osrs-dps-calc) spell icon sync' } });
  const data = Buffer.from(await res.arrayBuffer());
  if (!res.ok || !data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    console.error(`  failed: ${img} (HTTP ${res.status}, ${res.headers.get('content-type')})`);
    failed += 1;
  } else {
    fs.writeFileSync(path.join(OUT_DIR, img), data);
    console.log(`  ${img} (${data.length} bytes)`);
  }
  // Go easy on the wiki
  await new Promise((r) => { setTimeout(r, 250); });
}

if (failed) process.exit(1);
