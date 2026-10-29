import { describe, expect, test } from '@jest/globals';
import { getMonsters, INITIAL_MONSTER_INPUTS } from '@/lib/Monsters';
import { scaleMonster } from '@/lib/MonsterScaling';
import { UPGRADE_FINDER_PRESETS } from '@/lib/UpgradeFinderPresets';
import { Monster } from '@/types/Monster';
import { UpgradeFinderTarget } from '@/types/State';

const monsters = getMonsters();
const preset = (label: string) => UPGRADE_FINDER_PRESETS.find((p) => p.label === label)!;
const build = (t: UpgradeFinderTarget): Monster => {
  const m = monsters.find((x) => x.id === t.id && (x.version || '') === t.version)!;
  return { ...m, inputs: { ...INITIAL_MONSTER_INPUTS, ...t.inputs } };
};

describe('UPGRADE_FINDER_PRESETS', () => {
  test('every monster exists', () => {
    for (const p of UPGRADE_FINDER_PRESETS) {
      for (const t of p.targets) {
        const found = monsters.some((m) => m.id === t.id && (m.version || '') === t.version);
        expect([p.label, t.id, t.version, found]).toEqual([p.label, t.id, t.version, true]);
      }
    }
  });

  test('raid presets set their scaling', () => {
    const akkha = build(preset('ToA').targets[0]);
    // 400 hp, +120% at raid level 300, +18% at path level 3
    expect(scaleMonster(akkha).skills.hp).toBe(1040);

    const maiden = build(preset('ToB').targets[0]);
    expect(scaleMonster(maiden).skills.hp).toBe(Math.trunc((3500 * 7) / 8)); // party of 4

    const tekton = build(preset('CoX').targets[0]);
    const cm = { ...tekton, inputs: { ...tekton.inputs, isFromCoxCm: true } };
    expect(scaleMonster(cm).skills.def).toBeGreaterThan(scaleMonster(tekton).skills.def);
  });
});
