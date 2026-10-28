import { EquipmentPiece, Player, PlayerEquipment } from '@/types/Player';
import { SavedSetup, SavedSetupItem } from '@/types/State';
import { availableEquipment } from '@/lib/Equipment';

export const EQUIPMENT_SLOTS: (keyof PlayerEquipment)[] = [
  'head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring',
];

export const toSavedSetupItem = (piece: EquipmentPiece | null): SavedSetupItem | null => {
  if (!piece) return null;
  return piece.itemVars ? { id: piece.id, itemVars: { ...piece.itemVars } } : { id: piece.id };
};

export const resolveSavedSetupItem = (item: SavedSetupItem | null): EquipmentPiece | null => {
  if (!item) return null;
  const piece = availableEquipment.find((eq) => eq.id === item.id);
  if (!piece) return null;
  return item.itemVars ? { ...piece, itemVars: { ...piece.itemVars, ...item.itemVars } } : piece;
};

export const resolveSavedSetupEquipment = (setup: SavedSetup): PlayerEquipment => Object.fromEntries(
  EQUIPMENT_SLOTS.map((slot) => [slot, resolveSavedSetupItem(setup.equipment[slot])]),
) as unknown as PlayerEquipment;

export const savedSetupFromPlayer = (player: Player, name: string, id?: string): SavedSetup => ({
  id: id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  name,
  equipment: Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, toSavedSetupItem(player.equipment[slot])]),
  ) as SavedSetup['equipment'],
  style: { ...player.style },
  spellName: player.spell?.name ?? null,
  prayers: [...player.prayers],
  potions: [...player.buffs.potions],
});

/**
 * The name shown for an equipment piece, including blowpipe darts and the version (e.g. "#Charged").
 */
export const equipmentDisplayName = (piece: EquipmentPiece): string => {
  const dart = piece.itemVars?.blowpipeDartName ? ` (${piece.itemVars.blowpipeDartName.replace(' dart', '')})` : '';
  const version = piece.version ? ` #${piece.version}` : '';
  return `${piece.name}${dart}${version}`;
};
