import { describe, expect, test } from '@jest/globals';
import { cross } from 'd3-array';
import { findEquipment, getTestMonster, getTestPlayer } from '@/tests/utils/TestUtils';
import { availableEquipment, isSearchableEquipment } from '@/lib/Equipment';
import { DEFAULT_AUTO_BUFFS_CONFIG } from '@/lib/AutoBuffs';
import { optimize, Optimizer, styleFamily } from '@/lib/Optimizer';
import { EquipmentPiece, PlayerEquipment } from '@/types/Player';
import { getCombatStylesForCategory } from '@/utils';

type Slot = keyof PlayerEquipment;

/**
 * Tries every combination of the given slot options with every style of the weapon, to check the optimizer
 * against the true best.
 */
const bruteForceBest = (optimizer: Optimizer, weapon: EquipmentPiece, family: string, options: Partial<Record<Slot, EquipmentPiece[]>>) => {
  const slots = Object.keys(options) as Slot[];
  let combos: Partial<PlayerEquipment>[] = [{}];
  for (const slot of slots) {
    combos = cross(combos, [null, ...options[slot]!]).map(([combo, item]) => ({ ...combo, [slot]: item }));
  }

  let best = 0;
  for (const style of getCombatStylesForCategory(weapon.category).filter((s) => styleFamily(s) === family && s.stance !== 'Manual Cast')) {
    for (const combo of combos) {
      const gear = {
        head: null, cape: null, neck: null, ammo: null, body: null, shield: null, legs: null, hands: null, feet: null, ring: null, ...combo, weapon,
      } as PlayerEquipment;
      best = Math.max(best, optimizer.evaluate(gear, {
        weapon, style, spell: null, family: family as 'melee',
      }));
    }
  }
  return best;
};

const items = (...names: string[]) => names.map((n) => findEquipment(n));

describe('Optimizer', () => {
  test('matches an exhaustive search on a small melee pool', () => {
    const monster = getTestMonster('Abyssal demon');
    const options = {
      head: items('Helm of Neitiznot', 'Slayer helmet (i)', 'Berserker helm'),
      neck: items('Amulet of fury', 'Amulet of torture', 'Salve amulet(ei)'),
      body: [findEquipment('Bandos chestplate'), findEquipment('Fighter torso', 'Normal')],
      legs: items('Bandos tassets', 'Obsidian platelegs'),
      ring: items('Berserker ring (i)', 'Ultor ring'),
    };
    const weapon = findEquipment('Abyssal whip');
    const pool = [weapon, ...Object.values(options).flat()];
    const opts = {
      player: getTestPlayer(monster), monster, poolIds: pool.map((p) => p.id), styles: ['melee' as const], buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    };

    const [best] = optimize(opts);
    expect(best.equipment.weapon?.name).toBe('Abyssal whip');
    expect(best.dps).toBeCloseTo(bruteForceBest(new Optimizer(opts), weapon, 'melee', options), 9);
  });

  test('matches an exhaustive search when armour sets compete with better-stat pieces (void)', () => {
    const monster = getTestMonster('Abyssal demon');
    const normal = (...names: string[]) => names.map((n) => findEquipment(n, 'Normal'));
    const options = {
      head: [...normal('Void ranger helm'), findEquipment('Armadyl helmet')],
      body: [...normal('Elite void top'), findEquipment("Karil's leathertop", 'Undamaged')],
      legs: [...normal('Elite void robe'), findEquipment("Karil's leatherskirt", 'Undamaged')],
      hands: [...normal('Void knight gloves'), findEquipment('Barrows gloves')],
    };
    const weapon = findEquipment('Toxic blowpipe', 'Charged');
    const dart = findEquipment('Dragon dart');
    const pool = [weapon, dart, ...Object.values(options).flat()];
    const opts = {
      player: getTestPlayer(monster), monster, poolIds: pool.map((p) => p.id), styles: ['ranged' as const], buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    };

    const [best] = optimize(opts);
    const loadedBlowpipe = { ...weapon, itemVars: { blowpipeDartName: dart.name, blowpipeDartId: dart.id } };
    expect(best.equipment.weapon?.itemVars?.blowpipeDartName).toBe('Dragon dart');
    expect(best.dps).toBeCloseTo(bruteForceBest(new Optimizer(opts), loadedBlowpipe, 'ranged', options), 9);
  });

  test('finds a full set that no single swap would reach (void vs a weak-stat monster)', () => {
    // Against a monster with no ranged defence, accuracy bonuses barely matter, so void's damage boost wins,
    // but only once all four pieces are on.
    const monster = getTestMonster('Abyssal demon', '', { defensive: { light: 0, standard: 0, heavy: 0 }, skills: { def: 1 } });
    const normal = (...names: string[]) => names.map((n) => findEquipment(n, 'Normal'));
    const options = {
      head: [...normal('Void ranger helm'), findEquipment('Armadyl helmet')],
      body: [...normal('Elite void top'), findEquipment('Armadyl chestplate')],
      legs: [...normal('Elite void robe'), findEquipment('Armadyl chainskirt')],
      hands: [...normal('Void knight gloves'), findEquipment('Barrows gloves')],
    };
    const weapon = findEquipment('Toxic blowpipe', 'Charged');
    const dart = findEquipment('Dragon dart');
    const opts = {
      player: getTestPlayer(monster),
      monster,
      poolIds: [weapon, dart, ...Object.values(options).flat()].map((p) => p.id),
      styles: ['ranged' as const],
      buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    };

    const [best] = optimize(opts);
    const loadedBlowpipe = { ...weapon, itemVars: { blowpipeDartName: dart.name, blowpipeDartId: dart.id } };
    expect(best.dps).toBeCloseTo(bruteForceBest(new Optimizer(opts), loadedBlowpipe, 'ranged', options), 9);
    // Starting from Armadyl, any single void piece is worse, so only trying the whole set gets here
    expect([best.equipment.head, best.equipment.body, best.equipment.legs, best.equipment.hands].map((e) => e?.name))
      .toEqual(['Void ranger helm', 'Elite void top', 'Elite void robe', 'Void knight gloves']);
  });

  test('only returns the requested styles, and ranged weapons get ammo', () => {
    const monster = getTestMonster('Abyssal demon');
    const pool = items('Abyssal whip', 'Twisted bow', 'Dragon arrow', 'Rune arrow', 'Amulet of fury');
    const results = optimize({
      player: getTestPlayer(monster), monster, poolIds: pool.map((p) => p.id), styles: ['ranged'], buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    });

    expect(results.every((r) => r.family === 'ranged')).toBe(true);
    expect(results[0].equipment.weapon?.name).toBe('Twisted bow');
    expect(results[0].equipment.ammo?.name).toBe('Dragon arrow');
    expect(results[0].prayers).toEqual(DEFAULT_AUTO_BUFFS_CONFIG.ranged.prayers);
  });

  test("doesn't put ammo on weapons that don't use it", () => {
    const monster = getTestMonster('Abyssal demon');
    const blowpipe = findEquipment('Toxic blowpipe', 'Charged');
    const pool = [blowpipe, ...items('Dragon dart', 'Dragon arrow', 'Diamond bolts (e)')];
    const results = optimize({
      player: getTestPlayer(monster), monster, poolIds: pool.map((p) => p.id), styles: ['ranged'], buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    });

    expect(results[0].equipment.weapon?.name).toBe('Toxic blowpipe');
    expect(results[0].equipment.ammo).toBeNull();
  });

  test('handles every searchable item in reasonable time', () => {
    const monster = getTestMonster('Abyssal demon');
    const pool = availableEquipment.filter(isSearchableEquipment).map((eq) => eq.id);
    const optimizer = new Optimizer({
      player: getTestPlayer(monster), monster, poolIds: pool, styles: ['melee', 'ranged', 'magic'], buffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    });

    const start = performance.now();
    const results = optimizer.run();
    const seconds = (performance.now() - start) / 1000;
    console.log(`All items: ${optimizer.evaluations} evaluations in ${seconds.toFixed(1)}s. Top: ${results.slice(0, 3).map((r) => `${r.equipment.weapon?.name} ${r.dps.toFixed(2)}`).join(', ')}`);

    expect(results.length).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(30);
  });
});
