import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import spells from '../../../cdn/json/spells.json';

describe('spell icons', () => {
  test('every spell has a self-hosted icon in cdn/spells', () => {
    // If this fails after syncing with upstream, run: node scripts/fetchSpellImages.mjs
    const dir = path.join(__dirname, '../../../cdn/spells');
    const missing = spells
      .map((s) => s.image)
      .filter((img) => img && !fs.existsSync(path.join(dir, img)));
    expect(missing).toEqual([]);
  });
});
