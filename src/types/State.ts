import { PartialDeep } from 'type-fest';
import { EquipmentPiece, Player, PlayerEquipment } from '@/types/Player';
import { PlayerCombatStyle } from '@/types/PlayerCombatStyle';
import { Prayer } from '@/enums/Prayer';
import Potion from '@/enums/Potion';
import type { AutoBuffsConfig, AutoBuffStyle } from '@/lib/AutoBuffs';
import { Monster } from '@/types/Monster';
import UserIssueType from '@/enums/UserIssueType';
import { DetailEntry } from '@/lib/CalcDetails';
import { ChartEntry } from '@/types/Charts';

export interface UserIssue {
  type: UserIssueType;
  message: string;
  loadout?: string;
}

/**
 * UI-specific toggled behaviour and state.
 */
export interface UI {
  showPreferencesModal: boolean;
  showShareModal: boolean;
  showSettingsModal: boolean;
  username: string;
  isDefensiveReductionsExpanded: boolean;
}

/**
 * User preferences that we store in the user's localStorage. You should not add any keys here that shouldn't be
 * saved locally and persist between sessions.
 */
export interface Preferences {
  manualMode: boolean;
  rememberUsername: boolean;
  showHitDistribution: boolean;
  showLoadoutComparison: boolean;
  showTtkComparison: boolean;
  showNPCVersusPlayerResults: boolean;
  hitDistsHideZeros: boolean; // legacy name
  hitDistShowSpec: boolean;
  resultsExpanded: boolean;
  bankOwnedOnly: boolean; // only show equipment from the imported bank in the equipment search
  autoBuffs: boolean; // turn on potions and prayers when a weapon is equipped
  autoBuffsConfig: AutoBuffsConfig; // which potions and prayers auto buffs turns on
  upgradeFinderTargets: UpgradeFinderTarget[]; // the monster list of the upgrade finder
  upgradeFinderList: string; // which saved list that is (a preset's label or "Custom"), or empty if not chosen yet
  upgradeFinderSaved: Record<string, UpgradeFinderTarget[]>; // every saved list, so switching keeps your changes
}

/**
 * A monster in the upgrade finder's list, e.g. one boss of a raid.
 */
export interface UpgradeFinderTarget {
  id: number;
  version: string;
  weight: number; // kills per run
  inputs?: Partial<Monster['inputs']>; // party size, raid level, phase, ...
  styles?: AutoBuffStyle[]; // combat styles you can use on it, or all of them if missing
}

/**
 * An equipment slot in a saved setup. Only the ID is stored so setups pick up item data changes.
 */
export interface SavedSetupItem {
  id: number;
  itemVars?: EquipmentPiece['itemVars'];
}

/**
 * A loadout the user saved to reuse later from the Presets dropdown.
 */
export interface SavedSetup {
  id: string;
  name: string;
  equipment: { [slot in keyof PlayerEquipment]: SavedSetupItem | null };
  style?: PlayerCombatStyle;
  spellName?: string | null;
  prayers?: Prayer[]; // missing on setups saved before prayers were remembered
  potions?: Potion[];
}

export interface ItemTag {
  tag: string;
  itemId: number;
}

/**
 * User customisations from the settings menu, stored separately from preferences.
 */
export interface CustomSettings {
  hiddenItemIds: number[]; // hidden from the equipment search
  itemTags: ItemTag[]; // search shortcuts, e.g. "tbow" -> Twisted bow
  savedSetups: SavedSetup[];
  hiddenPresets: string[]; // EquipmentPreset keys of built-in presets hidden from the Presets dropdown
}

/**
 * The result of running the calculator on a specific player loadout.
 */
export interface CalculatedLoadout {
  userIssues?: UserIssue[],
}

export interface PlayerVsNPCCalculatedLoadout extends CalculatedLoadout {
  details?: DetailEntry[],
  specDetails?: DetailEntry[],

  // Player vs NPC metrics
  npcDefRoll?: number,
  maxHit?: number,
  expectedHit?: number,
  maxAttackRoll?: number,
  accuracy?: number,
  dps?: number,
  ttk?: number,
  hitDist?: ChartEntry[],
  ttkDist?: Map<number, number>,

  specAccuracy?: number,
  specMaxHit?: number,
  specExpected?: number,
  specMomentDps?: number,
  specFullDps?: number,
  specHitDist?: ChartEntry[],
}

// NPC vs Player metrics
export interface NPCVsPlayerCalculatedLoadout extends CalculatedLoadout {
  npcDetails?: DetailEntry[],

  playerDefRoll?: number,
  npcMaxAttackRoll?: number,
  npcMaxHit?: number,
  npcDps?: number,
  npcAccuracy?: number,
  avgDmgTaken?: number,
}

export interface Calculator {
  loadouts: (PlayerVsNPCCalculatedLoadout & NPCVsPlayerCalculatedLoadout)[]
}

/**
 * The exported data version, which can be used to perform lazy migrations on load,
 * if the application changes since the data was written to storage.
 * This value should be incremented every time {@link ImportableData},
 * or any of its subproperties, are updated in a non-backwards-compatible manner,
 * or also in any manner that could affect the migrations required on load.
 */
export const IMPORT_VERSION = 12 as const;

/**
 * This is the state that can be exported and imported (through shortlinks).
 * If you change the schema here without taking precautions, you **will** break existing shortlinks.
 */
export interface ImportableData {
  // can be any number <= IMPORT_VERSION
  serializationVersion: number;

  loadouts: PartialDeep<Player>[];
  selectedLoadout: number;

  monster: Monster;
}

/**
 * The interface for the global app state, which includes not only the import(ed|able) data, but also the UI state,
 * and the user's preferences.
 */
export interface State extends ImportableData {
  ui: UI;
  prefs: Preferences;
  calc: Calculator;

  /**
   * All monsters that a player can fight.
   */
  availableMonsters: Omit<Monster, 'inputs'>[];

}
