import React, { useState } from 'react';
import {
  X,
  HandCoins,
  FileText,
  BarChart2,
  User,
  Calendar,
  Users,
  Blocks,
  Clock,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import useAccessControl from '../../../hooks/useAccessControl'; // ← the working hook

// ─────────────────────────────────────────────────────────────────────────────
// AccessBadge — small visual pill shown in the modal header
// ─────────────────────────────────────────────────────────────────────────────
const AccessBadge = ({ label, granted, isDark }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border
      ${granted
        ? isDark
          ? 'bg-green-900/30 border-green-700/50 text-green-300'
          : 'bg-green-50 border-green-200 text-green-700'
        : isDark
          ? 'bg-gray-800/50 border-gray-700 text-gray-500'
          : 'bg-gray-100 border-gray-200 text-gray-400'
      }`}
  >
    {granted ? '✓' : '✗'} {label}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// NoAccessOverlay — shown inside the modal when canView is false
// ─────────────────────────────────────────────────────────────────────────────
const NoAccessOverlay = ({ isDark, onClose }) => (
  <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
    <div
      className={`w-16 h-16 rounded-2xl flex items-center justify-center
        ${isDark
          ? 'bg-red-900/30 border border-red-700/40'
          : 'bg-red-50 border border-red-200'}`}
    >
      <Lock size={28} className={isDark ? 'text-red-400' : 'text-red-500'} />
    </div>
    <div>
      <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
        Access Restricted
      </h3>
      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        You don't have permission to view this rebate program.
        <br />Contact your administrator for access.
      </p>
    </div>
    <button
      onClick={onClose}
      className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors
        ${isDark
          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
    >
      Close
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// RebateDetailsModal
// ─────────────────────────────────────────────────────────────────────────────
const RebateDetailsModal = ({
  selectedRebate,
  setSelectedRebate,
  rebateDetails,
  setRebateDetails,
  originalRebateDetails,
  setOriginalRebateDetails,
  editingCustomers,
  setEditingCustomers,
  editingItems,
  setEditingItems,
  theme = 'light',
  // Route path of the current rebate page — used for access control lookup.
  // Example: "/Nexchem_RebateSetup" or "/Van_RebateSetup"
  // Must match the RoutePath stored in the NavItems table.
  routePath,
  renderFixedCustomerTable,
  renderIncrementalCustomerTable,
  renderPercentageCustomerTable,
  renderFixedItemsTable,
  renderIncrementalItemsTable,
  renderPercentageItemsTable,
}) => {
  const [activeTab, setActiveTab] = useState('customers');
  const isDark = theme === 'dark';


  // ── Access control — uses the same working hook as Nexchem_SalesEmployee ──
  // Syncs on first visit, then fetches with user → group → role fallback.
  const { access, accessLoading, accessError } = useAccessControl(routePath);

  // ── Close helper ──────────────────────────────────────────────────────────
  const closeModal = () => {
    setSelectedRebate(null);
    setRebateDetails(null);
    setOriginalRebateDetails(null);
    setEditingCustomers({});
    setEditingItems({});
  };

  // ── Guard: don't render if no rebate selected ─────────────────────────────
  if (!selectedRebate) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // Styling helpers
  // ─────────────────────────────────────────────────────────────────────────
  const cardClasses = (color) => {
    const base = 'rounded-xl border shadow-sm p-4 transition-all duration-200';
    if (isDark) {
      const darkColors = {
        red:    'bg-gradient-to-br from-red-900/20    to-red-800/20    border-red-700/30',
        blue:   'bg-gradient-to-br from-blue-900/20   to-blue-800/20   border-blue-700/30',
        yellow: 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-yellow-700/30',
        green:  'bg-gradient-to-br from-green-900/20  to-green-800/20  border-green-700/30',
        purple: 'bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-700/30',
      };
      return `${base} ${darkColors[color] || darkColors.blue}`;
    }
    const lightColors = {
      red:    'bg-gradient-to-br from-red-50    to-red-100    border-red-200',
      blue:   'bg-gradient-to-br from-blue-50   to-blue-100   border-blue-200',
      yellow: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200',
      green:  'bg-gradient-to-br from-green-50  to-green-100  border-green-200',
      purple: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200',
    };
    return `${base} ${lightColors[color] || lightColors.blue}`;
  };

  const cardIconBg = (color) => {
    const gradients = {
      red:    'from-red-500    to-red-600',
      blue:   'from-blue-500   to-blue-600',
      yellow: 'from-yellow-500 to-yellow-600',
      green:  'from-green-500  to-green-600',
      purple: 'from-purple-500 to-purple-600',
    };
    return `w-10 h-10 rounded-lg flex items-center justify-center shadow bg-gradient-to-br ${gradients[color] || gradients.blue}`;
  };

  const cardLabelColor = (color) => {
    if (isDark) return 'text-gray-400';
    const colors = {
      red:    'text-red-600',
      blue:   'text-blue-600',
      yellow: 'text-yellow-600',
      green:  'text-green-600',
      purple: 'text-purple-600',
    };
    return colors[color] || colors.blue;
  };

  const tabBtnClasses = (isActive) => {
    const base = 'flex items-center gap-2 px-5 py-2 rounded-md text-xs font-medium transition-all min-w-[140px] justify-center';
    if (isDark) {
      return isActive
        ? `${base} bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow`
        : `${base} text-gray-400 hover:text-gray-200`;
    }
    return isActive
      ? `${base} bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow`
      : `${base} text-gray-600 hover:text-gray-800`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Layout classes
  // ─────────────────────────────────────────────────────────────────────────
  const asideClass = `
    fixed inset-0 flex items-center justify-center z-50
    backdrop-blur-md transition-all duration-300
    ${isDark ? 'bg-black/70' : 'bg-black/60'}
  `;

  const containerClass = `
    rounded-3xl w-[80%] max-w-[1400px] max-h-[95vh] overflow-hidden
    relative shadow-2xl transition-all duration-300
    ${isDark
      ? 'bg-gray-800 border border-gray-700/50 backdrop-blur-sm'
      : 'bg-white border border-white/50 backdrop-blur-sm'}
  `;

  return (
    <div className={asideClass} onClick={closeModal}>
      <div className={containerClass} onClick={e => e.stopPropagation()}>

        {/* ── Close button ───────────────────────────────────────────────── */}
        <button
          onClick={closeModal}
          className={`absolute right-4 top-4 z-10 w-8 h-8 flex items-center justify-center
            rounded-lg transition-all duration-200 shadow-sm hover:shadow border
            ${isDark
              ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-400 hover:text-gray-200'
              : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-600 hover:text-gray-800'}`}
        >
          <X size={18} />
        </button>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={`border-b px-6 py-4 ${isDark ? 'border-gray-700' : 'border-blue-100'}`}>

          {/* Title row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center
              bg-gradient-to-br from-blue-500 to-blue-600 shadow">
              <HandCoins size={20} className="text-white" />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                Rebate Program Details
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                View and manage rebate program information, customers, and items
              </p>
            </div>
          </div>

          {/* ── Info cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-5 gap-3">
            {/* Rebate Code */}
            <div className={cardClasses('red')}>
              <div className="flex items-start gap-3">
                <div className={cardIconBg('red')}><FileText size={14} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium mb-1 ${cardLabelColor('red')}`}>Rebate Code</div>
                  <div className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>
                    {selectedRebate.code}
                  </div>
                </div>
              </div>
            </div>
            {/* Rebate Type */}
            <div className={cardClasses('blue')}>
              <div className="flex items-start gap-3">
                <div className={cardIconBg('blue')}><BarChart2 size={14} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium mb-1 ${cardLabelColor('blue')}`}>Rebate Type</div>
                  <div className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>
                    {rebateDetails?.rebateType}
                  </div>
                </div>
              </div>
            </div>
            {/* Sales Employee */}
            <div className={cardClasses('yellow')}>
              <div className="flex items-start gap-3">
                <div className={cardIconBg('yellow')}><User size={14} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium mb-1 ${cardLabelColor('yellow')}`}>Sales Employee</div>
                  <div className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>
                    {rebateDetails?.salesEmployee}
                  </div>
                </div>
              </div>
            </div>
            {/* Frequency */}
            <div className={cardClasses('purple')}>
              <div className="flex items-start gap-3">
                <div className={cardIconBg('purple')}><Clock size={14} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium mb-1 ${cardLabelColor('purple')}`}>Frequency</div>
                  <div className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>
                    {rebateDetails?.frequency || 'Quarterly'}
                  </div>
                </div>
              </div>
            </div>
            {/* Period */}
            <div className={cardClasses('green')}>
              <div className="flex items-start gap-3">
                <div className={cardIconBg('green')}><Calendar size={14} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium mb-1 ${cardLabelColor('green')}`}>Period</div>
                  <div className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>
                    {(() => {
                      if (rebateDetails?.dateFrom && rebateDetails?.dateTo)
                        return `${rebateDetails.dateFrom} to ${rebateDetails.dateTo}`;
                      if (selectedRebate?.from && selectedRebate?.to)
                        return `${selectedRebate.from} to ${selectedRebate.to}`;
                      if (rebateDetails?.rebateDetails?.dateFrom && rebateDetails?.rebateDetails?.dateTo)
                        return `${rebateDetails.rebateDetails.dateFrom} to ${rebateDetails.rebateDetails.dateTo}`;
                      return 'Period not specified';
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content area ───────────────────────────────────────────────── */}
        <div className="flex flex-col h-[calc(95vh-220px)]">

          {/* ── Loading state ─────────────────────────────────────────────── */}
          {accessLoading ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <div className={`w-10 h-10 rounded-full border-4 border-t-transparent animate-spin
                ${isDark ? 'border-blue-400' : 'border-blue-500'}`} />
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Checking permissions…
              </p>
            </div>

          ) : !access.canView ? (
            /* ── No access overlay ──────────────────────────────────────── */
            <NoAccessOverlay isDark={isDark} onClose={closeModal} />

          ) : (
            /* ── Main content (user has canView) ────────────────────────── */
            <>
              {/* Tabs + action buttons */}
              <div className={`border-b px-6 py-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1 rounded-lg p-1
                    ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    {[
                      { icon: Users,  label: 'Customers', value: 'customers' },
                      { icon: Blocks, label: 'Items',     value: 'items'     },
                    ].map(tab => (
                      <button
                        key={tab.value}
                        className={tabBtnClasses(activeTab === tab.value)}
                        onClick={() => setActiveTab(tab.value)}
                      >
                        <tab.icon size={16} />
                        {tab.label}
                        {tab.value === 'customers' && rebateDetails?.customers && (
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold
                            ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                            {rebateDetails.customers.length}
                          </span>
                        )}
                        {tab.value === 'items' && rebateDetails?.items && (
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold
                            ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                            {rebateDetails.items.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab content */}
              <div className={`flex-1 overflow-auto p-6 ${isDark ? 'bg-gray-900/30' : 'bg-white'}`}>

                {/* CUSTOMERS TAB */}
                {activeTab === 'customers' && (
                  <div className={`rounded-xl border shadow-sm overflow-hidden
                    ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className={`p-4 border-b
                      ${isDark
                        ? 'border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900'
                        : 'border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={`text-base font-bold uppercase tracking-wider
                            ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {rebateDetails?.rebateType === 'Fixed'       ? 'Customer Quotas' :
                             rebateDetails?.rebateType === 'Incremental' ? 'Customer Ranges' :
                             'Customer Quotas'}
                          </h4>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {rebateDetails?.rebateType === 'Fixed'
                              ? 'Manage customer quotas and QTR rebate'
                              : rebateDetails?.rebateType === 'Incremental'
                              ? 'Manage customer ranges and rebate per bag'
                              : 'Manage customer quotas for percentage rebate'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={`overflow-auto max-h-[470px] ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                      {rebateDetails?.rebateType === 'Fixed'
                        ? renderFixedCustomerTable({ access })
                        : rebateDetails?.rebateType === 'Incremental'
                        ? renderIncrementalCustomerTable({ access })
                        : renderPercentageCustomerTable({ access })}
                    </div>
                  </div>
                )}

                {/* ITEMS TAB */}
                {activeTab === 'items' && (
                  <div className={`rounded-xl border shadow-sm overflow-hidden
                    ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className={`p-4 border-b
                      ${isDark
                        ? 'border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900'
                        : 'border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={`text-base font-bold uppercase tracking-wider
                            ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {rebateDetails?.rebateType === 'Fixed'       ? 'Rebate Items'    :
                             rebateDetails?.rebateType === 'Incremental' ? 'Item Ranges'     :
                             'Percentage Items'}
                          </h4>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {rebateDetails?.rebateType === 'Fixed'
                              ? 'Manage items and their rebate values'
                              : rebateDetails?.rebateType === 'Incremental'
                              ? 'Manage item ranges and rebate per bag'
                              : 'Manage items and their percentage values'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={`overflow-auto max-h-[470px] ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                      {rebateDetails?.rebateType === 'Fixed'
                        ? renderFixedItemsTable({ access })
                        : rebateDetails?.rebateType === 'Incremental'
                        ? renderIncrementalItemsTable({ access })
                        : renderPercentageItemsTable({ access })}
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RebateDetailsModal;