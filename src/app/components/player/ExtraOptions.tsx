import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import slayer from '@/public/img/misc/slayer.webp';
import skull from '@/public/img/misc/skull.webp';
import diary from '@/public/img/misc/diary.png';
import forinthry_surge from '@/public/img/misc/forinthry_surge.webp';
import soulreaper_axe from '@/public/img/misc/soulreaper_axe.png';
import ba_attacker from '@/public/img/misc/ba_attacker.webp';
import chinchompa from '@/public/img/misc/chinchompa.png';
import thrall from '@/public/img/misc/resurrect_greater_ghost.png';
import NumberInput from '@/app/components/generic/NumberInput';
import MonsterSelect from '@/app/components/monster/MonsterSelect';
import { IconX } from '@tabler/icons-react';
import { toJS } from 'mobx';
import { Thrall } from '@/types/Player';
import { Monster } from '@/types/Monster';
import { INITIAL_MONSTER_INPUTS } from '@/lib/Monsters';
import { getCdnImage } from '@/utils';
import Toggle from '../generic/Toggle';

const THRALL_OPTIONS: [Thrall | null, string][] = [[null, 'Off'], ['lesser', 'Lesser'], ['superior', 'Superior'], ['greater', 'Greater']];

const VENATOR_BOWS = ['Venator bow', 'Echo venator bow'];

const ExtraOptions: React.FC = observer(() => {
  const store = useStore();
  const { player } = store;
  const { weapon } = player.equipment;
  const bounceTargets = player.buffs.bounceTargets ?? [];

  // A bounce target shares the main monster's raid scaling, but not its defence reductions or current HP
  const addBounceTarget = (m: Monster) => store.setBounceTargets([...bounceTargets, {
    ...m,
    inputs: {
      ...store.monster.inputs,
      phase: m.id === store.monster.id ? store.monster.inputs.phase : undefined,
      monsterCurrentHp: m.skills.hp,
      defenceReductions: INITIAL_MONSTER_INPUTS.defenceReductions,
    },
  }]);

  return (
    <div className="px-6 my-4">
      <div className="mt-2 mb-4">
        <Toggle
          checked={player.buffs.onSlayerTask}
          setChecked={(c) => store.updatePlayer({ buffs: { onSlayerTask: c } })}
          label={(
            <>
              <img src={slayer.src} width={18} className="inline-block" alt="" />
              {' '}
              On Slayer task
              {' '}
              <span
                className="align-super underline decoration-dotted cursor-help text-xs text-gray-300"
                data-tooltip-id="tooltip"
                data-tooltip-content="Black mask and slayer helmet give bonuses while you are on a Slayer task."
              >
                ?
              </span>
            </>
          )}
        />
        <Toggle
          checked={player.buffs.inWilderness}
          setChecked={(c) => store.updatePlayer({ buffs: { inWilderness: c } })}
          label={(
            <>
              <img src={skull.src} width={18} className="inline-block" alt="" />
              {' '}
              In the Wilderness
              {' '}
              <span
                className="align-super underline decoration-dotted cursor-help text-xs text-gray-300"
                data-tooltip-id="tooltip"
                data-tooltip-content="Some weapons give bonuses while you are in the Wilderness."
              >
                ?
              </span>
            </>
          )}
        />
        <Toggle
          checked={player.buffs.forinthrySurge}
          setChecked={(c) => store.updatePlayer({ buffs: { forinthrySurge: c } })}
          label={(
            <>
              <img src={forinthry_surge.src} width={18} className="inline-block" alt="" />
              {' '}
              Forinthry Surge
              {' '}
              <span
                className="align-super underline decoration-dotted cursor-help text-xs text-gray-300"
                data-tooltip-id="tooltip"
                data-tooltip-content="Provides a bonus against revenants."
              >
                ?
              </span>
            </>
          )}
        />
        <Toggle
          checked={player.buffs.kandarinDiary}
          setChecked={(c) => store.updatePlayer({ buffs: { kandarinDiary: c } })}
          label={(
            <>
              <img src={diary.src} width={18} className="inline-block" alt="" />
              {' '}
              Kandarin Hard Diary
              {' '}
              <span
                className="align-super underline decoration-dotted cursor-help text-xs text-gray-300"
                data-tooltip-id="tooltip"
                data-tooltip-content="10% activation chance increase to enchanted bolts."
              >
                ?
              </span>
            </>
          )}
        />
        <div className="w-full">
          <NumberInput
            className="form-control w-12"
            required
            min={0}
            max={5}
            value={player.buffs.soulreaperStacks}
            onChange={(v) => store.updatePlayer({ buffs: { soulreaperStacks: v } })}
          />
          <span className="ml-1 text-sm select-none">
            <img src={soulreaper_axe.src} width={18} className="inline-block" alt="" />
            {' '}
            Soul stacks
            {' '}
            <span
              className="align-super underline decoration-dotted cursor-help text-xs text-gray-300"
              data-tooltip-id="tooltip"
              data-tooltip-content="When using the soulreaper axe, every hit gives a soul stack."
            >
              ?
            </span>
          </span>
        </div>
        <div className="w-full">
          <NumberInput
            className="form-control w-12"
            required
            min={0}
            max={5}
            value={player.buffs.baAttackerLevel}
            onChange={(v) => store.updatePlayer({ buffs: { baAttackerLevel: v } })}
          />
          <span className="ml-1 text-sm select-none">
            <img src={ba_attacker.src} className="inline-block h-fit" alt="" />
            {' '}
            BA Attacker level
            {' '}
            <span
              className="align-super underline decoration-dotted cursor-help text-xs text-gray-300"
              data-tooltip-id="tooltip"
              data-tooltip-content="When fighting Penance Fighters and Penance Archers, your attacker level provides extra damage."
            >
              ?
            </span>
          </span>
        </div>
        <div className="w-full">
          <NumberInput
            className="form-control w-12"
            required
            min={1}
            max={10}
            value={player.buffs.chinchompaDistance}
            onChange={(v) => store.updatePlayer({ buffs: { chinchompaDistance: v } })}
          />
          <span className="ml-1 text-sm select-none">
            <img src={chinchompa.src} className="inline-block h-fit" alt="" />
            {' '}
            Chinchompa distance (tiles)
            {' '}
            <span
              className="align-super underline decoration-dotted cursor-help text-xs text-gray-300"
              data-tooltip-id="tooltip"
              data-tooltip-content="When using chinchompas, accuracy is modified based on distance to the target."
            >
              ?
            </span>
          </span>
        </div>
        <div className="w-full mt-1 text-sm">
          <span className="select-none">
            <img src={thrall.src} width={18} className="inline-block" alt="" />
            {' '}
            Thrall
          </span>
          <div className="mt-1 flex gap-1">
            {THRALL_OPTIONS.map(([value, label]) => {
              const on = (player.buffs.thrall ?? null) === value;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  className={`form-control px-2 py-0 ${on ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
                  onClick={() => store.updatePlayer({ buffs: { thrall: value } })}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {weapon && VENATOR_BOWS.includes(weapon.name) && weapon.version === 'Charged' && (
          <div className="w-full mt-2 text-sm">
            <span className="select-none">
              {weapon.image && <img src={getCdnImage(`equipment/${weapon.image}`)} width={18} className="inline-block" alt="" />}
              {' '}
              Bounce targets
            </span>
            {bounceTargets.map((m, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="mt-1 flex items-center gap-1">
                <span className="grow min-w-0 truncate">
                  {m.name}
                  {m.version && <span className="text-xs text-gray-400 dark:text-gray-300">{` #${m.version}`}</span>}
                </span>
                <button
                  type="button"
                  className="text-gray-400 hover:text-red transition-colors"
                  onClick={() => store.setBounceTargets(bounceTargets.filter((_, j) => j !== i))}
                  aria-label={`Remove ${m.name}`}
                >
                  <IconX size={16} />
                </button>
              </div>
            ))}
            {bounceTargets.length < 2 && (
              <div className="mt-1 flex items-center gap-1">
                <div className="grow min-w-0">
                  <MonsterSelect id="bounce-target-select" placeholder="Add a monster..." onSelect={addBounceTarget} />
                </div>
                <button
                  type="button"
                  className="form-control px-2 py-1 whitespace-nowrap"
                  onClick={() => addBounceTarget(toJS(store.monster))}
                >
                  Current monster
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

  );
});

export default ExtraOptions;
