import { describe, expect, test } from '@jest/globals';
import { findEquipment, getTestMonster, getTestPlayer } from '@/tests/utils/TestUtils';
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import { EquipmentPiece } from '@/types/Player';
import { getDefaultCombatStyle } from '@/utils';
import { SECONDS_PER_TICK } from '@/lib/constants';

const monster = getTestMonster('Abyssal demon', 'Standard', { inputs: { monsterCurrentHp: 1000 } });
const claws = findEquipment('Dragon claws');

const calcWith = (specWeapon: EquipmentPiece | null, ring: EquipmentPiece | null = null, specDowntime = 0) => new PlayerVsNPCCalc(
  getTestPlayer(monster, {
    equipment: { weapon: findEquipment('Abyssal whip'), ring },
    buffs: { specWeapon, specDowntime },
  }),
  monster,
);

describe('getSpecRotation', () => {
  test('is left out without a spec weapon', () => {
    expect(calcWith(null).getSpecRotation()).toBeUndefined();
  });

  test("adds the spec's damage over the main weapon's, for the energy regenerated", () => {
    const calc = calcWith(claws);
    const spec = new PlayerVsNPCCalc(
      getTestPlayer(monster, { equipment: { weapon: claws }, style: getDefaultCombatStyle(claws.category) }),
      monster,
    ).getSpecCalc()!;
    const net = (spec.getExpectedDamage() - calc.getAttackDps() * spec.getExpectedAttackSpeed() * SECONDS_PER_TICK) / 50;

    const rotation = calc.getSpecRotation()!;
    expect(rotation.dps).toBeCloseTo(calc.getDps() + net * (10 / 30), 6);
    expect(rotation.ttk).toBeLessThan(calc.getTtk());
  });

  test('regenerates energy twice as fast with a Lightbearer', () => {
    const plain = calcWith(claws).getSpecRotation()!;
    const lightbearer = calcWith(claws, findEquipment('Lightbearer')).getSpecRotation()!;
    const base = calcWith(claws).getDps();

    expect(lightbearer.dps - base).toBeCloseTo(2 * (plain.dps - base), 6);
  });

  test('banks energy during downtime, up to 100%', () => {
    const none = calcWith(claws, null, 0).getSpecRotation()!;
    const full = calcWith(claws, null, 300).getSpecRotation()!; // 300s at 10% per 30s is a full bar
    const longer = calcWith(claws, null, 1000).getSpecRotation()!;

    expect(full.ttk).toBeLessThan(none.ttk);
    expect(longer.ttk).toBeCloseTo(full.ttk, 9);
  });
});
