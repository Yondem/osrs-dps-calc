import React from 'react';
import { observer } from 'mobx-react-lite';
import EquipmentGrid from '@/app/components/player/equipment/EquipmentGrid';
import Bonuses from '@/app/components/player/Bonuses';
import EquipmentPresets from '@/app/components/player/equipment/EquipmentPresets';
import Toggle from '@/app/components/generic/Toggle';
import { useStore } from '@/state';
import EquipmentSelect from './equipment/EquipmentSelect';

const Equipment: React.FC = observer(() => {
  const store = useStore();
  const {
    ownedEquipmentIds, hiddenEquipmentIds, hiddenBlowpipeDartKeys, prefs,
  } = store;

  return (
    <div className="px-4">
      <div className="mt-4">
        <EquipmentGrid />
      </div>
      <div className="mt-4 flex grow gap-0.5">
        <div className="basis-full">
          <EquipmentSelect
            ownedEquipmentIds={prefs.bankOwnedOnly && ownedEquipmentIds ? ownedEquipmentIds : undefined}
            excludedEquipmentIds={hiddenEquipmentIds}
            excludedBlowpipeDarts={hiddenBlowpipeDartKeys}
          />
        </div>
        <div className="basis-32">
          <EquipmentPresets />
        </div>
      </div>
      {ownedEquipmentIds && (
        <Toggle
          className="mt-2"
          checked={prefs.bankOwnedOnly}
          setChecked={(c) => store.updatePreferences({ bankOwnedOnly: c })}
          label="Only show items in my bank"
        />
      )}
      <div>
        <Bonuses />
      </div>
    </div>
  );
});

export default Equipment;
