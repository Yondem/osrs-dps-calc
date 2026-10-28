import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import { availableEquipment } from '@/lib/Equipment';
import { EquipmentPiece } from '@/types/Player';
import EquipmentSelect from '@/app/components/player/equipment/EquipmentSelect';
import ItemChip from '@/app/components/settings/ItemChip';

const TagsSection: React.FC = observer(() => {
  const store = useStore();
  const { itemTags } = store.custom;
  const [item, setItem] = useState<EquipmentPiece | null>(null);
  const [tag, setTag] = useState('');

  const sortedTags = [...itemTags].sort((a, b) => a.tag.localeCompare(b.tag));

  return (
    <div>
      <p className="mb-3">
        Tags are search shortcuts. Tag the Twisted bow with
        {' '}
        <span className="font-mono font-bold">tbow</span>
        , and typing
        {' '}
        <span className="font-mono font-bold">tbow</span>
        {' '}
        in the equipment search puts it first.
      </p>
      <EquipmentSelect
        id="settings-tags-select"
        placeholder="Search for an item to tag..."
        onSelectedItemChange={(option) => {
          if (option) setItem(option.equipment);
        }}
      />
      <form
        className="mt-2 flex gap-1 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (!item || !tag.trim()) return;
          store.addItemTag(tag, item.id);
          setTag('');
        }}
      >
        <div className="basis-1/2 min-w-0 px-2 py-1 rounded bg-body-100 dark:bg-dark-400">
          <ItemChip piece={item} fallbackLabel="Pick an item above" />
        </div>
        <input
          type="text"
          className="form-control basis-1/3 min-w-0 px-2 py-1 font-mono"
          placeholder="tag, e.g. tbow"
          value={tag}
          maxLength={24}
          onChange={(e) => setTag(e.target.value)}
        />
        <button
          type="submit"
          disabled={!item || !tag.trim()}
          className="form-control px-3 py-1 font-bold hover:scale-105 transition-transform"
        >
          Add
        </button>
      </form>
      <div className="mt-4 flex flex-col gap-1">
        {sortedTags.length === 0 && <p className="text-gray-500 dark:text-gray-300 italic">No tags yet.</p>}
        {sortedTags.map((t) => (
          <div key={`${t.tag}-${t.itemId}`} className="px-2 py-1 rounded bg-body-100 dark:bg-dark-400 flex items-center gap-2">
            <span className="font-mono font-bold basis-24 shrink-0 truncate">{t.tag}</span>
            <div className="min-w-0 grow">
              <ItemChip
                piece={availableEquipment.find((eq) => eq.id === t.itemId)}
                fallbackLabel={`Unknown item ${t.itemId}`}
                onRemove={() => store.removeItemTag(t.tag, t.itemId)}
                removeLabel="Remove tag"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default TagsSection;
