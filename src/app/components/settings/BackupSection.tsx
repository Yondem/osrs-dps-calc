import React, { useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { toast } from 'react-toastify';
import {
  IconClipboard, IconClipboardCopy, IconDownload, IconUpload,
} from '@tabler/icons-react';
import { useStore } from '@/state';
import Toggle from '@/app/components/generic/Toggle';
import { Backup, createBackup, parseBackup } from '@/lib/Backup';

const BUTTON_CLASS = 'form-control grow flex justify-center items-center gap-1 px-3 py-2 font-bold hover:brightness-110 transition';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const BackupSection: React.FC = observer(() => {
  const store = useStore();
  const { bank } = store;
  const [includeBank, setIncludeBank] = useState(true);
  const [pending, setPending] = useState<Backup | null>(null);
  const [importBank, setImportBank] = useState(true);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const exportText = () => JSON.stringify(createBackup(toJS(store.prefs), toJS(store.custom), includeBank ? toJS(bank) : null));

  const saveToFile = () => {
    const url = URL.createObjectURL(new Blob([exportText()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dps-calc-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportText());
      toast.success('Copied your settings to the clipboard!', { toastId: 'backup-copy' });
    } catch (e) {
      toast.error('Could not copy to the clipboard. Save to a file instead.', { toastId: 'backup-copy' });
    }
  };

  const read = (text: string) => {
    try {
      setPending(parseBackup(text));
      setImportBank(true);
      setError('');
    } catch (e) {
      setPending(null);
      setError((e as Error).message);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      read(await navigator.clipboard.readText());
    } catch (e) {
      setError('Could not read the clipboard. Load the backup from a file instead.');
    }
  };

  const loadFile = async (file: File | undefined) => {
    if (file) read(await file.text());
  };

  const confirmImport = () => {
    if (!pending) return;
    store.importBackup(pending, importBank);
    setPending(null);
    toast.success('Imported your settings!', { toastId: 'backup-import' });
  };

  return (
    <div>
      <p>
        The desktop app, the website and each browser keep their own settings. Export them here and import them in the
        other one to bring over your saved setups, auto buffs, tags, filtered items, graphs and bank.
      </p>

      <h3 className="font-bold mt-4 mb-1">Export</h3>
      {bank && <Toggle checked={includeBank} setChecked={setIncludeBank} label="Include my bank" />}
      <div className="mt-1 flex gap-2">
        <button type="button" className={BUTTON_CLASS} onClick={saveToFile}>
          <IconDownload className="w-5" />
          Save to file
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={copyToClipboard}>
          <IconClipboardCopy className="w-5" />
          Copy to clipboard
        </button>
      </div>

      <h3 className="font-bold mt-4 mb-1">Import</h3>
      <div className="flex gap-2">
        <button type="button" className={BUTTON_CLASS} onClick={() => fileInput.current?.click()}>
          <IconUpload className="w-5" />
          Load from file
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={pasteFromClipboard}>
          <IconClipboard className="w-5" />
          Paste from clipboard
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            loadFile(e.target.files?.[0]);
            // Picking the same file again should still read it
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="mt-2 text-red-500 dark:text-red-300">{error}</p>}

      {pending && (
        <div className="mt-3 p-2 rounded border border-orange-400 bg-orange-100 dark:bg-orange-900/30">
          <p>
            {'Backup from '}
            <span className="font-bold">{pending.exportedAt ? new Date(pending.exportedAt).toLocaleString() : 'an unknown date'}</span>
            {' with '}
            {[
              plural(pending.custom.savedSetups?.length ?? 0, 'saved setup'),
              plural(pending.custom.itemTags?.length ?? 0, 'tag'),
              plural((pending.custom.hiddenItemIds?.length ?? 0) + (pending.custom.hiddenBlowpipeDarts?.length ?? 0), 'filtered item'),
            ].join(', ')}
            {pending.bank ? ` and a bank of ${plural(pending.bank.items.length, 'item')}` : ''}
            .
          </p>
          <p className="mt-1">Importing replaces your current settings here. Your open loadouts stay as they are.</p>
          {pending.bank && <Toggle checked={importBank} setChecked={setImportBank} label="Replace my bank too" />}
          <div className="mt-2 flex gap-2 justify-end">
            <button type="button" className="form-control px-3 py-1 hover:brightness-110 transition" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="form-control px-3 py-1 font-bold hover:brightness-110 transition" onClick={confirmImport}>
              Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default BackupSection;
