import { describe, expect, test } from '@jest/globals';
import { findEquipment, getTestMonster, getTestPlayer } from '@/tests/utils/TestUtils';
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import { Monster } from '@/types/Monster';
import { SECONDS_PER_TICK } from '@/lib/constants';

const target = getTestMonster('Abyssal demon', 'Standard');

const equipment = (bow = findEquipment('Venator bow', 'Charged')) => ({ weapon: bow, ammo: findEquipment('Dragon arrow', 'Unpoisoned') });

const calcWith = (bounceTargets: Monster[], bow = findEquipment('Venator bow', 'Charged')) => new PlayerVsNPCCalc(
  getTestPlayer(target, { equipment: equipment(bow), buffs: { bounceTargets } }),
  target,
);

// The expected damage per second of one bounce on a monster
const bounceDps = (calc: PlayerVsNPCCalc, accuracy: number) => {
  const max = Math.trunc((2 * calc.getMinAndMax()[1]) / 3);
  return (accuracy * (max / 2)) / calc.getExpectedAttackSpeed() / SECONDS_PER_TICK;
};

describe('Venator bow bounces', () => {
  test("don't happen without bounce targets", () => {
    const calc = calcWith([]);
    expect(calc.getTotalDps()).toBeUndefined();
    expect(calc.getDistribution().dists).toHaveLength(1);
  });

  test('come back to the target when there is one other monster', () => {
    const single = calcWith([]);
    const calc = calcWith([target]);

    expect(calc.getDps() - single.getDps()).toBeCloseTo(bounceDps(calc, calc.getHitChance()), 9);
    expect(calc.getTtk()).toBeLessThan(single.getTtk());
    // The first bounce lands on the other monster
    expect(calc.getTotalDps()!).toBeCloseTo(calc.getDps() + bounceDps(calc, calc.getHitChance()), 9);
  });

  test('both go to other monsters when there are two, each with its own accuracy', () => {
    const single = calcWith([]);
    const weak = getTestMonster('Cow');
    const calc = calcWith([target, weak]);
    const weakAccuracy = new PlayerVsNPCCalc(getTestPlayer(weak, { equipment: equipment() }), weak).getHitChance();

    expect(calc.getDps()).toBeCloseTo(single.getDps(), 9);
    expect(weakAccuracy).toBeGreaterThan(calc.getHitChance());
    expect(calc.getTotalDps()!).toBeCloseTo(
      calc.getDps() + bounceDps(calc, calc.getHitChance()) + bounceDps(calc, weakAccuracy),
      9,
    );
  });

  test('need a charged bow, and work with the Echo venator bow', () => {
    expect(calcWith([target], findEquipment('Venator bow', 'Uncharged')).getTotalDps()).toBeUndefined();
    expect(calcWith([target], findEquipment('Echo venator bow', 'Charged')).getTotalDps()).toBeDefined();
  });
});
