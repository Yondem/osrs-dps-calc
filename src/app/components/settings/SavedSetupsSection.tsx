import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { toast } from 'react-toastify';
import {
  IconChevronDown, IconChevronUp, IconDeviceFloppy, IconDownload, IconTrash,
} from '@tabler/icons-react';
import { useStore } from '@/state';
import { SavedSetup } from '@/types/State';
import { PlayerEquipment } from '@/types/Player';
import { PlayerCombatStyle } from '@/types/PlayerCombatStyle';
import EquipmentSelect from '@/app/components/player/equipment/EquipmentSelect';
import ItemChip from '@/app/components/settings/ItemChip';
import { EQUIPMENT_SLOTS, resolveSavedSetupItem, toSavedSetupItem } from '@/lib/SavedSetups';
import BuffRow from '@/app/components/settings/BuffRow';
import { Prayer } from '@/enums/Prayer';
import Potion from '@/enums/Potion';
import { EquipmentCategory } from '@/enums/EquipmentCategory';
import { getCombatStylesForCategory } from '@/utils';
import {
  AUTO_BUFF_STYLES, autoBuffStyleFor, potionOptionsFor, prayerOptionsFor,
} from '@/lib/AutoBuffs';

const SLOT_LABELS: { [slot in keyof PlayerEquipment]: string } = {
  head: 'Head',
  cape: 'Cape',
  neck: 'Neck',
  ammo: 'Ammo',
  weapon: 'Weapon',
  body: 'Body',
  shield: 'Shield',
  legs: 'Legs',
  hands: 'Hands',
  feet: 'Feet',
  ring: 'Ring',
};

const sameStyle = (a: PlayerCombatStyle, b: PlayerCombatStyle | undefined) => a.name === b?.name && a.stance === b?.stance && a.type === b?.type;

const SetupNameInput: React.FC<{ setup: SavedSetup }> = observer(({ setup }) => {
  const store = useStore();
  const [value, setValue] = useState(setup.name);

  const commit = () => {
    const name = value.trim();
    if (name && name !== setup.name) {
      store.updateSavedSetup(setup.id, { name });
    } else {
      setValue(setup.name);
    }
  };

  return (
    <input
      type="text"
      className="form-control px-2 py-1 font-bold min-w-0 grow"
      value={value}
      maxLength={40}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
});

const SetupEditor: React.FC<{ setup: SavedSetup }> = observer(({ setup }) => {
  const store = useStore();

  const setSlot = (slot: keyof PlayerEquipment, item: SavedSetup['equipment'][typeof slot]) => {
    const equipment = { ...setup.equipment, [slot]: item };

    // Mirror the game: a two-handed weapon and a shield can't be worn together.
    const newWeapon = resolveSavedSetupItem(equipment.weapon);
    if (item && slot === 'weapon' && newWeapon?.isTwoHanded) equipment.shield = null;
    if (item && slot === 'shield' && newWeapon?.isTwoHanded) equipment.weapon = null;

    // A new weapon gets its first style, unless it has the same style as the old one
    const newStyles = getCombatStylesForCategory(resolveSavedSetupItem(equipment.weapon)?.category ?? EquipmentCategory.NONE);
    const keepStyle = newStyles.some((s) => sameStyle(s, setup.style));

    store.updateSavedSetup(setup.id, { equipment, ...(keepStyle ? {} : { style: newStyles[0] }) });
  };

  const weapon = resolveSavedSetupItem(setup.equipment.weapon);
  const styles = getCombatStylesForCategory(weapon?.category ?? EquipmentCategory.NONE);
  // Prayers and potions for the weapon's style are offered, or all of them if that's unknown
  const buffStyle = weapon && setup.style ? autoBuffStyleFor(weapon, setup.style) : null;

  return (
    <div className="mt-2">
      <EquipmentSelect
        id={`settings-setup-select-${setup.id}`}
        placeholder="Search to add or replace an item..."
        excludedEquipmentIds={store.hiddenEquipmentIds}
        excludedBlowpipeDarts={store.hiddenBlowpipeDartKeys}
        onSelectedItemChange={(option) => {
          if (option) setSlot(option.equipment.slot as keyof PlayerEquipment, toSavedSetupItem(option.equipment));
        }}
      />
      <div className="mt-2 grid sm:grid-cols-2 gap-x-3 gap-y-1">
        {EQUIPMENT_SLOTS.map((slot) => {
          const item = setup.equipment[slot];
          return (
            <div key={slot} className="flex items-center gap-2 px-2 py-1 rounded bg-body-100 dark:bg-dark-400">
              <span className="basis-14 shrink-0 text-xs text-gray-500 dark:text-gray-300">{SLOT_LABELS[slot]}</span>
              <div className="min-w-0 grow">
                {item ? (
                  <ItemChip
                    piece={resolveSavedSetupItem(item)}
                    fallbackLabel={`Unknown item ${item.id}`}
                    onRemove={() => setSlot(slot, null)}
                    removeLabel="Remove from setup"
                  />
                ) : <span className="text-gray-400 italic">Empty</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-start gap-2 py-1">
        <span className="basis-16 shrink-0 pt-0.5 text-gray-500 dark:text-gray-300">Style</span>
        <div className="flex flex-wrap gap-1 grow">
          {styles.map((s) => {
            const selected = sameStyle(s, setup.style);
            return (
              <button
                key={`${s.name}-${s.stance}-${s.type}`}
                type="button"
                className={`form-control px-2 py-0.5 ${selected ? 'ring-2 ring-green-500 font-bold' : 'opacity-70'}`}
                onClick={() => store.updateSavedSetup(setup.id, { style: s })}
              >
                {s.stance && s.stance !== s.name ? `${s.name} (${s.stance})` : s.name}
              </button>
            );
          })}
        </div>
      </div>
      {setup.spellName && (
        <div className="flex items-start gap-2 py-1">
          <span className="basis-16 shrink-0 text-gray-500 dark:text-gray-300">Spell</span>
          {setup.spellName}
        </div>
      )}
      <BuffRow
        id={`settings-setup-${setup.id}-prayers`}
        label="Prayers"
        kind="prayer"
        chosen={setup.prayers ?? []}
        options={buffStyle ? prayerOptionsFor(buffStyle) : AUTO_BUFF_STYLES.flatMap(prayerOptionsFor)}
        onChange={(prayers) => store.updateSavedSetup(setup.id, { prayers: prayers as Prayer[] })}
      />
      <BuffRow
        id={`settings-setup-${setup.id}-potions`}
        label="Potions"
        kind="potion"
        chosen={setup.potions ?? []}
        options={potionOptionsFor(buffStyle ?? 'any')}
        onChange={(potions) => store.updateSavedSetup(setup.id, { potions: potions as Potion[] })}
      />
    </div>
  );
});

const SavedSetupsSection: React.FC = observer(() => {
  const store = useStore();
  const { savedSetups } = store.custom;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (savedSetups.length === 0) {
    return (
      <p>
        No saved setups yet. Click the
        {' '}
        <span className="font-bold">+</span>
        {' '}
        next to a loadout&apos;s name to save its gear as a setup. Saved setups show at the top of the Presets dropdown.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p>Saved setups show at the top of the Presets dropdown. Expand one to edit its gear.</p>
      {savedSetups.map((setup) => {
        const expanded = expandedId === setup.id;
        return (
          <div key={setup.id} className="p-2 rounded border border-body-300 dark:border-dark-200">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="text-gray-500 hover:text-black dark:text-gray-300 dark:hover:text-white"
                onClick={() => setExpandedId(expanded ? null : setup.id)}
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
              </button>
              <SetupNameInput key={setup.name} setup={setup} />
              <button
                type="button"
                className="form-control p-1 hover:scale-105 transition-transform"
                data-tooltip-id="tooltip"
                data-tooltip-content="Load into the current loadout"
                onClick={() => {
                  store.applySavedSetup(setup.id);
                  toast.success(`Loaded "${setup.name}"`, { toastId: 'setup-load' });
                }}
              >
                <IconDownload size={18} aria-label="Load into the current loadout" />
              </button>
              <button
                type="button"
                className="form-control p-1 hover:scale-105 transition-transform"
                data-tooltip-id="tooltip"
                data-tooltip-content="Overwrite with current loadout"
                onClick={() => {
                  // eslint-disable-next-line no-alert
                  if (window.confirm(`Overwrite "${setup.name}" with the current loadout's gear?`)) {
                    store.saveCurrentLoadoutAsSetup(setup.name, setup.id);
                  }
                }}
              >
                <IconDeviceFloppy size={18} aria-label="Overwrite with current loadout" />
              </button>
              <button
                type="button"
                className="form-control p-1 hover:scale-105 transition-transform hover:text-red-500"
                data-tooltip-id="tooltip"
                data-tooltip-content="Delete setup"
                onClick={() => {
                  // eslint-disable-next-line no-alert
                  if (window.confirm(`Delete "${setup.name}"?`)) store.deleteSavedSetup(setup.id);
                }}
              >
                <IconTrash size={18} aria-label="Delete setup" />
              </button>
            </div>
            {expanded && <SetupEditor setup={setup} />}
          </div>
        );
      })}
    </div>
  );
});

export default SavedSetupsSection;
