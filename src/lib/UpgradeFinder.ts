import { AmmoApplicability, ammoApplicability } from '@/lib/Equipment';
import { AutoBuffsConfig, AutoBuffStyle } from '@/lib/AutoBuffs';
import {
  ARMOUR_SETS, ARMOUR_SLOTS, ArmourSlot, Candidate, isWearingAll, OptimizeResult, Optimizer, ProgressFn, requiresAmmo,
  WEAPON_SETS,
  resolvePool, statScore, withoutDominated,
} from '@/lib/Optimizer';
import { BLOWPIPE_IDS } from '@/lib/constants';
import { EquipmentPiece, Player, PlayerEquipment } from '@/types/Player';
import { Monster } from '@/types/Monster';
import type { BlowpipeDarts } from '@/types/State';

/*
 * Finds the items that would raise your DPS the most against a monster, compared to the best setup you can already
 * make from what you own.
 *
 * 1. Baseline: the best owned setup per combat style, found with the optimizer.
 * 2. Screening: every item you don't own is swapped into the baseline of each style it could help (weapons with the
 *    ammo they need, armour sets as a whole). Armour that another item beats on every relevant stat is skipped.
 * 3. Refinement: the most promising upgrades get the optimizer's slot-by-slot refinement with everything you own,
 *    so e.g. a new weapon can pick a different amulet or combat style.
 *
 * Results for several monsters are combined by combineUpgrades, which ranks upgrades by kill time saved.
 */

export interface UpgradeFinderOptions {
  player: Player; // skills, buffs and spell are kept
  monster: Monster;
  ownedIds: number[]; // what the baseline may use
  candidateIds: number[]; // what may be acquired; owned items are skipped
  blowpipeDarts?: BlowpipeDarts[]; // the darts the user picked for their blowpipes: owned, and used for the baseline
  styles: AutoBuffStyle[];
  buffsConfig: AutoBuffsConfig | null;
  refineCount?: number; // how many of the best screened upgrades get the full refinement
  maxResults?: number;
}

export interface UpgradeOption {
  key: string; // the same upgrade has the same key for every monster
  items: EquipmentPiece[]; // what has to be acquired
  dps: number;
  setup: OptimizeResult;
}

export interface MonsterUpgrades {
  baseline: OptimizeResult | null; // the best owned setup, or null if nothing owned can hurt the monster
  upgrades: UpgradeOption[]; // only upgrades over the baseline, best first
}

const EPSILON = 1e-6;

interface Entry {
  key: string;
  items: EquipmentPiece[];
  gear: PlayerEquipment;
  candidate: Candidate;
  dps: number;
  refined: boolean;
}

const sameItem = (a: EquipmentPiece | null | undefined, b: EquipmentPiece) => a?.id === b.id
  && a.itemVars?.blowpipeDartId === b.itemVars?.blowpipeDartId;

const isWearing = (gear: PlayerEquipment, eq: EquipmentPiece) => sameItem(gear[eq.slot as keyof PlayerEquipment], eq)
  // Blowpipe darts are worn inside the weapon
  || (gear.weapon?.itemVars?.blowpipeDartId === eq.id);

export const findUpgrades = (opts: UpgradeFinderOptions, onProgress?: ProgressFn): MonsterUpgrades => {
  const {
    player, monster, styles, buffsConfig, refineCount = 15, maxResults = 80,
  } = opts;
  const progress = (fraction: number) => onProgress?.(Math.round(fraction * 1000), 1000);

  // Darts picked for a blowpipe are loaded into it, so they're owned although a bank export doesn't show them
  const ownedIds = [...opts.ownedIds, ...(opts.blowpipeDarts ?? []).flatMap((c) => c.dartIds)];
  const owned = resolvePool(ownedIds, monster);
  const ownedNames = new Set(owned.map((eq) => eq.name));
  const all = resolvePool([...opts.candidateIds, ...ownedIds], monster);
  const isOwned = (eq: EquipmentPiece) => ownedNames.has(eq.name);
  const base = {
    player, monster, poolIds: [], styles, buffsConfig,
  };
  const withPool = (pool: EquipmentPiece[]) => new Optimizer({ ...base, pool });

  // 1. Baseline: the best owned setup per style, with blowpipes loaded with the picked darts. Other darts can still
  // be suggested as upgrades.
  const baselines = new Map<AutoBuffStyle, OptimizeResult>();
  for (const r of new Optimizer({ ...base, pool: owned, blowpipeDarts: opts.blowpipeDarts })
    .run((done, total) => progress(0.25 * (done / total)))) {
    if (!baselines.has(r.family) && r.equipment.weapon) baselines.set(r.family, r);
  }
  const baselineDps = Math.max(0, ...[...baselines.values()].map((b) => b.dps));
  const baselineCandidate = (b: OptimizeResult): Candidate => ({
    weapon: b.equipment.weapon!, style: b.style, spell: b.spell, family: b.family,
  });

  // 2. Screening
  const scan = withPool(all);
  const entries = new Map<string, Entry>();
  const consider = (key: string, items: EquipmentPiece[], gear: PlayerEquipment, candidate: Candidate) => {
    const dps = scan.evaluate(gear, candidate);
    const existing = entries.get(key);
    if (!existing || dps > existing.dps) {
      entries.set(key, {
        key, items, gear, candidate, dps, refined: false,
      });
    }
  };

  // Armour, worn with each style's baseline weapon
  for (const b of baselines.values()) {
    const c = baselineCandidate(b);
    for (const slot of ARMOUR_SLOTS) {
      if (slot === 'shield' && c.weapon.isTwoHanded) continue;
      let options = all.filter((eq) => eq.slot === slot);
      options = slot === 'ammo' && requiresAmmo(c.weapon)
        ? options.filter((a) => ammoApplicability(c.weapon.id, a.id) === AmmoApplicability.INCLUDED)
        : withoutDominated(options, c.style);
      for (const eq of options) {
        if (!isOwned(eq)) consider(`${eq.id}`, [eq], { ...b.equipment, [slot]: eq }, c);
      }
    }

    // Sets only pay off as a whole, so the missing pieces are also tried together
    for (const set of ARMOUR_SETS) {
      const pieces = Object.entries(set).map(([slot, pattern]) => all
        .filter((eq) => eq.slot === slot && pattern!.test(eq.name))
        .sort((x, y) => statScore(y, c.style) - statScore(x, c.style))[0]);
      if (pieces.some((p) => !p)) continue;
      const missing = pieces.filter((p) => !isOwned(p));
      // A single missing piece is already tried on its own
      if (missing.length < 2) continue;
      const gear = { ...b.equipment, ...Object.fromEntries(pieces.map((p) => [p.slot, p])) };
      consider(`set:${missing.map((p) => p.id).join(',')}`, missing, gear, c);
    }
  }
  progress(0.4);

  // Weapons (and darts for owned blowpipes), worn with the baseline armour of their style
  // Owned weapons are tried too if they need an armour set, to find the missing pieces
  const needsSet = (eq: EquipmentPiece) => WEAPON_SETS.some((s) => s.weapon.test(eq.name));
  const weapons = all.filter((eq) => eq.slot === 'weapon' && (!isOwned(eq) || BLOWPIPE_IDS.includes(eq.id) || needsSet(eq)));
  weapons.forEach((w, wi) => {
    const variants = scan.weaponVariants(w);
    // Prefer darts you own, if the blowpipe can use any
    const ownedDart = (v: EquipmentPiece) => all.find((d) => d.id === v.itemVars?.blowpipeDartId && isOwned(d));
    const usable = variants.some(ownedDart) ? variants.filter((v) => isOwned(w) || ownedDart(v)) : variants;

    for (const weapon of usable) {
      const dart = all.find((d) => d.id === weapon.itemVars?.blowpipeDartId);
      const newItems = [w, ...(dart ? [dart] : [])].filter((eq) => !isOwned(eq));
      if (newItems.length === 0 && !needsSet(weapon)) continue;
      const key = newItems.length > 0 ? newItems.map((eq) => eq.id).join('+') : `set-for:${w.id}`;

      const ammoByFamily = new Map<AutoBuffStyle, EquipmentPiece | null>();
      for (const c of scan.candidatesFor(weapon)) {
        const b = baselines.get(c.family);
        let gear: PlayerEquipment;
        let items = newItems;
        if (b) {
          gear = { ...b.equipment, weapon };
          if (weapon.isTwoHanded) gear.shield = null;
          if (!requiresAmmo(weapon)) {
            if (gear.ammo && ammoApplicability(weapon.id, gear.ammo.id) === AmmoApplicability.INVALID) gear.ammo = null;
          } else if (!gear.ammo || ammoApplicability(weapon.id, gear.ammo.id) !== AmmoApplicability.INCLUDED) {
            // The best ammo it can fire: your own if you have any, or else the best there is
            if (!ammoByFamily.has(c.family)) {
              const usableAmmo = all.filter((a) => a.slot === 'ammo' && ammoApplicability(weapon.id, a.id) === AmmoApplicability.INCLUDED);
              const ownedAmmo = usableAmmo.filter(isOwned);
              const choices = ownedAmmo.length > 0 ? ownedAmmo : usableAmmo;
              let bestAmmo: EquipmentPiece | null = null;
              let bestDps = -1;
              for (const a of choices) {
                const dps = scan.evaluate({ ...gear, ammo: a }, c);
                if (dps > bestDps) {
                  bestDps = dps;
                  bestAmmo = a;
                }
              }
              ammoByFamily.set(c.family, bestAmmo);
            }
            gear.ammo = ammoByFamily.get(c.family)!;
            if (gear.ammo && !isOwned(gear.ammo)) items = [...newItems, gear.ammo];
          }
        } else {
          // Nothing owned for this style yet: start from the best owned stats per slot
          const extraAmmo = requiresAmmo(weapon) && !owned.some((a) => ammoApplicability(weapon.id, a.id) === AmmoApplicability.INCLUDED)
            ? all.filter((a) => a.slot === 'ammo' && ammoApplicability(weapon.id, a.id) === AmmoApplicability.INCLUDED)
            : [];
          gear = withPool([...owned, ...newItems, ...extraAmmo]).startingGear(c);
          if (gear.ammo && !isOwned(gear.ammo)) items = [...newItems, gear.ammo];
        }
        if (newItems.length > 0) consider(key, items, gear, c);

        // Weapons that need their armour set (bowfa and crystal, ...) are also tried wearing it, buying what's missing
        for (const { weapon: pattern, set } of WEAPON_SETS) {
          const pieces = pattern.test(weapon.name) ? scan.setPieces(set, c) : null;
          if (!pieces) continue;
          const missing = Object.values(pieces).filter((eq): eq is EquipmentPiece => !!eq && !isOwned(eq));
          if (newItems.length === 0 && missing.length === 0) continue;
          consider(key, [...items, ...missing], { ...gear, ...pieces }, c);
        }
      }
    }
    if (wi % 50 === 0) progress(0.4 + 0.35 * (wi / weapons.length));
  });
  progress(0.75);

  // 3. Refinement of the most promising upgrades, with everything owned
  const ranked = [...entries.values()].filter((e) => e.dps > baselineDps + EPSILON).sort((x, y) => y.dps - x.dps);
  ranked.slice(0, refineCount).forEach((e, i) => {
    const optimizer = withPool([...owned, ...e.items]);
    const starts = [e.gear];
    // Swapping one piece out of a set loses the set effect, so also try starting over without it
    const b = baselines.get(e.candidate.family);
    const baselineSet = b && ARMOUR_SETS.find((set) => Object.entries(set)
      .every(([slot, pattern]) => pattern!.test(b.equipment[slot as ArmourSlot]?.name ?? '')));
    if (b && baselineSet) {
      const setPieces = Object.fromEntries(Object.keys(baselineSet).map((slot) => [slot, b.equipment[slot as ArmourSlot]]));
      if (!isWearingAll(e.gear, setPieces)) starts.push(optimizer.startingGear(e.candidate));
    }

    for (const start of starts) {
      const refined = optimizer.refine(start, e.candidate);
      // The upgrade has to stay in the setup, or the gain didn't come from it
      const kept = e.items.filter((eq) => isWearing(refined.gear, eq));
      if (kept.length > 0 && refined.dps > e.dps) {
        e.dps = refined.dps;
        e.gear = refined.gear;
        e.candidate = refined.candidate;
        e.items = kept;
      }
    }
    e.refined = true;
    progress(0.75 + 0.25 * ((i + 1) / Math.min(refineCount, ranked.length)));
  });

  progress(1);
  return {
    baseline: [...baselines.values()].sort((x, y) => y.dps - x.dps)[0] ?? null,
    upgrades: ranked
      .filter((e) => e.dps > baselineDps + EPSILON)
      .sort((x, y) => y.dps - x.dps)
      .slice(0, maxResults)
      .map((e) => ({
        key: e.key, items: e.items, dps: e.dps, setup: scan.result(e.gear, e.candidate),
      })),
  };
};

export interface UpgradeTarget {
  hp: number; // health to kill, for the time saved
  weight: number; // how many times it's killed per run
}

export interface CombinedUpgrade {
  key: string;
  items: EquipmentPiece[];
  secondsSaved: number; // over every target you can already kill, weighted
  unlocks: number[]; // targets nothing you own can damage, but this can
  perTarget: (UpgradeOption | null)[]; // null where it's no upgrade
}

/**
 * Kill time with a DPS, or Infinity if nothing can damage the monster.
 */
export const killTime = (target: UpgradeTarget, dps: number) => (dps > 0 ? (target.weight * target.hp) / dps : Infinity);

/**
 * Ranks upgrades over several monsters by the total kill time they save. Monsters you can't damage yet have no kill
 * time to save, so upgrades that make them killable are listed in unlocks instead.
 */
export const combineUpgrades = (results: MonsterUpgrades[], targets: UpgradeTarget[]): CombinedUpgrade[] => {
  const byKey = new Map<string, CombinedUpgrade>();
  results.forEach((r, i) => {
    if (targets[i].weight <= 0) return;
    const before = killTime(targets[i], r.baseline?.dps ?? 0);
    for (const u of r.upgrades) {
      let combined = byKey.get(u.key);
      if (!combined) {
        combined = {
          key: u.key, items: u.items, secondsSaved: 0, unlocks: [], perTarget: results.map(() => null),
        };
        byKey.set(u.key, combined);
      }
      combined.perTarget[i] = u;
      if (Number.isFinite(before)) combined.secondsSaved += before - killTime(targets[i], u.dps);
      else combined.unlocks.push(i);
      // Show the most items any monster needed (e.g. ammo for a new bow)
      if (u.items.length > combined.items.length) combined.items = u.items;
    }
  });
  return [...byKey.values()]
    .filter((u) => u.secondsSaved > 0 || u.unlocks.length > 0)
    .sort((x, y) => y.secondsSaved - x.secondsSaved || y.unlocks.length - x.unlocks.length);
};
