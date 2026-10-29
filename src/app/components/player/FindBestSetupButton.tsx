import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { toast } from 'react-toastify';
import { IconPlus, IconSparkles } from '@tabler/icons-react';
import { useStore } from '@/state';
import Modal from '@/app/components/generic/Modal';
import Toggle from '@/app/components/generic/Toggle';
import {
  availableEquipment, isPvpOnlyEquipment, isSearchableEquipment, wornItemIds,
} from '@/lib/Equipment';
import { AUTO_BUFF_STYLES, AutoBuffStyle } from '@/lib/AutoBuffs';
import { OptimizeResult } from '@/lib/Optimizer';
import { EQUIPMENT_SLOTS, equipmentDisplayName, toSavedSetupItem } from '@/lib/SavedSetups';
import { runOptimizer, OptimizeRun } from '@/worker/OptimizeRunner';
import { SavedSetup } from '@/types/State';
import { getCdnImage } from '@/utils';

const STYLE_LABELS: { [s in AutoBuffStyle]: string } = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic' };

export const resultToSetup = (r: OptimizeResult): SavedSetup => ({
  id: 'best-setup',
  name: r.equipment.weapon ? equipmentDisplayName(r.equipment.weapon) : 'Best setup',
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, toSavedSetupItem(r.equipment[slot])])) as SavedSetup['equipment'],
  style: r.style,
  spellName: r.spell?.name ?? null,
  prayers: r.prayers,
  potions: r.potions,
});

const ResultRow: React.FC<{ result: OptimizeResult, rank: number, currentDps: number, onLoad: (newLoadout: boolean) => void, canCreate: boolean }> = ({
  result, rank, currentDps, onLoad, canCreate,
}) => {
  const { weapon } = result.equipment;
  const diff = currentDps > 0 ? ((result.dps - currentDps) / currentDps) * 100 : null;
  const { name, stance } = result.style;
  const styleLabel = result.spell ? result.spell.name : `${name}${stance && stance !== name ? ` (${stance})` : ''}`;

  return (
    <div className="p-2 rounded border border-body-300 dark:border-dark-200">
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-400 w-5 shrink-0">{rank}</span>
        {weapon?.image && <img src={getCdnImage(`equipment/${weapon.image}`)} alt="" className="max-h-6 max-w-6" />}
        <div className="min-w-0 grow">
          <div className="font-bold truncate">{weapon ? equipmentDisplayName(weapon) : 'Unarmed'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-300">
            {STYLE_LABELS[result.family]}
            {' · '}
            {styleLabel}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold font-mono">{result.dps.toFixed(3)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-300">
            DPS
            {diff !== null && (
              <span className={diff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                {` ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-3 flex-wrap">
        <div className="flex gap-0.5 grow flex-wrap">
          {EQUIPMENT_SLOTS.filter((s) => s !== 'weapon').map((slot) => {
            const eq = result.equipment[slot];
            return eq ? (
              <span key={slot} className="w-6 h-6 flex items-center justify-center rounded bg-body-100 dark:bg-dark-400" title={equipmentDisplayName(eq)}>
                {eq.image && <img src={getCdnImage(`equipment/${eq.image}`)} alt={eq.name} className="max-h-5 max-w-5" />}
              </span>
            ) : null;
          })}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-300">
          {`Max hit ${result.maxHit} · ${(result.accuracy * 100).toFixed(1)}% acc.`}
        </span>
        <div className="flex gap-1">
          <button type="button" className="form-control px-2 py-0.5 font-bold hover:scale-105 transition-transform" onClick={() => onLoad(false)}>
            Load
          </button>
          {canCreate && (
            <button
              type="button"
              className="form-control px-1 py-0.5 hover:scale-105 transition-transform"
              onClick={() => onLoad(true)}
              data-tooltip-id="tooltip"
              data-tooltip-content="Load into a new loadout"
            >
              <IconPlus size={16} aria-label="Load into a new loadout" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const FindBestSetupButton: React.FC = observer(() => {
  const store = useStore();
  const { bank, ownedEquipmentIds, hiddenEquipmentIds } = store;
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState<'bank' | 'all'>('bank');
  const [styles, setStyles] = useState<AutoBuffStyle[]>(AUTO_BUFF_STYLES);
  const [useAutoBuffs, setUseAutoBuffs] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<OptimizeResult[] | null>(null);
  const run = useRef<OptimizeRun | null>(null);

  const useBank = source === 'bank' && !!bank;
  const currentDps = store.calc.loadouts[store.selectedLoadout]?.dps ?? 0;

  // Stop a running search if the dialog is closed
  useEffect(() => {
    if (!isOpen) {
      run.current?.cancel();
      run.current = null;
      setProgress(null);
    }
  }, [isOpen]);

  const search = async () => {
    const worn = wornItemIds(store.player.equipment);
    const poolIds = availableEquipment
      // All items leaves out PvP-only gear, unless you own it
      .filter((eq) => (useBank || isPvpOnlyEquipment(eq) ? ownedEquipmentIds?.has(eq.id) || worn.includes(eq.id) : true))
      .filter((eq) => isSearchableEquipment(eq) && !hiddenEquipmentIds.has(eq.id))
      .map((eq) => eq.id);

    run.current?.cancel();
    setResults(null);
    setProgress(0);
    const thisRun = runOptimizer({
      player: toJS(store.player),
      monster: toJS(store.monster),
      poolIds,
      styles,
      buffsConfig: useAutoBuffs ? toJS(store.prefs.autoBuffsConfig) : null,
      resultsPerStyle: 5,
    }, setProgress);
    run.current = thisRun;

    try {
      const found = await thisRun.promise;
      if (run.current === thisRun) setResults(found);
    } catch (e) {
      console.error(e);
      toast.error('The search failed. Check the console for details.', { toastId: 'optimizer-error' });
    } finally {
      if (run.current === thisRun) {
        run.current = null;
        setProgress(null);
      }
    }
  };

  const load = (result: OptimizeResult, newLoadout: boolean) => {
    if (newLoadout) store.createLoadout(true, store.selectedLoadout);
    store.applySetup(resultToSetup(result), false);
    setIsOpen(false);
    toast.success(`Loaded ${resultToSetup(result).name} setup`, { toastId: 'optimizer-load' });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSource(bank ? 'bank' : 'all');
          setIsOpen(true);
        }}
        className="text-body-500 dark:text-dark-100 hover:text-orange-400 transition-colors"
        data-tooltip-id="tooltip"
        data-tooltip-content="Find best setup"
      >
        <IconSparkles aria-label="Find best setup" />
      </button>
      <Modal
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        maxWidth="max-w-2xl"
        title={(
          <div className="flex gap-2 items-center">
            <IconSparkles />
            Find best setup
          </div>
        )}
      >
        <div className="text-sm">
          <p className="mb-3">
            {'Searches for the highest DPS gear against '}
            <span className="font-bold">{store.monster.name}</span>
            {', using this loadout\'s stats and other buffs.'}
          </p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-3">
            <div>
              <p className="font-bold mb-1">Items</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={!bank}
                  className={`form-control px-3 py-1 ${useBank ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
                  onClick={() => setSource('bank')}
                >
                  My bank
                </button>
                <button
                  type="button"
                  className={`form-control px-3 py-1 ${!useBank ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
                  onClick={() => setSource('all')}
                >
                  All items
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                {bank
                  ? 'My bank also includes what this loadout is wearing. Filtered items are always skipped.'
                  : 'Import your bank in Settings to search only items you own.'}
              </p>
            </div>
            <div>
              <p className="font-bold mb-1">Styles</p>
              <div className="flex gap-1">
                {AUTO_BUFF_STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`form-control px-3 py-1 ${styles.includes(s) ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
                    onClick={() => setStyles(styles.includes(s) ? styles.filter((x) => x !== s) : [...styles, s])}
                  >
                    {STYLE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Toggle
            checked={useAutoBuffs}
            setChecked={setUseAutoBuffs}
            label="Use my auto buffs prayers and potions for each style"
            help="Off: every setup is scored with this loadout's current prayers and potions."
          />
          <button
            type="button"
            disabled={styles.length === 0 || progress !== null}
            className="form-control mt-2 w-full flex justify-center items-center gap-1 py-2 font-bold hover:scale-[1.02] transition-transform"
            onClick={search}
          >
            <IconSparkles className="w-5" />
            {progress !== null ? 'Searching...' : 'Find best setup'}
          </button>
          {progress !== null && (
            <div className="mt-2 h-2 rounded bg-body-200 dark:bg-dark-400 overflow-hidden">
              <div className="h-full bg-green-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          {results && (
            <div className="mt-3 flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1">
              {results.length === 0 && <p className="italic text-gray-500">No setups found. Try more styles or All items.</p>}
              {results.map((r, i) => (
                <ResultRow
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  result={r}
                  rank={i + 1}
                  currentDps={currentDps}
                  canCreate={store.canCreateLoadout}
                  onLoad={(newLoadout) => load(r, newLoadout)}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
});

export default FindBestSetupButton;
