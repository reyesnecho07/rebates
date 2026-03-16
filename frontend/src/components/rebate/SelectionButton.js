import React from 'react';
import { ChevronDown, Users, Package } from 'lucide-react';

const SelectionButton = ({ 
  onClick, 
  selectedCount = 0, 
  type = 'customer',
  theme 
}) => {
  const isCustomer = type === 'customer';
  const colors = isCustomer 
    ? {
        bg: theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50',
        border: theme === 'dark' ? 'border-blue-700' : 'border-blue-200',
        text: theme === 'dark' ? 'text-blue-400' : 'text-blue-600',
        hover: theme === 'dark' ? 'hover:bg-blue-800/30' : 'hover:bg-blue-100',
        icon: isCustomer ? 'text-blue-500' : 'text-purple-500'
      }
    : {
        bg: theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50',
        border: theme === 'dark' ? 'border-purple-700' : 'border-purple-200',
        text: theme === 'dark' ? 'text-purple-400' : 'text-purple-600',
        hover: theme === 'dark' ? 'hover:bg-purple-800/30' : 'hover:bg-purple-100',
        icon: isCustomer ? 'text-blue-500' : 'text-purple-500'
      };

  const Icon = isCustomer ? Users : Package;

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between w-full px-4 py-3 border rounded-xl text-sm transition-all shadow-sm ${colors.bg} ${colors.border} ${colors.hover}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-4 h-4 flex-shrink-0 ${colors.icon}`} />
        <span className={`truncate font-medium ${colors.text}`}>
          {selectedCount === 0 
            ? `Select ${isCustomer ? 'Customers' : 'Items'}` 
            : `${selectedCount} ${isCustomer ? 'customer' : 'item'}${selectedCount > 1 ? 's' : ''} selected`}
        </span>
      </div>
      <ChevronDown className={`w-4 h-4 flex-shrink-0 ${colors.text}`} />
    </button>
  );
};

export default SelectionButton;