import { availableEquipment, equipmentAliases } from '@/lib/Equipment';

export interface BankItem {
  id: number;
  name: string;
  quantity: number;
}

export interface BankData {
  items: BankItem[];
  importedAt: string;
}

/**
 * Parses the "Copy item data to clipboard" export from the RuneLite Bank Memory plugin.
 * The format is tab-separated with a header row: "Item id", "Item name", "Item quantity".
 * Lines that don't parse (header, blank lines) are skipped, placeholders (quantity 0) are dropped,
 * and duplicate item IDs are merged.
 */
export const parseBankMemoryExport = (text: string): BankItem[] => {
  const items = new Map<number, BankItem>();

  for (const line of text.split(/\r?\n/)) {
    const [rawId, rawName, rawQuantity] = line.split('\t').map((s) => s.trim());
    const id = Number(rawId);
    const quantity = Number(rawQuantity);
    if (!rawId || !Number.isInteger(id) || id < 0 || !Number.isFinite(quantity) || quantity <= 0) continue;

    const existing = items.get(id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.set(id, { id, name: rawName || '', quantity });
    }
  }

  return [...items.values()];
};

/**
 * Expands a list of item IDs to include every functionally identical variant (ornament kits, locked versions, etc).
 */
export const withAliasVariants = (ids: Iterable<number>): Set<number> => {
  const result = new Set(ids);

  for (const [base, variants] of Object.entries(equipmentAliases)) {
    const group = [parseInt(base), ...variants];
    if (group.some((id) => result.has(id))) {
      group.forEach((id) => result.add(id));
    }
  }

  return result;
};

/**
 * Versions that only differ by charge/degradation state. Owning one of these (e.g. an uncharged Tumeken's shadow)
 * counts as owning the others, since the item can be charged or repaired.
 */
const CHARGE_STATE_VERSIONS = new Set([
  'Charged', 'Uncharged', 'Empty', 'Inactive', 'Active', 'Activated', 'Undamaged', '100', '75', '50', '25', '0',
]);

/**
 * The set of equipment IDs that count as owned, given the items in the bank.
 * Owning any variant of an item (e.g. an ornament kit or locked version) counts as owning the whole variant group,
 * and owning an item in any charge state counts as owning it in every charge state.
 */
export const getOwnedEquipmentIds = (items: BankItem[]): Set<number> => {
  const owned = withAliasVariants(items.map((i) => i.id));

  const chargeStateNames = new Set(availableEquipment
    .filter((eq) => owned.has(eq.id) && CHARGE_STATE_VERSIONS.has(eq.version))
    .map((eq) => eq.name));
  for (const eq of availableEquipment) {
    if (chargeStateNames.has(eq.name) && CHARGE_STATE_VERSIONS.has(eq.version)) {
      owned.add(eq.id);
    }
  }

  return owned;
};

/**
 * How many distinct pieces of equipment known to the calculator are in the bank.
 */
export const countOwnedEquipment = (owned: Set<number>): number => availableEquipment
  .filter((eq) => owned.has(eq.id)).length;
