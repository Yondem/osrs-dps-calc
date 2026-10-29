import { BankData } from '@/lib/Bank';
import { CustomSettings, Preferences } from '@/types/State';

const BACKUP_FORMAT = 'dps-calc-backup';
const BACKUP_VERSION = 1;

/**
 * Everything saved in settings, as a file that can be moved between the desktop app, the website and other browsers
 * (each keeps its own storage).
 */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  prefs: Partial<Preferences>;
  custom: Partial<CustomSettings>;
  bank: BankData | null;
}

export const createBackup = (prefs: Preferences, custom: CustomSettings, bank: BankData | null): Backup => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  prefs,
  custom,
  bank,
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const CUSTOM_ARRAYS: (keyof CustomSettings)[] = ['hiddenItemIds', 'itemTags', 'savedSetups', 'hiddenPresets'];

/**
 * Reads a backup made by {@link createBackup}, throwing an error with a readable message if it isn't one.
 */
export const parseBackup = (text: string): Backup => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('That isn\'t a DPS Calc backup. Make sure you copied or picked the whole export.');
  }

  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    throw new Error('That isn\'t a DPS Calc backup. Make sure you copied or picked the whole export.');
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error('This backup is from a newer version of the calculator. Update this one first.');
  }

  const prefs = isObject(data.prefs) ? data.prefs : {};
  const custom = isObject(data.custom) ? data.custom : {};
  for (const key of CUSTOM_ARRAYS) {
    if (key in custom && !Array.isArray(custom[key])) delete custom[key];
  }
  const bank = isObject(data.bank) && Array.isArray(data.bank.items) ? data.bank as unknown as BankData : null;

  return {
    format: BACKUP_FORMAT,
    version: data.version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    prefs: prefs as Partial<Preferences>,
    custom: custom as Partial<CustomSettings>,
    bank,
  };
};
