import React from 'react';
import { GetPropsCommonOptions, UseSelectGetToggleButtonPropsOptions } from 'downshift';
import { IconPlus, IconX } from '@tabler/icons-react';
import Select from '@/app/components/generic/Select';
import { addPrayer, Prayer, PrayerMap } from '@/enums/Prayer';
import Potion from '@/enums/Potion';
import { PotionMap } from '@/utils';

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

export default BuffRow;
