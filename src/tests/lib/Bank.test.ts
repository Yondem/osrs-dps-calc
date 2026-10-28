import { describe, expect, test } from '@jest/globals';
import { getOwnedEquipmentIds, parseBankMemoryExport } from '@/lib/Bank';

describe('parseBankMemoryExport', () => {
  test('parses the Bank Memory clipboard export', () => {
    const text = 'Item id\tItem name\tItem quantity\r\n4151\tAbyssal whip\t1\r\n995\tCoins\t12345678\r\n';
    expect(parseBankMemoryExport(text)).toEqual([
      { id: 4151, name: 'Abyssal whip', quantity: 1 },
      { id: 995, name: 'Coins', quantity: 12345678 },
    ]);
  });

  test('skips placeholders and junk, and merges duplicates', () => {
    const text = [
      'Item id\tItem name\tItem quantity',
      '',
      '11832\tBandos chestplate\t0',
      'not\ta\tnumber',
      '892\tRune arrow\t100',
      '892\tRune arrow\t50',
    ].join('\n');
    expect(parseBankMemoryExport(text)).toEqual([
      { id: 892, name: 'Rune arrow', quantity: 150 },
    ]);
  });

  test('returns nothing for unrelated text', () => {
    expect(parseBankMemoryExport('hello world')).toEqual([]);
  });
});

describe('getOwnedEquipmentIds', () => {
  test('owning a variant counts as owning its base item', () => {
    // 12773 is a variant of the Abyssal whip (4151)
    const owned = getOwnedEquipmentIds([{ id: 12773, name: 'Volcanic abyssal whip', quantity: 1 }]);
    expect(owned.has(4151)).toBe(true);
  });

  test('owning an uncharged item counts as owning the charged version', () => {
    // Tumeken's shadow: 27277 uncharged, 27275 charged
    const owned = getOwnedEquipmentIds([{ id: 27277, name: "Tumeken's shadow (uncharged)", quantity: 1 }]);
    expect(owned.has(27275)).toBe(true);
  });

  test('does not add unrelated items', () => {
    const owned = getOwnedEquipmentIds([{ id: 4151, name: 'Abyssal whip', quantity: 1 }]);
    expect(owned.has(27275)).toBe(false);
  });
});
