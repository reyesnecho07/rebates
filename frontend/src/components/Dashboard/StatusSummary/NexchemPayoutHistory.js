// src/components/Dashboard/PayoutHistory.js
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Wallet } from 'lucide-react';

const NexchemPayoutHistory = ({
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
  handlePayoutStatusChange, // kept for compatibility but not used
  loadDetailedPayoutsData,
  formatCurrency,
  handleSaveAmountReleased,
  beginningBalance = 0,
  beginningBalances = [],
  previousBalance = 0,
  beginningBalanceRecord = null,
}) => {
  const isDark = theme === 'dark';
  const [syncingSap, setSyncingSap]       = useState(false);
  const [sapSyncMessage, setSapSyncMessage] = useState(null);
  const [showSapDetails, setShowSapDetails] = useState({});

  if (customerModalTab !== 'payout') return null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

  const parseMonthYear = (str) => {
    if (!str) return 0;
    for (let i = 0; i < monthNames.length; i++) {
      if (str.includes(monthNames[i])) {
        const y = str.match(/\b(20\d{2})\b/);
        return (y ? parseInt(y[1]) : 0) * 100 + (i + 1);
      }
    }
    return 0;
  };

  const formatSapDate = (s) => {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return s; }
  };

  // ── SAP Sync ──────────────────────────────────────────────────────────────
  const handleSapSync = async () => {
    if (!modalCustomer?.CardCode) {
      setSapSyncMessage('❌ No customer selected');
      setTimeout(() => setSapSyncMessage(null), 3000);
      return;
    }
    setSyncingSap(true);
    setSapSyncMessage('Syncing with SAP Journal Entries…');
    try {
      const response = await fetch(
        `http://192.168.100.193:3009/api/nexchem/customer/${modalCustomer.CardCode}/sync-sap`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            db: 'NEXCHEM',
            rebateCode: modalCustomer?.rebateCode,
            periodFrom: modalCustomer?.dateRange?.periodFrom,
            periodTo:   modalCustomer?.dateRange?.periodTo,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const result = await response.json();
      if (result.success) {
        setSapSyncMessage(`✅ SAP sync complete — ${result.data.updatedCount} records updated`);
        if (loadDetailedPayoutsData) await loadDetailedPayoutsData();
      } else throw new Error(result.message || 'Sync failed');
    } catch (err) {
      setSapSyncMessage(`❌ SAP sync failed: ${err.message}`);
    } finally {
      setSyncingSap(false);
      setTimeout(() => setSapSyncMessage(null), 5000);
    }
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredPayouts.length / payoutRowsPerPage));
  const safePage   = Math.min(payoutCurrentPage, totalPages);

  const getPageNums = () => {
    const total = totalPages, cur = safePage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)         return [1, 2, 3, 4, 5, '...', total];
    if (cur >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', cur - 1, cur, cur + 1, '...', total];
  };

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const T = {
    bg:      isDark ? 'bg-slate-900'                     : 'bg-white',
    header:  isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200',
    thead:   isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200',
    divider: isDark ? 'divide-slate-700'  : 'divide-slate-100',
    footer:  isDark ? 'bg-slate-800 border-slate-700'    : 'bg-white border-slate-200',
    select:  isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-700',
    tp:      isDark ? 'text-slate-100'  : 'text-slate-800',
    ts:      isDark ? 'text-slate-400'  : 'text-slate-500',
    tm:      isDark ? 'text-slate-500'  : 'text-slate-400',
    row:     isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50',
  };

  const thCls = `px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest ${T.ts}`;

  const PaginationBtn = ({ icon: Icon, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
        disabled
          ? isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
          : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    ><Icon size={14} /></button>
  );

  // ── Badge helpers ──────────────────────────────────────────────────────────
  const badge = (value, color) => {
    const map = {
      overreleased: isDark
        ? 'bg-red-900/40 text-red-300 border-red-700/50'
        : 'bg-red-50 text-red-700 border-red-300',
      blue:    isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'       : 'bg-blue-50 text-blue-700 border-blue-200',
      violet:  isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40'  : 'bg-violet-50 text-violet-700 border-violet-200',
      emerald: isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber:   isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'     : 'bg-amber-50 text-amber-700 border-amber-200',
      red:     isDark ? 'bg-red-900/30 text-red-300 border-red-700/40'           : 'bg-red-50 text-red-700 border-red-200',
      slate:   isDark ? 'bg-slate-700 text-slate-400 border-slate-600'            : 'bg-slate-100 text-slate-500 border-slate-200',
      green:   isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return `inline-block px-2 py-0.5 rounded border font-semibold tabular-nums text-xs whitespace-nowrap ${map[color] || map.slate}`;
  };

  // Map status to color for badge
  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'green';
      case 'Partially Paid': return 'amber';
      case 'Pending': return 'blue';
      case 'No Payout': return 'slate';
      case 'Over-Released': return 'overreleased';
      default: return 'slate';
    }
  };

  const formatBalanceForDisplay = (value) => {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absValue);
    return isNegative ? `-₱${formattedNumber}` : `₱${formattedNumber}`;
  };

  const renderPayoutRow = (payout, index) => {
    if (payout.Date === 'Beginning Balance' || payout.isBeginningBalance) return null;

    const hasTransactions      = payout.BaseAmount > 0 || payout.dailySalesRebate > 0;
    const isEligible           = payout.TotalAmount > 0;
    const isNotEligible        = !isEligible;
    const isEditable           = payout.Status !== 'No Payout' && hasTransactions && isEligible;
    const isQtr                = payout.isQtrRebate;
    const hasPrevBal           = payout.PreviousBalance > 0;
    const hasSapData           = payout.SapReleasedAmount > 0;
    const calculatedBalance = (payout.TotalAmount || 0) - (payout.AmountReleased || 0);
    const isOverReleased = calculatedBalance < 0;

    // Row accent
    let rowAccent = '';
    if (isQtr)      rowAccent = isDark ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-blue-400';
    if (hasSapData) rowAccent = isDark ? 'border-l-2 border-l-violet-500' : 'border-l-2 border-l-violet-400';
    if (isOverReleased) rowAccent = isDark ? 'border-l-2 border-l-red-500' : 'border-l-2 border-l-red-400';

    const rowOpacity = (payout.Status === 'No Payout' || isNotEligible) ? 'opacity-70' : '';

    // Badge colors
    const baseColor  = hasTransactions ? 'blue' : 'slate';
    const totalColor = isNotEligible ? 'slate' : isQtr ? 'violet' : hasPrevBal ? 'amber' : payout.TotalAmount > 0 ? 'green' : 'slate';
    let balColor = 'slate';
    if (calculatedBalance < 0) {
      balColor = 'overreleased';
    } else if (calculatedBalance === 0) {
      balColor = 'green';
    } else if (calculatedBalance > 0 && isEditable) {
      balColor = 'red';
    }

    return (
      <tr key={payout.Id || index} className={`transition-colors duration-100 border-b ${T.row} ${isDark ? 'border-slate-700/50' : 'border-slate-100'} ${rowAccent} ${rowOpacity}`}>
        {/* Date */}
        <td className="px-5 py-2.5">
          <span className={`font-medium ${T.tp}`}>{payout.Date}</span>
          {isQtr && <div className={`text-[10px] mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Quarter Rebate</div>}
          {isNotEligible && <div className={`text-[10px] mt-0.5 ${T.tm}`}>{!hasTransactions ? 'No Transactions' : 'Not Eligible'}</div>}
          {hasPrevBal && <div className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>+ Prev: {formatCurrency(payout.PreviousBalance)}</div>}
        </td>

        {/* Period */}
        <td className="px-4 py-2.5">
          <div className={`font-medium text-xs ${isNotEligible ? `${T.ts} italic` : isQtr ? (isDark ? 'text-violet-300' : 'text-violet-700') : T.tp}`}>
            {payout.Period}
          </div>
          {payout.CalculationNote && !isNotEligible && (
            <div className={`text-[10px] mt-0.5 ${T.tm}`}>{payout.CalculationNote}</div>
          )}
          {isNotEligible && (
            <div className={`text-[10px] mt-0.5 ${T.tm}`}>
              {!hasTransactions ? 'No transactions this month' : 'Quota not met'}
            </div>
          )}
        </td>

        {/* Rebate Earned */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatCurrency(payout.BaseAmount || 0), baseColor)}>
            {formatCurrency(payout.BaseAmount || 0)}
          </span>
        </td>

        {/* Total Amount */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatCurrency(payout.TotalAmount), totalColor)}>
            {formatCurrency(payout.TotalAmount)}
          </span>
        </td>

        {/* Status - now center-aligned to match header */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(payout.Status || 'No Payout', getStatusColor(payout.Status))}>
            {payout.Status || 'No Payout'}
          </span>
        </td>

        {/* Amount Released */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(
            payout.AmountReleased
              ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(payout.AmountReleased)
              : '0.00',
            isNotEligible ? 'slate' : 'blue'
          )}>
            ₱{payout.AmountReleased
              ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(payout.AmountReleased)
              : '0.00'}
          </span>
        </td>

        {/* Balance */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatBalanceForDisplay(calculatedBalance), balColor)}>
            {formatBalanceForDisplay(calculatedBalance)}
          </span>
        </td>
      </tr>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col ${T.bg}`}>

      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 px-5 py-3 border-b flex items-center justify-between ${T.header}`}>
        <div>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Payout History</h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>Rebate payment records — balances carry over month to month</p>
        </div>
        {/* SAP Sync button and record count commented out as in original */}
      </div>

      {/* SAP sync message */}
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

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {(() => {
        const allPayouts = [...(paginatedPayouts || [])];
        const begBalRows = allPayouts.filter(p =>
          p.IsBeginningBalance === 1 ||
          p.isBeginningBalance === true ||
          (p.Period && p.Period.startsWith('Balance of '))
        );
        const regularRows = allPayouts
          .filter(p =>
            !p.IsBeginningBalance &&
            !p.isBeginningBalance &&
            p.Period &&
            !p.Period.startsWith('Balance of ')
          )
          .sort((a, b) => parseMonthYear(a.Period) - parseMonthYear(b.Period));
        const firstRegularNum = regularRows.length > 0
          ? Math.min(...regularRows.map(p => parseMonthYear(p.Period)))
          : 0;
        const applicableBegBal = begBalRows
          .filter(bb => {
            const num = parseMonthYear(bb.Period.replace('Balance of ', '').trim());
            return num > 0 && num <= firstRegularNum;
          })
          .sort((a, b) => {
            const an = parseMonthYear(a.Period.replace('Balance of ', '').trim());
            const bn = parseMonthYear(b.Period.replace('Balance of ', '').trim());
            return bn - an;
          })[0] || null;
        const crossRebateBal = !applicableBegBal && previousBalance > 0 && firstRegularNum > 0
          ? (() => {
              const recPeriod = beginningBalanceRecord?.Period || '';
              const sourceStr = recPeriod.startsWith('Balance of ')
                ? recPeriod.replace('Balance of ', '').trim() : recPeriod;
              const sourceNum = parseMonthYear(sourceStr);
              if (sourceNum !== 0 && sourceNum >= firstRegularNum) return null;
              return { Period: recPeriod || 'Previous Period', TotalAmount: previousBalance, isBeginningBalance: true, isCrossRebate: true };
            })()
          : null;
        const activeBegBal = applicableBegBal || crossRebateBal;

        const renderBegBalRow = () => {
          if (!activeBegBal) return null;
          const amount = parseFloat(activeBegBal.TotalAmount) || parseFloat(activeBegBal.Amount) || 0;
          const dateDisplay = (() => {
            if (!firstRegularNum) return '';
            const year = Math.floor(firstRegularNum / 100);
            const month = firstRegularNum % 100;
            return `${String(month).padStart(2, '0')}.01.${year}`;
          })();
          const fromLabel = (() => {
            const src = activeBegBal.Period || beginningBalanceRecord?.Period || '';
            const stripped = src.startsWith('Balance of ') ? src.replace('Balance of ', '').trim() : src;
            for (let i = 0; i < monthNames.length; i++) {
              if (stripped.includes(monthNames[i])) return stripped;
            }
            if (!firstRegularNum) return null;
            const year  = Math.floor(firstRegularNum / 100);
            const month = firstRegularNum % 100;
            const pi = month === 1 ? 11 : month - 2;
            const py = month === 1 ? year - 1 : year;
            return `${monthNames[pi]} ${py}`;
          })();
          return (
            <tr key="beg-balance-row" className={`border-b ${isDark ? 'border-slate-700/50 bg-emerald-900/10 border-l-2 border-l-emerald-500' : 'border-slate-100 bg-emerald-50/60 border-l-2 border-l-emerald-400'}`}>
              <td className="px-5 py-2.5">
                <span className={`font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{dateDisplay}</span>
              </td>
              <td className="px-4 py-2.5">
                <div className={`font-medium text-xs ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>Beginning Balance</div>
              </td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5 text-center">
                <span className={`inline-block px-2 py-0.5 rounded border font-bold tabular-nums text-xs ${
                  isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {formatCurrency(amount)}
                </span>
              </td>
            </tr>
          );
        };

        if (regularRows.length === 0 && !activeBegBal) {
          return (
            <div className="flex-1 overflow-auto">
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
            </div>
          );
        }

        return (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className={`sticky top-0 border-b ${T.thead}`}>
                <tr>
                  <th className={`${thCls} text-left w-[12%]`}>Date</th>
                  <th className={`${thCls} text-left w-[20%]`}>Period</th>
                  <th className={`${thCls} text-center w-[12%]`}>Rebate Earned</th>
                  <th className={`${thCls} text-center w-[12%]`}>Total Amount</th>
                  <th className={`${thCls} text-center w-[10%]`}>Status</th>
                  <th className={`${thCls} text-center w-[14%]`}>Amount Released</th>
                  <th className={`${thCls} text-center w-[14%]`}>Balance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${T.divider}`}>
                {renderBegBalRow()}
                {regularRows.map((payout, i) => renderPayoutRow(payout, i))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Pagination footer ────────────────────────────────────────────── */}
      {filteredPayouts.length > 0 && (
        <div className={`flex-shrink-0 flex flex-wrap gap-2 items-center justify-between px-5 py-2.5 border-t ${T.footer}`}>
          <div className="flex items-center gap-3">
            <p className={`text-[11px] ${T.ts}`}>
              Showing{' '}
              <span className={`font-semibold ${T.tp}`}>
                {(safePage - 1) * payoutRowsPerPage + 1}–{Math.min(safePage * payoutRowsPerPage, filteredPayouts.length)}
              </span>{' '}
              of{' '}
              <span className={`font-semibold ${T.tp}`}>{filteredPayouts.length}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${T.ts}`}>Per page</span>
              <select
                value={payoutRowsPerPage}
                onChange={(e) => { setPayoutRowsPerPage(Number(e.target.value)); setPayoutCurrentPage(1); }}
                className={`text-xs border rounded-md px-1.5 py-0.5 outline-none ${T.select}`}
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <PaginationBtn icon={ChevronsLeft}  onClick={() => setPayoutCurrentPage(1)}                              disabled={safePage === 1} />
            <PaginationBtn icon={ChevronLeft}   onClick={() => setPayoutCurrentPage(p => Math.max(p - 1, 1))}       disabled={safePage === 1} />
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
            <PaginationBtn icon={ChevronsRight} onClick={() => setPayoutCurrentPage(totalPages)}                         disabled={safePage === totalPages} />
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(NexchemPayoutHistory);