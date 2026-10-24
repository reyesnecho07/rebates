// src/components/RebateDetailsModal.jsx
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

/* ─── Apple system colour language ───────────────────────────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const tokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"  : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const FONT = `
  .rd-page, .rd-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .rd-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .rd-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .rd-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.4); border-radius: 999px; }
  .rd-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes rd-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .rd-pop { animation: rd-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// NoAccessOverlay
// ─────────────────────────────────────────────────────────────────────────────
const NoAccessOverlay = ({ isDark, onClose }) => {
  const K = tokens(isDark);
  return (
    <div className="rd-page flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center rd-glass"
        style={{
          background: `${APPLE.red}18`,
          border: `1px solid ${APPLE.red}33`,
        }}
      >
        <Lock size={24} style={{ color: APPLE.red }} />
      </div>
      <div>
        <h3 className="text-sm font-bold mb-1" style={{ color: K.ink }}>
          Access Restricted
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: K.muted }}>
          You don't have permission to view this rebate program.
          <br />Contact your administrator for access.
        </p>
      </div>
      <button
        onClick={onClose}
        className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
        style={{
          background: K.chipBg,
          color: K.muted,
          border: `1px solid ${K.hairline}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = K.hover; e.currentTarget.style.color = K.ink; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.muted; }}
      >
        Close
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// InfoCard — compact stat pill in the header strip
//   Set `hidden` to true to blank the value (used when the viewer has no access)
// ─────────────────────────────────────────────────────────────────────────────
const INFO_ACCENT = {
  red:     { color: APPLE.red,    gradient: `linear-gradient(155deg, #FF6B5E 0%, ${APPLE.red} 100%)` },
  blue:    { color: APPLE.blue,   gradient: `linear-gradient(155deg, #5AC8FA 0%, ${APPLE.blue} 100%)` },
  amber:   { color: APPLE.orange, gradient: `linear-gradient(155deg, #FFB340 0%, ${APPLE.orange} 100%)` },
  violet:  { color: APPLE.purple, gradient: `linear-gradient(155deg, #D48FFF 0%, ${APPLE.purple} 100%)` },
  emerald: { color: APPLE.green,  gradient: `linear-gradient(155deg, #6BE27F 0%, ${APPLE.green} 100%)` },
};

const InfoCard = ({ icon: Icon, label, value, color, isDark, hidden = false }) => {
  const K = tokens(isDark);
  const a = INFO_ACCENT[color] || INFO_ACCENT.blue;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl border rd-glass"
      style={{
        background: isDark ? `${a.color}14` : `${a.color}0d`,
        borderColor: `${a.color}33`,
        opacity: hidden ? 0.55 : 1,
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: a.gradient,
          boxShadow: `0 4px 12px -4px ${a.color}88`,
        }}
      >
        <Icon size={14} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
          style={{ color: K.muted }}
        >
          {label}
        </p>
        {hidden ? (
          <div
            className="h-3.5 w-24 rounded-md"
            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            aria-label="Restricted"
          />
        ) : (
          <p className="text-xs font-bold truncate" style={{ color: K.ink }}>
            {value || '—'}
          </p>
        )}
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
  const K = tokens(isDark);
  const { access, accessLoading } = useAccessControl(routePath);

  // While loading, treat as no access; once resolved, read the flag.
  const canView = !accessLoading && !!access?.canView;

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

  return (
    <div
      className="rd-page fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: isDark ? "rgba(10,10,14,0.65)" : "rgba(0,0,0,0.4)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      onClick={closeModal}
    >
      <style>{FONT}</style>
      <div
        className="rd-glass rd-pop flex flex-col rounded-[28px] border w-[88%] max-w-[1380px] h-[92vh] overflow-hidden relative"
        style={{
          background: K.glassDeep,
          borderColor: K.rim,
          boxShadow: K.shadow,
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Close button ─────────────────────────────────────────────────── */}
        <button
          onClick={closeModal}
          className="absolute right-4 top-4 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all"
          style={{ background: K.chipBg, color: K.muted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
        >
          <X size={16} />
        </button>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 border-b px-6 py-4 rd-glass"
          style={{ borderColor: K.hairline, background: K.glassDeep }}
        >

          {/* Title */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                boxShadow: `0 4px 12px -4px ${APPLE.blue}88`,
              }}
            >
              <HandCoins size={17} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold leading-none" style={{ color: K.ink }}>
                  Rebate Program Details
                </h2>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: K.muted }}>
                View and manage rebate program information, customers, and items
              </p>
            </div>
          </div>

          {/* Info strip — values are blanked when the viewer lacks access */}
          <div className="flex items-stretch gap-2.5">
          <div className="flex-1 min-w-0"><InfoCard icon={FileText}  label="Rebate Code"    value={selectedRebate.code}                     color="red"     isDark={isDark} hidden={!canView} /></div>
          <div className="flex-1 min-w-0"><InfoCard icon={BarChart2} label="Rebate Type"    value={rebateDetails?.rebateType}               color="blue"    isDark={isDark} hidden={!canView} /></div>
          <div className="flex-1 min-w-0"><InfoCard icon={Clock}     label="Frequency"      value={rebateDetails?.frequency || 'Quarterly'} color="violet"  isDark={isDark} hidden={!canView} /></div>
          <div className="flex-shrink-0"><InfoCard  icon={Calendar}  label="Period"         value={periodStr}                               color="emerald" isDark={isDark} hidden={!canView} /></div>          
          <InfoCard icon={Blocks} label="Quota Type" value={rebateDetails?.quotaType || 'N/A'} color={rebateDetails?.quotaType === 'Without Quota' ? 'amber' : 'blue'} isDark={isDark} hidden={!canView}/></div>
          </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0">

          {/* Loading */}
          {accessLoading ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <div
                className="w-9 h-9 rounded-full border-4 animate-spin"
                style={{ borderColor: `${APPLE.blue}33`, borderTopColor: APPLE.blue }}
              />
              <p className="text-xs" style={{ color: K.muted }}>Checking permissions…</p>
            </div>

          ) : !canView ? (
            <NoAccessOverlay isDark={isDark} onClose={closeModal} />

          ) : (
            <>
              {/* ── Tab bar ─────────────────────────────────────────────── */}
              <div
                className="flex-shrink-0 border-b px-6 py-2.5 flex items-center gap-3 rd-glass"
                style={{ borderColor: K.hairline, background: K.glassDeep }}
              >
                <div
                  className="flex items-center gap-1 rounded-full p-1"
                  style={{ background: K.chipBg, border: `1px solid ${K.hairline}` }}
                >
                  {[
                    { icon: Users,  label: 'Customers', value: 'customers', count: rebateDetails?.totalCustomers ?? rebateDetails?.customers?.length },
                    { icon: Blocks, label: 'Items',     value: 'items',     count: rebateDetails?.totalItems ?? rebateDetails?.items?.length     },
                  ].map(tab => {
                    const isActive = activeTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        onClick={() => setActiveTab(tab.value)}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                        style={{
                          background: isActive
                            ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                            : "transparent",
                          color: isActive ? "#FFFFFF" : K.muted,
                          boxShadow: isActive ? `0 4px 12px -4px ${APPLE.blue}88` : "none",
                        }}
                        onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = K.hover; e.currentTarget.style.color = K.ink; } }}
                        onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = K.muted; } }}
                      >
                        <tab.icon size={14} />
                        {tab.label}
                        {tab.count != null && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{
                              background: isActive ? "rgba(255,255,255,0.25)" : K.chipBg,
                              color: isActive ? "#FFFFFF" : K.muted,
                            }}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Tab content ─────────────────────────────────────────── */}
              <div className="flex flex-col flex-1 min-h-0 p-5" style={{ background: K.bg }}>

                {/* CUSTOMERS */}
                {activeTab === 'customers' && (
                  <div
                    className="flex flex-col flex-1 min-h-0 rounded-2xl border rd-glass overflow-hidden"
                    style={{ background: K.glass, borderColor: K.hairline, boxShadow: K.shadow }}
                  >
                    <div
                      className="flex-shrink-0 px-5 py-3 border-b"
                      style={{ borderColor: K.hairline, background: K.glass }}
                    >
                      <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: K.ink }}>
                        {customerTabLabel}
                      </h4>
                      <p className="text-[11px] mt-0.5" style={{ color: K.muted }}>{customerTabSub}</p>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto rd-scroll">
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
                  <div
                    className="flex flex-col flex-1 min-h-0 rounded-2xl border rd-glass overflow-hidden"
                    style={{ background: K.glass, borderColor: K.hairline, boxShadow: K.shadow }}
                  >
                    <div
                      className="flex-shrink-0 px-5 py-3 border-b"
                      style={{ borderColor: K.hairline, background: K.glass }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: K.ink }}>
                            {itemTabLabel}
                          </h4>
                          <p className="text-[11px] mt-0.5" style={{ color: K.muted }}>{itemTabSub}</p>
                        </div>
                        {rebateDetails?.name && (
                          <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                            style={{
                              background: `${APPLE.orange}14`,
                              borderColor: `${APPLE.orange}33`,
                            }}
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: APPLE.orange }}
                            />
                            <span
                              className="text-[10px] font-semibold"
                              style={{ color: APPLE.orange }}
                            >
                              {rebateDetails.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto rd-scroll">
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