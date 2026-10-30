import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import {
  availableEquipment, BASE_BLOWPIPES, getCanonicalItemId, loadableDarts,
} from '@/lib/Equipment';
import { BLOWPIPE_IDS } from '@/lib/constants';
import { getCdnImage } from '@/utils';

// The names of the ornamental versions (e.g. Blazing) that share each base blowpipe's darts
const VARIANT_NAMES = new Map(BASE_BLOWPIPES.map((b) => [b.id, BLOWPIPE_IDS
  .filter((id) => id !== b.id && getCanonicalItemId(id) === b.id)
  .map((id) => availableEquipment.find((eq) => eq.id === id)?.name)
  .filter((name): name is string => !!name && name !== b.name)]));

const AmmoSection: React.FC = observer(() => {
  const store = useStore();
  const { blowpipeDarts } = store.custom;

  return (
    <div>
      <p className="mb-3">
        Pick the darts you want the equipment search, best setup and upgrade finder to use.
      </p>
      <div className="flex flex-col gap-2">
        {BASE_BLOWPIPES.map((blowpipe) => {
          const picked = blowpipeDarts.find((c) => c.blowpipeId === blowpipe.id)?.dartIds ?? [];
          const variants = VARIANT_NAMES.get(blowpipe.id) ?? [];
          return (
            <div key={blowpipe.id} className="px-2 py-2 rounded bg-body-100 dark:bg-dark-400">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex justify-center items-center shrink-0">
                  {blowpipe.image && <img src={getCdnImage(`equipment/${blowpipe.image}`)} alt="" className="max-h-5 max-w-5" />}
                </div>
                <span className="font-bold">{blowpipe.name}</span>
                {variants.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-300">{`also ${variants.join(', ')}`}</span>
                )}
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-300">
                  {picked.length === 0 ? 'Automatic' : `${picked.length} picked`}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {loadableDarts(blowpipe).map((dart) => {
                  const on = picked.includes(dart.id);
                  return (
                    <button
                      key={dart.id}
                      type="button"
                      aria-pressed={on}
                      className={`form-control flex items-center gap-1 px-2 py-1 transition ${on
                        ? 'ring-2 ring-green-500 font-bold'
                        : 'opacity-60 hover:opacity-100'}`}
                      onClick={() => store.toggleBlowpipeDart(blowpipe.id, dart.id)}
                    >
                      {dart.image && <img src={getCdnImage(`equipment/${dart.image}`)} alt="" className="max-h-4 max-w-4" />}
                      {dart.name.replace(' dart', '')}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default AmmoSection;
