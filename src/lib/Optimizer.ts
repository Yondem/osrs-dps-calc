import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import {
  AmmoApplicability, ammoApplicability, availableEquipment, calculateEquipmentBonusesFromGear, chosenBlowpipeDarts,
  CORRUPTED_GAUNTLET_EQUIPMENT_IDS, GAUNTLET_EQUIPMENT_IDS, getCanonicalItemId, loadableDarts,
} from '@/lib/Equipment';
import { BLOWPIPE_IDS, CORRUPTED_GAUNTLET_MONSTER_IDS, GAUNTLET_MONSTER_IDS } from '@/lib/constants';
import {
  AutoBuffsConfig, AutoBuffStyle, getRaid, withAutoBuffPotions,
} from '@/lib/AutoBuffs';
import { EQUIPMENT_SLOTS } from '@/lib/SavedSetups';
import { addPrayer, Prayer } from '@/enums/Prayer';
import Potion from '@/enums/Potion';
import { EquipmentPiece, Player, PlayerEquipment } from '@/types/Player';
import { Monster } from '@/types/Monster';
import type { BlowpipeDarts } from '@/types/State';
import { PlayerCombatStyle } from '@/types/PlayerCombatStyle';
import { Spell, spellByName } from '@/types/Spell';
import { calculatePotionBoosts, getCombatStylesForCategory, isDefined } from '@/utils';

/*
 * Finds the highest DPS loadout from a pool of items, using the real calculator to score every candidate.
 *
 * 1. Screening: every weapon is tried in every relevant combat style (and spell, for staves) with a quick
 *    "best stats per slot" set of armour, to find the most promising weapons.
 * 2. Refinement: for the best few weapons per combat style, every slot is swapped through its candidates one at a
 *    time, keeping any improvement, until nothing improves. Armour sets (void, obsidian, barrows, ...) only pay off
 *    as a group, so they are also tried as a whole.
 */

export interface OptimizeOptions {
  player: Player; // the loadout to start from: skills, buffs and spell are kept
  monster: Monster;
  poolIds: number[]; // equipment the search may use
  pool?: EquipmentPiece[]; // an already resolved pool (see resolvePool), used instead of poolIds
  blowpipeDarts?: BlowpipeDarts[]; // the darts the user picked for their blowpipes
  styles: AutoBuffStyle[]; // combat styles to search
  buffsConfig: AutoBuffsConfig | null; // prayers and potions per style, or null to keep the loadout's own
  resultsPerStyle?: number;
  weaponsPerStyle?: number; // how many weapons per style get the full refinement
}

export interface OptimizeResult {
  family: AutoBuffStyle;
  dps: number;
  maxHit: number;
  accuracy: number;
  equipment: PlayerEquipment;
  style: PlayerCombatStyle;
  spell: Spell | null;
  prayers: Prayer[];
  potions: Potion[];
}

export type ProgressFn = (done: number, total: number) => void;

export type ArmourSlot = Exclude<keyof PlayerEquipment, 'weapon'>;
export const ARMOUR_SLOTS = EQUIPMENT_SLOTS.filter((s) => s !== 'weapon') as ArmourSlot[];

const SPELL_STANCES = ['Autocast', 'Defensive Autocast', 'Manual Cast'];
const FALLBACK_SPELLS = ['Fire Surge', 'Ice Barrage'];

/**
 * Non-weapon items the calculator gives special effects to (taken from the names it checks for). These are always
 * tried, even when another item has better stats. Weapons are always tried individually anyway.
 */
export const styleFamily = (style: PlayerCombatStyle): AutoBuffStyle | null => {
  switch (style.type) {
    case 'stab':
    case 'slash':
    case 'crush':
      return 'melee';
    case 'ranged':
      return 'ranged';
    case 'magic':
      return 'magic';
    default:
      return null;
  }
};

const specialItems = (names: string[]) => new RegExp(`^(${names.join('|')})`, 'i');
const SPECIAL_EFFECT_ITEMS: { [family in AutoBuffStyle]: RegExp } & { any: RegExp } = {
  any: specialItems([
    'Black mask', 'Slayer helmet', 'Salve amulet', 'Amulet of avarice', 'Amulet of the damned', 'Elite void',
    'Void knight', 'Ring of suffering', 'Lightbearer', 'Echo boots', 'Magic secateurs',
  ]),
  melee: specialItems([
    'Berserker necklace', 'Obsidian', 'Tzhaar', "Inquisitor's", "Dharok's", "Verac's", "Torag's", 'Blood Moon',
    'Void melee',
  ]),
  ranged: specialItems(['Crystal (blessing|body|helm|legs)', "Karil's", 'Eclipse Moon', 'Void ranger', "Dizana's"]),
  magic: specialItems([
    "Ahrim's", 'Blue Moon', 'Void mage', 'Tome of', 'Elemental amulet', 'Chaos gauntlets', 'Confliction gauntlets',
    'Brimstone ring', '(Imbued )?(Guthix|Saradomin|Zamorak) (max )?cape',
  ]),
};

const hasSpecialEffect = (eq: EquipmentPiece, style: PlayerCombatStyle): boolean => {
  const family = styleFamily(style);
  return SPECIAL_EFFECT_ITEMS.any.test(eq.name) || (family !== null && SPECIAL_EFFECT_ITEMS[family].test(eq.name));
};

// Not available on normal accounts, or only inside a minigame
const EXCLUDED_ITEMS = /\((Deadman Mode|Last Man Standing|beta|historical)\)|^(Barbed|Blunt|Bullet|Field) arrow$/;

/**
 * Armour sets whose effect only applies to the whole set, tried together during refinement.
 */
export const ARMOUR_SETS: Partial<Record<ArmourSlot, RegExp>>[] = [
  ...['melee', 'ranger', 'mage'].flatMap((helm) => [
    {
      head: new RegExp(`^Void ${helm} helm`, 'i'), body: /^Void knight top/i, legs: /^Void knight robe/i, hands: /^Void knight gloves/i,
    },
    {
      head: new RegExp(`^Void ${helm} helm`, 'i'), body: /^Elite void top/i, legs: /^Elite void robe/i, hands: /^Void knight gloves/i,
    },
  ]),
  { head: /^Obsidian helmet/i, body: /^Obsidian platebody/i, legs: /^Obsidian platelegs/i },
  { head: /^Inquisitor's great helm/i, body: /^Inquisitor's hauberk/i, legs: /^Inquisitor's plateskirt/i },
  { head: /^Crystal helm/i, body: /^Crystal body/i, legs: /^Crystal legs/i },
  { head: /^Dharok's helm/i, body: /^Dharok's platebody/i, legs: /^Dharok's platelegs/i },
  { head: /^Verac's helm/i, body: /^Verac's brassard/i, legs: /^Verac's plateskirt/i },
  {
    head: /^Torag's helm/i, body: /^Torag's platebody/i, legs: /^Torag's platelegs/i, neck: /^Amulet of the damned/i,
  },
  {
    head: /^Karil's coif/i, body: /^Karil's leathertop/i, legs: /^Karil's leatherskirt/i, neck: /^Amulet of the damned/i,
  },
  {
    head: /^Ahrim's hood/i, body: /^Ahrim's robetop/i, legs: /^Ahrim's robeskirt/i, neck: /^Amulet of the damned/i,
  },
  ...['Blood', 'Blue', 'Eclipse'].map((moon) => ({
    head: new RegExp(`^${moon} Moon helm`, 'i'),
    body: new RegExp(`^${moon} Moon chestplate`, 'i'),
    legs: new RegExp(`^${moon} Moon tassets`, 'i'),
  })),
];

const setWithHelm = (helm: string) => ARMOUR_SETS.find((set) => set.head?.source.startsWith(`^${helm}`))!;

/**
 * Armour sets whose effect needs a particular weapon. With the quick "best stats" armour these weapons look much worse
 * than they are, so they're also screened wearing their set.
 */
export const WEAPON_SETS: { weapon: RegExp, set: Partial<Record<ArmourSlot, RegExp>> }[] = [
  { weapon: /^(Crystal bow|Bow of Faerdhinen)/i, set: setWithHelm('Crystal helm') },
  { weapon: /^(Tzhaar-ket-em|Tzhaar-ket-om|Toktz-xil-ak|Toktz-xil-ek|Toktz-mej-tal)/i, set: setWithHelm('Obsidian helmet') },
  { weapon: /^Dharok's greataxe/i, set: setWithHelm("Dharok's helm") },
  { weapon: /^Verac's flail/i, set: setWithHelm("Verac's helm") },
  { weapon: /^Karil's crossbow/i, set: setWithHelm("Karil's coif") },
  { weapon: /^Ahrim's staff/i, set: setWithHelm("Ahrim's hood") },
  { weapon: /^Dual macuahuitl/i, set: setWithHelm('Blood Moon helm') },
  { weapon: /^Eclipse atlatl/i, set: setWithHelm('Eclipse Moon helm') },
  { weapon: /^Blue Moon spear/i, set: setWithHelm('Blue Moon helm') },
];

/**
 * The stats that matter for a style's damage: attack bonus and strength bonus.
 */
const relevantStats = (eq: EquipmentPiece, style: PlayerCombatStyle): number[] => {
  const o = eq.offensive;
  const b = eq.bonuses;
  switch (style.type) {
    case 'stab':
    case 'slash':
    case 'crush':
      return [o[style.type], b.str];
    case 'ranged':
      return [o.ranged, b.ranged_str];
    case 'magic':
      return [o.magic, b.magic_str];
    default:
      return [];
  }
};

/**
 * Drops items that another item beats or ties on every relevant stat, unless they have a special effect.
 */
export const withoutDominated = (items: EquipmentPiece[], style: PlayerCombatStyle): EquipmentPiece[] => {
  const stats = items.map((eq) => relevantStats(eq, style));
  return items.filter((eq, i) => hasSpecialEffect(eq, style) || !items.some((_, j) => {
    if (i === j) return false;
    const better = stats[j].every((v, k) => v >= stats[i][k]);
    const strictlyBetter = stats[j].some((v, k) => v > stats[i][k]);
    // On an exact tie, keep the first of the identical items
    return better && (strictlyBetter || j < i);
  }));
};

/**
 * A rough "how good is this item for this style" score, only used to pick starting gear and to trim large slots.
 * The real calculator decides everything else.
 */
export const statScore = (eq: EquipmentPiece, style: PlayerCombatStyle): number => {
  const o = eq.offensive;
  const b = eq.bonuses;
  switch (style.type) {
    case 'stab':
    case 'slash':
    case 'crush':
      return o[style.type] + 2 * b.str;
    case 'ranged':
      return o.ranged + 2 * b.ranged_str;
    case 'magic':
      return o.magic + 0.3 * b.magic_str;
    default:
      return 0;
  }
};

export const requiresAmmo = (weapon: EquipmentPiece) => ammoApplicability(weapon.id, undefined) === AmmoApplicability.INVALID;

type SlotOptions = (EquipmentPiece | null)[];

export const isWearingAll = (gear: PlayerEquipment, pieces: Partial<PlayerEquipment>) => Object.entries(pieces)
  .every(([slot, eq]) => gear[slot as ArmourSlot]?.id === eq?.id);

export interface Candidate {
  weapon: EquipmentPiece;
  style: PlayerCombatStyle;
  spell: Spell | null;
  family: AutoBuffStyle;
}

/**
 * The items of a pool that the search actually tries against a monster.
 */
export const resolvePool = (poolIds: number[], monster: Monster): EquipmentPiece[] => {
  // Ornament kits, recolours and locked versions work the same, so only the base item of each is tried
  const ids = new Set(poolIds.map((id) => getCanonicalItemId(id)));
  // Versions of the same item (Barrows degradation, charged/uncharged, ...) differ only in stats, so only the
  // strongest is kept
  const byName = new Map<string, EquipmentPiece>();
  const inGauntlet = [...GAUNTLET_MONSTER_IDS, ...CORRUPTED_GAUNTLET_MONSTER_IDS].includes(monster.id);
  const gauntletOnly = new Set([...GAUNTLET_EQUIPMENT_IDS, ...CORRUPTED_GAUNTLET_EQUIPMENT_IDS]);
  const total = (e: EquipmentPiece) => Object.values(e.offensive).reduce((a, b) => a + b, 0)
    + Object.values(e.bonuses).reduce((a, b) => a + b, 0);
  for (const eq of availableEquipment) {
    if (!ids.has(eq.id) || EXCLUDED_ITEMS.test(eq.name)) continue;
    // Greegrees, crates and other novelty "weapons" have no attack speed and break the DPS formula
    if (eq.slot === 'weapon' && eq.speed <= 0) continue;
    if (gauntletOnly.has(eq.id) && !inGauntlet) continue;
    const existing = byName.get(eq.name);
    if (!existing || total(eq) > total(existing)) byName.set(eq.name, eq);
  }
  return [...byName.values()];
};

export class Optimizer {
  private readonly opts: OptimizeOptions;

  private readonly pool: EquipmentPiece[];

  private readonly bySlot: Map<string, EquipmentPiece[]>;

  private readonly buffs: Map<AutoBuffStyle, Pick<Player, 'prayers' | 'boosts'> & { potions: Potion[] }> = new Map();

  private readonly spells: Spell[];

  private readonly candidateCache: Map<string, SlotOptions> = new Map();

  public evaluations = 0;

  constructor(opts: OptimizeOptions) {
    this.opts = opts;
    this.pool = opts.pool ?? resolvePool(opts.poolIds, opts.monster);
    this.bySlot = new Map();
    for (const eq of this.pool) {
      this.bySlot.set(eq.slot, [...(this.bySlot.get(eq.slot) || []), eq]);
    }

    const { player, buffsConfig, monster } = opts;
    for (const family of ['melee', 'ranged', 'magic'] as AutoBuffStyle[]) {
      if (buffsConfig) {
        const prayers = buffsConfig[family].prayers.reduce((acc, p) => addPrayer(acc, p), [] as Prayer[]);
        const potions = withAutoBuffPotions(player.buffs.potions, buffsConfig, family, getRaid(monster));
        this.buffs.set(family, { prayers, potions, boosts: { ...player.boosts, ...calculatePotionBoosts(potions, player.skills) } });
      } else {
        this.buffs.set(family, { prayers: player.prayers, potions: player.buffs.potions, boosts: player.boosts });
      }
    }

    this.spells = [player.spell, ...FALLBACK_SPELLS.map((s) => spellByName(s))]
      .filter(isDefined)
      .filter((s, i, arr) => arr.findIndex((o) => o.name === s.name) === i);
  }

  private buildPlayer(gear: PlayerEquipment, c: Candidate): Player {
    const buffs = this.buffs.get(c.family)!;
    const player: Player = {
      ...this.opts.player,
      equipment: gear,
      style: c.style,
      spell: c.spell,
      prayers: buffs.prayers,
      boosts: buffs.boosts,
      buffs: { ...this.opts.player.buffs, potions: buffs.potions },
    };
    return { ...player, ...calculateEquipmentBonusesFromGear(player, this.opts.monster) };
  }

  public evaluate(gear: PlayerEquipment, c: Candidate): number {
    this.evaluations += 1;
    const dps = new PlayerVsNPCCalc(this.buildPlayer(gear, c), this.opts.monster).getDps();
    return Number.isFinite(dps) ? dps : 0;
  }

  public result(gear: PlayerEquipment, c: Candidate): OptimizeResult {
    const player = this.buildPlayer(gear, c);
    const calc = new PlayerVsNPCCalc(player, this.opts.monster);
    return {
      family: c.family,
      dps: calc.getDps(),
      maxHit: calc.getDistribution().getMax(),
      accuracy: calc.getDisplayHitChance(),
      equipment: gear,
      style: c.style,
      spell: c.spell,
      prayers: player.prayers,
      potions: player.buffs.potions,
    };
  }

  /**
   * Items to try in a slot for a weapon and style. Empty (null) is always an option, except for required ammo.
   */
  public slotCandidates(slot: ArmourSlot, c: Candidate): SlotOptions {
    if (slot === 'shield' && c.weapon.isTwoHanded) return [null];

    const ammoFor = slot === 'ammo' && requiresAmmo(c.weapon) ? c.weapon.id : '';
    const key = `${slot}:${c.style.type}:${ammoFor}`;
    let cached = this.candidateCache.get(key);
    if (!cached) {
      cached = this.computeSlotCandidates(slot, c, ammoFor !== '');
      this.candidateCache.set(key, cached);
    }
    return cached;
  }

  private computeSlotCandidates(slot: ArmourSlot, c: Candidate, ammoRequired: boolean): SlotOptions {
    const items = this.bySlot.get(slot) || [];
    if (ammoRequired) {
      // Bolt and arrow effects matter, so all usable ammo is tried
      return items.filter((a) => ammoApplicability(c.weapon.id, a.id) === AmmoApplicability.INCLUDED);
    }
    return [null, ...withoutDominated(items, c.style)];
  }

  public startingGear(c: Candidate): PlayerEquipment {
    const gear = { weapon: c.weapon } as PlayerEquipment;
    for (const slot of ARMOUR_SLOTS) {
      // Weapons that don't load ammo get nothing from the ammo slot's ranged strength, so it starts empty
      // (the refinement still adds anything there that actually helps)
      if (slot === 'ammo' && !requiresAmmo(c.weapon)) {
        gear.ammo = null;
        continue;
      }
      const options = this.slotCandidates(slot, c);
      // Required ammo is always filled; other slots stay empty unless something helps the style
      const fallback = slot === 'ammo' ? options[0] ?? null : null;
      gear[slot] = options.filter(isDefined).reduce<EquipmentPiece | null>(
        (best, eq) => (statScore(eq, c.style) > (best ? statScore(best, c.style) : 0) ? eq : best),
        fallback,
      );
    }
    return gear;
  }

  /**
   * A blowpipe once per dart, or any other weapon as it is. A blowpipe uses the darts the user picked for it if
   * they did, or else the darts in the pool it can load. Darts loaded into a blowpipe don't show up in a bank export,
   * so with none in the pool every dart it can load is tried.
   */
  public weaponVariants(w: EquipmentPiece): EquipmentPiece[] {
    if (!BLOWPIPE_IDS.includes(w.id)) return [w];
    const loadable = loadableDarts(w);
    const inPool = loadable.filter((d) => this.pool.some((eq) => eq.id === d.id));
    return (chosenBlowpipeDarts(this.opts.blowpipeDarts, w) ?? (inPool.length > 0 ? inPool : loadable))
      .map((d) => ({ ...w, itemVars: { ...w.itemVars, blowpipeDartName: d.name, blowpipeDartId: d.id } }));
  }

  /**
   * A weapon in every searched combat style and spell it can use.
   */
  public candidatesFor(weapon: EquipmentPiece): Candidate[] {
    const result: Candidate[] = [];
    const styles = getCombatStylesForCategory(weapon.category);
    const hasAutocast = styles.some((s) => s.stance === 'Autocast');
    for (const style of styles) {
      const family = styleFamily(style);
      if (!family || !this.opts.styles.includes(family)) continue;

      if (style.stance && SPELL_STANCES.includes(style.stance)) {
        // Only weapons that can autocast (staves, wands) are used for spells; one spell stance is enough
        if (!hasAutocast || style.stance !== 'Autocast') continue;
        for (const spell of this.spells) {
          result.push({
            weapon, style, spell, family,
          });
        }
      } else {
        result.push({
          weapon, style, spell: null, family,
        });
      }
    }
    return result;
  }

  /**
   * Every weapon (with each loadable dart, for blowpipes) in every combat style and spell it can use.
   */
  public candidates(): Candidate[] {
    return (this.bySlot.get('weapon') || [])
      .flatMap((w) => this.weaponVariants(w))
      .flatMap((w) => this.candidatesFor(w));
  }

  /**
   * The strongest version of each piece of an armour set, or null if the pool is missing a piece.
   */
  public setPieces(set: Partial<Record<ArmourSlot, RegExp>>, c: Candidate): Partial<PlayerEquipment> | null {
    const pieces = Object.entries(set).map(([slot, pattern]) => {
      const matches = (this.bySlot.get(slot) || []).filter((eq) => pattern!.test(eq.name));
      return [slot, matches.sort((a, b) => statScore(b, c.style) - statScore(a, c.style))[0]] as const;
    });
    return pieces.every(([, eq]) => eq) ? Object.fromEntries(pieces) : null;
  }

  /**
   * The gear a weapon is screened with: the starting gear, or its armour set if the weapon needs one and that's better.
   */
  public screeningGear(c: Candidate): { gear: PlayerEquipment, dps: number } {
    const start = this.startingGear(c);
    let best = { gear: start, dps: this.evaluate(start, c) };
    for (const { weapon, set } of WEAPON_SETS) {
      const pieces = weapon.test(c.weapon.name) ? this.setPieces(set, c) : null;
      if (!pieces) continue;
      const gear = { ...start, ...pieces };
      const dps = this.evaluate(gear, c);
      if (dps > best.dps) best = { gear, dps };
    }
    return best;
  }

  public refine(start: PlayerEquipment, c: Candidate): { gear: PlayerEquipment, candidate: Candidate, dps: number } {
    let gear = start;
    let candidate = c;
    let best = this.evaluate(gear, candidate);

    const tryGear = (next: PlayerEquipment, nextCandidate: Candidate = candidate) => {
      const dps = this.evaluate(next, nextCandidate);
      if (dps > best + 1e-9) {
        best = dps;
        gear = next;
        candidate = nextCandidate;
        return true;
      }
      return false;
    };

    const sameFamilyStyles = getCombatStylesForCategory(c.weapon.category)
      .filter((s) => styleFamily(s) === c.family && (c.spell ? s.stance === c.style.stance : !SPELL_STANCES.includes(s.stance || '')));

    // Each armour set the pool has every piece of
    const setMoves = ARMOUR_SETS.map((set) => this.setPieces(set, c)).filter(isDefined);

    for (let pass = 0; pass < 5; pass++) {
      let improved = false;

      for (const slot of ARMOUR_SLOTS) {
        for (const item of this.slotCandidates(slot, candidate)) {
          if (item?.id === gear[slot]?.id) continue;
          if (tryGear({ ...gear, [slot]: item })) improved = true;
        }
      }

      for (const pieces of setMoves) {
        if (!isWearingAll(gear, pieces) && tryGear({ ...gear, ...pieces })) improved = true;
      }

      for (const style of sameFamilyStyles) {
        if (style.name === candidate.style.name && style.stance === candidate.style.stance) continue;
        if (tryGear(gear, { ...candidate, style })) improved = true;
      }

      if (!improved) break;
    }

    return { gear, candidate, dps: best };
  }

  public run(onProgress?: ProgressFn): OptimizeResult[] {
    const { resultsPerStyle = 3, weaponsPerStyle = 8 } = this.opts;
    const candidates = this.candidates();

    // 1. Screening: the best style/spell per weapon, scored with simple starting gear (or the weapon's armour set)
    const screened = new Map<string, { candidate: Candidate, gear: PlayerEquipment, dps: number }>();
    candidates.forEach((c, i) => {
      const { gear, dps } = this.screeningGear(c);
      // One entry per weapon: a blowpipe keeps its best dart, so darts don't crowd other weapons out of the shortlist
      const key = `${c.family}:${c.weapon.id}`;
      if (!screened.has(key) || dps > screened.get(key)!.dps) screened.set(key, { candidate: c, gear, dps });
      if (i % 50 === 0) onProgress?.(i, candidates.length * 2);
    });

    // 2. Refinement of the most promising weapons per style
    const shortlist = this.opts.styles.flatMap((family) => [...screened.values()]
      .filter((s) => s.candidate.family === family && s.dps > 0)
      .sort((a, b) => b.dps - a.dps)
      .slice(0, weaponsPerStyle));

    const results: OptimizeResult[] = shortlist.map(({ candidate, gear }, i) => {
      onProgress?.(candidates.length + Math.round(((i + 1) / shortlist.length) * candidates.length), candidates.length * 2);
      const refined = this.refine(gear, candidate);
      return this.result(refined.gear, refined.candidate);
    });

    onProgress?.(1, 1);
    // The best few of each style, so a style that loses overall still shows its best options
    return this.opts.styles
      .flatMap((family) => results
        .filter((r) => r.family === family && r.dps > 0)
        .sort((a, b) => b.dps - a.dps)
        .slice(0, resultsPerStyle))
      .sort((a, b) => b.dps - a.dps);
  }
}

export const optimize = (opts: OptimizeOptions, onProgress?: ProgressFn): OptimizeResult[] => new Optimizer(opts).run(onProgress);
