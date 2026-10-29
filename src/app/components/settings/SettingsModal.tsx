import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  IconArrowsExchange, IconBuildingBank, IconChartBar, IconDeviceFloppy, IconEyeOff, IconFlask, IconList, IconSettings, IconTag,
} from '@tabler/icons-react';
import { useStore } from '@/state';
import Modal from '@/app/components/generic/Modal';
import SavedSetupsSection from '@/app/components/settings/SavedSetupsSection';
import PresetsSection from '@/app/components/settings/PresetsSection';
import TagsSection from '@/app/components/settings/TagsSection';
import FilteredItemsSection from '@/app/components/settings/FilteredItemsSection';
import BankSection from '@/app/components/settings/BankSection';
import AutoBuffsSection from '@/app/components/settings/AutoBuffsSection';
import GraphsSection from '@/app/components/settings/GraphsSection';
import BackupSection from '@/app/components/settings/BackupSection';

const SECTIONS = [
  {
    key: 'setups', label: 'Saved setups', Icon: IconDeviceFloppy, Component: SavedSetupsSection,
  },
  {
    key: 'presets', label: 'Built-in presets', Icon: IconList, Component: PresetsSection,
  },
  {
    key: 'autobuffs', label: 'Auto buffs', Icon: IconFlask, Component: AutoBuffsSection,
  },
  {
    key: 'graphs', label: 'Graphs', Icon: IconChartBar, Component: GraphsSection,
  },
  {
    key: 'tags', label: 'Tags', Icon: IconTag, Component: TagsSection,
  },
  {
    key: 'filtered', label: 'Filtered items', Icon: IconEyeOff, Component: FilteredItemsSection,
  },
  {
    key: 'bank', label: 'Bank', Icon: IconBuildingBank, Component: BankSection,
  },
  {
    key: 'backup', label: 'Export / import', Icon: IconArrowsExchange, Component: BackupSection,
  },
];

const SettingsModal: React.FC = observer(() => {
  const store = useStore();
  const [sectionKey, setSectionKey] = useState(SECTIONS[0].key);
  const section = SECTIONS.find((s) => s.key === sectionKey) ?? SECTIONS[0];

  return (
    <Modal
      isOpen={store.ui.showSettingsModal}
      setIsOpen={(open) => store.updateUIState({ showSettingsModal: open })}
      maxWidth="max-w-4xl"
      title={(
        <div className="flex gap-2 items-center">
          <IconSettings />
          Settings
        </div>
      )}
    >
      <div className="flex flex-col sm:flex-row gap-4 text-sm">
        <nav className="flex sm:flex-col gap-1 sm:basis-44 shrink-0 overflow-x-auto">
          {SECTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`flex items-center gap-2 px-3 py-2 rounded text-left whitespace-nowrap transition-colors ${key === section.key
                ? 'bg-btns-300 dark:bg-dark-500 text-white font-bold'
                : 'hover:bg-body-200 dark:hover:bg-dark-400'}`}
              onClick={() => setSectionKey(key)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="grow min-w-0 h-[65vh] overflow-y-auto pr-1">
          <h2 className="font-serif font-bold text-lg mb-2">{section.label}</h2>
          <section.Component />
        </div>
      </div>
    </Modal>
  );
});

export default SettingsModal;
