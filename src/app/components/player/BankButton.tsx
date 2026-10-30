import React from 'react';
import { observer } from 'mobx-react-lite';
import { IconBuildingBank } from '@tabler/icons-react';
import { useStore } from '@/state';

/**
 * Opens Settings › Bank.
 */
const BankButton: React.FC = observer(() => {
  const store = useStore();

  return (
    <button
      type="button"
      onClick={() => store.updateUIState({ showSettingsModal: true, settingsSection: 'bank' })}
      className="text-body-500 dark:text-dark-100 hover:text-orange-400 transition-colors"
      data-tooltip-id="tooltip"
      data-tooltip-content="Import your bank"
    >
      <IconBuildingBank aria-label="Import your bank" />
    </button>
  );
});

export default BankButton;
