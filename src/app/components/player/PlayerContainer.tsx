import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import { calculateCombatLevel } from '@/utils';
import PlayerInnerContainer, { PlayerTabName } from '@/app/components/player/PlayerInnerContainer';
import LoadoutName from '@/app/components/player/LoadoutName';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import FindBestSetupButton from '@/app/components/player/FindBestSetupButton';
import UpgradeFinderButton from '@/app/components/player/UpgradeFinderButton';
import BankButton from '@/app/components/player/BankButton';

const PlayerContainer: React.FC = observer(() => {
  const store = useStore();
  const {
    loadouts, player, selectedLoadout, canCreateLoadout, createLoadout, renameLoadout, deleteLoadout,
  } = store;
  const [tab, setTab] = useState<PlayerTabName>('equipment');
  const columnRef = useRef<HTMLDivElement>(null);
  const [equipmentHeight, setEquipmentHeight] = useState<number>();

  // Equipment is the tallest tab. The column keeps its height on the other tabs, without stretching their background,
  // so the graphs below stay in the same place.
  useEffect(() => {
    const column = columnRef.current;
    if (tab !== 'equipment' || !column) return undefined;

    const parts = [...column.children];
    const measure = () => setEquipmentHeight(parts.reduce((h, el) => h + el.getBoundingClientRect().height, 0));
    measure();
    const resizeObserver = new ResizeObserver(measure);
    parts.forEach((el) => resizeObserver.observe(el));
    return () => resizeObserver.disconnect();
  }, [tab]);

  return (
    <div ref={columnRef} className="flex flex-col w-[350px]" style={{ minHeight: equipmentHeight }}>
      <div
        className="sm:rounded sm:rounded-b-none text-sm font-bold font-serif flex gap-2 items-center bg-transparent text-white border-b-4 border-orange-300 dark:border-orange-700"
      >
        <div className="my-1 flex h-full">
          {loadouts.map((l, ix) => (
            <button
              type="button"
              // eslint-disable-next-line react/no-array-index-key
              key={ix}
              className={`min-w-[40px] text-left first:md:rounded-tl px-4 py-1 border-l-2 first:border-l-0 last:rounded-tr border-body-100 dark:border-dark-300 transition-colors ${selectedLoadout === ix ? 'bg-orange-400 dark:bg-orange-700' : 'bg-btns-400 dark:bg-dark-400'}`}
              onClick={() => {
                store.setSelectedLoadout(ix);
              }}
            >
              {ix + 1}
            </button>
          ))}
        </div>
        <div>
          <button
            type="button"
            disabled={!canCreateLoadout}
            onClick={() => createLoadout(true, selectedLoadout)}
            className="disabled:cursor-not-allowed text-body-500 dark:text-dark-100 disabled:text-body-200 dark:disabled:text-dark-500 hover:text-green transition-colors"
            data-tooltip-id="tooltip"
            data-tooltip-content="Add new loadout"
          >
            <IconPlus aria-label="Add new loadout" />
          </button>
        </div>
      </div>
      <div
        className="bg-tile sm:rounded-b-lg dark:bg-dark-300 text-black dark:text-white shadow-lg flex flex-col"
      >
        <div
          className="px-5 py-3 border-b-body-400 dark:border-b-dark-200 border-b flex justify-between items-center font-serif"
        >
          <div className="min-w-0">
            <LoadoutName name={loadouts[selectedLoadout].name} renameLoadout={renameLoadout} index={selectedLoadout} />
            <div className="text-xs font-bold text-gray-500 dark:text-gray-300">
              Level
              {' '}
              {calculateCombatLevel(player.skills)}
            </div>
          </div>
          <div className="flex gap-1">
            <FindBestSetupButton />
            <UpgradeFinderButton />
            <BankButton />
            <button
              type="button"
              onClick={() => deleteLoadout(selectedLoadout)}
              className="disabled:cursor-not-allowed text-body-500 dark:text-dark-100 disabled:text-btns-100 dark:disabled:text-dark-500 hover:text-red transition-colors"
              data-tooltip-id="tooltip"
              data-tooltip-content="Remove loadout"
            >
              <IconTrash aria-label="Remove loadout" />
            </button>
          </div>
        </div>
        <PlayerInnerContainer selected={tab} setSelected={setTab} />
      </div>
    </div>
  );
});

export default PlayerContainer;
