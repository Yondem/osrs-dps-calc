import React, { useMemo } from 'react';
import { useStore } from '@/state';
import { observer } from 'mobx-react-lite';
import { getCdnImage } from '@/utils';
import { EquipmentPiece } from '@/types/Player';
import LazyImage from '@/app/components/generic/LazyImage';
import { cross } from 'd3-array';
import {
  availableEquipment,
  canBlowpipeUseDart,
  CORRUPTED_GAUNTLET_EQUIPMENT_IDS,
  DARTS,
  equipmentAliases,
  GAUNTLET_EQUIPMENT_IDS,
  isSearchableEquipment,
} from '@/lib/Equipment';
import { BLOWPIPE_IDS, GAUNTLET_MONSTER_IDS, CORRUPTED_GAUNTLET_MONSTER_IDS } from '@/lib/constants';
import Combobox from '../../generic/Combobox';

interface EquipmentOption {
  label: string;
  value: string;
  version: string;
  slot: string;
  equipment: EquipmentPiece;
  searchAliases?: string;
}

const gauntletSort = (items: EquipmentOption[], monsterId: number) => {
  // If the selected NPC is in The Gauntlet prioritize Gauntlet Equipment
  if (GAUNTLET_MONSTER_IDS.includes(monsterId)) {
    return items.sort((a, b) => {
      const aPriority = GAUNTLET_EQUIPMENT_IDS.includes(a.equipment.id);
      const bPriority = GAUNTLET_EQUIPMENT_IDS.includes(b.equipment.id);
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return a.label.localeCompare(b.label);
    });
  }

  // If the selected NPC is in The Corrupted Gauntlet prioritize Corrupted Gauntlet Equipment
  if (CORRUPTED_GAUNTLET_MONSTER_IDS.includes(monsterId)) {
    return items.sort((a, b) => {
      const aPriority = CORRUPTED_GAUNTLET_EQUIPMENT_IDS.includes(a.equipment.id);
      const bPriority = CORRUPTED_GAUNTLET_EQUIPMENT_IDS.includes(b.equipment.id);
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return a.label.localeCompare(b.label);
    });
  }

  // If the selected NPC is not in The (Corrupted) Gauntlet all Gauntlet equipment is deprioritzed
  return items.sort((a, b) => {
    const aPriority = GAUNTLET_EQUIPMENT_IDS.includes(a.equipment.id) || CORRUPTED_GAUNTLET_EQUIPMENT_IDS.includes(a.equipment.id);
    const bPriority = GAUNTLET_EQUIPMENT_IDS.includes(b.equipment.id) || CORRUPTED_GAUNTLET_EQUIPMENT_IDS.includes(b.equipment.id);
    if (aPriority && !bPriority) return 1;
    if (!aPriority && bPriority) return -1;
    return a.label.localeCompare(b.label);
  });
};

interface IEquipmentSelectProps {
  customAvailableEquipmentFilter?: (eq: EquipmentPiece) => boolean;
  onSelectedItemChange?: (item: EquipmentOption | null | undefined) => void;
  canonicalize?: boolean;
  /** If set, only equipment with these IDs is listed (e.g. items in the player's imported bank). */
  ownedEquipmentIds?: Set<number>;
  /** Equipment with these IDs is never listed (e.g. items the user filtered out in settings). */
  excludedEquipmentIds?: Set<number>;
  placeholder?: string;
  id?: string;
}

/**
 * Moves items with a user-defined tag matching the search to the top: exact tag matches first, then prefix matches.
 */
const tagsFirstSort = (items: EquipmentOption[], inputValue: string, tagsById: Map<number, string[]>) => {
  const query = inputValue.trim().toLowerCase();
  if (!query || tagsById.size === 0) return items;

  const rank = (o: EquipmentOption) => {
    const tags = tagsById.get(o.equipment.id);
    if (!tags) return 2;
    if (tags.includes(query)) return 0;
    return tags.some((t) => t.startsWith(query)) ? 1 : 2;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
};

const EquipmentSelect: React.FC<IEquipmentSelectProps> = observer((props) => {
  const {
    customAvailableEquipmentFilter, onSelectedItemChange, canonicalize, ownedEquipmentIds, excludedEquipmentIds, placeholder, id,
  } = props;
  const store = useStore();
  const { itemTags } = store.custom;

  const tagsById = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const { tag, itemId } of itemTags) {
      map.set(itemId, [...(map.get(itemId) || []), tag]);
    }
    return map;
  }, [itemTags]);

  const options: EquipmentOption[] = useMemo(() => {
    const blowpipeEntries: EquipmentOption[] = [];

    const entries: EquipmentOption[] = [];
    for (const v of availableEquipment.filter((eq) => {
      if (ownedEquipmentIds && !ownedEquipmentIds.has(eq.id)) {
        return false;
      }
      if (excludedEquipmentIds?.has(eq.id)) {
        return false;
      }
      if (customAvailableEquipmentFilter) {
        return customAvailableEquipmentFilter(eq);
      }
      return isSearchableEquipment(eq);
    })) {
      const e: EquipmentOption = {
        label: `${v.name}`,
        value: v.id.toString(),
        version: v.version || '',
        slot: v.slot,
        equipment: v,
        searchAliases: tagsById.get(v.id)?.join(' '),
      };

      if (BLOWPIPE_IDS.includes(v.id)) {
        blowpipeEntries.push(e);
      } else {
        entries.push(e);
      }
    }

    cross(blowpipeEntries, DARTS)
      .filter(([blowpipe, dart]) => canBlowpipeUseDart(blowpipe.label, dart.name))
      .forEach(([blowpipe, dart]) => {
        entries.push({
          ...blowpipe,
          label: `${blowpipe.label} (${dart.name.replace(' dart', '')})`,
          value: `${blowpipe.value}_${dart.id}`,
          equipment: {
            ...blowpipe.equipment,
            itemVars: {
              ...blowpipe.equipment.itemVars,
              blowpipeDartName: dart.name,
              blowpipeDartId: dart.id,
            },
          },
        });
      });

    return gauntletSort(entries, store.monster.id);
  }, [store.monster.id, customAvailableEquipmentFilter, ownedEquipmentIds, excludedEquipmentIds, tagsById]);

  return (
    <Combobox<EquipmentOption>
      id={id ?? 'equipment-select'}
      className="w-full"
      items={options}
      keepOpenAfterSelect
      keepPositionAfterSelect
      placeholder={placeholder ?? 'Search for equipment...'}
      onSelectedItemChange={(item) => {
        if (onSelectedItemChange) {
          onSelectedItemChange(item);
        } else if (item) {
          store.updatePlayer({
            equipment: {
              [item.equipment.slot]: item.equipment,
            },
          });
        }
      }}
      CustomItemComponent={({ item, itemString }) => (
        <div className="flex items-center gap-2">
          <div className="basis-4 flex justify-center h-[20px] w-auto">
            {item.equipment.image && (<LazyImage responsive src={item.equipment.image ? getCdnImage(`equipment/${item.equipment.image}`) : undefined} alt="" />)}
          </div>
          <div>
            {itemString}
            {item.version && (
              <span className="monster-version text-xs text-gray-400 dark:text-gray-300">
                #
                {item.version}
              </span>
            )}
          </div>
        </div>
      )}
      customFilter={(v) => {
        if (canonicalize === false) {
          return v;
        }

        const remainingVariantGroups: { [k: number]: number[] } = {};
        const remainingVariantMemberships: { [k: number]: number } = {}; // reverse map

        // For each option, add it to a variant group if necessary.
        for (const eqOpt of v) {
          const eqId = eqOpt.equipment.id;
          for (const [base, vars] of Object.entries(equipmentAliases)) {
            const baseId = parseInt(base);
            if (baseId === eqId || vars.includes(eqId)) {
              remainingVariantGroups[baseId] = remainingVariantGroups[baseId] ? [...remainingVariantGroups[baseId], eqId] : [eqId];
              remainingVariantMemberships[eqId] = baseId;
            }
          }
        }

        return v.filter((eqOpt) => {
          const eqId = eqOpt.equipment.id;

          // This is a base variant, keep it in the list
          const baseId: number | undefined = remainingVariantMemberships[eqId];
          if (baseId === eqId) return true;

          if (baseId !== undefined) {
            const group = remainingVariantGroups[baseId];
            if (group.includes(eqId)) {
              // Keep this item in the list if it's the first result,
              // and its base variant is filtered
              return group.indexOf(eqId) === 0 && !v.find((o) => o.equipment.id === baseId);
            }
          }

          // For everything else (probably items that aren't variants), keep in the list
          return true;
        });
      }}
      customSort={(v, inputValue) => tagsFirstSort(gauntletSort(v, store.monster.id), inputValue, tagsById)}
    />
  );
});

export default EquipmentSelect;
