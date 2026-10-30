import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import { availableEquipment, blowpipeDartKey } from '@/lib/Equipment';
import { EquipmentPiece } from '@/types/Player';
import EquipmentSelect from '@/app/components/player/equipment/EquipmentSelect';
import ItemChip from '@/app/components/settings/ItemChip';

/**
 * A blowpipe loaded with a dart, as the equipment search lists it.
 */
const loadedBlowpipe = (blowpipeId: number, dartId: number): EquipmentPiece | undefined => {
  const blowpipe = availableEquipment.find((eq) => eq.id === blowpipeId);
  const dart = availableEquipment.find((eq) => eq.id === dartId);
  if (!blowpipe || !dart) return undefined;
  return { ...blowpipe, itemVars: { ...blowpipe.itemVars, blowpipeDartName: dart.name, blowpipeDartId: dart.id } };
};

const FilteredItemsSection: React.FC = observer(() => {
  const store = useStore();
  const { hiddenItemIds, hiddenBlowpipeDarts } = store.custom;

  return (
    <div>
      <p className="mb-3">
        Items here never show up in the equipment search. Hiding an item also hides its ornament, locked and recoloured
        variants. Hiding a blowpipe with a dart only hides that dart, so the blowpipe&apos;s other darts stay.
      </p>
      <EquipmentSelect
        id="settings-filtered-items-select"
        placeholder="Search for an item to hide..."
        excludedEquipmentIds={store.hiddenEquipmentIds}
        excludedBlowpipeDarts={store.hiddenBlowpipeDartKeys}
        onSelectedItemChange={(item) => {
          if (!item) return;
          const dartId = item.equipment.itemVars?.blowpipeDartId;
          if (dartId) {
            store.hideBlowpipeDart(item.equipment.id, dartId);
          } else {
            store.hideItem(item.equipment.id);
          }
        }}
      />
      <div className="mt-3 flex flex-col gap-1">
        {hiddenItemIds.length === 0 && hiddenBlowpipeDarts.length === 0 && (
          <p className="text-gray-500 dark:text-gray-300 italic">No items filtered yet.</p>
        )}
        {hiddenItemIds.map((id) => (
          <div key={id} className="px-2 py-1 rounded bg-body-100 dark:bg-dark-400">
            <ItemChip
              piece={availableEquipment.find((eq) => eq.id === id)}
              fallbackLabel={`Unknown item ${id}`}
              onRemove={() => store.unhideItem(id)}
              removeLabel="Show in search again"
            />
          </div>
        ))}
        {hiddenBlowpipeDarts.map(({ blowpipeId, dartId }) => (
          <div key={blowpipeDartKey(blowpipeId, dartId)} className="px-2 py-1 rounded bg-body-100 dark:bg-dark-400">
            <ItemChip
              piece={loadedBlowpipe(blowpipeId, dartId)}
              fallbackLabel={`Unknown blowpipe ${blowpipeId} with dart ${dartId}`}
              onRemove={() => store.unhideBlowpipeDart(blowpipeId, dartId)}
              removeLabel="Show in search again"
            />
          </div>
        ))}
      </div>
    </div>
  );
});

export default FilteredItemsSection;
