import type { UpgradeFinderTarget } from '@/types/State';

export interface UpgradeFinderPreset {
  label: string;
  targets: UpgradeFinderTarget[];
}

const ALL_BUT_MELEE: UpgradeFinderTarget['styles'] = ['ranged', 'magic'];

/**
 * Monster lists for the upgrade finder, in release order, one kill of each boss per run. Each list's monsters are in
 * the order you fight them (CoX in its Challenge Mode layout). Raid settings (party size, raid level, ...) are set
 * separately for the whole list, and kills per run and usable styles can be changed per monster.
 */
export const UPGRADE_FINDER_PRESETS: UpgradeFinderPreset[] = [
  {
    label: 'CoX',
    targets: [
      { id: 7540, version: 'Normal', weight: 1 }, // Tekton
      { id: 7584, version: 'Normal', weight: 1 }, // Ice demon
      { id: 7573, version: 'Normal', weight: 3 }, // Lizardman shamans
      { id: 7527, version: 'Melee', weight: 1 }, // Vanguards
      { id: 7528, version: 'Ranged', weight: 1 },
      { id: 7529, version: 'Magic', weight: 1 },
      {
        id: 7530, version: 'Normal', weight: 1, styles: ALL_BUT_MELEE,
      }, // Vespula flies
      { id: 7566, version: 'Normal', weight: 1 }, // Vasa Nistirio
      { id: 7604, version: 'Normal', weight: 3 }, // Skeletal mystics
      { id: 7562, version: 'Small', weight: 1 }, // Muttadiles
      { id: 7561, version: 'Large', weight: 1 },
      { id: 7550, version: 'Right claw (Normal)', weight: 1 }, // Olm
      { id: 7552, version: 'Left claw (Normal)', weight: 1 },
      { id: 7551, version: 'Head (Normal)', weight: 1 },
    ].map((t) => ({ ...t, inputs: { partySize: 1, isFromCoxCm: false } })),
  },
  ...(['Normal', 'Hard'] as const).map((mode) => {
    const hard = mode === 'Hard';
    return {
      label: hard ? 'ToB HM' : 'ToB',
      targets: [
        { id: hard ? 10822 : 8360, version: hard ? 'Hard Mode' : 'Normal', weight: 1 }, // Maiden
        { id: hard ? 10813 : 8359, version: mode, weight: 1 }, // Bloat
        { id: hard ? 10807 : 8354, version: mode, weight: 1 }, // Nylocas Vasilias
        { id: hard ? 10867 : 8387, version: mode, weight: 1 }, // Sotetseg
        {
          id: hard ? 10772 : 8340, version: `${mode} mode`, weight: 1, styles: ALL_BUT_MELEE,
        }, // Xarpus can't be meleed
        { id: hard ? 10850 : 8372, version: `${mode} mode, Phase 2`, weight: 1 }, // Verzik
        { id: hard ? 10852 : 8374, version: `${mode} mode, Phase 3`, weight: 1 },
      ].map((t) => ({ ...t, inputs: { partySize: 4 } })),
    };
  }),
  {
    label: 'ToA',
    targets: [
      { id: 11778, version: '', weight: 1 }, // Ba-Ba
      { id: 11719, version: 'Shielded', weight: 1 }, // Kephri
      { id: 11789, version: '', weight: 1 }, // Akkha
      { id: 11730, version: 'Normal', weight: 1 }, // Zebak
      { id: 11751, version: '', weight: 1 }, // Obelisk (P1)
      { id: 11756, version: 'Active', weight: 1 }, // Tumeken's Warden (P2)
      { id: 11762, version: 'Damaged', weight: 1 }, // Tumeken's Warden (P3)
    ].map((t) => ({ ...t, inputs: { toaInvocationLevel: 300, toaPathLevel: 3 } })),
  },
  {
    label: 'TFA',
    targets: [
      { id: 16659, version: 'Grounded', weight: 0.5 }, // Archive Guardian
      { id: 16659, version: 'Flying', weight: 0.5 },
      { id: 16652, version: '', weight: 1 }, // Ezekiel
      { id: 16640, version: '', weight: 1 }, // Bork
      { id: 16641, version: '', weight: 1 }, // The Smorks
      { id: 16667, version: '', weight: 1 }, // Moia
      {
        id: 16665, version: '', weight: 1, styles: ALL_BUT_MELEE,
      }, // Dreadnoth can't really be meleed
      { id: 16643, version: '', weight: 1 }, // Dagon'hai Elder
      { id: 16647, version: 'Book', weight: 1 }, // Dagon'hai Monks
      { id: 16645, version: 'Staff', weight: 1 },
      { id: 16684, version: '', weight: 1 }, // Xarth
      { id: 16673, version: 'Phase 1', weight: 1 }, // Ocellus
      { id: 16675, version: 'Phase 2', weight: 1 },
      { id: 16677, version: 'Phase 3', weight: 1 },
    ],
  },
];

const targetKey = (t: UpgradeFinderTarget) => `${t.id}|${t.version}`;

/**
 * A list's monsters in its preset's order, so lists saved before a preset was reordered follow the new order. Monsters
 * the preset doesn't have keep their order, after the preset's.
 */
export const inPresetOrder = (targets: UpgradeFinderTarget[], preset: UpgradeFinderPreset): UpgradeFinderTarget[] => {
  const rank = new Map(preset.targets.map((t, i) => [targetKey(t), i]));
  const rankOf = (t: UpgradeFinderTarget) => rank.get(targetKey(t)) ?? preset.targets.length;
  return [...targets].sort((a, b) => rankOf(a) - rankOf(b));
};
