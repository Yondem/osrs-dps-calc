// noinspection FallThroughInSwitchStatementJS

import {
  autorun, IReactionDisposer, IReactionPublic, makeAutoObservable, reaction, toJS,
} from 'mobx';
import React, { createContext, useContext } from 'react';
import { PartialDeep } from 'type-fest';
import * as localforage from 'localforage';
import merge from 'lodash.mergewith';
import { toast } from 'react-toastify';
import {
  CalculatedLoadout,
  Calculator,
  CustomSettings,
  IMPORT_VERSION,
  ImportableData,
  PlayerVsNPCCalculatedLoadout,
  Preferences,
  SavedSetup,
  State,
  UI,
  UserIssue,
} from '@/types/State';
import {
  EquipmentPiece, Player, PlayerEquipment,
} from '@/types/Player';
import { Monster } from '@/types/Monster';
import { MonsterAttribute } from '@/enums/MonsterAttribute';
import {
  calculatePotionBoosts, fetchPlayerSkills, fetchShortlinkData, getCombatStylesForCategory, getDefaultCombatStyle, isDefined,
} from '@/utils';
import { ComputeBasicRequest, ComputeReverseRequest, WorkerRequestType } from '@/worker/CalcWorkerTypes';
import { getMonsters, INITIAL_MONSTER_INPUTS } from '@/lib/Monsters';
import { availableEquipment, calculateEquipmentBonusesFromGear } from '@/lib/Equipment';
import { BankData, getOwnedEquipmentIds, withAliasVariants } from '@/lib/Bank';
import { Backup } from '@/lib/Backup';
import { resolveSavedSetupEquipment, savedSetupFromPlayer } from '@/lib/SavedSetups';
import {
  AutoBuffsConfig, autoBuffStyleFor, DEFAULT_AUTO_BUFFS_CONFIG, getRaid, withAutoBuffPotions, withAutoBuffPrayers,
} from '@/lib/AutoBuffs';
import { CalcWorker } from '@/worker/CalcWorker';
import { spellByName } from '@/types/Spell';
import {
  DEFAULT_ATTACK_SPEED,
  INFINITE_HEALTH_MONSTERS,
  NUMBER_OF_LOADOUTS,
} from '@/lib/constants';
import { EquipmentCategory } from './enums/EquipmentCategory';
import { addPrayer, Prayer } from './enums/Prayer';
import Potion from './enums/Potion';

const EMPTY_CALC_LOADOUT = {} as CalculatedLoadout;

const generateInitialEquipment = () => {
  const initialEquipment: PlayerEquipment = {
    ammo: null,
    body: null,
    cape: null,
    feet: null,
    hands: null,
    head: null,
    legs: null,
    neck: null,
    ring: null,
    shield: null,
    weapon: null,
  };
  return initialEquipment;
};

export const generateEmptyPlayer = (name?: string): Player => ({
  name: name ?? 'Loadout 1',
  style: getDefaultCombatStyle(EquipmentCategory.NONE),
  skills: {
    atk: 99,
    def: 99,
    hp: 99,
    magic: 99,
    prayer: 99,
    ranged: 99,
    str: 99,
    mining: 99,
    herblore: 99,
    farming: 99,
  },
  boosts: {
    atk: 0,
    def: 0,
    hp: 0,
    magic: 0,
    prayer: 0,
    ranged: 0,
    str: 0,
    mining: 0,
    herblore: 0,
    farming: 0,
  },
  equipment: generateInitialEquipment(),
  attackSpeed: DEFAULT_ATTACK_SPEED,
  prayers: [],
  bonuses: {
    str: 0,
    ranged_str: 0,
    magic_str: 0,
    prayer: 0,
  },
  defensive: {
    stab: 0,
    slash: 0,
    crush: 0,
    magic: 0,
    ranged: 0,
  },
  offensive: {
    stab: 0,
    slash: 0,
    crush: 0,
    magic: 0,
    ranged: 0,
  },
  buffs: {
    potions: [],
    onSlayerTask: true,
    inWilderness: false,
    kandarinDiary: true,
    chargeSpell: false,
    markOfDarknessSpell: false,
    forinthrySurge: false,
    soulreaperStacks: 5,
    baAttackerLevel: 0,
    chinchompaDistance: 4, // 4 tiles is the optimal range for "medium fuse" (rapid), which is the default selected stance
    usingSunfireRunes: false,
    fragmentOfWind: false,
    fragmentOfWater: false,
    fragmentOfEarth: false,
    fragmentOfFire: false,
    thrall: null,
  },
  spell: null,
});

export const parseLoadoutsFromImportedData = (data: ImportableData) => data.loadouts.map((loadout, i) => {
  // For each item, reload the most current data using the item ID to ensure we're not using stale data.
  if (loadout.equipment) {
    for (const [k, v] of Object.entries(loadout.equipment)) {
      if (v === null) continue;
      let item: EquipmentPiece | undefined;
      if (Object.hasOwn(v, 'id')) {
        item = availableEquipment.find((eq) => eq.id === v.id);
        if (item) {
          // include the hidden itemVars inputs that are not present on the availableEquipment store
          if (Object.hasOwn(v, 'itemVars')) {
            item = { ...item, itemVars: v.itemVars };
          }
        } else {
          console.warn(`[parseLoadoutsFromImportedData] No item found for item ID ${v.id}`);
        }
      }
      // The following line will remove the item entirely if it seems to no longer exist.
      loadout.equipment[k as keyof typeof loadout.equipment] = item || null;
    }
  }

  // load the current spell, if applicable
  if (loadout.spell?.name) {
    loadout.spell = spellByName(loadout.spell.name);
  }

  return { name: `Loadout ${i + 1}`, ...loadout };
});

class GlobalState implements State {
  serializationVersion = IMPORT_VERSION;

  monster: Monster = {
    id: 415,
    name: 'Abyssal demon',
    version: 'Standard',
    image: 'Abyssal demon.png',
    size: 1,
    speed: 4,
    style: 'stab',
    skills: {
      atk: 97,
      def: 135,
      hp: 150,
      magic: 1,
      ranged: 1,
      str: 67,
    },
    offensive: {
      atk: 0,
      magic: 0,
      magic_str: 0,
      ranged: 0,
      ranged_str: 0,
      str: 0,
    },
    defensive: {
      flat_armour: 0,
      stab: 20,
      slash: 20,
      crush: 20,
      magic: 0,
      light: 20,
      standard: 20,
      heavy: 20,
    },
    attributes: [MonsterAttribute.DEMON],
    weakness: null,
    immunities: {
      burn: null,
    },
    is_slayer_monster: true,
    inputs: { ...INITIAL_MONSTER_INPUTS },
  };

  loadouts: Player[] = [
    generateEmptyPlayer(),
  ];

  selectedLoadout = 0;

  ui: UI = {
    showPreferencesModal: false,
    showShareModal: false,
    showSettingsModal: false,
    settingsSection: 'setups',
    username: '',
    isDefensiveReductionsExpanded: false,
  };

  prefs: Preferences = {
    manualMode: false,
    rememberUsername: true,
    showHitDistribution: false,
    showLoadoutComparison: false,
    showTtkComparison: false,
    showNPCVersusPlayerResults: false,
    hiddenGraphs: [],
    hitDistsHideZeros: false,
    hitDistShowSpec: false,
    resultsExpanded: false,
    bankOwnedOnly: false,
    autoBuffs: false,
    autoBuffsConfig: DEFAULT_AUTO_BUFFS_CONFIG,
    upgradeFinderTargets: [],
    upgradeFinderList: '',
    upgradeFinderSaved: {},
  };

  /**
   * The player's bank, imported from the RuneLite Bank Memory plugin. Stored separately from preferences.
   */
  bank: BankData | null = null;

  /**
   * Customisations from the settings menu (filtered items, tags, saved setups, hidden presets).
   * Arrays are always replaced rather than mutated, so components can use them as memo dependencies.
   */
  custom: CustomSettings = {
    hiddenItemIds: [],
    blowpipeDarts: [],
    itemTags: [],
    savedSetups: [],
    hiddenPresets: [],
  };

  calc: Calculator = {
    loadouts: [
      {
        npcDefRoll: 0,
        maxHit: 0,
        maxAttackRoll: 0,
        npcMaxHit: 0,
        npcMaxAttackRoll: 0,
        npcDps: 0,
        npcAccuracy: 0,
        playerDefRoll: 0,
        accuracy: 0,
        dps: 0,
        ttk: 0,
        hitDist: [],
        ttkDist: undefined,
      },
    ],
  };

  private calcWorker!: CalcWorker;

  availableMonsters = getMonsters();

  private _debug: boolean = false;

  private storageUpdater?: IReactionDisposer;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });

    const recomputeBoosts = () => this.recomputeBoosts();

    const potionTriggers: ((r: IReactionPublic) => unknown)[] = [
      () => toJS(this.player.skills),
      () => toJS(this.player.buffs.potions),
    ];
    potionTriggers.map((t) => reaction(t, recomputeBoosts, { fireImmediately: false }));

    // for toa monster + shadow handling
    const equipmentTriggers: ((r: IReactionPublic) => unknown)[] = [
      () => toJS(this.monster),
    ];
    equipmentTriggers.map((t) => reaction(t, () => {
      if (!this.prefs.manualMode) {
        this.recalculateEquipmentBonusesFromGearAll();
      }
    }));
  }

  /**
   * Re-compute a loadout's boost values from its potions. Defaults to the selected loadout.
   */
  recomputeBoosts(loadoutIx?: number) {
    loadoutIx = loadoutIx !== undefined ? loadoutIx : this.selectedLoadout;
    const loadout = this.loadouts[loadoutIx];
    this.updatePlayer({ boosts: calculatePotionBoosts(loadout.buffs.potions, loadout.skills) }, loadoutIx);
  }

  set debug(debug: boolean) {
    this._debug = debug;
  }

  get debug(): boolean {
    return this._debug;
  }

  /**
   * Get the importable version of the current UI state
   */
  get asImportableData(): ImportableData {
    return {
      serializationVersion: IMPORT_VERSION,
      loadouts: toJS(this.loadouts),
      monster: toJS(this.monster),
      selectedLoadout: this.selectedLoadout,
    };
  }

  /**
   * Get the currently selected player (loadout)
   */
  get player() {
    return this.loadouts[this.selectedLoadout];
  }

  /**
   * Returns the data for the currently equipped items
   */
  get equipmentData() {
    return this.player.equipment;
  }

  /**
   * Get the user's current issues based on their calculated loadouts
   */
  get userIssues() {
    let is: UserIssue[] = [];

    // Determine the current global/UI-related issues
    // ex. is.push({ type: UserIssueType.MONSTER_UNIQUE_EFFECTS, message: 'This monster has unique effects that are not yet accounted for. Results may be inaccurate.' });
    // Add in the issues returned from the calculator
    for (const l of Object.values(this.calc.loadouts)) {
      if (l.userIssues) is = [...is, ...l.userIssues];
    }
    return is;
  }

  /**
   * Get the available combat styles for the currently equipped weapon
   * @see https://oldschool.runescape.wiki/w/Combat_Options
   */
  get availableCombatStyles() {
    const cat = this.player.equipment.weapon?.category || EquipmentCategory.NONE;
    return getCombatStylesForCategory(cat);
  }

  /**
   * Whether the currently selected monster has non-standard mechanics or behaviour.
   * In this case, we should hide UI elements relating to reverse DPS/damage taken metrics.
   */
  get isNonStandardMonster() {
    return !['slash', 'crush', 'stab', 'magic', 'ranged'].includes(this.monster.style || '');
  }

  /**
   * Initialises the autorun function for updating dps-calc-state when something changes.
   * This should only ever be called once.
   */
  startStorageUpdater() {
    if (this.storageUpdater) {
      console.warn('[GlobalState] StorageUpdater is already set!');
      return;
    }
    this.storageUpdater = autorun(() => {
      // Save their application state to browser storage
      localforage.setItem('dps-calc-state', toJS(this.asImportableData)).catch(() => {
      });
    });
  }

  setCalcWorker(worker: CalcWorker) {
    if (this.calcWorker) {
      console.warn('[GlobalState] CalcWorker is already set!');
      this.calcWorker.shutdown();
    }
    worker.initWorker();
    this.calcWorker = worker;
  }

  updateEquipmentBonuses(loadoutIx?: number) {
    loadoutIx = loadoutIx !== undefined ? loadoutIx : this.selectedLoadout;

    this.loadouts[loadoutIx] = merge(
      this.loadouts[loadoutIx],
      calculateEquipmentBonusesFromGear(this.loadouts[loadoutIx], this.monster),
    );
  }

  recalculateEquipmentBonusesFromGearAll() {
    this.loadouts.forEach((_, i) => this.updateEquipmentBonuses(i));
  }

  updateUIState(ui: PartialDeep<UI>) {
    this.ui = Object.assign(this.ui, ui);
  }

  updateCalcResults(calc: PartialDeep<Calculator>) {
    this.calc = merge(this.calc, calc);
  }

  updateCalcTtkDist(loadoutIx: number, ttkDist: PlayerVsNPCCalculatedLoadout['ttkDist']) {
    this.calc.loadouts[loadoutIx].ttkDist = ttkDist;
  }

  async loadShortlink(linkId: string) {
    let data: ImportableData;

    await toast.promise(async () => {
      data = await fetchShortlinkData(linkId);

      /**
       * For future reference: if we ever change the schema of the loadouts or the monster object,
       * then some of the JSON data we store for shortlinks will be incorrect. We can handle those instances here, as
       * a sort of "on-demand migration".
       *
       * Also: the reason we're merging the objects below is that we're trying our hardest not to cause the app to
       * error if the JSON data is bad. To achieve that, we do a deep merge of the loadouts and monster objects so that
       * the existing data still remains.
       */

      this.updateImportedData(data);
    }, {
      pending: 'Loading data from shared link...',
      success: 'Loaded data from shared link!',
      error: 'Failed to load shared link data. Please try again.',
    }, {
      toastId: 'shortlink',
    });
  }

  updateImportedData(data: ImportableData) {
    /* eslint-disable no-fallthrough */
    /* eslint-disable @typescript-eslint/dot-notation */
    /* eslint-disable @typescript-eslint/no-explicit-any */
    switch (data.serializationVersion) {
      case 1:
        data.monster.inputs.phase = data.monster.inputs.tormentedDemonPhase;

      case 2: // reserved: used during leagues 5
      case 3: // reserved: used during leagues 5
      case 4: // reserved: used during leagues 5
      case 5:
        data.loadouts.forEach((l) => {
          if ((l as any)['leagues']) {
            delete (l as any)['leagues'];
          }
        });

      case 6:
        // partyAvgMiningLevel becomes partySumMiningLevel
        if (isDefined(data.monster.inputs.partyAvgMiningLevel)) {
          data.monster.inputs.partySumMiningLevel = data.monster.inputs.partyAvgMiningLevel * data.monster.inputs.partySize;
          delete data.monster.inputs.partyAvgMiningLevel;
        }

      case 7:
        if (!isDefined(data.monster.immunities)) {
          data.monster.immunities = {
            burn: null,
          };
        }

      case 8: // reserved: used during leagues 6

      case 9: // reserved: used during leagues 6

      case 10:
        data.loadouts.forEach((l) => {
          // leagues had prayers beyond 20, and now we need to reuse the ids
          l.prayers = l.prayers?.filter((p) => p <= 20);
        });

      default:
    }
    /* eslint-enable */
    console.debug('IMPORT | ', data);

    if (data.monster) {
      let newMonster: PartialDeep<Monster> = {};

      if (data.monster.id > -1) {
        const monstersById = getMonsters().filter((m) => m.id === data.monster.id);
        if ((monstersById?.length || 0) === 0) {
          throw new Error(`Failed to find monster by id '${data.monster.id}' from shortlink`);
        }

        if (monstersById.length === 1) {
          newMonster = monstersById[0];
        } else {
          const version = monstersById.find((m) => m.version === data.monster.version);
          if (version) {
            newMonster = version;
          } else {
            newMonster = monstersById[0];
          }
        }
      } else {
        newMonster = data.monster;
      }

      // If the passed monster def reductions are different to the defaults, expand the UI section.
      for (const [k, v] of Object.entries(data.monster.inputs?.defenceReductions)) {
        if (v !== undefined && v !== INITIAL_MONSTER_INPUTS.defenceReductions[k as keyof typeof INITIAL_MONSTER_INPUTS.defenceReductions]) {
          this.updateUIState({ isDefensiveReductionsExpanded: true });
          break;
        }
      }

      // only use the shortlink for user-input fields, trust cdn for others in case they change
      this.updateMonster({
        ...newMonster,
        inputs: data.monster.inputs,
      });
    }

    // Expand some minified fields with their full metadata
    const loadouts = parseLoadoutsFromImportedData(data);

    // manually recompute equipment in case their metadata has changed since the shortlink was created
    loadouts.forEach((p, ix) => {
      if (this.loadouts[ix] === undefined) this.loadouts.push(generateEmptyPlayer());
      this.updatePlayer(p, ix);
    });
    this.recalculateEquipmentBonusesFromGearAll();

    this.selectedLoadout = data.selectedLoadout || 0;
  }

  loadPreferences() {
    localforage.getItem('dps-calc-prefs').then((v) => {
      if (v) this.applyStoredPreferences(v as Partial<Preferences>);
    }).catch((e) => {
      console.error(e);
      // TODO maybe some handling here
    });
  }

  /**
   * Applies saved preferences, from storage or a backup, upgrading ones saved by older versions.
   */
  applyStoredPreferences(stored: Partial<Preferences>) {
    // Older versions stored a single melee prayer choice instead of the full auto buffs config
    const { autoBuffsMeleePrayer, ...prefs } = stored as Partial<Preferences> & { autoBuffsMeleePrayer?: Prayer };
    const config = { ...DEFAULT_AUTO_BUFFS_CONFIG, ...prefs.autoBuffsConfig };
    if (autoBuffsMeleePrayer !== undefined && !prefs.autoBuffsConfig) {
      config.melee = { ...config.melee, prayers: [autoBuffsMeleePrayer] };
    }
    this.updatePreferences({ ...prefs, autoBuffsConfig: config });
  }

  /**
   * Replaces the settings, saved setups and (optionally) bank with those from a backup.
   */
  importBackup(backup: Backup, includeBank: boolean) {
    this.applyStoredPreferences(backup.prefs);
    this.updateCustomSettings({
      hiddenItemIds: [], blowpipeDarts: [], itemTags: [], savedSetups: [], hiddenPresets: [], ...backup.custom,
    });
    if (includeBank && backup.bank) {
      this.setBank(backup.bank);
    } else if (!this.bank) {
      // The backup's "only show items in my bank" means nothing without a bank here
      this.updatePreferences({ bankOwnedOnly: false });
    }
  }

  loadBank() {
    localforage.getItem('dps-calc-bank').then((v) => {
      if (v) this.bank = v as BankData;
    }).catch((e) => {
      console.error(e);
    });
  }

  setBank(bank: BankData | null) {
    this.bank = bank;
    if (!bank) this.updatePreferences({ bankOwnedOnly: false });

    const save = bank ? localforage.setItem('dps-calc-bank', toJS(bank)) : localforage.removeItem('dps-calc-bank');
    save.catch((e) => {
      console.error(e);
      toast.error('Could not save your bank to storage.', { toastId: 'bank-save' });
    });
  }

  /**
   * Equipment IDs in the imported bank (including functionally identical variants), or null if no bank is imported.
   */
  get ownedEquipmentIds(): Set<number> | null {
    return this.bank ? getOwnedEquipmentIds(this.bank.items) : null;
  }

  loadCustomSettings() {
    localforage.getItem('dps-calc-custom').then((v) => {
      if (v) this.custom = { ...this.custom, ...(v as Partial<CustomSettings>) };
    }).catch((e) => {
      console.error(e);
    });
  }

  updateCustomSettings(changes: Partial<CustomSettings>) {
    this.custom = { ...this.custom, ...changes };
    localforage.setItem('dps-calc-custom', toJS(this.custom)).catch((e) => {
      console.error(e);
      toast.error('Could not save your settings to storage.', { toastId: 'custom-save' });
    });
  }

  /**
   * Equipment IDs hidden from the equipment search, including functionally identical variants.
   */
  get hiddenEquipmentIds(): Set<number> {
    return withAliasVariants(this.custom.hiddenItemIds);
  }

  hideItem(id: number) {
    if (this.custom.hiddenItemIds.includes(id)) return;
    this.updateCustomSettings({ hiddenItemIds: [...this.custom.hiddenItemIds, id] });
  }

  unhideItem(id: number) {
    this.updateCustomSettings({ hiddenItemIds: this.custom.hiddenItemIds.filter((i) => i !== id) });
  }

  /**
   * Adds or removes a dart from the ones a (base) blowpipe is used with.
   */
  toggleBlowpipeDart(blowpipeId: number, dartId: number) {
    const others = this.custom.blowpipeDarts.filter((c) => c.blowpipeId !== blowpipeId);
    const dartIds = this.custom.blowpipeDarts.find((c) => c.blowpipeId === blowpipeId)?.dartIds ?? [];
    const next = dartIds.includes(dartId) ? dartIds.filter((id) => id !== dartId) : [...dartIds, dartId];
    this.updateCustomSettings({ blowpipeDarts: next.length > 0 ? [...others, { blowpipeId, dartIds: next }] : others });
  }

  /**
   * Replace an item's tags with a comma-separated list, e.g. "bowfa, fbow, faebow". An empty list removes them all.
   */
  setItemTags(itemId: number, tags: string) {
    const normalised = [...new Set(tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
    this.updateCustomSettings({
      itemTags: [
        ...this.custom.itemTags.filter((t) => t.itemId !== itemId),
        ...normalised.map((tag) => ({ tag, itemId })),
      ],
    });
  }

  setPresetsHidden(presetKeys: string[], hidden: boolean) {
    const rest = this.custom.hiddenPresets.filter((p) => !presetKeys.includes(p));
    this.updateCustomSettings({ hiddenPresets: hidden ? [...rest, ...presetKeys] : rest });
  }

  /**
   * Saves the selected loadout's gear, combat style and spell as a setup. Overwrites the setup with `overwriteId` if given.
   */
  saveCurrentLoadoutAsSetup(name: string, overwriteId?: string): SavedSetup {
    const setup = savedSetupFromPlayer(this.player, name, overwriteId);
    const exists = this.custom.savedSetups.some((s) => s.id === setup.id);
    this.updateCustomSettings({
      savedSetups: exists
        ? this.custom.savedSetups.map((s) => (s.id === setup.id ? setup : s))
        : [...this.custom.savedSetups, setup],
    });
    return setup;
  }

  updateSavedSetup(id: string, changes: Partial<SavedSetup>) {
    this.updateCustomSettings({
      savedSetups: this.custom.savedSetups.map((s) => (s.id === id ? { ...s, ...changes, id } : s)),
    });
  }

  deleteSavedSetup(id: string) {
    this.updateCustomSettings({ savedSetups: this.custom.savedSetups.filter((s) => s.id !== id) });
  }

  applySavedSetup(id: string) {
    const setup = this.custom.savedSetups.find((s) => s.id === id);
    if (setup) this.applySetup(setup, true);
  }

  /**
   * Loads a setup's gear, combat style, spell, prayers and potions into the selected loadout.
   * Used for saved setups and for results from the best setup finder.
   */
  applySetup(setup: SavedSetup, rename: boolean) {
    // Clear the weapon and shield first, so the two-handed weapon handling in updatePlayer
    // doesn't drop the setup's weapon when switching away from a two-hander.
    this.updatePlayer({ equipment: { weapon: null, shield: null } });
    this.updatePlayer({
      ...(rename ? { name: setup.name } : {}),
      equipment: resolveSavedSetupEquipment(setup),
      ...(setup.style ? { style: setup.style } : {}),
      spell: setup.spellName ? spellByName(setup.spellName) : null,
    });

    // Assigned directly rather than through updatePlayer, which merges arrays index by index.
    // This also replaces anything auto-buffs turned on when the weapon was equipped above.
    if (setup.prayers) this.player.prayers = [...setup.prayers];
    if (setup.potions) {
      const raid = getRaid(this.monster);
      // Inside a raid, auto-buffs swaps the setup's combat potions for the raid's own potion.
      this.player.buffs.potions = this.prefs.autoBuffs && raid
        ? withAutoBuffPotions(setup.potions, this.prefs.autoBuffsConfig, null, raid)
        : [...setup.potions];
    }
  }

  /**
   * Turns on the potions (and optionally the prayers) for the "automatically enable buffs" setting,
   * based on the loadout's weapon and whether the monster is in a raid.
   */
  applyAutoBuffs(loadoutIx: number, includePrayers: boolean) {
    const loadout = this.loadouts[loadoutIx];
    const config = this.prefs.autoBuffsConfig;
    const { weapon } = loadout.equipment;
    const style = weapon ? autoBuffStyleFor(weapon, loadout.style) : null;

    loadout.buffs.potions = withAutoBuffPotions(loadout.buffs.potions, config, style, getRaid(this.monster));
    if (includePrayers && style) {
      loadout.prayers = withAutoBuffPrayers(loadout.prayers, config, style);
    }

    this.recomputeBoosts(loadoutIx);
  }

  updateAutoBuffsConfig(changes: Partial<AutoBuffsConfig>) {
    this.updatePreferences({ autoBuffsConfig: { ...this.prefs.autoBuffsConfig, ...changes } });
  }

  async fetchCurrentPlayerSkills() {
    const { username } = this.ui;

    try {
      const res = await toast.promise(
        fetchPlayerSkills(username),
        {
          pending: 'Fetching player skills...',
          success: `Successfully fetched player skills for ${username}!`,
          error: 'Error fetching player skills',
        },
        {
          toastId: 'skills-fetch',
        },
      );

      if (res) this.updatePlayer({ skills: res });
    } catch (e) {
      console.error(e);
    }
  }

  updatePreferences(pref: PartialDeep<Preferences>) {
    // Update local state store
    this.prefs = Object.assign(this.prefs, pref);

    if (pref && Object.prototype.hasOwnProperty.call(pref, 'manualMode')) {
      // Reset player bonuses to their worn equipment
      this.recalculateEquipmentBonusesFromGearAll();
    }

    // Save to browser storage
    localforage.setItem('dps-calc-prefs', toJS(this.prefs)).catch((e) => {
      console.error(e);
      // TODO something that isn't this
      // eslint-disable-next-line no-alert
      alert('Could not persist preferences to browser. Make sure our site has permission to do this.');
    });
  }

  /**
   * Toggle a potion, with logic to remove from or add to the potions array depending on if it is already in there.
   * @param potion
   */
  togglePlayerPotion(potion: Potion) {
    const isToggled = this.player.buffs.potions.includes(potion);
    if (isToggled) {
      this.player.buffs.potions = this.player.buffs.potions.filter((p) => p !== potion);
    } else {
      this.player.buffs.potions = [...this.player.buffs.potions, potion];
    }
  }

  /**
   * Toggle a prayer, with logic to remove from or add to the prayers array depending on if it is already in there.
   * @param prayer
   */
  togglePlayerPrayer(prayer: Prayer) {
    const isToggled = this.player.prayers.includes(prayer);
    if (isToggled) {
      // If we're toggling off an existing prayer, just filter it out from the array
      this.player.prayers = this.player.prayers.filter((p) => p !== prayer);
    } else {
      // If we're toggling on a new prayer, turn off any prayers that can't be enabled alongside it
      this.player.prayers = addPrayer(this.player.prayers, prayer);
    }
  }

  /**
   * Toggle a monster attribute.
   * @param attr
   */
  toggleMonsterAttribute(attr: MonsterAttribute) {
    const isToggled = this.monster.attributes.includes(attr);
    if (isToggled) {
      this.monster.attributes = this.monster.attributes.filter((a) => a !== attr);
    } else {
      this.monster.attributes = [...this.monster.attributes, attr];
    }
  }

  /**
   * Update the player state.
   * @param player
   * @param loadoutIx Which loadout to update. Defaults to the current selected loadout.
   */
  updatePlayer(player: PartialDeep<Player>, loadoutIx?: number) {
    loadoutIx = loadoutIx !== undefined ? loadoutIx : this.selectedLoadout;

    const currentShield = this.loadouts[loadoutIx].equipment.shield;
    const newShield = player.equipment?.shield;

    const currentWeapon = this.loadouts[loadoutIx].equipment.weapon;
    // Captured now because merge() below mutates the existing weapon object in place.
    const previousWeaponId = currentWeapon?.id;

    // Special handling for if a shield is equipped, and we're using a two-handed weapon
    if (player.equipment?.shield && newShield !== undefined && currentWeapon?.isTwoHanded) {
      player = { ...player, equipment: { ...player.equipment, weapon: null } };
    }
    // ...and vice-versa
    if (player.equipment?.weapon && player.equipment?.weapon.isTwoHanded && currentShield?.name !== '') {
      player = { ...player, equipment: { ...player.equipment, shield: null } };
    }

    const eq = player.equipment;
    if (eq && (Object.hasOwn(eq, 'weapon') || Object.hasOwn(eq, 'shield'))) {
      const newWeapon = player.equipment?.weapon;

      if (newWeapon !== undefined) {
        const oldWeaponCat = currentWeapon?.category || EquipmentCategory.NONE;
        const newWeaponCat = newWeapon?.category || EquipmentCategory.NONE;
        if ((newWeaponCat !== undefined) && (newWeaponCat !== oldWeaponCat) && !player.style) {
          player.style = getDefaultCombatStyle(newWeaponCat);
        }
      }
    }

    this.loadouts[loadoutIx] = merge(this.loadouts[loadoutIx], player);
    if (!this.prefs.manualMode) {
      this.updateEquipmentBonuses(loadoutIx);
    }

    const equippedWeapon = player.equipment?.weapon;
    if (this.prefs.autoBuffs && equippedWeapon && equippedWeapon.id !== previousWeaponId) {
      this.applyAutoBuffs(loadoutIx, true);
    }
  }

  /**
   * Replaces the selected loadout's Venator bow bounce targets (updatePlayer would merge the lists instead).
   */
  setBounceTargets(targets: Monster[]) {
    this.loadouts[this.selectedLoadout].buffs.bounceTargets = targets;
  }

  /**
   * Update the monster state.
   * @param monster
   */
  updateMonster(monster: PartialDeep<Monster>) {
    const raidBefore = getRaid(this.monster);

    // If monster attributes were passed to this function, clear the existing ones
    if (monster.attributes !== undefined) this.monster.attributes = [];

    // If the monster ID was changed, reset all the inputs.
    if (
      monster.id !== undefined
      && monster.id !== this.monster.id
      && !Object.hasOwn(monster, 'inputs')
    ) {
      monster = {
        ...monster,
        inputs: INITIAL_MONSTER_INPUTS,
      };
    }

    this.monster = merge(this.monster, monster, (obj, src) => {
      // This check is to ensure that empty arrays always override existing arrays, even if they have values.
      if (Array.isArray(src) && src.length === 0) {
        return src;
      }
      return undefined;
    });

    // Moving into or out of a raid swaps potions (e.g. super combat <-> overload) on loadouts with a weapon.
    if (this.prefs.autoBuffs && getRaid(this.monster) !== raidBefore) {
      this.loadouts.forEach((loadout, ix) => {
        if (loadout.equipment.weapon) this.applyAutoBuffs(ix, false);
      });
    }
  }

  /**
   * Clear an equipment slot, removing the item that was inside of it.
   * @param slot
   */
  clearEquipmentSlot(slot: keyof PlayerEquipment) {
    this.updatePlayer({
      equipment: {
        [slot]: null,
      },
    });
  }

  setSelectedLoadout(ix: number) {
    this.selectedLoadout = ix;
  }

  deleteLoadout(ix: number) {
    if (this.loadouts.length === 1) {
      // If there is only one loadout, clear it instead of deleting it
      this.loadouts[0] = generateEmptyPlayer();
      return;
    }

    this.loadouts = this.loadouts.filter((p, i) => i !== ix);
    // If the selected loadout index is equal to or over the index we just remove, shift it down by one, else add one
    if ((this.selectedLoadout >= ix) && ix !== 0) {
      this.selectedLoadout -= 1;
    }
  }

  renameLoadout(ix: number, name: string) {
    const loadout = this.loadouts[ix];

    const trimmedName = name.trim();
    if (loadout) {
      if (trimmedName) {
        loadout.name = trimmedName;
      } else {
        loadout.name = `Loadout ${ix + 1}`;
      }
    }
  }

  get canCreateLoadout() {
    return this.loadouts.length < NUMBER_OF_LOADOUTS;
  }

  createLoadout(selected?: boolean, cloneIndex?: number) {
    // Do not allow creating a loadout if we're over the limit
    if (!this.canCreateLoadout) return;

    const newLoadout = (cloneIndex !== undefined) ? toJS(this.loadouts[cloneIndex]) : generateEmptyPlayer();
    newLoadout.name = `Loadout ${this.loadouts.length + 1}`;

    this.loadouts.push(newLoadout);
    if (selected) this.selectedLoadout = (this.loadouts.length - 1);
  }

  async doWorkerRecompute() {
    if (!this.calcWorker?.isReady()) {
      console.debug('[GlobalState] doWorkerRecompute called but worker is not ready, ignoring for now.');
      return;
    }

    // clear existing loadout data
    const calculatedLoadouts: CalculatedLoadout[] = [];
    this.loadouts.forEach(() => calculatedLoadouts.push(EMPTY_CALC_LOADOUT));
    this.calc.loadouts = calculatedLoadouts;

    const data: Extract<ComputeBasicRequest['data'], ComputeReverseRequest['data']> = {
      loadouts: toJS(this.loadouts),
      monster: toJS(this.monster),
      calcOpts: {
        hitDistHideMisses: this.prefs.hitDistsHideZeros,
        detailedOutput: this.debug,
        disableMonsterScaling: this.monster.id === -1,
      },
    };
    const request = async (type: WorkerRequestType.COMPUTE_BASIC | WorkerRequestType.COMPUTE_REVERSE) => {
      const resp = await this.calcWorker.do({
        type,
        data,
      });

      console.log(`[GlobalState] Calc response ${WorkerRequestType[type]}`, resp.payload);
      this.updateCalcResults({ loadouts: resp.payload });
    };

    const promises: Promise<void>[] = [];
    promises.push(
      request(WorkerRequestType.COMPUTE_BASIC),
      request(WorkerRequestType.COMPUTE_REVERSE),
    );

    if (this.prefs.showTtkComparison && !this.prefs.hiddenGraphs.includes('ttkComparison')
      && !INFINITE_HEALTH_MONSTERS.includes(this.monster.id)) {
      promises.push(
        (async (): Promise<void> => {
          const parallel = process.env.NEXT_PUBLIC_SERIAL_TTK !== 'true';
          const resp = await this.calcWorker.do({
            type: parallel ? WorkerRequestType.COMPUTE_TTK_PARALLEL : WorkerRequestType.COMPUTE_TTK,
            data,
          });

          for (const [ix, loadout] of resp.payload.entries()) {
            this.updateCalcTtkDist(ix, loadout.ttkDist);
          }
        })(),
      );
    }

    await Promise.all(promises);
  }
}

const StoreContext = createContext<GlobalState>(new GlobalState());

const StoreProvider: React.FC<{ store: GlobalState, children: React.ReactNode }> = ({ store, children }) => (
  <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
);

const useStore = () => useContext(StoreContext);

export { GlobalState, StoreProvider, useStore };
