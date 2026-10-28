import Potion from '@/enums/Potion';
import { addPrayer, Prayer, PrayerMap } from '@/enums/Prayer';
import { MonsterAttribute } from '@/enums/MonsterAttribute';
import { TOMBS_OF_AMASCUT_MONSTER_IDS } from '@/lib/constants';
import { Monster } from '@/types/Monster';
import { EquipmentPiece, PlayerSkills } from '@/types/Player';
import { PlayerCombatStyle } from '@/types/PlayerCombatStyle';
import { PotionMap } from '@/utils';

export type AutoBuffStyle = 'melee' | 'ranged' | 'magic';
export type Raid = 'cox' | 'toa';

/**
 * What the "automatically enable buffs" setting turns on, configured in the settings menu.
 */
export interface AutoBuffsConfig {
  melee: { potions: Potion[], prayers: Prayer[] };
  ranged: { potions: Potion[], prayers: Prayer[] };
  magic: { potions: Potion[], prayers: Prayer[] };
  cox: Potion[]; // replaces the style's potions against Chambers of Xeric monsters
  toa: Potion[]; // replaces the style's potions against Tombs of Amascut monsters
}

export const DEFAULT_AUTO_BUFFS_CONFIG: AutoBuffsConfig = {
  melee: { potions: [Potion.SUPER_COMBAT], prayers: [Prayer.PIETY] },
  ranged: { potions: [Potion.RANGING], prayers: [Prayer.RIGOUR] },
  magic: { potions: [Potion.SATURATED_HEART], prayers: [Prayer.AUGURY] },
  cox: [Potion.OVERLOAD_PLUS],
  toa: [Potion.SMELLING_SALTS],
};

export const AUTO_BUFF_STYLES: AutoBuffStyle[] = ['melee', 'ranged', 'magic'];

// Boosts each potion gives at 99 in every skill, used to decide which styles it helps and how much.
const MAXED_SKILLS: PlayerSkills = {
  atk: 99, str: 99, def: 99, ranged: 99, magic: 99, hp: 99, prayer: 99, mining: 99, herblore: 99, farming: 99,
};
const potionBoostFor = (potion: Potion, style: AutoBuffStyle | 'any'): number => {
  const b = PotionMap[potion].calculateFn(MAXED_SKILLS);
  const atk = Math.max(b.atk ?? 0, 0);
  const str = Math.max(b.str ?? 0, 0);
  const ranged = Math.max(b.ranged ?? 0, 0);
  const magic = Math.max(b.magic ?? 0, 0);
  switch (style) {
    case 'melee':
      return atk + str;
    case 'ranged':
      return ranged;
    case 'magic':
      return magic;
    default:
      return atk + str + ranged + magic;
  }
};

const ALL_POTIONS = Object.keys(PotionMap).map(Number) as Potion[];

/**
 * Potions that boost a style (or any combat stat, for raids), strongest first.
 */
export const potionOptionsFor = (style: AutoBuffStyle | 'any'): Potion[] => ALL_POTIONS
  .filter((p) => potionBoostFor(p, style) > 0)
  .sort((a, b) => potionBoostFor(b, style) - potionBoostFor(a, style));

const prayerScore = (prayer: Prayer): number => {
  const d = PrayerMap[prayer];
  return (d.factorAccuracy?.[0] ?? 100) + (d.factorStrength?.[0] ?? 100) + (d.magicDamageBonus ?? 0);
};

/**
 * Offensive prayers for a style, strongest first.
 */
export const prayerOptionsFor = (style: AutoBuffStyle): Prayer[] => (Object.keys(PrayerMap).map(Number) as Prayer[])
  .filter((p) => PrayerMap[p].combatStyle === style)
  .sort((a, b) => prayerScore(b) - prayerScore(a));

export const getRaid = (monster: Pick<Monster, 'id' | 'attributes'>): Raid | null => {
  if (TOMBS_OF_AMASCUT_MONSTER_IDS.includes(monster.id)) return 'toa';
  if (monster.attributes.includes(MonsterAttribute.XERICIAN)) return 'cox';
  return null;
};

/**
 * The style a weapon is used with. Staves and wands default to a melee stance, so a weapon with more magic attack
 * than melee attack counts as magic.
 */
export const autoBuffStyleFor = (weapon: EquipmentPiece, style: PlayerCombatStyle): AutoBuffStyle | null => {
  if (style.type === 'ranged') return 'ranged';
  if (style.type === 'magic') return 'magic';
  if (style.type === null) return null;

  const {
    stab, slash, crush, magic,
  } = weapon.offensive;
  return magic > Math.max(stab, slash, crush) ? 'magic' : 'melee';
};

/**
 * Every potion the config can turn on. These are removed before the right ones are added, so switching weapon
 * style or moving into a raid swaps them; potions the user picked that aren't in the config are left alone.
 */
export const managedPotions = (config: AutoBuffsConfig): Potion[] => [...new Set([
  ...AUTO_BUFF_STYLES.flatMap((s) => config[s].potions), ...config.cox, ...config.toa,
])];

export const autoBuffPotionsFor = (config: AutoBuffsConfig, style: AutoBuffStyle | null, raid: Raid | null): Potion[] => {
  if (raid) return config[raid];
  return style ? config[style].potions : [];
};

export const withAutoBuffPotions = (
  potions: Potion[],
  config: AutoBuffsConfig,
  style: AutoBuffStyle | null,
  raid: Raid | null,
): Potion[] => {
  const managed = managedPotions(config);
  return [...new Set([...potions.filter((p) => !managed.includes(p)), ...autoBuffPotionsFor(config, style, raid)])];
};

/**
 * Turns on the style's prayers, turning off any prayers they can't be combined with.
 */
export const withAutoBuffPrayers = (prayers: Prayer[], config: AutoBuffsConfig, style: AutoBuffStyle): Prayer[] => config[style].prayers
  .reduce((acc, p) => addPrayer(acc, p), prayers);
