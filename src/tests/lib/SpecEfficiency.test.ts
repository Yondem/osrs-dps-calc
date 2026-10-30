import { describe, expect, test } from '@jest/globals';
import { findEquipment, getTestMonster, getTestPlayer } from '@/tests/utils/TestUtils';
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';

const specCalc = (weapon: string) => {
  const monster = getTestMonster('Abyssal demon', 'Standard');
  const player = getTestPlayer(monster, { equipment: { weapon: findEquipment(weapon) } });
  return new PlayerVsNPCCalc(player, monster).getSpecCalc()!;
};

describe('getSpecDamagePerEnergy', () => {
  test("is the spec's expected hit per 1% of energy it costs", () => {
    const dragon = specCalc('Dragon claws');
    const burning = specCalc('Burning claws');

    expect(dragon.getSpecDamagePerEnergy()).toBeCloseTo(dragon.getExpectedDamage() / 50, 9);
    // Burning claws' expected hit includes the burn
    expect(burning.getSpecDamagePerEnergy()).toBeCloseTo(burning.getExpectedDamage() / 35, 9);
  });

  test("is left out for specs that don't cost energy", () => {
    expect(specCalc('Soulreaper axe').getSpecDamagePerEnergy()).toBeUndefined();
  });
});
