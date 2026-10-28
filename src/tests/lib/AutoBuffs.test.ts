import { describe, expect, test } from '@jest/globals';
import Potion from '@/enums/Potion';
import { addPrayer, Prayer } from '@/enums/Prayer';
import { MonsterAttribute } from '@/enums/MonsterAttribute';
import { TOMBS_OF_AMASCUT_MONSTER_IDS } from '@/lib/constants';
import { availableEquipment } from '@/lib/Equipment';
import { getCombatStylesForCategory, getDefaultCombatStyle } from '@/utils';
import {
  AutoBuffsConfig,
  autoBuffStyleFor,
  DEFAULT_AUTO_BUFFS_CONFIG,
  getRaid,
  potionOptionsFor,
  prayerOptionsFor,
  withAutoBuffPotions,
  withAutoBuffPrayers,
} from '@/lib/AutoBuffs';

const findItem = (name: string) => availableEquipment.find((eq) => eq.name === name)!;
const defaultStyle = (name: string) => {
  const weapon = findItem(name);
  return autoBuffStyleFor(weapon, getDefaultCombatStyle(weapon.category));
};
const config = DEFAULT_AUTO_BUFFS_CONFIG;

describe('getRaid', () => {
  test('detects Chambers of Xeric and Tombs of Amascut monsters', () => {
    expect(getRaid({ id: 7540, attributes: [MonsterAttribute.XERICIAN] })).toBe('cox');
    expect(getRaid({ id: TOMBS_OF_AMASCUT_MONSTER_IDS[0], attributes: [] })).toBe('toa');
    expect(getRaid({ id: 415, attributes: [MonsterAttribute.DEMON] })).toBeNull();
  });
});

describe('autoBuffStyleFor', () => {
  test('picks the style from the weapon', () => {
    expect(defaultStyle('Twisted bow')).toBe('ranged');
    expect(defaultStyle('Abyssal whip')).toBe('melee');
    expect(defaultStyle("Tumeken's shadow")).toBe('magic');
  });

  test('treats a staff in a melee stance as magic', () => {
    const wand = findItem('Kodai wand');
    const meleeStance = getCombatStylesForCategory(wand.category).find((s) => s.type === 'crush')!;
    expect(autoBuffStyleFor(wand, meleeStance)).toBe('magic');
  });
});

describe('withAutoBuffPotions', () => {
  test("adds the style's potions and keeps unrelated ones", () => {
    expect(withAutoBuffPotions([Potion.SUPER_DEFENCE], config, 'melee', null)).toEqual([Potion.SUPER_DEFENCE, Potion.SUPER_COMBAT]);
    expect(withAutoBuffPotions([], config, 'ranged', null)).toEqual([Potion.RANGING]);
    expect(withAutoBuffPotions([], config, 'magic', null)).toEqual([Potion.SATURATED_HEART]);
  });

  test('switching style swaps the managed potions', () => {
    expect(withAutoBuffPotions([Potion.SUPER_COMBAT], config, 'ranged', null)).toEqual([Potion.RANGING]);
  });

  test('raids replace the style potions', () => {
    expect(withAutoBuffPotions([Potion.SUPER_COMBAT], config, 'melee', 'cox')).toEqual([Potion.OVERLOAD_PLUS]);
    expect(withAutoBuffPotions([Potion.SUPER_COMBAT], config, 'melee', 'toa')).toEqual([Potion.SMELLING_SALTS]);
    expect(withAutoBuffPotions([Potion.SMELLING_SALTS], config, 'melee', null)).toEqual([Potion.SUPER_COMBAT]);
  });

  test('uses the configured potions', () => {
    const custom: AutoBuffsConfig = {
      ...config,
      melee: { potions: [Potion.SUPER_STRENGTH], prayers: [] },
      magic: { potions: [Potion.ANCIENT], prayers: [] },
      cox: [Potion.OVERLOAD],
    };
    expect(withAutoBuffPotions([], custom, 'melee', null)).toEqual([Potion.SUPER_STRENGTH]);
    expect(withAutoBuffPotions([Potion.SUPER_STRENGTH], custom, 'magic', null)).toEqual([Potion.ANCIENT]);
    expect(withAutoBuffPotions([], custom, 'melee', 'cox')).toEqual([Potion.OVERLOAD]);
  });
});

describe('withAutoBuffPrayers', () => {
  test('turns on the configured prayers, replacing conflicting ones', () => {
    expect(withAutoBuffPrayers([Prayer.RIGOUR, Prayer.STEEL_SKIN], config, 'melee')).toEqual([Prayer.PIETY]);

    const chad: AutoBuffsConfig = { ...config, melee: { potions: [], prayers: [Prayer.ULTIMATE_STRENGTH, Prayer.INCREDIBLE_REFLEXES] } };
    expect(withAutoBuffPrayers([Prayer.PIETY], chad, 'melee')).toEqual([Prayer.ULTIMATE_STRENGTH, Prayer.INCREDIBLE_REFLEXES]);
  });
});

describe('addPrayer', () => {
  test('brain and arm prayers combine, others replace each other', () => {
    expect(addPrayer([Prayer.ULTIMATE_STRENGTH], Prayer.INCREDIBLE_REFLEXES)).toEqual([Prayer.ULTIMATE_STRENGTH, Prayer.INCREDIBLE_REFLEXES]);
    expect(addPrayer([Prayer.ULTIMATE_STRENGTH, Prayer.INCREDIBLE_REFLEXES], Prayer.PIETY)).toEqual([Prayer.PIETY]);
    expect(addPrayer([Prayer.PIETY], Prayer.PIETY)).toEqual([Prayer.PIETY]);
  });
});

describe('options', () => {
  test('are filtered by style and sorted strongest first', () => {
    const melee = potionOptionsFor('melee');
    expect(melee[0]).toBe(Potion.SMELLING_SALTS);
    expect(melee).toContain(Potion.SUPER_STRENGTH);
    expect(melee).not.toContain(Potion.RANGING);
    expect(melee).not.toContain(Potion.ANCIENT); // brews lower melee stats
    expect(potionOptionsFor('magic')).toContain(Potion.ANCIENT);

    expect(prayerOptionsFor('melee')[0]).toBe(Prayer.ZEAL);
    expect(prayerOptionsFor('melee')).toContain(Prayer.INCREDIBLE_REFLEXES);
    expect(prayerOptionsFor('magic')[0]).toBe(Prayer.AUGURY);
    expect(prayerOptionsFor('ranged')).not.toContain(Prayer.PIETY);
  });
});
