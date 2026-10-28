import React, { useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { toast } from 'react-toastify';
import { IconDeviceFloppy, IconPlus } from '@tabler/icons-react';
import { useStore } from '@/state';
import Modal from '@/app/components/generic/Modal';

/**
 * The "+" next to the loadout name: saves the current loadout's gear as a setup, which then shows up under Presets.
 */
const SaveSetupButton: React.FC = observer(() => {
  const store = useStore();
  const { savedSetups } = store.custom;
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');

  const nameInput = useRef<HTMLInputElement | null>(null);

  const save = (overwriteId?: string) => {
    const setup = store.saveCurrentLoadoutAsSetup(name.trim() || store.player.name, overwriteId);
    setIsOpen(false);
    toast.success(`Saved "${setup.name}" - find it under Presets.`, { toastId: 'setup-save' });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(store.player.name);
          setIsOpen(true);
        }}
        className="text-body-500 dark:text-dark-100 hover:text-green transition-colors flex-none"
        data-tooltip-id="tooltip"
        data-tooltip-content="Save loadout as a setup"
      >
        <IconPlus aria-label="Save loadout as a setup" size={18} />
      </button>
      <Modal
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        initialFocus={nameInput}
        title={(
          <div className="flex gap-2 items-center">
            <IconDeviceFloppy />
            Save setup
          </div>
        )}
      >
        <div className="text-sm">
          <p>Saves this loadout&apos;s gear, combat style, spell, prayers and potions. Saved setups appear at the top of the Presets dropdown.</p>
          <form
            className="mt-3 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input
              type="text"
              className="form-control w-full px-2 py-1"
              ref={nameInput}
              onFocus={(e) => {
                // Defer so the selection isn't reset by the dialog's own focus handling
                const input = e.target;
                setTimeout(() => input.select(), 50);
              }}
              placeholder="Setup name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="form-control px-3 py-1 font-bold whitespace-nowrap hover:scale-105 transition-transform">
              Save as new
            </button>
          </form>
          {savedSetups.length > 0 && (
            <>
              <p className="mt-4 mb-1 text-gray-500 dark:text-gray-300">Or overwrite an existing setup:</p>
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {savedSetups.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="form-control px-2 py-1 text-left hover:bg-body-200 dark:hover:bg-dark-400"
                    onClick={() => save(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
});

export default SaveSetupButton;
