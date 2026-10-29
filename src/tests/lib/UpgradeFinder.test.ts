import { describe, expect, test } from '@jest/globals';
import { findEquipment, getTestMonster, getTestPlayer } from '@/tests/utils/TestUtils';
import { DEFAULT_AUTO_BUFFS_CONFIG } from '@/lib/AutoBuffs';
import { optimize, OptimizeResult } from '@/lib/Optimizer';
import { combineUpgrades, findUpgrades, MonsterUpgrades } from '@/lib/UpgradeFinder';

const ids = (...names: string[]) => names.map((n) => findEquipment(n).id);

const MELEE_GEAR = ids('Abyssal whip', 'Dragon defender', 'Amulet of fury', 'Fire cape', 'Barrows gloves', 'Dragon boots', 'Berserker ring (i)', 'Bandos chestplate', 'Bandos tassets');

describe('findUpgrades', () => {
  test('finds an armour upgrade worth the same as optimizing with it', () => {
    const monster = getTestMonster('Abyssal demon');
    const opts = {
      player: getTestPlayer(monster),
      monster,
      ownedIds: MELEE_GEAR,
      candidateIds: ids('Amulet of torture', 'Amulet of glory'),
      styles: ['melee' as const],
      buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    };
    const { baseline, upgrades } = findUpgrades(opts);
    const [withTorture] = optimize({ ...opts, poolIds: [...MELEE_GEAR, ...ids('Amulet of torture')] });

    expect(baseline?.equipment.neck?.name).toBe('Amulet of fury');
    // Glory is worse than the fury you own, so it's no upgrade
    expect(upgrades.map((u) => u.items.map((eq) => eq.name))).toEqual([['Amulet of torture']]);
    expect(upgrades[0].dps).toBeCloseTo(withTorture.dps, 9);
    expect(upgrades[0].dps).toBeGreaterThan(baseline!.dps);
  });

  test('includes the ammo a new weapon needs when none is owned', () => {
    const monster = getTestMonster('Moia');
    const { upgrades } = findUpgrades({
      player: getTestPlayer(monster),
      monster,
      ownedIds: MELEE_GEAR,
      candidateIds: ids('Twisted bow', 'Dragon arrow'),
      styles: ['melee', 'ranged'],
      buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    });

    const bow = upgrades.find((u) => u.items[0].name === 'Twisted bow');
    expect(bow?.items.map((eq) => eq.name)).toEqual(['Twisted bow', 'Dragon arrow']);
    expect(bow?.setup.equipment.ammo?.name).toBe('Dragon arrow');
    // Arrows alone don't help a whip
    expect(upgrades.some((u) => u.items.length === 1 && u.items[0].name === 'Dragon arrow')).toBe(false);
  });

  test('tries the missing pieces of an armour set together', () => {
    const monster = getTestMonster('Abyssal demon');
    const owned = ids('Rune crossbow', 'Ruby bolts (e)', "Black d'hide body", "Black d'hide chaps", 'Barrows gloves', 'Archers ring (i)', 'Amulet of fury');
    const { upgrades } = findUpgrades({
      player: getTestPlayer(monster),
      monster,
      ownedIds: owned,
      candidateIds: ids('Void ranger helm', 'Elite void top', 'Elite void robe', 'Void knight gloves'),
      styles: ['ranged'],
      buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    });

    const set = upgrades.find((u) => u.key.startsWith('set:'));
    expect(set?.items.map((eq) => eq.name).sort()).toEqual(['Elite void robe', 'Elite void top', 'Void knight gloves', 'Void ranger helm']);
    expect(upgrades[0].key).toBe(set?.key);
  });

  test("uses the monster's defence reductions", () => {
    const owned = ids(...[
      "Inquisitor's mace", "Inquisitor's great helm", "Inquisitor's hauberk", "Inquisitor's plateskirt", 'Amulet of torture',
      'Ferocious gloves', 'Primordial boots', 'Ultor ring', 'Infernal cape', 'Masori mask (f)', 'Masori body (f)', 'Masori chaps (f)',
      'Necklace of anguish', 'Zaryte vambraces', 'Pegasian boots', 'Venator ring',
    ]);
    const find = (dwh: number) => {
      const monster = getTestMonster('Archive Guardian', 'Grounded', { inputs: { defenceReductions: { dwh } } });
      return findUpgrades({
        player: getTestPlayer(monster), monster, ownedIds: owned, candidateIds: ids('Twisted bow', 'Dragon arrow'), styles: ['melee', 'ranged'], buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
      });
    };
    const before = find(0);
    const after = find(2);

    // Two DWH specs (down to the TFA defence floor of 156) speed up both, and here make the bow worth getting
    expect(before.baseline!.dps).toBeCloseTo(7.946, 2);
    expect(after.baseline!.dps).toBeCloseTo(9.307, 2);
    expect(before.upgrades.some((u) => u.items[0].name === 'Twisted bow')).toBe(false);
    expect(after.upgrades.find((u) => u.items[0].name === 'Twisted bow')?.dps).toBeCloseTo(9.574, 2);
  });

  test('suggests the armour set an owned weapon needs', () => {
    const monster = getTestMonster('The Leviathan', 'Post-quest');
    const { baseline, upgrades } = findUpgrades({
      player: getTestPlayer(monster),
      monster,
      ownedIds: ids('Bow of Faerdhinen (c)', 'Masori mask (f)', 'Masori body (f)', 'Masori chaps (f)', 'Necklace of anguish', 'Zaryte vambraces', 'Pegasian boots', 'Venator ring'),
      candidateIds: [findEquipment('Crystal helm', 'Active').id, findEquipment('Crystal body', 'Active').id, findEquipment('Crystal legs', 'Active').id],
      styles: ['ranged'],
      buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    });

    expect(baseline?.equipment.body?.name).toBe('Masori body (f)');
    expect(upgrades[0].items.map((eq) => eq.name).sort()).toEqual(['Crystal body', 'Crystal helm', 'Crystal legs']);
    expect(upgrades[0].setup.equipment.weapon?.name).toBe('Bow of Faerdhinen (c)');
  });
});

describe('combineUpgrades', () => {
  const setup = (dps: number) => ({ dps } as OptimizeResult);
  const analysis = (baseline: number, upgrades: [string, number][]): MonsterUpgrades => ({
    baseline: setup(baseline),
    upgrades: upgrades.map(([key, dps]) => ({
      key, items: [findEquipment('Amulet of torture')], dps, setup: setup(dps),
    })),
  });

  test('ranks by weighted kill time saved', () => {
    const results = [
      analysis(5, [['a', 10], ['b', 6]]), // 1000 hp: a saves 100s, b saves 33.3s
      analysis(10, [['b', 20]]), // 2000 hp, twice: b saves 200s
    ];
    const combined = combineUpgrades(results, [{ hp: 1000, weight: 1 }, { hp: 2000, weight: 2 }]);

    expect(combined.map((u) => u.key)).toEqual(['b', 'a']);
    expect(combined[0].secondsSaved).toBeCloseTo(1000 / 5 - 1000 / 6 + 200, 9);
    expect(combined[1].secondsSaved).toBeCloseTo(100, 9);
    expect(combined[1].perTarget[1]).toBeNull();
  });

  test('lists monsters nothing owned can damage as unlocks, not time saved', () => {
    const results = [
      analysis(5, [['a', 10]]),
      analysis(0, [['b', 4]]),
    ];
    const combined = combineUpgrades(results, [{ hp: 1000, weight: 1 }, { hp: 1000, weight: 1 }]);

    expect(combined.map((u) => [u.key, u.secondsSaved, u.unlocks])).toEqual([['a', 100, []], ['b', 0, [1]]]);
  });
});
