import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import Toggle from '@/app/components/generic/Toggle';
import { GraphKey } from '@/types/State';

const GRAPHS: { key: GraphKey, label: string }[] = [
  { key: 'hitDistribution', label: 'Hit Distribution' },
  { key: 'loadoutComparison', label: 'Loadout Comparison Graph' },
  { key: 'ttkComparison', label: 'Time-to-Kill Graph' },
  { key: 'npcVersusPlayer', label: 'Damage taken from the monster' },
];

const GraphsSection: React.FC = observer(() => {
  const store = useStore();
  const { hiddenGraphs } = store.prefs;

  return (
    <div>
      {GRAPHS.map(({ key, label }) => (
        <Toggle
          key={key}
          checked={!hiddenGraphs.includes(key)}
          setChecked={(shown) => store.updatePreferences({
            hiddenGraphs: shown ? hiddenGraphs.filter((g) => g !== key) : [...hiddenGraphs, key],
          })}
          label={label}
        />
      ))}
    </div>
  );
});

export default GraphsSection;
