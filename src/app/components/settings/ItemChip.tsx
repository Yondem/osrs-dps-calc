import React from 'react';
import { IconX } from '@tabler/icons-react';
import { EquipmentPiece } from '@/types/Player';
import { getCdnImage } from '@/utils';
import { equipmentDisplayName } from '@/lib/SavedSetups';

interface ItemChipProps {
  piece: EquipmentPiece | null | undefined;
  fallbackLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
}

/**
 * A small row showing an item's icon and name, with an optional remove button.
 */
const ItemChip: React.FC<ItemChipProps> = ({
  piece, fallbackLabel, onRemove, removeLabel,
}) => (
  <div className="flex items-center gap-2 min-w-0">
    <div className="w-5 h-5 flex justify-center items-center shrink-0">
      {piece?.image && <img src={getCdnImage(`equipment/${piece.image}`)} alt="" className="max-h-5 max-w-5" />}
    </div>
    <span className="truncate">{piece ? equipmentDisplayName(piece) : fallbackLabel}</span>
    {onRemove && (
      <button
        type="button"
        className="ml-auto text-gray-400 hover:text-red-500 shrink-0"
        onClick={onRemove}
        aria-label={removeLabel ?? 'Remove'}
        data-tooltip-id="tooltip"
        data-tooltip-content={removeLabel ?? 'Remove'}
      >
        <IconX size={16} />
      </button>
    )}
  </div>
);

export default ItemChip;
