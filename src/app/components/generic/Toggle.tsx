import React from 'react';
import { Switch } from '@headlessui/react';

interface ToggleProps {
  checked: boolean;
  setChecked: (checked: boolean) => void;
  disabled?: boolean;
  label?: string | React.ReactNode;
  className?: string;
}

const Toggle: React.FC<ToggleProps> = (props) => {
  const {
    checked, setChecked, disabled, label, className,
  } = props;

  return (
    <Switch.Group>
      <div className={`flex items-center text-sm mb-1.5 transition-opacity ${disabled ? 'opacity-25' : ''} ${className}`}>
        <Switch
          disabled={disabled}
          checked={checked}
          onChange={setChecked}
          className={`${
            checked ? 'bg-green-500 dark:bg-green-400' : 'bg-gray-400'
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
        >
          <span
            className={`${
              checked ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          />
        </Switch>
        <Switch.Label className="ml-2 text-gray-500 dark:text-white">
          {label}
        </Switch.Label>
      </div>
    </Switch.Group>
  );
};

export default Toggle;
