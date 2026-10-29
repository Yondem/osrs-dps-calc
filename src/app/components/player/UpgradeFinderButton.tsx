import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { toast } from 'react-toastify';
import {
  IconCheck, IconChevronDown, IconPlus, IconTrendingUp, IconX,
} from '@tabler/icons-react';
import { useStore } from '@/state';
import Modal from '@/app/components/generic/Modal';
import Toggle from '@/app/components/generic/Toggle';
import {
  availableEquipment, isPvpOnlyEquipment, isSearchableEquipment, wornItemIds,
} from '@/lib/Equipment';
import { AUTO_BUFF_STYLES, AutoBuffStyle } from '@/lib/AutoBuffs';
import {
  combineUpgrades, CombinedUpgrade, killTime, MonsterUpgrades, UpgradeTarget,
} from '@/lib/UpgradeFinder';
import { INITIAL_MONSTER_INPUTS } from '@/lib/Monsters';
import { scaleMonster } from '@/lib/MonsterScaling';
import { MONSTER_PHASES_BY_ID, PARTY_SIZE_REQUIRED_MONSTER_IDS, TOMBS_OF_AMASCUT_MONSTER_IDS } from '@/lib/constants';
import { MonsterAttribute } from '@/enums/MonsterAttribute';
import { UPGRADE_FINDER_PRESETS } from '@/lib/UpgradeFinderPresets';
import { equipmentDisplayName } from '@/lib/SavedSetups';
import { runUpgradeFinder, UpgradeRun } from '@/worker/UpgradeRunner';
import { resultToSetup } from '@/app/components/player/FindBestSetupButton';
import { Monster } from '@/types/Monster';
import { EquipmentPiece } from '@/types/Player';
import { UpgradeFinderTarget } from '@/types/State';
import { getCdnImage } from '@/utils';
import NumberInput from '@/app/components/generic/NumberInput';
import vuln from '@/public/img/def_reductions/Vulnerability.png';
import bgs from '@/public/img/def_reductions/Bandos_godsword.webp';
import sceptre from '@/public/img/def_reductions/Accursed sceptre.png';
import elderMaul from '@/public/img/def_reductions/Elder_maul.png';
import tonalztic from '@/public/img/def_reductions/Tonalztics_of_ralos.png';
import dwh from '@/public/img/def_reductions/Dragon_warhammer.webp';
import arc from '@/public/img/def_reductions/Arclight.png';
import emberlight from '@/public/img/def_reductions/Emberlight.png';
import seercull from '@/public/img/def_reductions/Seercull.png';
import ayak from '@/public/img/def_reductions/Eye_of_ayak.png';
import attackIcon from '@/public/img/bonuses/attack.png';
import rangedIcon from '@/public/img/bonuses/ranged.png';
import magicIcon from '@/public/img/bonuses/magic.png';

const STYLE_ICONS: { [s in AutoBuffStyle]: { src: string } } = { melee: attackIcon, ranged: rangedIcon, magic: magicIcon };

const STYLE_LABELS: { [s in AutoBuffStyle]: string } = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic' };

type RaidInputs = Pick<Monster['inputs'], 'partySize' | 'toaInvocationLevel' | 'toaPathLevel' | 'isFromCoxCm'>;

/**
 * Raid scaling for the whole monster list, shown when it has raid monsters: party size, ToA raid and path level and
 * CoX Challenge Mode. The values shown are the first monster's of each raid.
 */
const RaidSettings: React.FC<{
  monsters: Monster[],
  onChange: (changes: Partial<RaidInputs>) => void,
}> = ({ monsters, onChange }) => {
  const toa = monsters.filter((m) => TOMBS_OF_AMASCUT_MONSTER_IDS.includes(m.id));
  const cox = monsters.filter((m) => m.attributes.includes(MonsterAttribute.XERICIAN));
  const party = monsters.filter((m) => PARTY_SIZE_REQUIRED_MONSTER_IDS.includes(m.id) || cox.includes(m));
  if (party.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="font-bold">Raid settings</span>
      <span className="flex items-center gap-1">
        <NumberInput
          className="form-control w-12 px-1 py-0"
          min={1}
          max={100}
          value={party[0].inputs.partySize}
          onChange={(v) => onChange({ partySize: v })}
          aria-label="Party size"
        />
        Party size
      </span>
      {toa.length > 0 && (
        <>
          <span className="flex items-center gap-1">
            <NumberInput
              className="form-control w-14 px-1 py-0"
              min={0}
              max={600}
              step={5}
              value={toa[0].inputs.toaInvocationLevel}
              onChange={(v) => onChange({ toaInvocationLevel: v })}
              aria-label="ToA raid level"
            />
            ToA raid level
          </span>
          <span className="flex items-center gap-1">
            <NumberInput
              className="form-control w-10 px-1 py-0"
              min={0}
              max={6}
              value={toa[0].inputs.toaPathLevel}
              onChange={(v) => onChange({ toaPathLevel: v })}
              aria-label="ToA path level"
            />
            Path level
          </span>
        </>
      )}
      {cox.length > 0 && (
        <Toggle
          className="!mb-0"
          checked={cox[0].inputs.isFromCoxCm}
          setChecked={(c) => onChange({ isFromCoxCm: c })}
          label="CoX Challenge Mode"
        />
      )}
    </div>
  );
};

const SLOT_LABELS: Record<string, string> = {
  weapon: 'Weapon',
  head: 'Head',
  cape: 'Cape',
  neck: 'Neck',
  ammo: 'Ammo',
  body: 'Body',
  shield: 'Shield',
  legs: 'Legs',
  hands: 'Hands',
  feet: 'Feet',
  ring: 'Ring',
};

type DefenceReductions = Monster['inputs']['defenceReductions'];
type ReductionAmount = Exclude<keyof DefenceReductions, 'accursed' | 'vulnerability'>;

const REDUCTION_AMOUNTS: { key: ReductionAmount, label: string, icon: { src: string } }[] = [
  { key: 'dwh', label: 'DWH hits', icon: dwh },
  { key: 'elderMaul', label: 'Elder maul hits', icon: elderMaul },
  { key: 'arclight', label: 'Arclight hits', icon: arc },
  { key: 'emberlight', label: 'Emberlight hits', icon: emberlight },
  { key: 'tonalztic', label: 'Tonalztics hits', icon: tonalztic },
  { key: 'bgs', label: 'BGS damage', icon: bgs },
  { key: 'seercull', label: 'Seercull damage', icon: seercull },
  { key: 'ayak', label: 'Ayak damage', icon: ayak },
];

const targetReductions = (t: UpgradeFinderTarget): DefenceReductions => ({
  ...INITIAL_MONSTER_INPUTS.defenceReductions, ...t.inputs?.defenceReductions,
});

/**
 * The defence reductions set on a monster in the list, as small icons with amounts.
 */
const ReductionSummary: React.FC<{ reductions: DefenceReductions }> = ({ reductions }) => {
  const parts = [
    ...REDUCTION_AMOUNTS.filter((r) => reductions[r.key] > 0).map((r) => ({ key: r.key, icon: r.icon, text: `${reductions[r.key]}` })),
    ...(reductions.accursed ? [{ key: 'accursed', icon: sceptre, text: '' }] : []),
    ...(reductions.vulnerability ? [{ key: 'vulnerability', icon: vuln, text: '' }] : []),
  ];
  if (parts.length === 0) return <span className="text-gray-500 dark:text-gray-300">def. red.</span>;
  return (
    <span className="flex items-center gap-1">
      {parts.map((p) => (
        <span key={p.key} className="flex items-center">
          <img src={p.icon.src} width={14} alt="" />
          {p.text}
        </span>
      ))}
    </span>
  );
};

const monsterLabel = (m: Pick<Monster, 'name' | 'version'>) => `${m.name}${m.version ? ` (${m.version})` : ''}`;

interface Target extends UpgradeTarget {
  monster: Monster;
  label: string;
  styles: AutoBuffStyle[]; // combat styles you can use on it
}

interface Results {
  targets: Target[];
  analyses: MonsterUpgrades[];
  upgrades: CombinedUpgrade[];
}

// Where an upgrade goes: the slot of its first item, or "set" for several armour pieces
const upgradeCategory = (u: CombinedUpgrade) => (u.items.length > 1 && u.items[0].slot !== 'weapon' ? 'set' : u.items[0].slot);

const categoryLabel = (c: string) => ({ all: 'All', set: 'Sets' }[c] ?? SLOT_LABELS[c] ?? c);

/**
 * Kill time per run with the best owned setups, leaving out monsters nothing owned can damage.
 */
const ownedKillTime = ({ targets, analyses }: Pick<Results, 'targets' | 'analyses'>) => {
  const times = targets.map((t, i) => (t.weight > 0 ? killTime(t, analyses[i].baseline?.dps ?? 0) : 0));
  return {
    total: times.filter(Number.isFinite).reduce((a, b) => a + b, 0),
    unkillable: targets.filter((_, i) => !Number.isFinite(times[i])),
  };
};

const formatSeconds = (s: number) => (Number.isFinite(s) ? `${s.toFixed(1)}s` : '∞');

const pct = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : Infinity);

const formatPct = (p: number, sign = '+') => (Number.isFinite(p) ? `${sign}${Math.abs(p).toFixed(1)}%` : 'new');

const ItemIcon: React.FC<{ eq: EquipmentPiece | null | undefined, size?: number }> = ({ eq, size = 6 }) => (eq?.image ? (
  <img
    src={getCdnImage(`equipment/${eq.image}`)}
    alt={eq.name}
    title={equipmentDisplayName(eq)}
    style={{ maxWidth: `${size * 4}px`, maxHeight: `${size * 4}px` }}
  />
) : null);

const UpgradeRow: React.FC<{
  upgrade: CombinedUpgrade,
  rank: number,
  results: Results,
  single: boolean,
  expanded: boolean,
  toggle: () => void,
  onAssumeOwned: () => void,
  onLoad: (targetIndex: number) => void,
}> = ({
  upgrade, rank, results, single, expanded, toggle, onAssumeOwned, onLoad,
}) => {
  const { targets, analyses } = results;
  const totalBefore = ownedKillTime(results).total;
  const gains = upgrade.perTarget
    .map((u, i) => ({ i, u, gain: u ? pct(analyses[i].baseline?.dps ?? 0, u.dps) : 0 }))
    .filter((g) => g.u)
    .sort((a, b) => b.gain - a.gain);
  const name = upgrade.items.map((eq) => equipmentDisplayName(eq)).join(' + ');
  const category = upgradeCategory(upgrade);
  const singleUpgrade = upgrade.perTarget[0];
  const baselineDps = analyses[0].baseline?.dps ?? 0;

  return (
    <div className="p-2 rounded border border-body-300 dark:border-dark-200">
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-400 w-5 shrink-0">{rank}</span>
        <div className="flex gap-0.5 shrink-0">
          {upgrade.items.map((eq) => <ItemIcon key={eq.id} eq={eq} />)}
        </div>
        <button type="button" className="min-w-0 grow text-left" onClick={toggle}>
          <div className="font-bold truncate" title={name}>{name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-300 flex items-center gap-1">
            {category === 'set' ? 'Armour set' : categoryLabel(category)}
            {!single && ` · better on ${gains.length}/${targets.length}`}
            <IconChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
        <div className="text-right shrink-0">
          {single && singleUpgrade ? (
            <>
              <div className="font-bold font-mono">{`+${(singleUpgrade.dps - baselineDps).toFixed(3)}`}</div>
              <div className="text-xs text-green-600 dark:text-green-400">{`DPS ${formatPct(pct(baselineDps, singleUpgrade.dps))}`}</div>
            </>
          ) : (
            <>
              {upgrade.secondsSaved > 0 && (
                <>
                  <div className="font-bold font-mono">{`−${formatSeconds(upgrade.secondsSaved)}`}</div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    {`per run ${totalBefore > 0 ? formatPct((upgrade.secondsSaved / totalBefore) * 100, '−') : ''}`}
                  </div>
                </>
              )}
              {upgrade.unlocks.length > 0 && (
                <div
                  className="text-xs font-bold text-orange-500"
                  data-tooltip-id="tooltip"
                  data-tooltip-content={`Nothing you own can damage ${upgrade.unlocks.map((i) => targets[i].label).join(', ')}`}
                >
                  {`can now kill ${upgrade.unlocks.length}`}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            className="form-control px-1 py-0.5 hover:scale-105 transition-transform"
            onClick={onAssumeOwned}
            data-tooltip-id="tooltip"
            data-tooltip-content="Assume I own this and search again, to find the next upgrade"
          >
            <IconCheck size={16} aria-label="Assume owned" />
          </button>
          {single && (
            <button type="button" className="form-control px-2 py-0.5 font-bold hover:scale-105 transition-transform" onClick={() => onLoad(0)}>
              Load
            </button>
          )}
        </div>
      </div>
      {!single && !expanded && (
        <div className="mt-1 flex flex-wrap gap-1 text-xs">
          {gains.slice(0, 6).map(({ i, gain }) => (
            <span key={i} className="px-1.5 rounded bg-body-100 dark:bg-dark-400">
              {targets[i].label}
              <span className="text-green-600 dark:text-green-400">{` ${formatPct(gain)}`}</span>
            </span>
          ))}
          {gains.length > 6 && <span className="text-gray-500 dark:text-gray-300">{`+${gains.length - 6} more`}</span>}
        </div>
      )}
      {expanded && (
        <div className="mt-2 flex flex-col gap-1 text-xs">
          {targets.map((t, i) => {
            const u = upgrade.perTarget[i];
            const before = analyses[i].baseline;
            const setup = u?.setup ?? before;
            return (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className={`flex items-center gap-2 ${u ? '' : 'opacity-50'}`}>
                <span className="grow min-w-0 truncate font-bold" title={t.label}>{t.label}</span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <ItemIcon eq={setup?.equipment.weapon} size={4} />
                  {setup?.equipment.ammo && setup.equipment.ammo.id !== before?.equipment.ammo?.id && <ItemIcon eq={setup.equipment.ammo} size={4} />}
                </span>
                <span className="font-mono shrink-0 w-36 text-right">
                  {`${(before?.dps ?? 0).toFixed(2)} → ${(u?.dps ?? before?.dps ?? 0).toFixed(2)}`}
                </span>
                <span className="w-12 shrink-0 text-right text-green-600 dark:text-green-400">
                  {u ? formatPct(pct(before?.dps ?? 0, u.dps)) : '–'}
                </span>
                <button
                  type="button"
                  disabled={!u}
                  className="form-control px-1.5 py-0 disabled:opacity-30 hover:scale-105 transition-transform"
                  onClick={() => onLoad(i)}
                  data-tooltip-id="tooltip"
                  data-tooltip-content={single ? 'Load this setup' : 'Load this setup and switch to this monster'}
                >
                  Load
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CUSTOM_LIST = 'Custom';
const LIST_NAMES = [...UPGRADE_FINDER_PRESETS.map((p) => p.label), CUSTOM_LIST];

/**
 * For a list saved before there was one per raid: the preset it was loaded from, if every monster is in one.
 */
const inferListName = (targets: UpgradeFinderTarget[]) => (targets.length > 0 && UPGRADE_FINDER_PRESETS
  .find((p) => targets.every((t) => p.targets.some((x) => x.id === t.id && x.version === t.version)))?.label) || CUSTOM_LIST;

const UpgradeFinderButton: React.FC = observer(() => {
  const store = useStore();
  const {
    bank, ownedEquipmentIds, hiddenEquipmentIds, availableMonsters,
  } = store;
  const savedTargets = store.prefs.upgradeFinderTargets;
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'current' | 'list'>('current');
  const [styles, setStyles] = useState<AutoBuffStyle[]>(AUTO_BUFF_STYLES);
  const [useAutoBuffs, setUseAutoBuffs] = useState(true);
  const [assumed, setAssumed] = useState<EquipmentPiece[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingReductions, setEditingReductions] = useState<number | null>(null);
  const run = useRef<UpgradeRun | null>(null);

  // Stop a running search if the dialog is closed
  useEffect(() => {
    if (!isOpen) {
      run.current?.cancel();
      run.current = null;
      setProgress(null);
    }
  }, [isOpen]);

  const activeList = store.prefs.upgradeFinderList || inferListName(savedTargets);
  const activePreset = UPGRADE_FINDER_PRESETS.find((p) => p.label === activeList);

  // Changes are saved to the active list, so switching to another list and back keeps them
  const setTargets = (targets: UpgradeFinderTarget[]) => store.updatePreferences({
    upgradeFinderTargets: targets,
    upgradeFinderList: activeList,
    upgradeFinderSaved: { ...store.prefs.upgradeFinderSaved, [activeList]: targets },
  });

  const switchList = (name: string) => {
    const saved = { ...store.prefs.upgradeFinderSaved, [activeList]: savedTargets };
    const targets = saved[name] ?? UPGRADE_FINDER_PRESETS.find((p) => p.label === name)?.targets ?? [];
    store.updatePreferences({ upgradeFinderTargets: targets, upgradeFinderList: name, upgradeFinderSaved: { ...saved, [name]: targets } });
    setEditingReductions(null);
  };

  const buildTarget = (t: UpgradeFinderTarget): Target | null => {
    const m = availableMonsters.find((x) => x.id === t.id && (x.version || '') === t.version);
    if (!m) return null;
    const inputs = { ...INITIAL_MONSTER_INPUTS, phase: MONSTER_PHASES_BY_ID[m.id]?.[0], ...t.inputs };
    const { hp } = scaleMonster({ ...m, inputs }).skills;
    return {
      monster: { ...m, inputs: { ...inputs, monsterCurrentHp: t.inputs?.monsterCurrentHp ?? hp } },
      label: monsterLabel(m),
      hp,
      weight: t.weight,
      styles: t.styles ?? AUTO_BUFF_STYLES,
    };
  };

  const listTargets = useMemo(
    () => savedTargets.map((t) => buildTarget(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedTargets, availableMonsters],
  );

  const currentTarget = (): Target => {
    const monster = toJS(store.monster);
    return {
      monster, label: monsterLabel(monster), hp: scaleMonster(monster).skills.hp, weight: 1, styles: AUTO_BUFF_STYLES,
    };
  };

  // The styles searched against a monster: the ones picked above that can be used on it
  const usableStyles = (t: Target) => styles.filter((s) => t.styles.includes(s));

  const search = async (assumedItems: EquipmentPiece[] = assumed) => {
    const targets = mode === 'current'
      ? [currentTarget()]
      : listTargets.filter((t): t is Target => !!t && t.weight > 0 && usableStyles(t).length > 0);
    if (targets.length === 0) return;

    const worn = store.loadouts.flatMap((l) => wornItemIds(l.equipment));
    const ownedIds = [
      ...availableEquipment
        .filter((eq) => ownedEquipmentIds?.has(eq.id) && isSearchableEquipment(eq) && !hiddenEquipmentIds.has(eq.id))
        .map((eq) => eq.id),
      ...worn,
      ...assumedItems.map((eq) => eq.id),
    ];
    const candidateIds = availableEquipment
      .filter((eq) => isSearchableEquipment(eq) && !isPvpOnlyEquipment(eq) && !hiddenEquipmentIds.has(eq.id))
      .map((eq) => eq.id);
    const player = toJS(store.player);
    const buffsConfig = useAutoBuffs ? toJS(store.prefs.autoBuffsConfig) : null;

    run.current?.cancel();
    setResults(null);
    setExpanded(null);
    setProgress(0);
    const thisRun = runUpgradeFinder(targets.map((t) => ({
      player,
      monster: t.monster,
      ownedIds,
      candidateIds,
      styles: usableStyles(t),
      buffsConfig,
      refineCount: targets.length > 1 ? 12 : 20,
    })), setProgress);
    run.current = thisRun;

    try {
      const analyses = await thisRun.promise;
      if (run.current === thisRun) {
        setResults({ targets, analyses, upgrades: combineUpgrades(analyses, targets) });
        setSlotFilter('all');
      }
    } catch (e) {
      console.error(e);
      toast.error('The search failed. Check the console for details.', { toastId: 'upgrade-finder-error' });
    } finally {
      if (run.current === thisRun) {
        run.current = null;
        setProgress(null);
      }
    }
  };

  const assumeOwned = (items: EquipmentPiece[]) => {
    const next = [...assumed, ...items.filter((eq) => !assumed.some((a) => a.id === eq.id))];
    setAssumed(next);
    search(next);
  };

  const load = (upgrade: CombinedUpgrade, targetIndex: number) => {
    const u = upgrade.perTarget[targetIndex];
    if (!u || !results) return;
    if (mode === 'list') store.updateMonster(results.targets[targetIndex].monster);
    store.applySetup(resultToSetup(u.setup), false);
    setIsOpen(false);
    toast.success(`Loaded ${resultToSetup(u.setup).name} setup`, { toastId: 'upgrade-finder-load' });
  };

  const single = results ? results.targets.length === 1 : mode === 'current';
  const categories = results ? [...new Set(results.upgrades.map(upgradeCategory))] : [];
  const shown = results?.upgrades.filter((u) => slotFilter === 'all' || upgradeCategory(u) === slotFilter).slice(0, 30) ?? [];
  const owned = results ? ownedKillTime(results) : null;
  const canSearch = styles.length > 0 && progress === null
    && (mode === 'current' || listTargets.some((t) => t && t.weight > 0 && usableStyles(t).length > 0));

  const updateTarget = (i: number, changes: Partial<UpgradeFinderTarget>) => setTargets(savedTargets.map((t, j) => (i === j ? { ...t, ...changes } : t)));

  // Raid settings apply to the whole list. The stored current HP is dropped so it follows the new scaled HP
  const applyRaidInputs = (changes: Partial<RaidInputs>) => setTargets(savedTargets.map((t) => {
    const inputs = { ...t.inputs, ...changes };
    delete inputs.monsterCurrentHp;
    return { ...t, inputs };
  }));

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-body-500 dark:text-dark-100 hover:text-orange-400 transition-colors"
        data-tooltip-id="tooltip"
        data-tooltip-content="Upgrade finder"
      >
        <IconTrendingUp aria-label="Upgrade finder" />
      </button>
      <Modal
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        maxWidth="max-w-3xl"
        title={(
          <div className="flex gap-2 items-center">
            <IconTrendingUp />
            Upgrade finder
          </div>
        )}
      >
        <div className="text-sm">
          <p className="mb-3">
            Finds the items you don&apos;t own yet that would speed up your kills the most, compared to the best setup you
            can already make
            {bank ? ' from your bank and loadouts' : ' from your loadouts (import your bank in Settings to use everything you own)'}
            .
          </p>

          <div className="flex gap-1 mb-2">
            <button
              type="button"
              className={`form-control px-3 py-1 ${mode === 'current' ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
              onClick={() => setMode('current')}
            >
              {`This monster (${monsterLabel(store.monster)})`}
            </button>
            <button
              type="button"
              className={`form-control px-3 py-1 ${mode === 'list' ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
              onClick={() => setMode('list')}
            >
              {`Monster list: ${activeList}${savedTargets.length ? ` (${savedTargets.length})` : ''}`}
            </button>
          </div>

          {mode === 'list' && (
            <div className="mb-3 p-2 rounded border border-body-300 dark:border-dark-200">
              <div className="flex flex-wrap gap-1 mb-2 items-center">
                {LIST_NAMES.map((name) => {
                  const preset = UPGRADE_FINDER_PRESETS.find((p) => p.label === name);
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`form-control px-2 py-0.5 ${name === activeList ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
                      onClick={() => switchList(name)}
                      data-tooltip-id="tooltip"
                      data-tooltip-content={`${preset ? preset.description : 'Your own monster list.'} Your changes to it are kept.`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1 mb-2 items-center">
                <button
                  type="button"
                  disabled={store.monster.id < 0}
                  className="form-control px-2 py-0.5 flex items-center gap-1 disabled:opacity-50"
                  onClick={() => setTargets([...savedTargets, {
                    id: store.monster.id, version: store.monster.version || '', weight: 1, inputs: toJS(store.monster.inputs),
                  }])}
                >
                  <IconPlus size={14} />
                  Add current monster
                </button>
                {(activePreset || savedTargets.length > 0) && (
                  <button
                    type="button"
                    className="form-control px-2 py-0.5"
                    onClick={() => {
                      setTargets(activePreset?.targets ?? []);
                      setEditingReductions(null);
                    }}
                    data-tooltip-id="tooltip"
                    data-tooltip-content={activePreset
                      ? `Undo your changes to the ${activePreset.label} list: its monsters, kills per run, styles and settings`
                      : 'Remove every monster from this list'}
                  >
                    {activePreset ? 'Reset' : 'Clear'}
                  </button>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-300 ml-auto">Kills per run weight each monster&apos;s kill time.</span>
              </div>
              <RaidSettings monsters={listTargets.filter((t): t is Target => !!t).map((t) => t.monster)} onChange={applyRaidInputs} />
              {savedTargets.length === 0 && <p className="italic text-gray-500 text-xs">{activePreset ? `Reset to get the ${activePreset.label} monsters back, or add monsters.` : 'Add monsters with "Add current monster".'}</p>}
              <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto pr-1">
                {savedTargets.map((t, i) => {
                  const built = listTargets[i];
                  const reductions = targetReductions(t);
                  const setReductions = (changes: Partial<DefenceReductions>) => updateTarget(i, {
                    inputs: { ...t.inputs, defenceReductions: { ...reductions, ...changes } },
                  });
                  const editing = editingReductions === i;
                  return (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className={`text-xs ${t.weight > 0 ? '' : 'opacity-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="grow min-w-0 truncate">{built ? built.label : `Unknown monster ${t.id}`}</span>
                        {built && <span className="text-gray-500 dark:text-gray-300 shrink-0">{`${built.hp} hp`}</span>}
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="text-gray-500 dark:text-gray-300">×</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={t.weight}
                            className="form-control w-14 px-1 py-0"
                            aria-label="Kills per run"
                            onChange={(e) => updateTarget(i, { weight: Math.max(0, parseFloat(e.target.value) || 0) })}
                          />
                        </span>
                        <span className="flex gap-0.5 shrink-0">
                          {AUTO_BUFF_STYLES.map((s) => {
                            const allowed = t.styles ?? AUTO_BUFF_STYLES;
                            const on = allowed.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                className={`form-control p-0.5 ${on ? '' : 'opacity-30 grayscale'}`}
                                onClick={() => updateTarget(i, { styles: on ? allowed.filter((x) => x !== s) : AUTO_BUFF_STYLES.filter((x) => x === s || allowed.includes(x)) })}
                                aria-label={`${STYLE_LABELS[s]} ${on ? 'on' : 'off'}`}
                                data-tooltip-id="tooltip"
                                data-tooltip-content={`${STYLE_LABELS[s]} ${on ? 'can' : "can't"} be used on this monster`}
                              >
                                <img src={STYLE_ICONS[s].src} width={14} alt="" />
                              </button>
                            );
                          })}
                        </span>
                        <button
                          type="button"
                          className={`form-control px-1.5 py-0 shrink-0 min-w-[4.5rem] flex justify-center ${editing ? 'ring-2 ring-green-500' : ''}`}
                          onClick={() => setEditingReductions(editing ? null : i)}
                          aria-label="Defence reductions"
                          data-tooltip-id="tooltip"
                          data-tooltip-content="Defence reductions used for this monster (specs, BGS, ...)"
                        >
                          <ReductionSummary reductions={reductions} />
                        </button>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-500"
                          onClick={() => {
                            setTargets(savedTargets.filter((_, j) => j !== i));
                            setEditingReductions(null);
                          }}
                          aria-label="Remove"
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                      {editing && (
                        <div className="my-1 ml-2 p-2 rounded bg-body-100 dark:bg-dark-400">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                            {REDUCTION_AMOUNTS.map((r) => (
                              <div key={r.key} className="flex items-center gap-1">
                                <NumberInput
                                  className="form-control w-12 px-1 py-0"
                                  min={0}
                                  value={reductions[r.key]}
                                  onChange={(v) => setReductions({ [r.key]: v })}
                                  aria-label={r.label}
                                />
                                <img src={r.icon.src} width={14} alt="" />
                                <span className="truncate">{r.label}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4">
                            <Toggle
                              className="!mb-0"
                              checked={reductions.accursed}
                              setChecked={(c) => setReductions({ accursed: c })}
                              label={(
                                <>
                                  <img src={sceptre.src} width={14} className="inline-block" alt="" />
                                  {' Accursed sceptre'}
                                </>
                              )}
                            />
                            <Toggle
                              className="!mb-0"
                              checked={reductions.vulnerability}
                              setChecked={(c) => setReductions({ vulnerability: c })}
                              label={(
                                <>
                                  <img src={vuln.src} width={14} className="inline-block" alt="" />
                                  {' Vulnerability'}
                                </>
                              )}
                            />
                            {built && (
                              <span className="text-gray-500 dark:text-gray-300">
                                {`Defence ${built.monster.skills.def} → ${scaleMonster(built.monster).skills.def}`}
                              </span>
                            )}
                            <button
                              type="button"
                              className="form-control px-2 py-0 ml-auto"
                              onClick={() => setTargets(savedTargets.map((x) => ({ ...x, inputs: { ...x.inputs, defenceReductions: reductions } })))}
                            >
                              Apply to all monsters
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2 items-center">
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
            <Toggle
              checked={useAutoBuffs}
              setChecked={setUseAutoBuffs}
              label="Use my auto buffs prayers and potions"
              help="Off: every setup is scored with this loadout's current prayers and potions."
              className="!mb-0"
            />
          </div>

          {assumed.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1 items-center text-xs">
              <span className="text-gray-500 dark:text-gray-300">Assuming you own:</span>
              {assumed.map((eq) => (
                <span key={eq.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-body-100 dark:bg-dark-400">
                  <ItemIcon eq={eq} size={4} />
                  {equipmentDisplayName(eq)}
                  <button type="button" aria-label="Remove" className="text-gray-400 hover:text-red-500" onClick={() => setAssumed(assumed.filter((a) => a.id !== eq.id))}>
                    <IconX size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={!canSearch}
            className="form-control w-full flex justify-center items-center gap-1 py-2 font-bold hover:scale-[1.02] transition-transform"
            onClick={() => search()}
          >
            <IconTrendingUp className="w-5" />
            {progress !== null ? 'Searching...' : 'Find upgrades'}
          </button>
          {progress !== null && (
            <div className="mt-2 h-2 rounded bg-body-200 dark:bg-dark-400 overflow-hidden">
              <div className="h-full bg-green-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}

          {results && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-300 mb-2">
                {single ? (
                  <>
                    {'Best setup you own: '}
                    <span className="font-bold">
                      {results.analyses[0].baseline?.equipment.weapon ? equipmentDisplayName(results.analyses[0].baseline.equipment.weapon) : 'none'}
                    </span>
                    {` at ${(results.analyses[0].baseline?.dps ?? 0).toFixed(3)} DPS.`}
                  </>
                ) : (
                  `Your best owned setups take ${formatSeconds(owned!.total)} of kill time per run over ${results.targets.length} monsters. Ranked by time saved; click an upgrade for each monster.`
                )}
                {owned!.unkillable.length > 0 && (
                  <span className="block text-orange-500">
                    {`Nothing you own can damage ${owned!.unkillable.map((t) => t.label).join(', ')}, so ${owned!.unkillable.length > 1 ? 'they are' : 'it is'} left out of the time saved. Upgrades that can are marked "can now kill".`}
                  </span>
                )}
              </p>
              {categories.length > 1 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {['all', ...categories].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`form-control px-2 py-0 text-xs ${slotFilter === c ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
                      onClick={() => setSlotFilter(c)}
                    >
                      {categoryLabel(c)}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1">
                {shown.length === 0 && <p className="italic text-gray-500">No upgrades found. You may already own the best gear for this.</p>}
                {shown.map((u, i) => (
                  <UpgradeRow
                    key={u.key}
                    upgrade={u}
                    rank={i + 1}
                    results={results}
                    single={single}
                    expanded={expanded === u.key}
                    toggle={() => setExpanded(expanded === u.key ? null : u.key)}
                    onAssumeOwned={() => assumeOwned(u.items)}
                    onLoad={(ti) => load(u, ti)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
});

export default UpgradeFinderButton;
