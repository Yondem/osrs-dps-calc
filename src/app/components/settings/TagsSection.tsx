import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import { availableEquipment } from '@/lib/Equipment';
import { EquipmentPiece } from '@/types/Player';
import EquipmentSelect from '@/app/components/player/equipment/EquipmentSelect';
import ItemChip from '@/app/components/settings/ItemChip';

const TAGS_MAX_LENGTH = 100;

/**
 * An item's tags as one comma-separated text box, saved when it loses focus or Enter is pressed.
 */
const ItemTagsInput: React.FC<{ itemId: number, tags: string }> = observer(({ itemId, tags }) => {
  const store = useStore();
  const [value, setValue] = useState(tags);

  const commit = () => {
    if (value.trim()) {
      store.setItemTags(itemId, value);
    } else {
      // Clearing the box keeps the old tags; the [x] is for removing them
      setValue(tags);
    }
  };

  return (
    <input
      type="text"
      className="form-control basis-1/2 min-w-0 px-2 py-1 font-mono font-bold"
      aria-label="Tags"
      value={value}
      maxLength={TAGS_MAX_LENGTH}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
});

const TagsSection: React.FC = observer(() => {
  const store = useStore();
  const { itemTags } = store.custom;
  const [item, setItem] = useState<EquipmentPiece | null>(null);
  const [tag, setTag] = useState('');

  // One row per item, with its tags in the order they were added
  const tagsByItem = new Map<number, string[]>();
  for (const t of itemTags) tagsByItem.set(t.itemId, [...(tagsByItem.get(t.itemId) ?? []), t.tag]);
  const rows = [...tagsByItem.entries()]
    .map(([itemId, tags]) => ({ itemId, tags: tags.join(', ') }))
    .sort((a, b) => a.tags.localeCompare(b.tags));

  return (
    <div>
      <EquipmentSelect
        id="settings-tags-select"
        placeholder="Search for an item to tag..."
        closeAfterSelect
        onSelectedItemChange={(option) => {
          if (option) setItem(option.equipment);
        }}
      />
      <form
        className="mt-2 flex gap-1 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (!item || !tag.trim()) return;
          store.setItemTags(item.id, [...(tagsByItem.get(item.id) ?? []), tag].join(','));
          setTag('');
        }}
      >
        <div className="basis-1/2 min-w-0 px-2 py-1 rounded bg-body-100 dark:bg-dark-400">
          <ItemChip piece={item} fallbackLabel="Pick an item above" />
        </div>
        <input
          type="text"
          className="form-control basis-1/3 min-w-0 px-2 py-1 font-mono"
          placeholder="e.g. bowfa, fbow, faebow"
          value={tag}
          maxLength={TAGS_MAX_LENGTH}
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
        {rows.length === 0 && <p className="text-gray-500 dark:text-gray-300 italic">No tags yet.</p>}
        {rows.map(({ itemId, tags }) => (
          <div key={itemId} className="px-2 py-1 rounded bg-body-100 dark:bg-dark-400 flex items-center gap-2">
            {/* Keyed on the tags so the box resets when they change elsewhere, e.g. from the Add button */}
            <ItemTagsInput key={tags} itemId={itemId} tags={tags} />
            <div className="min-w-0 grow">
              <ItemChip
                piece={availableEquipment.find((eq) => eq.id === itemId)}
                fallbackLabel={`Unknown item ${itemId}`}
                onRemove={() => store.setItemTags(itemId, '')}
                removeLabel="Remove tags"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default TagsSection;
