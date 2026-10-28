import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import Toggle from '@/app/components/generic/Toggle';
import { BUILT_IN_PRESETS, builtInPresetKey } from '@/app/components/player/equipment/EquipmentPresets';

const PresetsSection: React.FC = observer(() => {
  const store = useStore();
  const { hiddenPresets } = store.custom;
  const allKeys = BUILT_IN_PRESETS.map((p) => builtInPresetKey(p.value));

  return (
    <div>
      <p className="mb-3">Choose which of the calculator&apos;s built-in presets show in the Presets dropdown. Your saved setups always show.</p>
      <div className="mb-3 flex gap-1">
        <button type="button" className="form-control px-3 py-1 hover:scale-105 transition-transform" onClick={() => store.setPresetsHidden(allKeys, true)}>
          Hide all
        </button>
        <button type="button" className="form-control px-3 py-1 hover:scale-105 transition-transform" onClick={() => store.setPresetsHidden(allKeys, false)}>
          Show all
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        {BUILT_IN_PRESETS.map((p) => {
          const key = builtInPresetKey(p.value);
          return (
            <Toggle
              key={key}
              label={p.label}
              checked={!hiddenPresets.includes(key)}
              setChecked={(c) => store.setPresetsHidden([key], !c)}
            />
          );
        })}
      </div>
    </div>
  );
});

export default PresetsSection;
