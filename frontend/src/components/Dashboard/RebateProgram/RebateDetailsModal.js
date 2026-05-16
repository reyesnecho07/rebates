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
  Lock,
} from 'lucide-react';
import useAccessControl from '../../../hooks/useAccessControl';

// ─────────────────────────────────────────────────────────────────────────────
// NoAccessOverlay
// ─────────────────────────────────────────────────────────────────────────────
const NoAccessOverlay = ({ isDark, onClose }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
      isDark ? 'bg-slate-700 border border-slate-600' : 'bg-red-50 border border-red-200'
    }`}>
      <Lock size={24} className={isDark ? 'text-red-400' : 'text-red-500'} />
    </div>
    <div>
      <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
        Access Restricted
      </h3>
      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        You don't have permission to view this rebate program.
        <br />Contact your administrator for access.
      </p>
    </div>
    <button
      onClick={onClose}
      className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        isDark
          ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      Close
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// InfoCard — compact stat pill in the header strip
// ─────────────────────────────────────────────────────────────────────────────
const INFO_ACCENT = {
  red:    { icon: 'from-rose-500 to-red-600',     light: 'bg-rose-50 border-rose-200 text-rose-700',       dark: 'bg-rose-900/20 border-rose-700/30 text-rose-300'    },
  blue:   { icon: 'from-blue-500 to-indigo-600',  light: 'bg-blue-50 border-blue-200 text-blue-700',       dark: 'bg-blue-900/20 border-blue-700/30 text-blue-300'    },
  amber:  { icon: 'from-amber-500 to-orange-500', light: 'bg-amber-50 border-amber-200 text-amber-700',    dark: 'bg-amber-900/20 border-amber-700/30 text-amber-300'  },
  violet: { icon: 'from-violet-500 to-purple-600',light: 'bg-violet-50 border-violet-200 text-violet-700', dark: 'bg-violet-900/20 border-violet-700/30 text-violet-300'},
  emerald:{ icon: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50 border-emerald-200 text-emerald-700',dark: 'bg-emerald-900/20 border-emerald-700/30 text-emerald-300'},
};

const InfoCard = ({ icon: Icon, label, value, color, isDark }) => {
  const a = INFO_ACCENT[color] || INFO_ACCENT.blue;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
      isDark ? a.dark : a.light
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${a.icon} shadow-sm`}>
        <Icon size={14} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 opacity-70 ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>{label}</p>
        <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
};

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
  const { access, accessLoading } = useAccessControl(routePath);

  const closeModal = () => {
    setSelectedRebate(null);
    setRebateDetails(null);
    setOriginalRebateDetails(null);
    setEditingCustomers({});
    setEditingItems({});
  };

  if (!selectedRebate) return null;

  // ── Period string ─────────────────────────────────────────────────────────
  const periodStr = (() => {
    if (rebateDetails?.dateFrom && rebateDetails?.dateTo)
      return `${rebateDetails.dateFrom} – ${rebateDetails.dateTo}`;
    if (selectedRebate?.from && selectedRebate?.to)
      return `${selectedRebate.from} – ${selectedRebate.to}`;
    if (rebateDetails?.rebateDetails?.dateFrom && rebateDetails?.rebateDetails?.dateTo)
      return `${rebateDetails.rebateDetails.dateFrom} – ${rebateDetails.rebateDetails.dateTo}`;
    return 'Not specified';
  })();

  // ── Tab label helpers ─────────────────────────────────────────────────────
  const customerTabLabel =
    rebateDetails?.rebateType === 'Incremental' ? 'Customer Ranges' : 'Customer Quotas';
  const customerTabSub =
    rebateDetails?.rebateType === 'Fixed'       ? 'Manage customer quotas and QTR rebate'
    : rebateDetails?.rebateType === 'Incremental' ? 'Manage customer ranges and rebate per bag'
    : 'Manage customer quotas for percentage rebate';

  const itemTabLabel =
    rebateDetails?.rebateType === 'Fixed'       ? 'Rebate Items'
    : rebateDetails?.rebateType === 'Incremental' ? 'Item Ranges'
    : 'Percentage Items';
  const itemTabSub =
    rebateDetails?.rebateType === 'Fixed'       ? 'Manage items and their rebate values'
    : rebateDetails?.rebateType === 'Incremental' ? 'Manage item ranges and rebate per bag'
    : 'Manage items and their percentage values';

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const T = {
    overlay:   isDark ? 'bg-black/75'         : 'bg-black/60',
    modal:     isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-slate-50 border-slate-200',
    header:    isDark ? 'bg-slate-800 border-slate-700'    : 'bg-white border-slate-200',
    tabBar:    isDark ? 'bg-slate-800 border-slate-700'    : 'bg-white border-slate-200',
    tabTrack:  isDark ? 'bg-slate-700/60'                  : 'bg-slate-100',
    tabActive: 'bg-blue-600 text-white shadow',
    tabIdle:   isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800',
    content:   isDark ? 'bg-slate-900/60'                  : 'bg-slate-50',
    card:      isDark ? 'bg-slate-800 border-slate-700'    : 'bg-white border-slate-200',
    cardHead:  isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200',
    body:      isDark ? 'bg-slate-800'                     : 'bg-white',
    tp:        isDark ? 'text-slate-100'  : 'text-slate-800',
    ts:        isDark ? 'text-slate-400'  : 'text-slate-500',
    tm:        isDark ? 'text-slate-500'  : 'text-slate-400',
    closeBtn:  isDark
      ? 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
      : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-800',
    badge:     isDark ? 'bg-blue-900/40 text-blue-300'  : 'bg-blue-100 text-blue-600',
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${T.overlay}`}
      onClick={closeModal}
    >
      <div
        className={`flex flex-col rounded-2xl border shadow-2xl w-[88%] max-w-[1380px] h-[92vh] overflow-hidden relative font-sans ${T.modal}`}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Close button ─────────────────────────────────────────────────── */}
        <button
          onClick={closeModal}
          className={`absolute right-4 top-4 z-20 w-8 h-8 flex items-center justify-center rounded-lg border transition-all shadow-sm ${T.closeBtn}`}
        >
          <X size={16} />
        </button>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className={`flex-shrink-0 border-b px-6 py-4 ${T.header}`}>

          {/* Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 shadow">
              <HandCoins size={17} className="text-white" />
            </div>
            <div>
              <h2 className={`text-sm font-bold leading-none ${T.tp}`}>Rebate Program Details</h2>
              <p className={`text-[11px] mt-0.5 ${T.ts}`}>
                View and manage rebate program information, customers, and items
              </p>
            </div>
          </div>

          {/* Info strip */}
          <div className="grid grid-cols-5 gap-2.5">
            <InfoCard icon={FileText}  label="Rebate Code"    value={selectedRebate.code}              color="red"    isDark={isDark} />
            <InfoCard icon={BarChart2} label="Rebate Type"    value={rebateDetails?.rebateType}        color="blue"   isDark={isDark} />
            <InfoCard icon={User}      label="Sales Employee" value={rebateDetails?.salesEmployee}     color="amber"  isDark={isDark} />
            <InfoCard icon={Clock}     label="Frequency"      value={rebateDetails?.frequency || 'Quarterly'} color="violet" isDark={isDark} />
            <InfoCard icon={Calendar}  label="Period"         value={periodStr}                        color="emerald" isDark={isDark} />
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0">

          {/* Loading */}
          {accessLoading ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <div className={`w-9 h-9 rounded-full border-4 border-t-transparent animate-spin ${
                isDark ? 'border-blue-400' : 'border-blue-500'
              }`} />
              <p className={`text-xs ${T.ts}`}>Checking permissions…</p>
            </div>

          ) : !access.canView ? (
            <NoAccessOverlay isDark={isDark} onClose={closeModal} />

          ) : (
            <>
              {/* ── Tab bar ─────────────────────────────────────────────── */}
              <div className={`flex-shrink-0 border-b px-6 py-2.5 flex items-center gap-3 ${T.tabBar}`}>
                <div className={`flex items-center gap-1 rounded-lg p-1 ${T.tabTrack}`}>
                  {[
                    { icon: Users,  label: 'Customers', value: 'customers', count: rebateDetails?.customers?.length },
                    { icon: Blocks, label: 'Items',     value: 'items',     count: rebateDetails?.items?.length     },
                  ].map(tab => (
                    <button
                      key={tab.value}
                      onClick={() => setActiveTab(tab.value)}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        activeTab === tab.value ? T.tabActive : T.tabIdle
                      }`}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                      {tab.count != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          activeTab === tab.value
                            ? 'bg-white/20 text-white'
                            : T.badge
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Tab content ─────────────────────────────────────────── */}
              <div className={`flex flex-col flex-1 min-h-0 p-5 ${T.content}`}>

                {/* CUSTOMERS */}
                {activeTab === 'customers' && (
                  <div className={`flex flex-col flex-1 min-h-0 rounded-xl border shadow-sm overflow-hidden ${T.card}`}>
                    <div className={`flex-shrink-0 px-5 py-3 border-b ${T.cardHead}`}>
                      <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>
                        {customerTabLabel}
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${T.ts}`}>{customerTabSub}</p>
                    </div>
                    <div className={`flex-1 min-h-0 overflow-auto ${T.body}`}>
                      {rebateDetails?.rebateType === 'Fixed'
                        ? renderFixedCustomerTable({ access })
                        : rebateDetails?.rebateType === 'Incremental'
                        ? renderIncrementalCustomerTable({ access })
                        : renderPercentageCustomerTable({ access })}
                    </div>
                  </div>
                )}

                {/* ITEMS */}
                {activeTab === 'items' && (
                  <div className={`flex flex-col flex-1 min-h-0 rounded-xl border shadow-sm overflow-hidden ${T.card}`}>
                  <div className={`flex-shrink-0 px-5 py-3 border-b ${T.cardHead}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>
                          {itemTabLabel}
                        </h4>
                        <p className={`text-[11px] mt-0.5 ${T.ts}`}>{itemTabSub}</p>
                      </div>
                        {rebateDetails?.name && (
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                            isDark
                              ? 'bg-amber-900/20 border-amber-700/30'
                              : 'bg-amber-50 border-amber-200'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              isDark ? 'bg-amber-400' : 'bg-amber-500'
                            }`} />
                            <span className={`text-[10px] font-semibold ${
                              isDark ? 'text-amber-300' : 'text-amber-700'
                            }`}>
                              {rebateDetails.name}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                    <div className={`flex-1 min-h-0 overflow-auto ${T.body}`}>
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