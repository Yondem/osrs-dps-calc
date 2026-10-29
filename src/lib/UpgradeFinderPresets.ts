import type { UpgradeFinderTarget } from '@/types/State';

export interface UpgradeFinderPreset {
  label: string;
  description: string;
  targets: UpgradeFinderTarget[];
}

const ALL_BUT_MELEE: UpgradeFinderTarget['styles'] = ['ranged', 'magic'];

/**
 * Monster lists for the upgrade finder, one kill of each boss per run. Raid settings (party size, raid level, ...) are
 * set separately for the whole list, and kills per run and usable styles can be changed per monster.
 */
export const UPGRADE_FINDER_PRESETS: UpgradeFinderPreset[] = [
  {
    label: 'TFA',
    description: 'The TFA bosses. Archive Guardian is split between its flying and grounded forms.',
    targets: [
      { id: 16659, version: 'Grounded', weight: 0.5 },
      { id: 16659, version: 'Flying', weight: 0.5 },
      { id: 16643, version: '', weight: 1 },
      { id: 16647, version: 'Book', weight: 1 },
      { id: 16645, version: 'Staff', weight: 1 },
      { id: 16641, version: '', weight: 1 },
      { id: 16640, version: '', weight: 1 },
      {
        id: 16665, version: '', weight: 1, styles: ALL_BUT_MELEE,
      }, // Dreadnoth can't really be meleed
      { id: 16652, version: '', weight: 1 },
      { id: 16667, version: '', weight: 1 },
      { id: 16684, version: '', weight: 1 },
      { id: 16673, version: 'Phase 1', weight: 1 },
      { id: 16675, version: 'Phase 2', weight: 1 },
      { id: 16677, version: 'Phase 3', weight: 1 },
    ],
  },
  {
    label: 'ToA',
    description: 'Tombs of Amascut: the four path bosses, the obelisk and both warden phases.',
    targets: [
      { id: 11789, version: '', weight: 1 }, // Akkha
      { id: 11778, version: '', weight: 1 }, // Ba-Ba
      { id: 11719, version: 'Shielded', weight: 1 }, // Kephri
      { id: 11730, version: 'Normal', weight: 1 }, // Zebak
      { id: 11751, version: '', weight: 1 }, // Obelisk (P1)
      { id: 11756, version: 'Active', weight: 1 }, // Tumeken's Warden (P2)
      { id: 11762, version: 'Damaged', weight: 1 }, // Tumeken's Warden (P3)
    ].map((t) => ({ ...t, inputs: { toaInvocationLevel: 300, toaPathLevel: 3 } })),
  },
  ...(['Normal', 'Hard'] as const).map((mode) => {
    const hard = mode === 'Hard';
    return {
      label: hard ? 'ToB HM' : 'ToB',
      description: `Theatre of Blood${hard ? ' (Hard Mode)' : ''}: every boss, and Verzik's second and third phases.`,
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
    label: 'CoX',
    description: 'Chambers of Xeric: the common combat rooms and Olm. Rooms vary between raids, so set kills per run to match yours.',
    targets: [
      { id: 7540, version: 'Normal', weight: 1 }, // Tekton
      { id: 7527, version: 'Melee', weight: 1 }, // Vanguards
      { id: 7528, version: 'Ranged', weight: 1 },
      { id: 7529, version: 'Magic', weight: 1 },
      { id: 7566, version: 'Normal', weight: 1 }, // Vasa Nistirio
      {
        id: 7530, version: 'Normal', weight: 1, styles: ALL_BUT_MELEE,
      }, // Vespula flies
      { id: 7561, version: 'Large', weight: 1 }, // Muttadiles
      { id: 7562, version: 'Small', weight: 1 },
      { id: 7584, version: 'Normal', weight: 1 }, // Ice demon
      { id: 7573, version: 'Normal', weight: 3 }, // Lizardman shamans
      { id: 7604, version: 'Normal', weight: 3 }, // Skeletal mystics
      { id: 7550, version: 'Right claw (Normal)', weight: 1 }, // Olm
      { id: 7552, version: 'Left claw (Normal)', weight: 1 },
      { id: 7551, version: 'Head (Normal)', weight: 1 },
    ].map((t) => ({ ...t, inputs: { partySize: 1, isFromCoxCm: false } })),
  },
];
