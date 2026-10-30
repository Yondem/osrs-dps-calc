import { describe, expect, test } from '@jest/globals';
import { createBackup, parseBackup } from '@/lib/Backup';
import { CustomSettings, Preferences } from '@/types/State';

const custom: CustomSettings = {
  hiddenItemIds: [11212],
  hiddenBlowpipeDarts: [{ blowpipeId: 12926, dartId: 811 }],
  itemTags: [{ tag: 'tbow', itemId: 20997 }],
  savedSetups: [],
  hiddenPresets: ['void'],
};
const prefs = { autoBuffs: true, hiddenGraphs: ['ttkComparison'] } as unknown as Preferences;
const bank = { items: [{ id: 4151, name: 'Abyssal whip', quantity: 1 }], importedAt: '2026-10-29T12:00:00.000Z' };

describe('parseBackup', () => {
  test('reads back what createBackup made', () => {
    const backup = parseBackup(JSON.stringify(createBackup(prefs, custom, bank)));
    expect(backup.prefs).toEqual(prefs);
    expect(backup.custom).toEqual(custom);
    expect(backup.bank).toEqual(bank);
  });

  test('keeps a backup without a bank', () => {
    expect(parseBackup(JSON.stringify(createBackup(prefs, custom, null))).bank).toBeNull();
  });

  test('rejects text that isn\'t a backup', () => {
    expect(() => parseBackup('Item id\tItem name')).toThrow('isn\'t a DPS Calc backup');
    expect(() => parseBackup('{"hello": 1}')).toThrow('isn\'t a DPS Calc backup');
  });

  test('rejects backups from a newer version', () => {
    expect(() => parseBackup(JSON.stringify({ ...createBackup(prefs, custom, null), version: 99 }))).toThrow('newer version');
  });

  test('drops malformed parts instead of importing them', () => {
    const backup = parseBackup(JSON.stringify({
      ...createBackup(prefs, custom, null), custom: { ...custom, itemTags: 'tbow' }, bank: { items: 'whip' },
    }));
    expect(backup.custom.itemTags).toBeUndefined();
    expect(backup.custom.hiddenItemIds).toEqual([11212]);
    expect(backup.bank).toBeNull();
  });
});
