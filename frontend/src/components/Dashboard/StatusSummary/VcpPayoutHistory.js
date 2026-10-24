import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Wallet, X, Zap, Calendar, Layers, Lock } from 'lucide-react';

const VcpPayoutHistory = ({
  theme = 'light',
  customerModalTab,
  modalCustomer,
  paginatedPayouts,
  filteredPayouts,
  payoutCurrentPage,
  setPayoutCurrentPage,
  payoutRowsPerPage,
  setPayoutRowsPerPage,
  editingPayoutId,
  setEditingPayoutId,
  editedAmountReleased,
  setEditedAmountReleased,
  saveMessage,
  setSaveMessage,
  handlePayoutStatusChange,
  loadDetailedPayoutsData,
  formatCurrency,
  beginningBalance = 0,
  beginningBalances = [],
  previousBalance = 0,
  beginningBalanceRecord = null,
  access,
}) => {
  const isDark  = theme === 'dark';
  const canView = !!access?.canView;

  const [syncingSap, setSyncingSap]         = useState(false);
  const [sapSyncMessage, setSapSyncMessage] = useState(null);
  const [showSapDetails, setShowSapDetails] = useState({});

  // ── Summary view (By Quarter / By Rebate Code) ─────────────────────────────
  const [summaryViewMode, setSummaryViewMode] = useState('detail'); // 'detail' | 'quarter' | 'rebateCode'
  const [summaryRows, setSummaryRows] = useState([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryLoadError, setSummaryLoadError] = useState(null);

  const customerCardCode =
    modalCustomer?.code ||
    modalCustomer?.CardCode ||
    modalCustomer?.cardCode ||
    modalCustomer?.CustomerCode;

  const loadPayoutSummary = useCallback(async () => {
    if (!canView) return;
    if (!customerCardCode) return;
    setIsSummaryLoading(true);
    setSummaryLoadError(null);
    try {
      const url = `http://192.168.100.193:3009/api/vcp/payouts/customer/${customerCardCode}/payout-summary?db=VCP`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const result = await response.json();
      if (result.success) {
        const rows = summaryViewMode === 'quarter'
          ? (result.data?.byQuarter || [])
          : (result.data?.byRebateCode || []);
        setSummaryRows(rows);
      } else {
        setSummaryRows([]);
        setSummaryLoadError(result.message || 'Failed to load payout summary');
      }
    } catch (err) {
      console.error('Error loading payout summary:', err);
      setSummaryRows([]);
      setSummaryLoadError(err.message || 'Failed to load payout summary');
    } finally {
      setIsSummaryLoading(false);
    }
  }, [customerCardCode, summaryViewMode, canView]);

  useEffect(() => {
    if (!canView) return;
    if (customerModalTab === 'payout' && customerCardCode && summaryViewMode !== 'detail') {
      loadPayoutSummary();
    }
  }, [customerModalTab, customerCardCode, summaryViewMode, loadPayoutSummary, canView]);

  if (customerModalTab !== 'payout') return null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  const parsePeriodToNumber = (str) => {
    if (!str) return 0;
    for (let i = 0; i < monthNames.length; i++) {
      if (str.includes(monthNames[i])) {
        const y = str.match(/\b(20\d{2})\b/);
        return (y ? parseInt(y[1]) : 0) * 100 + (i + 1);
      }
    }
    return 0;
  };

  const extractMonthYear = (period) => {
    const lower = (period || '').toLowerCase().trim();
    const short = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    for (let i = 0; i < monthNames.length; i++) {
      if (lower.includes(monthNames[i].toLowerCase())) {
        const y = period.match(/\b(20\d{2})\b/);
        return { month: i + 1, year: y ? parseInt(y[1]) : new Date().getFullYear() };
      }
    }
    for (let i = 0; i < short.length; i++) {
      if (lower.includes(short[i])) {
        const y = period.match(/\b(20\d{2})\b/);
        return { month: i + 1, year: y ? parseInt(y[1]) : new Date().getFullYear() };
      }
    }
    const q = lower.match(/q([1-4])\s*(20\d{2})?/);
    if (q) return { month: (parseInt(q[1]) - 1) * 3 + 1, year: q[2] ? parseInt(q[2]) : new Date().getFullYear() };
    const mn = period.match(/(\d{1,2})[\/\-]\s*(20\d{2})/);
    if (mn && parseInt(mn[1]) >= 1 && parseInt(mn[1]) <= 12)
      return { month: parseInt(mn[1]), year: parseInt(mn[2]) };
    return { month: 1, year: new Date().getFullYear() };
  };

  const sortByPeriod = (arr) =>
    [...arr].sort((a, b) => {
      const ad = extractMonthYear(a.Period), bd = extractMonthYear(b.Period);
      if (ad.year  !== bd.year)  return ad.year  - bd.year;
      if (ad.month !== bd.month) return ad.month - bd.month;
      const aOOP = (a.RebateType === 'SAP-OOP' || (a.PayoutId || '').startsWith('SAP-')) ? 1 : 0;
      const bOOP = (b.RebateType === 'SAP-OOP' || (b.PayoutId || '').startsWith('SAP-')) ? 1 : 0;
      return aOOP - bOOP;
    });

  const formatSapDate = (s) => {
    if (!s) return '';
    try {
      return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return s;
    }
  };

  // Resolution label map — explains why an OOP row landed where it did
  const MATCH_TYPE_LABELS = {
    exact         : null,
    after_last    : 'Auto-assigned: latest period used',
    before_first  : 'Auto-assigned: earliest period used',
    gap_previous  : 'Auto-assigned: nearest past period',
    gap_next      : 'Auto-assigned: nearest upcoming period',
    fallback      : 'Auto-assigned: best-fit period',
  };

  const resolutionLabel = (matchType) => MATCH_TYPE_LABELS[matchType] ?? null;

  const toggleSapDetails = (id) =>
    setShowSapDetails(prev => ({ ...prev, [id]: !prev[id] }));

  // Rows that are NOT real monthly payout rows (used for beginning-balance logic)
  const isHelperRow = (p) => {
    const id = p.PayoutId || '';
    return (
      p.isBeginningBalance ||
      p.Period?.startsWith('Balance of ') ||
      id.startsWith('OOP-') ||
      id.startsWith('SAP-') ||
      id.startsWith('QtrRebate-') ||
      p.isQtrRebate
    );
  };

  // ── Sorted data ───────────────────────────────────────────────────────────
  const sortedPaginated = sortByPeriod(paginatedPayouts || []);
  const sortedFiltered  = sortByPeriod(filteredPayouts  || []);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / payoutRowsPerPage));
  const safePage   = Math.min(payoutCurrentPage, totalPages);

  const getPageNums = () => {
    const total = totalPages, cur = safePage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)         return [1, 2, 3, 4, 5, '...', total];
    if (cur >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', cur - 1, cur, cur + 1, '...', total];
  };

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const T = {
    bg:      isDark ? 'bg-slate-900'                      : 'bg-white',
    header:  isDark ? 'bg-slate-800/80 border-slate-700'  : 'bg-slate-50 border-slate-200',
    thead:   isDark ? 'bg-slate-800/80 border-slate-700'  : 'bg-slate-50 border-slate-200',
    divider: isDark ? 'divide-slate-700'                  : 'divide-slate-100',
    footer:  isDark ? 'bg-slate-800 border-slate-700'     : 'bg-white border-slate-200',
    select:  isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-700',
    row:     isDark ? 'hover:bg-slate-800/60'             : 'hover:bg-slate-50',
    tp:      isDark ? 'text-slate-100'                    : 'text-slate-800',
    ts:      isDark ? 'text-slate-400'                    : 'text-slate-500',
    tm:      isDark ? 'text-slate-500'                    : 'text-slate-400',
  };

  const thCls = `px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest ${T.ts}`;

  const PaginationBtn = ({ icon: Icon, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
        disabled
          ? isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
          : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={14} />
    </button>
  );

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const badge = (value, color) => {
    const map = {
      blue:    isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'          : 'bg-blue-50 text-blue-700 border-blue-200',
      violet:  isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40'    : 'bg-violet-50 text-violet-700 border-violet-200',
      emerald: isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber:   isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'       : 'bg-amber-50 text-amber-700 border-amber-200',
      red:     isDark ? 'bg-red-900/30 text-red-300 border-red-700/40'             : 'bg-red-50 text-red-700 border-red-200',
      slate:   isDark ? 'bg-slate-700 text-slate-400 border-slate-600'             : 'bg-slate-100 text-slate-500 border-slate-200',
      teal:    isDark ? 'bg-teal-900/30 text-teal-300 border-teal-700/40'          : 'bg-teal-50 text-teal-700 border-teal-200',
    };
    return `inline-block px-2 py-0.5 rounded border font-semibold tabular-nums text-xs whitespace-nowrap ${map[color] || map.slate}`;
  };

  // ── Summary-view helpers ────────────────────────────────────────────────
  const getSummaryStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'emerald';
      case 'Partially Paid': return 'amber';
      case 'Pending': return 'blue';
      case 'Over-Released': return 'red';
      case 'No Payout': return 'slate';
      default: return 'slate';
    }
  };

  const SummaryRebateTypeBadge = ({ type }) => {
    const map = {
      Fixed:       isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'       : 'bg-blue-50 text-blue-700 border-blue-200',
      Incremental: isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40' : 'bg-violet-50 text-violet-700 border-violet-200',
      Percentage:  isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'    : 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap border ${
        map[type] || (isDark ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200')
      }`}>{type || '?'}</span>
    );
  };

  const statusSelectCls = (status, editable) => {
    if (!editable) return `appearance-none px-2 py-0.5 rounded border text-xs font-semibold italic ${
      isDark ? 'bg-slate-700 text-slate-500 border-slate-600' : 'bg-slate-100 text-slate-400 border-slate-200'
    }`;
    const map = {
      Paid:             isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Partially Paid': isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'       : 'bg-amber-50 text-amber-700 border-amber-200',
      Pending:          isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'          : 'bg-blue-50 text-blue-700 border-blue-200',
      'No Payout':      isDark ? 'bg-slate-700 text-slate-400 border-slate-600'             : 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return `appearance-none px-2 py-0.5 rounded border text-xs font-semibold cursor-pointer focus:outline-none ${map[status] || map['No Payout']}`;
  };

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderPayoutRow = (payout, index) => {
    if (payout.isBeginningBalance || payout.Period?.startsWith('Balance of ')) return null;

    // ── Out-of-period (OOP) SAP rows ─────────────────────────────────────────
    const isOOP =
      payout.RebateType === 'SAP-OOP' ||
      (payout.PayoutId || '').startsWith('SAP-');

    if (isOOP) {
      const oopAmt   = Math.abs(payout.SapReleasedAmount || payout.TotalAmount || 0);
      const isDeduct = (payout.SapReleasedAmount || 0) < 0 || payout.Status === 'Deducted';
      const oopColor = isDeduct ? 'red' : 'violet';
      const oopSign  = isDeduct ? '−' : '+';

      // matchType stored on the row tells us how the resolver assigned it
      const matchType = payout.MatchType || null;
      const resLabel  = matchType ? resolutionLabel(matchType) : null;
      const oopLabel  = isDeduct ? 'SAP Deduction (auto-resolved)' : 'SAP Released (auto-resolved)';

      return (
        <tr
          key={payout.Id || `oop-${index}`}
          className={`transition-colors duration-100 border-b ${T.row} ${
            isDark ? 'border-slate-700/50' : 'border-slate-100'
          } border-l-2 ${
            isDeduct
              ? isDark ? 'border-l-red-500'    : 'border-l-red-400'
              : isDark ? 'border-l-violet-500' : 'border-l-violet-400'
          } opacity-90`}
        >
          {/* Date */}
          <td className="px-5 py-2.5">
            <span className={`font-medium ${T.tp}`}>{payout.Date || payout.PayoutDate}</span>
            <div className={`text-[10px] mt-0.5 ${
              isDeduct
                ? isDark ? 'text-red-400'    : 'text-red-600'
                : isDark ? 'text-violet-400' : 'text-violet-600'
            }`}>
              {oopLabel}
            </div>
          </td>

          {/* Period */}
          <td className="px-4 py-2.5">
            <div className={`font-medium text-xs ${
              isDeduct
                ? isDark ? 'text-red-300'    : 'text-red-700'
                : isDark ? 'text-violet-300' : 'text-violet-700'
            }`}>
              {payout.Period}
            </div>

            {/* Resolution explanation badge */}
            {resLabel && (
              <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                isDark
                  ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                <Zap size={8} />
                {resLabel}
              </div>
            )}

            <div className={`text-[10px] mt-0.5 ${T.tm}`}>
              SAP DocDate outside rebate period — auto-resolved
            </div>
          </td>

          {/* Rebate Earned */}
          <td className="px-4 py-2.5 text-center">
            <span className={badge('—', 'slate')}>—</span>
          </td>

          {/* Total Amount */}
          <td className="px-4 py-2.5 text-center">
            <span className={badge(`${oopSign}${formatCurrency(oopAmt)}`, oopColor)}>
              {oopSign}{formatCurrency(oopAmt)}
            </span>
          </td>

          {/* Status */}
          <td className="px-4 py-2.5 text-center">
            <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${
              isDeduct
                ? isDark ? 'bg-red-900/30 text-red-300 border-red-700/40'          : 'bg-red-50 text-red-700 border-red-200'
                : isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40' : 'bg-violet-50 text-violet-700 border-violet-200'
            }`}>
              {isDeduct ? 'Deducted' : 'Paid (SAP)'}
            </span>
          </td>

          {/* Amount Released */}
          <td className="px-4 py-2.5 text-center">
            <span className={badge(
              `${oopSign}₱${oopAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              oopColor
            )}>
              {oopSign}₱{oopAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </td>

          {/* Balance */}
          <td className="px-4 py-2.5 text-center">
            <span className={badge('—', 'slate')}>—</span>
          </td>
        </tr>
      );
    }

    // ── Regular / Settled rows ────────────────────────────────────────────────
    const isSettled     = payout.Status === 'Settled' || !!payout.CarriedOverTo;
    const carriedOverTo = payout.CarriedOverTo || '';
    const carryOverNote = payout.CarryOverNote || '';
    const hasTransactions = payout.BaseAmount > 0;
    const isEligible      = payout.TotalAmount > 0;
    const isFixed         = modalCustomer?.rebateType === 'Fixed';
    const isPercentage    = modalCustomer?.rebateType === 'Percentage';
    const isIncremental   = modalCustomer?.rebateType === 'Incremental';

    const isQuotaGatedType =
      isFixed ||
      (isPercentage   && modalCustomer?.quotaType === 'With Quota') ||
      (isIncremental  && modalCustomer?.quotaType === 'With Quota');

    const isQuotaNotMet   = isQuotaGatedType && payout.Status === 'No Payout' && (payout.BaseAmount || 0) === 0;
    const isNoQuotaFixed  = isFixed && (payout.BaseAmount || 0) > 0;

    // ✅ FIX: quota-not-met rows are "not eligible" for editing/labels even when
    //         they now carry a forwarded balance (TotalAmount > 0).
    const isNotEligible   = (!isEligible || isQuotaNotMet) && !isSettled;

    const isEditable =
      !isSettled &&
      payout.Status !== 'No Payout' &&
      hasTransactions &&
      isEligible;

    const isQtr      = payout.isQtrRebate;
    const hasSapData = payout.SapReleasedAmount > 0;

    // Was this row populated by the universal resolver for a non-exact DocDate?
    const resolvedExternally =
      payout.MatchType && payout.MatchType !== 'exact' && hasSapData;

    let rowAccent = '';
    if (isSettled)            rowAccent = isDark ? 'border-l-2 border-l-teal-500'   : 'border-l-2 border-l-teal-400';
    else if (isQtr)           rowAccent = isDark ? 'border-l-2 border-l-blue-500'   : 'border-l-2 border-l-blue-400';
    else if (resolvedExternally) rowAccent = isDark ? 'border-l-2 border-l-amber-500' : 'border-l-2 border-l-amber-400';
    else if (hasSapData)      rowAccent = isDark ? 'border-l-2 border-l-violet-500' : 'border-l-2 border-l-violet-400';

    const rowOpacity =
      payout.Status === 'No Payout' || (isNotEligible && !isSettled) ? 'opacity-70' : '';

    const baseColor  = hasTransactions ? (isPercentage ? 'emerald' : 'blue') : 'slate';
    const totalColor = isNotEligible   ? 'slate'
                     : isQtr          ? 'violet'
                     : isEligible     ? (isPercentage ? 'emerald' : 'amber')
                     : 'slate';

    const displayBalance = isSettled ? 0 : (payout.Balance ?? 0);

    // ✅ FIX: show a carried balance on quota-not-met rows instead of hiding it
    const balColor =
      isQuotaNotMet && displayBalance > 0       ? 'amber'
      : isNotEligible                           ? 'slate'
      : displayBalance > 0 && isEditable        ? 'red'
      : displayBalance === 0                    ? 'emerald'
      : 'slate';

    return (
      <tr
        key={payout.Id || index}
        className={`transition-colors duration-100 border-b ${T.row} ${
          isDark ? 'border-slate-700/50' : 'border-slate-100'
        } ${rowAccent} ${rowOpacity}`}
      >
        {/* ── Date ──────────────────────────────────────────────────────── */}
        <td className="px-5 py-2.5">
          <span className={`font-medium ${T.tp}`}>{payout.Date}</span>
          {isQtr && (
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              Quarter Rebate
            </div>
          )}
          {isSettled && (
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              Balance settled
            </div>
          )}
          {isNotEligible && !isSettled && (
            <div className={`text-[10px] mt-0.5 ${
              isQuotaNotMet ? (isDark ? 'text-amber-400' : 'text-amber-600') : T.tm
            }`}>
              {isQuotaNotMet ? 'Quota not met' : !hasTransactions ? 'No Transactions' : 'Not Eligible'}
            </div>
          )}
        </td>

        {/* ── Period ────────────────────────────────────────────────────── */}
        <td className="px-4 py-2.5">
          <div className={`font-medium text-xs ${
            isNotEligible && !isSettled ? `italic ${T.ts}`
            : isSettled ? (isDark ? 'text-teal-300' : 'text-teal-700')
            : isQtr     ? (isDark ? 'text-violet-300' : 'text-violet-700')
            : T.tp
          }`}>
            {payout.Period}
          </div>

          {/* Carry-over note */}
          {carriedOverTo && (
            <div className={`text-[10px] mt-0.5 font-medium ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              Carried → {carriedOverTo} (fully paid)
            </div>
          )}
          {carryOverNote && !carriedOverTo && (
            <div className={`text-[10px] mt-0.5 ${T.tm}`}>{carryOverNote}</div>
          )}

          {/* Universal-resolver note: SAP amount came from a different DocDate */}
          {resolvedExternally && (
            <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
              isDark
                ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <Zap size={8} />
              {resolutionLabel(payout.MatchType)}
            </div>
          )}

          {isNotEligible && !isSettled && (
            <div className={`text-[10px] mt-0.5 ${
              isQuotaNotMet
                ? isDark ? 'text-amber-400/80' : 'text-amber-600/80'
                : T.tm
            }`}>
              {isQuotaNotMet
                ? displayBalance > 0
                  ? 'Did not meet monthly quota — balance carried forward'
                  : 'Did not meet monthly quota'
                : !hasTransactions
                ? 'No transactions this month'
                : 'No eligible transactions'}
            </div>
          )}
          {isNoQuotaFixed && !isQtr && !isSettled && (
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-blue-400/70' : 'text-blue-500/70'}`}>
              Daily sales-based rebate
            </div>
          )}
        </td>

        {/* ── Rebate Earned ─────────────────────────────────────────────── */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatCurrency(payout.BaseAmount || 0), baseColor)}>
            {formatCurrency(payout.BaseAmount || 0)}
          </span>
        </td>

        {/* ── Total Amount ──────────────────────────────────────────────── */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatCurrency(payout.TotalAmount), totalColor)}>
            {formatCurrency(payout.TotalAmount)}
          </span>
        </td>

        {/* ── Status ────────────────────────────────────────────────────── */}
        <td className="px-4 py-2.5 text-center">
          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${
            isSettled
              ? isDark
                ? 'bg-teal-900/30 text-teal-300 border-teal-700/40'
                : 'bg-teal-50 text-teal-700 border-teal-200'
              : payout.Status === 'Paid'
              ? isDark
                ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : payout.Status === 'Partially Paid'
              ? isDark
                ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'
                : 'bg-amber-50 text-amber-700 border-amber-200'
              : payout.Status === 'Pending'
              ? isDark
                ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'
                : 'bg-blue-50 text-blue-700 border-blue-200'
              : isDark
              ? 'bg-slate-700 text-slate-400 border-slate-600'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {isSettled ? 'Paid' : (payout.Status || 'No Payout')}
          </span>
        </td>

        {/* ── Amount Released ───────────────────────────────────────────── */}
        <td className="px-4 py-2.5 text-center">
          <div className="flex flex-col items-center gap-1">
            <span className={badge(
              `₱${(payout.AmountReleased || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              isNotEligible && !isSettled ? 'slate' : 'blue'
            )}>
              ₱{(payout.AmountReleased || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {isSettled && carriedOverTo && (
              <div className={`text-[9px] mt-0.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                Via {carriedOverTo}
              </div>
            )}

            {/* SAP detail panel */}
            {hasSapData && showSapDetails[payout.Id] && payout.sapEntries?.length > 0 && (
              <div className={`relative z-30 w-64 mt-1 rounded-xl border shadow-xl p-3 text-left ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                    SAP Journal Entries
                  </span>
                  <button
                    onClick={() => toggleSapDetails(payout.Id)}
                    className={`w-5 h-5 rounded flex items-center justify-center ${
                      isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {payout.sapEntries.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`text-[10px] pb-1.5 border-b last:border-0 ${
                        isDark ? 'border-slate-700' : 'border-slate-100'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className={T.ts}>{formatSapDate(entry.docDate)}</span>
                        <span className={`font-bold ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                          ₱{entry.amount?.toFixed(2)}
                        </span>
                      </div>
                      <div className={`mt-0.5 truncate ${T.tm}`}>
                        {entry.memo || entry.acctName || `Account: ${entry.account}`}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`mt-1.5 pt-1.5 border-t text-[9px] ${
                  isDark ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'
                }`}>
                  Total: ₱{payout.SapReleasedAmount.toFixed(2)} · {payout.sapEntries.length} entry(s)
                </div>
              </div>
            )}
          </div>
        </td>

        {/* ── Balance ───────────────────────────────────────────────────── */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatCurrency(displayBalance), balColor)}>
            {formatCurrency(displayBalance)}
          </span>
        </td>
      </tr>
    );
  };

  // ── Access denied state ────────────────────────────────────────────────────
  if (!canView) {
    return (
      <div className={`h-full flex flex-col ${T.bg}`}>
        <div className={`flex-shrink-0 px-5 py-3 border-b ${T.header}`}>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Payout History</h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>Restricted</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs px-6">
            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
              isDark ? 'bg-red-900/20 border border-red-700/30' : 'bg-red-50 border border-red-200'
            }`}>
              <Lock size={22} className={isDark ? 'text-red-400' : 'text-red-600'} />
            </div>
            <h3 className={`text-sm font-bold mb-1 ${T.tp}`}>Access Restricted</h3>
            <p className={`text-xs leading-relaxed ${T.ts}`}>
              You don't have permission to view payout history.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const regularRows = sortedPaginated.filter(
    p => !p.isBeginningBalance && !p.Period?.startsWith('Balance of ')
  );

  // ✅ FIX 1: compute the first period from ALL filtered rows (not just the current
  //           page) and ignore helper rows (QtrRebate / OOP / SAP) whose Period
  //           has no month name and would make Math.min() return 0.
  const periodNums = sortedFiltered
    .filter(p => !isHelperRow(p))
    .map(p => parsePeriodToNumber(p.Period))
    .filter(n => n > 0);

  const firstRegularNum = periodNums.length > 0 ? Math.min(...periodNums) : 0;

  // ✅ FIX 2: only show on page 1, and don't depend on firstRegularNum being > 0
  // Fallback: if the parent doesn't pass previousBalance, derive the carry-in from the
  // first row (TotalAmount already = BaseAmount + carried balance on the backend).
  const firstRow = sortedFiltered.find(p => !isHelperRow(p));
  const derivedBeg = firstRow
    ? Math.max(0, (parseFloat(firstRow.TotalAmount) || 0) - (parseFloat(firstRow.BaseAmount) || 0))
    : 0;

  const begAmount =
    [
      Number(previousBalance),
      Number(beginningBalanceRecord?.Balance),
      Number(beginningBalance),
      derivedBeg,
    ].find(n => Number.isFinite(n) && n > 0.005) || 0;

  const showBegBalance = safePage === 1 && begAmount > 0.005;

  return (
    <div className={`h-full flex flex-col ${T.bg}`}>

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 px-5 py-3 border-b flex items-center justify-between ${T.header}`}>
        <div>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Payout History</h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>Rebate payment records — sorted by period</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${T.ts}`}>View by</span>
          <div className="relative">
            {summaryViewMode === 'quarter'
              ? <Calendar size={12} className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${T.tm}`} />
              : summaryViewMode === 'rebateCode'
                ? <Layers size={12} className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${T.tm}`} />
                : null
            }
            <select
              value={summaryViewMode}
              onChange={(e) => setSummaryViewMode(e.target.value)}
              className={`${summaryViewMode !== 'detail' ? 'pl-7' : 'pl-3'} pr-6 py-1.5 rounded-lg text-[11px] font-semibold border outline-none transition-all appearance-none cursor-pointer ${T.select}`}
            >
              <option value="detail">Detail</option>
              <option value="quarter">Quarter</option>
              <option value="rebateCode">Rebate Code</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── SAP sync message ──────────────────────────────────────────────── */}
      {sapSyncMessage && (
        <div className={`flex-shrink-0 px-5 py-2 border-b text-xs flex items-center gap-2 ${
          sapSyncMessage.includes('✅')
            ? isDark ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : sapSyncMessage.includes('❌')
              ? isDark ? 'bg-red-900/20 border-red-800/30 text-red-300' : 'bg-red-50 border-red-200 text-red-600'
              : isDark ? 'bg-blue-900/20 border-blue-800/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {!sapSyncMessage.includes('✅') && !sapSyncMessage.includes('❌') && (
            <RefreshCw size={12} className="animate-spin flex-shrink-0" />
          )}
          {sapSyncMessage}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {summaryViewMode !== 'detail' ? (
          isSummaryLoading ? (
            <div className="animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`px-5 py-3 border-b flex items-center gap-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                  <div className={`h-3 w-24 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  <div className={`h-3 w-16 rounded ml-auto ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  <div className={`h-3 w-16 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                </div>
              ))}
            </div>
          ) : summaryLoadError ? (
            <div className="h-full flex items-center justify-center py-16">
              <div className="text-center">
                <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Failed to load payout summary</p>
                <p className={`text-xs ${T.ts}`}>{summaryLoadError}</p>
                <button
                  onClick={loadPayoutSummary}
                  className="mt-3 px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : summaryRows.length === 0 ? (
            <div className="h-full flex items-center justify-center py-16">
              <div className="text-center">
                <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Wallet size={22} className={T.tm} />
                </div>
                <h3 className={`text-sm font-bold mb-1 ${T.tp}`}>No Payout Records</h3>
                <p className={`text-xs ${T.ts}`}>No payout history found for this customer.</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className={`sticky top-0 border-b ${T.thead}`}>
                <tr>
                  <th className={`${thCls} text-left w-[22%]`}>
                    {summaryViewMode === 'quarter' ? 'Quarter' : 'Rebate Code'}
                  </th>
                  <th className={`${thCls} text-left w-[18%]`}>Type(s)</th>
                  <th className={`${thCls} text-center w-[15%]`}>Rebate Earned</th>
                  <th className={`${thCls} text-center w-[15%]`}>Total Amount</th>
                  <th className={`${thCls} text-center w-[10%]`}>Status</th>
                  <th className={`${thCls} text-center w-[10%]`}>Released</th>
                  <th className={`${thCls} text-center w-[10%]`}>Balance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${T.divider}`}>
                {summaryRows.map((row, i) => {
                  const dedupeKey = summaryViewMode === 'quarter' ? row.quarterLabel : row.rebateCode;
                  const key = `${dedupeKey || 'row'}-${i}`;
                  return (
                    <tr key={key} className={`transition-colors duration-100 border-b ${T.row} ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
                      <td className="px-5 py-2.5">
                        {summaryViewMode === 'rebateCode' ? (
                          <>
                            <span className={`font-semibold ${T.tp}`}>{row.rebateCode}</span>
                            {row.quarterLabel && row.dateFrom && row.dateTo && (
                              <div className={`text-[10px] mt-0.5 ${T.tm}`}>
                                {row.quarterLabel}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={`font-semibold ${T.tp}`}>{row.quarterLabel}</span>
                            {row.rebateCodes?.length > 0 && (
                              <div className={`text-[10px] mt-0.5 ${T.tm}`}>{row.rebateCodes.join(', ')}</div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(row.rebateTypes || []).map(t => <SummaryRebateTypeBadge key={t} type={t} />)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.baseAmount), 'blue')}>{formatCurrency(row.baseAmount)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.totalAmount), row.totalAmount > 0 ? 'amber' : 'slate')}>{formatCurrency(row.totalAmount)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(row.status, getSummaryStatusColor(row.status))}>{row.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.amountReleased), 'blue')}>{formatCurrency(row.amountReleased)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.isOverReleased ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={badge(formatCurrency(row.balance), row.balance > 0 ? 'red' : 'emerald')}>
                              {row.balance < 0 ? `(${formatCurrency(Math.abs(row.balance))})` : formatCurrency(row.balance)}
                            </span>
                            <span className={`text-[9px] ${isDark ? 'text-red-400' : 'text-red-600'}`}>Over-released</span>
                          </div>
                        ) : (
                          <span className={badge(formatCurrency(row.balance), row.balance > 0 ? 'red' : row.balance === 0 ? 'emerald' : 'slate')}>
                            {formatCurrency(row.balance)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : regularRows.length === 0 && !showBegBalance ? (
          <div className="h-full flex items-center justify-center py-16">
            <div className="text-center">
              <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${
                isDark ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
                <Wallet size={22} className={T.tm} />
              </div>
              <h3 className={`text-sm font-bold mb-1 ${T.tp}`}>No Payout Records</h3>
              <p className={`text-xs ${T.ts}`}>No payout records found for this period.</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className={`sticky top-0 border-b ${T.thead}`}>
              <tr>
                <th className={`${thCls} text-left  w-[12%]`}>Date</th>
                <th className={`${thCls} text-left  w-[20%]`}>Period</th>
                <th className={`${thCls} text-center w-[12%]`}>Rebate Earned</th>
                <th className={`${thCls} text-center w-[12%]`}>Total Amount</th>
                <th className={`${thCls} text-center w-[10%]`}>Status</th>
                <th className={`${thCls} text-center w-[14%]`}>Amount Released</th>
                <th className={`${thCls} text-center w-[14%]`}>Balance</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${T.divider}`}>

              {/* ── Beginning balance row ────────────────────────────────── */}
              {showBegBalance && (() => {
                const year  = Math.floor(firstRegularNum / 100);
                const month = firstRegularNum % 100;
                // ✅ FIX: guard against firstRegularNum === 0
                const dateDisplay = firstRegularNum > 0
                  ? `${String(month).padStart(2, '0')}.01.${year}`
                  : '—';
                return (
                  <tr
                    key="beg-balance"
                    className={`border-b ${
                      isDark
                        ? 'border-slate-700/50 bg-emerald-900/10 border-l-2 border-l-emerald-500'
                        : 'border-slate-100 bg-emerald-50/60 border-l-2 border-l-emerald-400'
                    }`}
                  >
                    <td className="px-5 py-2.5">
                      <span className={`font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                        {dateDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className={`font-medium text-xs ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
                        Beginning Balance
                      </div>
                    </td>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded border font-bold tabular-nums text-xs ${
                        isDark
                          ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {formatCurrency(begAmount)}
                      </span>
                    </td>
                  </tr>
                );
              })()}

              {/* ── Regular payout rows ──────────────────────────────────── */}
              {regularRows.map((payout, i) => renderPayoutRow(payout, i))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination footer ──────────────────────────────────────────────── */}
      {summaryViewMode === 'detail' && sortedFiltered.length > 0 && (
        <div className={`flex-shrink-0 flex flex-wrap gap-2 items-center justify-between px-5 py-2.5 border-t ${T.footer}`}>
          <div className="flex items-center gap-3">
            <p className={`text-[11px] ${T.ts}`}>
              Showing{' '}
              <span className={`font-semibold ${T.tp}`}>
                {(safePage - 1) * payoutRowsPerPage + 1}–{Math.min(safePage * payoutRowsPerPage, sortedFiltered.length)}
              </span>{' '}
              of{' '}
              <span className={`font-semibold ${T.tp}`}>{sortedFiltered.length}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${T.ts}`}>Per page</span>
              <select
                value={payoutRowsPerPage}
                onChange={(e) => {
                  setPayoutRowsPerPage(Number(e.target.value));
                  setPayoutCurrentPage(1);
                }}
                className={`text-xs border rounded-md px-1.5 py-0.5 outline-none ${T.select}`}
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PaginationBtn icon={ChevronsLeft}  onClick={() => setPayoutCurrentPage(1)}                                  disabled={safePage === 1} />
            <PaginationBtn icon={ChevronLeft}   onClick={() => setPayoutCurrentPage(p => Math.max(p - 1, 1))}           disabled={safePage === 1} />
            {getPageNums().map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className={`w-7 text-center text-xs ${T.tm}`}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPayoutCurrentPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                    safePage === p
                      ? 'bg-blue-600 text-white shadow'
                      : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <PaginationBtn icon={ChevronRight}  onClick={() => setPayoutCurrentPage(p => Math.min(p + 1, totalPages))} disabled={safePage === totalPages} />
            <PaginationBtn icon={ChevronsRight} onClick={() => setPayoutCurrentPage(totalPages)}                        disabled={safePage === totalPages} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VcpPayoutHistory;