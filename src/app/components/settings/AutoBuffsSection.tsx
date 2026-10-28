import React from 'react';
import { observer } from 'mobx-react-lite';
import { GetPropsCommonOptions, UseSelectGetToggleButtonPropsOptions } from 'downshift';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useStore } from '@/state';
import Toggle from '@/app/components/generic/Toggle';
import Select from '@/app/components/generic/Select';
import { addPrayer, Prayer, PrayerMap } from '@/enums/Prayer';
import Potion from '@/enums/Potion';
import { PotionMap } from '@/utils';
import {
  AUTO_BUFF_STYLES, AutoBuffStyle, DEFAULT_AUTO_BUFFS_CONFIG, potionOptionsFor, prayerOptionsFor,
} from '@/lib/AutoBuffs';

type BuffKind = 'potion' | 'prayer';

interface BuffOption {
  label: string;
  value: number;
  image: string;
}

const buffOption = (kind: BuffKind, value: number): BuffOption => {
  const data = kind === 'potion' ? PotionMap[value as Potion] : PrayerMap[value as Prayer];
  return { label: data.name, value, image: data.image.src };
};

const STYLE_LABELS: { [s in AutoBuffStyle]: string } = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic' };

const AddButton: React.FC<{
  getToggleButtonProps: (options?: UseSelectGetToggleButtonPropsOptions, otherOptions?: GetPropsCommonOptions) => unknown
}> = ({ getToggleButtonProps }) => (
  <button
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...getToggleButtonProps() as object}
    type="button"
    className="form-control p-0.5 hover:scale-110 transition-transform"
    aria-label="Add"
  >
    <IconPlus size={16} />
  </button>
);

const OptionItem: React.FC<{ item: BuffOption }> = ({ item }) => (
  <div className="flex items-center gap-2">
    <img src={item.image} alt="" className="h-4 w-4 object-contain" />
    {item.label}
  </div>
);

interface BuffRowProps {
  id: string;
  label: string;
  kind: BuffKind;
  chosen: number[];
  options: number[];
  onChange: (chosen: number[]) => void;
}

/**
 * A row of chosen potions or prayers, with an [x] on each and a [+] dropdown listing the rest, strongest first.
 */
const BuffRow: React.FC<BuffRowProps> = ({
  id, label, kind, chosen, options, onChange,
}) => (
  <div className="flex items-start gap-2 py-1">
    <span className="basis-16 shrink-0 pt-0.5 text-gray-500 dark:text-gray-300">{label}</span>
    <div className="flex flex-wrap items-center gap-1 grow">
      {chosen.length === 0 && <span className="italic text-gray-400">None</span>}
      {chosen.map((value) => {
        const option = buffOption(kind, value);
        return (
          <span key={value} className="inline-flex items-center gap-1 pl-1 pr-0.5 py-0.5 rounded bg-body-100 dark:bg-dark-400">
            <img src={option.image} alt="" className="h-4 w-4 object-contain" />
            {option.label}
            <button
              type="button"
              className="text-gray-400 hover:text-red-500"
              aria-label={`Remove ${option.label}`}
              onClick={() => onChange(chosen.filter((c) => c !== value))}
            >
              <IconX size={14} />
            </button>
          </span>
        );
      })}
      <Select<BuffOption>
        id={id}
        items={options.filter((o) => !chosen.includes(o)).map((o) => buffOption(kind, o))}
        resetAfterSelect
        CustomSelectComponent={AddButton}
        CustomItemComponent={OptionItem}
        onSelectedItemChange={(item) => {
          if (!item) return;
          // Prayers that can't be active together replace each other, like in game
          onChange(kind === 'prayer' ? addPrayer(chosen as Prayer[], item.value as Prayer) : [...chosen, item.value]);
        }}
      />
    </div>
  </div>
);

const AutoBuffsSection: React.FC = observer(() => {
  const store = useStore();
  const { autoBuffs, autoBuffsConfig: config } = store.prefs;

  return (
    <div>
      <Toggle
        checked={autoBuffs}
        setChecked={(c) => store.updatePreferences({ autoBuffs: c })}
        label="Automatically enable buffs when equipping a weapon"
      />
      <p className="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-300">
        When you equip a weapon, its style&apos;s potions and prayers below are turned on. Use [+] to add a buff
        (strongest options are listed first) and [x] to remove one.
      </p>
      <div className={`transition-opacity ${autoBuffs ? '' : 'opacity-50'}`}>
        {AUTO_BUFF_STYLES.map((style) => (
          <div key={style} className="mb-3">
            <p className="font-bold">{STYLE_LABELS[style]}</p>
            <BuffRow
              id={`autobuffs-${style}-potions`}
              label="Potions"
              kind="potion"
              chosen={config[style].potions}
              options={potionOptionsFor(style)}
              onChange={(potions) => store.updateAutoBuffsConfig({ [style]: { ...config[style], potions } })}
            />
            <BuffRow
              id={`autobuffs-${style}-prayers`}
              label="Prayers"
              kind="prayer"
              chosen={config[style].prayers}
              options={prayerOptionsFor(style)}
              onChange={(prayers) => store.updateAutoBuffsConfig({ [style]: { ...config[style], prayers: prayers as Prayer[] } })}
            />
          </div>
        ))}
        <p className="font-bold">Raids</p>
        <p className="text-xs text-gray-500 dark:text-gray-300">
          Against raid monsters these replace the style&apos;s potions. Switching the monster into or out of a raid swaps
          them on every loadout that has a weapon.
        </p>
        <BuffRow
          id="autobuffs-cox-potions"
          label="CoX"
          kind="potion"
          chosen={config.cox}
          options={potionOptionsFor('any')}
          onChange={(cox) => store.updateAutoBuffsConfig({ cox: cox as Potion[] })}
        />
        <BuffRow
          id="autobuffs-toa-potions"
          label="ToA"
          kind="potion"
          chosen={config.toa}
          options={potionOptionsFor('any')}
          onChange={(toa) => store.updateAutoBuffsConfig({ toa: toa as Potion[] })}
        />
        <button
          type="button"
          className="form-control mt-3 px-3 py-1 hover:scale-105 transition-transform"
          onClick={() => store.updatePreferences({ autoBuffsConfig: DEFAULT_AUTO_BUFFS_CONFIG })}
        >
          Reset to defaults
        </button>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-300">
          Potions listed here that don&apos;t belong to the current weapon or target are turned off; other buffs stay on.
          Loading a saved setup restores the prayers and potions saved with it instead.
        </p>
      </div>
    </div>
  );
});

export default AutoBuffsSection;
