import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { toast } from 'react-toastify';
import { IconClipboard, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/state';
import { countOwnedEquipment, parseBankMemoryExport } from '@/lib/Bank';

const BankSection: React.FC = observer(() => {
  const store = useStore();
  const { bank, ownedEquipmentIds } = store;
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const importText = (data: string) => {
    const items = parseBankMemoryExport(data);
    if (items.length === 0) {
      setError('No items found. Make sure you copied the Bank Memory "Copy item data to clipboard" export.');
      return;
    }
    store.setBank({ items, importedAt: new Date().toISOString() });
    store.updatePreferences({ bankOwnedOnly: true });
    setText('');
    setError('');
    toast.success(`Imported ${items.length} items from your bank!`, { toastId: 'bank-import' });
  };

  const pasteFromClipboard = async () => {
    try {
      importText(await navigator.clipboard.readText());
    } catch (e) {
      setError('Could not read the clipboard. Paste the export into the box below instead.');
    }
  };

  return (
    <div>
      {bank && ownedEquipmentIds && (
        <div className="mb-3 p-2 rounded border border-green-400 bg-green-100 dark:bg-green-900/40">
          <div className="flex justify-between items-center gap-2">
            <div>
              <span className="font-bold">{bank.items.length}</span>
              {' items imported '}
              {new Date(bank.importedAt).toLocaleString()}
              {', of which '}
              <span className="font-bold">{countOwnedEquipment(ownedEquipmentIds)}</span>
              {' are equipment.'}
            </div>
            <button
              type="button"
              className="form-control flex items-center gap-1 px-2 py-1 hover:scale-105 shrink-0"
              onClick={() => store.setBank(null)}
            >
              <IconTrash className="w-4" />
              Clear
            </button>
          </div>
        </div>
      )}
      <ol className="list-decimal list-inside">
        <li>
          In RuneLite, install the
          {' '}
          <a href="https://runelite.net/plugin-hub/show/bank-memory" target="_blank">Bank Memory</a>
          {' '}
          plugin and open your bank once.
        </li>
        <li>
          In the Bank Memory side panel, right-click your bank and choose
          {' '}
          <span className="font-bold">Copy item data to clipboard</span>
          .
        </li>
        <li>Click the button below, or paste it into the box and click Import.</li>
      </ol>
      <button
        type="button"
        className="form-control mt-3 w-full flex justify-center items-center gap-1 py-2 font-bold hover:brightness-110 transition"
        onClick={pasteFromClipboard}
      >
        <IconClipboard className="w-5" />
        {bank ? 'Re-import from clipboard' : 'Import from clipboard'}
      </button>
      <textarea
        className="form-control mt-3 w-full h-32 p-2 font-mono text-xs"
        placeholder={'Item id\tItem name\tItem quantity\n4151\tAbyssal whip\t1\n...'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
      />
      {error && <p className="mt-1 text-red-500 dark:text-red-300">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={!text.trim()}
          className="form-control px-4 py-1 hover:scale-105 transition-transform"
          onClick={() => importText(text)}
        >
          Import
        </button>
      </div>
    </div>
  );
});

export default BankSection;
