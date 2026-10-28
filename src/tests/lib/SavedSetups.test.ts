import { describe, expect, test } from '@jest/globals';
import { generateEmptyPlayer } from '@/state';
import { availableEquipment } from '@/lib/Equipment';
import { resolveSavedSetupEquipment, savedSetupFromPlayer } from '@/lib/SavedSetups';
import { Prayer } from '@/enums/Prayer';
import Potion from '@/enums/Potion';

const findItem = (id: number) => availableEquipment.find((eq) => eq.id === id)!;

describe('saved setups', () => {
  test('round-trips gear, style and spell through a saved setup', () => {
    const player = generateEmptyPlayer('Melee');
    player.equipment.weapon = findItem(4151); // Abyssal whip
    player.equipment.shield = findItem(12954); // Dragon defender

    const setup = savedSetupFromPlayer(player, 'Whip setup');
    expect(setup.name).toBe('Whip setup');
    expect(setup.equipment.weapon).toEqual({ id: 4151 });
    expect(setup.equipment.head).toBeNull();
    expect(setup.style).toEqual(player.style);

    const equipment = resolveSavedSetupEquipment(setup);
    expect(equipment.weapon?.name).toBe('Abyssal whip');
    expect(equipment.shield?.name).toBe('Dragon defender');
    expect(equipment.head).toBeNull();
  });

  test('keeps blowpipe dart choice', () => {
    const player = generateEmptyPlayer();
    const dart = availableEquipment.find((eq) => eq.name === 'Dragon dart')!;
    player.equipment.weapon = { ...findItem(12926), itemVars: { blowpipeDartName: dart.name, blowpipeDartId: dart.id } };

    const equipment = resolveSavedSetupEquipment(savedSetupFromPlayer(player, 'Blowpipe'));
    expect(equipment.weapon?.itemVars?.blowpipeDartName).toBe('Dragon dart');
  });

  test('remembers prayers and potions', () => {
    const player = generateEmptyPlayer();
    player.prayers = [Prayer.RIGOUR];
    player.buffs.potions = [Potion.RANGING];

    const setup = savedSetupFromPlayer(player, 'Ranged');
    player.prayers.push(Prayer.STEEL_SKIN); // later changes to the loadout must not leak into the setup
    expect(setup.prayers).toEqual([Prayer.RIGOUR]);
    expect(setup.potions).toEqual([Potion.RANGING]);
  });

  test('overwriting keeps the same id', () => {
    const setup = savedSetupFromPlayer(generateEmptyPlayer(), 'Test', 'abc123');
    expect(setup.id).toBe('abc123');
  });
});
