// src/components/rebate/SelectionButton.jsx
import React from 'react';
import { ChevronDown, Users, Package } from 'lucide-react';

const SelectionButton = ({ onClick, selectedCount = 0, type = 'customer' }) => {
  const isCustomer = type === 'customer';
  const hasSelection = selectedCount > 0;
  const Icon = isCustomer ? Users : Package;

  /* Per-type semantic accent (blue for customers, purple for items) — NOT theme tokens */
  const selectedClasses = isCustomer
    ? 'bg-[#0A84FF]/11 border-[#0A84FF]/33 hover:bg-[#0A84FF]/16 hover:border-[#0A84FF]/53'
    : 'bg-[#BF5AF2]/11 border-[#BF5AF2]/33 hover:bg-[#BF5AF2]/16 hover:border-[#BF5AF2]/53';
  const accentText = isCustomer ? 'text-[#0A84FF]' : 'text-[#BF5AF2]';
  const hoverNoSelection = isCustomer
    ? 'hover:bg-[var(--ds-hover)] hover:border-[#0A84FF]/33'
    : 'hover:bg-[var(--ds-hover)] hover:border-[#BF5AF2]/33';

  return (
    <button
      onClick={onClick}
      className={`ds-glass flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-all border ${
        hasSelection
          ? selectedClasses
          : `bg-[var(--ds-glass)] border-[var(--ds-hairline)] ${hoverNoSelection}`
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon
          size={16}
          className={`w-4 h-4 flex-shrink-0 ${hasSelection ? accentText : 'text-[var(--ds-muted)]'}`}
        />
        <span
          className={`truncate font-medium ${hasSelection ? accentText : 'text-[var(--ds-muted)]'}`}
        >
          {selectedCount === 0
            ? `Select ${isCustomer ? 'Customers' : 'Items'}`
            : `${selectedCount} ${isCustomer ? 'customer' : 'item'}${selectedCount > 1 ? 's' : ''} selected`}
        </span>
      </div>
      <ChevronDown
        size={16}
        className={`w-4 h-4 flex-shrink-0 ${hasSelection ? accentText : 'text-[var(--ds-faint)]'}`}
      />
    </button>
  );
};

export default SelectionButton;