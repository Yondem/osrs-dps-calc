import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import Toggle from '@/app/components/generic/Toggle';
import BuffRow from '@/app/components/settings/BuffRow';
import { Prayer } from '@/enums/Prayer';
import Potion from '@/enums/Potion';
import {
  AUTO_BUFF_STYLES, AutoBuffStyle, DEFAULT_AUTO_BUFFS_CONFIG, potionOptionsFor, prayerOptionsFor,
} from '@/lib/AutoBuffs';

const STYLE_LABELS: { [s in AutoBuffStyle]: string } = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic' };

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
      <div className={`mt-3 transition-opacity ${autoBuffs ? '' : 'opacity-50'}`}>
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
      </div>
    </div>
  );
});

export default AutoBuffsSection;
