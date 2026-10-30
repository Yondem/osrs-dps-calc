import { describe, expect, test } from '@jest/globals';
import { findEquipment, getTestMonster, getTestPlayer } from '@/tests/utils/TestUtils';
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import { Thrall } from '@/types/Player';
import { Monster } from '@/types/Monster';
import { SECONDS_PER_TICK } from '@/lib/constants';

const calcWith = (thrall: Thrall | null, monster: Monster = getTestMonster('Abyssal demon', 'Standard')) => {
  const player = getTestPlayer(monster, {
    equipment: { weapon: findEquipment('Abyssal whip') },
    buffs: { thrall },
  });
  return new PlayerVsNPCCalc(player, monster);
};

const meanTtk = (calc: PlayerVsNPCCalc) => [...calc.getTtkDistribution()]
  .reduce((acc, [ticks, p]) => acc + ticks * p, 0) * SECONDS_PER_TICK;

describe('thralls', () => {
  test('add their average damage per second to the DPS', () => {
    const without = calcWith(null).getDps();
    expect(calcWith('lesser').getDps() - without).toBeCloseTo(0.5 / 2.4, 9);
    expect(calcWith('superior').getDps() - without).toBeCloseTo(1 / 2.4, 9);
    expect(calcWith('greater').getDps() - without).toBeCloseTo(1.5 / 2.4, 9);
  });

  test("don't damage kurasks and turoths", () => {
    for (const monster of [getTestMonster('Kurask', 'Normal'), getTestMonster('Turoth', 'Mum')]) {
      expect(calcWith('greater', monster).getDps()).toBeCloseTo(calcWith(null, monster).getDps(), 9);
    }
  });

  test('speed up the kill, in both the average and the kill time distribution', () => {
    const without = calcWith(null);
    const greater = calcWith('greater');

    expect(greater.getTtk()).toBeLessThan(without.getTtk());
    expect(meanTtk(greater)).toBeLessThan(meanTtk(without));
    // The distribution counts the first attack as tick 1, so its mean is a few ticks off the average kill time. The
    // thrall shouldn't change that offset.
    expect(meanTtk(greater) - greater.getTtk()).toBeCloseTo(meanTtk(without) - without.getTtk(), 1);
  });

  test('leave special attack DPS out of it', () => {
    const monster = getTestMonster('Abyssal demon', 'Standard');
    const spec = (thrall: Thrall | null) => new PlayerVsNPCCalc(
      getTestPlayer(monster, { equipment: { weapon: findEquipment('Dragon claws') }, buffs: { thrall } }),
      monster,
    ).getSpecDps();

    expect(spec('greater')).toBeCloseTo(spec(null), 9);
  });
});
