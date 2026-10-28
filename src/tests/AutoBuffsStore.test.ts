import { describe, expect, test } from '@jest/globals';
import { GlobalState } from '@/state';
import { availableEquipment } from '@/lib/Equipment';
import { getMonsters } from '@/lib/Monsters';
import Potion from '@/enums/Potion';
import { Prayer } from '@/enums/Prayer';

const findItem = (name: string) => availableEquipment.find((eq) => eq.name === name)!;
const findMonster = (name: string) => getMonsters().find((m) => m.name === name)!;

const newStore = () => {
  const store = new GlobalState();
  // Set directly rather than via updatePreferences, which writes to browser storage
  store.prefs.autoBuffs = true;
  return store;
};

describe('auto buffs in the store', () => {
  test('equipping weapons turns on potions and the matching prayer', () => {
    const store = newStore();

    store.updatePlayer({ equipment: { weapon: findItem('Abyssal whip') } });
    expect(store.player.prayers).toEqual([Prayer.PIETY]);
    expect(store.player.buffs.potions).toEqual([Potion.SUPER_COMBAT]);
    expect(store.player.boosts.str).toBeGreaterThan(0);

    // Switching from one weapon to another must trigger again (regression: merge() mutated the old weapon object)
    store.updatePlayer({ equipment: { weapon: findItem('Twisted bow') } });
    expect(store.player.prayers).toEqual([Prayer.RIGOUR]);
    expect(store.player.buffs.potions).toEqual([Potion.RANGING]);
  });

  test('uses the configured buffs', () => {
    const store = newStore();
    store.prefs.autoBuffsConfig = {
      ...store.prefs.autoBuffsConfig,
      melee: { potions: [Potion.SUPER_STRENGTH], prayers: [Prayer.ULTIMATE_STRENGTH, Prayer.INCREDIBLE_REFLEXES] },
    };

    store.updatePlayer({ equipment: { weapon: findItem('Abyssal whip') } });
    expect(store.player.buffs.potions).toEqual([Potion.SUPER_STRENGTH]);
    expect(store.player.prayers).toEqual([Prayer.ULTIMATE_STRENGTH, Prayer.INCREDIBLE_REFLEXES]);
  });

  test('does nothing when the setting is off', () => {
    const store = newStore();
    store.prefs.autoBuffs = false;
    store.updatePlayer({ equipment: { weapon: findItem('Abyssal whip') } });
    expect(store.player.prayers).toEqual([]);
    expect(store.player.buffs.potions).toEqual([]);
  });

  test('loading a saved setup restores its prayers and potions over auto buffs', () => {
    const store = newStore();
    store.updatePlayer({ equipment: { weapon: findItem('Twisted bow') } });
    store.player.prayers = [Prayer.EAGLE_EYE];
    store.player.buffs.potions = [Potion.SUPER_RANGING];
    const setup = store.saveCurrentLoadoutAsSetup('Bow');

    store.updatePlayer({ equipment: { weapon: findItem('Abyssal whip') } });
    expect(store.player.prayers).toEqual([Prayer.PIETY]);

    store.applySavedSetup(setup.id);
    expect(store.player.equipment.weapon?.name).toBe('Twisted bow');
    expect(store.player.prayers).toEqual([Prayer.EAGLE_EYE]);
    expect(store.player.buffs.potions).toEqual([Potion.SUPER_RANGING]);

    // Inside a raid, auto buffs swaps in the raid potion but leaves the prayers alone
    store.updateMonster(findMonster('Zebak'));
    store.applySavedSetup(setup.id);
    expect(store.player.prayers).toEqual([Prayer.EAGLE_EYE]);
    expect(store.player.buffs.potions).toEqual([Potion.SUPER_RANGING, Potion.SMELLING_SALTS]);
  });

  test('raid targets get the raid potion, and switching monster swaps it', () => {
    const store = newStore();
    store.updateMonster(findMonster('Tekton'));
    store.updatePlayer({ equipment: { weapon: findItem('Abyssal whip') } });
    expect(store.player.buffs.potions).toEqual([Potion.OVERLOAD_PLUS]);

    store.updateMonster(findMonster('Zebak'));
    expect(store.player.buffs.potions).toEqual([Potion.SMELLING_SALTS]);

    store.updateMonster(findMonster('Abyssal demon'));
    expect(store.player.buffs.potions).toEqual([Potion.SUPER_COMBAT]);
  });
});
