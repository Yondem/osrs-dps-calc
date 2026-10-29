import { findEquipment, getTestMonster, getTestPlayer } from '@/tests/utils/TestUtils';
import { describe, expect, test } from '@jest/globals';
import { calculateEquipmentBonusesFromGear, isPvpOnlyEquipment } from '@/lib/Equipment';

describe('calculateEquipmentBonusesFromGear', () => {
  describe("with Dizana's quiver", () => {
    describe('with weapon using ammo slot', () => {
      test('applies bonus when charged', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Dizana's quiver", 'Charged'),
            weapon: findEquipment('Twisted bow'),
            ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(98);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(84);
      });

      test('applies bonus when blessed', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Blessed Dizana's quiver", 'Normal'),
            weapon: findEquipment('Twisted bow'),
            ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
          },
          offensive: {
            ranged: 0,
          },
          bonuses: {
            ranged_str: 0,
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(98);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(84);
      });

      test('does not apply bonus when uncharged', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Dizana's quiver", 'Uncharged'),
            weapon: findEquipment('Twisted bow'),
            ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
          },
          offensive: {
            ranged: 0,
          },
          bonuses: {
            ranged_str: 0,
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(88);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(83);
      });
    });
    describe('with weapon not using ammo slot', () => {
      test('does not apply bonus when charged', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Dizana's quiver", 'Charged'),
            weapon: findEquipment('Dragon dart'),
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(18);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(38);
      });

      test('does not apply bonus when blessed', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Blessed Dizana's quiver", 'Normal'),
            weapon: findEquipment('Dragon dart'),
          },
          offensive: {
            ranged: 0,
          },
          bonuses: {
            ranged_str: 0,
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(18);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(38);
      });

      test('does not apply bonus when uncharged', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Dizana's quiver", 'Uncharged'),
            weapon: findEquipment('Dragon dart'),
          },
          offensive: {
            ranged: 0,
          },
          bonuses: {
            ranged_str: 0,
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(18);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(38);
      });
    });
  });
});

describe('isPvpOnlyEquipment', () => {
  test('flags Bounty Hunter, revenant and Deadman items', () => {
    for (const [name, version] of [
      ["Zuriel's robe top (bh)", 'Activated'], ['Barrows gloves (wrapped)', ''], ["Corrupted morrigan's coif (bh)", 'Activated'],
      ['Crystal body (deadman)', 'Active'], ['Voidwaker (Deadman)', ''], ['Dragon mace (bh)', ''],
    ]) {
      expect([name, isPvpOnlyEquipment(findEquipment(name, version))]).toEqual([name, true]);
    }
  });

  test('keeps normal items, including imbues from PvP minigames and wilderness boss drops', () => {
    for (const [name, version] of [
      ['Barrows gloves', ''], ['Archers ring (i)', "Emir's Arena"], ['Slayer helmet (i)', 'Soul Wars'], ["Craw's bow", 'Charged'],
      ['Crystal body', 'Active'], ['Voidwaker', ''],
    ]) {
      expect([name, isPvpOnlyEquipment(findEquipment(name, version))]).toEqual([name, false]);
    }
  });
});
