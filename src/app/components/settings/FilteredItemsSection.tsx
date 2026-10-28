import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import { availableEquipment } from '@/lib/Equipment';
import EquipmentSelect from '@/app/components/player/equipment/EquipmentSelect';
import ItemChip from '@/app/components/settings/ItemChip';

const FilteredItemsSection: React.FC = observer(() => {
  const store = useStore();
  const { hiddenItemIds } = store.custom;

  return (
    <div>
      <p className="mb-3">
        Items here never show up in the equipment search. Hiding an item also hides its ornament, locked and recoloured
        variants.
      </p>
      <EquipmentSelect
        id="settings-filtered-items-select"
        placeholder="Search for an item to hide..."
        excludedEquipmentIds={store.hiddenEquipmentIds}
        onSelectedItemChange={(item) => {
          if (item) store.hideItem(item.equipment.id);
        }}
      />
      <div className="mt-3 flex flex-col gap-1">
        {hiddenItemIds.length === 0 && <p className="text-gray-500 dark:text-gray-300 italic">No items filtered yet.</p>}
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
      </div>
    </div>
  );
});

export default FilteredItemsSection;
