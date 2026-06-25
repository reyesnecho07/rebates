// src/components/Dashboard/StatusSummary/VanTransactionRecords.js
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList } from 'lucide-react';

const VanTransactionRecords = ({
  theme = 'light',
  modalCustomer,
  filteredTransactions,
  transactionCurrentPage,
  setTransactionCurrentPage,
  transactionRowsPerPage,
  setTransactionRowsPerPage,
  isLoading = false,
}) => {
  const isDark    = theme === 'dark';
  const isMonthly = modalCustomer?.frequency === 'Monthly';

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtNum = (n) =>
    (parseFloat(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const fmtDate = (s) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }); }
    catch { return s; }
  };

  const is25kg = (t) =>
    t.Is25kgItem || (t.Item && t.Item.toLowerCase().includes('25kg'));

  const calculateQtyReb = (t) => {
    const actual = parseFloat(t.ActualSales) || 0;
    return is25kg(t) ? actual / 2 : actual;
  };

  const calculateQtyBal = (transaction, allTransactions, currentIndex) => {
    const date     = new Date(transaction.Date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let cum = 0;
    for (let i = 0; i <= currentIndex; i++) {
      const t    = allTransactions[i];
      const tDate = new Date(t.Date);
      const tKey  = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
      if (tKey === monthKey) {
        const actual = parseFloat(t.ActualSales) || 0;
        cum += is25kg(t) ? actual / 2 : actual;
      }
    }
    return cum;
  };

  const getTargetQty = (transaction, mc) => {
    if (mc?.rebateType === 'Incremental') return null;
    if (mc?.details?.rebateDetails?.quotas) {
      try {
        const date      = new Date(transaction.Date);
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        const quotas    = mc.details.rebateDetails.quotas;
        if (typeof quotas === 'object') {
          if (quotas[monthName] !== undefined) return quotas[monthName];
          if (Array.isArray(quotas) && date.getMonth() < quotas.length) return quotas[date.getMonth()];
        }
      } catch {}
    }
    return transaction.TargetQty || transaction.MonthQuota || transaction.quota || 0;
  };

  const calculateProgress = (transaction, allTransactions, currentIndex, mc) => {
    const qtyBal = calculateQtyBal(transaction, allTransactions, currentIndex);
    if (mc?.rebateType === 'Incremental') {
      const currentRange = transaction.CurrentRange;
      const ranges = mc?.details?.rebateDetails?.ranges || [];
      if (currentRange && ranges.length > 0) {
        const range = ranges.find(r => r.rangeNo === currentRange);
        if (range) {
          const mn = parseFloat(range.minQty) || 0;
          const mx = parseFloat(range.maxQty) || 0;
          if (mx > mn) return Math.min(((qtyBal - mn) / (mx - mn)) * 100, 100);
          if (!mx)     return qtyBal >= mn ? 100 : Math.min((qtyBal / mn) * 100, 100);
        }
      }
      if (ranges.length > 0) {
        const firstMin = parseFloat(ranges[0].minQty) || 0;
        return Math.min((qtyBal / firstMin) * 100, 100);
      }
      return 0;
    }
    const target = getTargetQty(transaction, mc) || 0;
    return target <= 0 ? 0 : Math.min(100, (qtyBal / target) * 100);
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / transactionRowsPerPage));
  const safePage   = Math.min(transactionCurrentPage, totalPages);
  const paginated  = filteredTransactions.slice(
    (safePage - 1) * transactionRowsPerPage,
    safePage * transactionRowsPerPage
  );

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
    row:     isDark ? 'hover:bg-slate-800/60 border-slate-700/50' : 'hover:bg-slate-50 border-slate-100',
    divider: isDark ? 'divide-slate-700'  : 'divide-slate-100',
    footer:  isDark ? 'bg-slate-800 border-slate-700'    : 'bg-white border-slate-200',
    select:  isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-700',
    tp:      isDark ? 'text-slate-100'  : 'text-slate-800',
    ts:      isDark ? 'text-slate-400'  : 'text-slate-500',
    tm:      isDark ? 'text-slate-500'  : 'text-slate-400',
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

  // ── Shared cell renderers ─────────────────────────────────────────────────
  const DateCell = ({ t }) => (
    <td className="px-5 py-2.5">
      <span className={`font-medium tabular-nums ${T.tp}`}>{fmtDate(t.Date)}</span>
    </td>
  );

  const ItemCell = ({ name, code }) => (
    <td className="px-4 py-2.5">
      <div className={`font-medium truncate max-w-[500px] ${T.tp}`} title={name}>{name}</div>
      <div className={`text-[10px] font-mono mt-0.5 ${T.tm}`}>{code}</div>
    </td>
  );

  const BadgeCell = ({ value, color = 'blue', center = true }) => {
    const colorMap = {
      blue:   isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'     : 'bg-blue-50 text-blue-700 border-blue-200',
      violet: isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40' : 'bg-violet-50 text-violet-700 border-violet-200',
      emerald:isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber:  isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'   : 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
      <td className={`px-4 py-2.5 ${center ? 'text-center' : ''}`}>
        <span className={`inline-block px-2 py-0.5 rounded border font-semibold tabular-nums text-xs ${colorMap[color]}`}>
          {value}
        </span>
      </td>
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={`h-full flex flex-col ${T.bg}`}>
        <div className={`flex-shrink-0 px-5 py-3 border-b ${T.header}`}>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Transaction Records</h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>Loading transaction data from SAP…</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className={`w-8 h-8 rounded-full border-4 border-t-transparent animate-spin ${isDark ? 'border-blue-400' : 'border-blue-500'}`} />
            <p className={`text-xs ${T.ts}`}>Fetching from SAP database…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Monthly table (Date / Item / Act. Sales) ───────────────────────────────
  const MonthlyTable = () => (
    <table className="w-full text-xs">
      <thead className={`sticky top-0 border-b ${T.thead}`}>
        <tr>
          <th className={`${thCls} text-left`}>Date</th>
          <th className={`${thCls} text-left`}>Item</th>
          <th className={`${thCls} text-center`}>Actual Sales</th>
        </tr>
      </thead>
      <tbody className={`divide-y ${T.divider}`}>
        {paginated.map((t, i) => {
          const name = t.Item || t.ItemName || '—';
          const code = t.ItemCode || t.ItemCodeSAP || '—';
          return (
            <tr key={i} className={`transition-colors duration-100 border-b ${T.row}`}>
              <DateCell t={t} />
              <ItemCell name={name} code={code} />
              <BadgeCell value={fmtNum(t.ActualSales)} color="blue" />
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  // ── Quarterly table (Date / Item / Act. Sales / Qty Reb / Qty Bal / Progress / Status) ──
  const QuarterlyTable = () => (
    <table className="w-full text-xs">
      <thead className={`sticky top-0 border-b ${T.thead}`}>
        <tr>
          <th className={`${thCls} text-left`}>Date</th>
          <th className={`${thCls} text-left`}>Item</th>
          <th className={`${thCls} text-center`}>Act. Sales</th>
          <th className={`${thCls} text-center`}>Qty Reb</th>
          <th className={`${thCls} text-center`}>Qty Bal</th>
          {/*<th className={`${thCls} text-center`}>Progress</th>*/}
          <th className={`${thCls} text-center`}>Status</th>
        </tr>
      </thead>
      <tbody className={`divide-y ${T.divider}`}>
        {paginated.map((t, i) => {
          const globalIdx  = (safePage - 1) * transactionRowsPerPage + i;
          const name       = t.Item || t.ItemName || '—';
          const code       = t.ItemCode || t.ItemCodeSAP || '—';
          const item25     = is25kg(t);
          const displayName = item25 ? `${name} (25kg)` : name;
          const qtyReb     = calculateQtyReb(t);
          const qtyBal     = calculateQtyBal(t, filteredTransactions, globalIdx);
          const progress   = calculateProgress(t, filteredTransactions, globalIdx, modalCustomer);
          const targetQty  = getTargetQty(t, modalCustomer);
          const isIncr     = modalCustomer?.rebateType === 'Incremental';

          // Progress bar color
          const barColor = progress >= 100 ? 'bg-emerald-500'
            : progress >= 75 ? 'bg-blue-500'
            : progress >= 50 ? 'bg-amber-500'
            : 'bg-red-500';

          // Qty Bal badge color
          const qtyBalColor = (targetQty && qtyBal >= targetQty) ? 'emerald' : 'amber';

          // Status badge
          let statusLabel, statusColor;
          if (isIncr) {
            statusLabel = t.CurrentRange ? `Range ${t.CurrentRange}` : qtyBal > 0 ? 'Progressing' : 'Not in Range';
            statusColor = t.CurrentRange ? 'emerald' : qtyBal > 0 ? 'amber' : 'red';
          } else {
            statusLabel = progress >= 100 ? 'Eligible' : progress >= 70 ? 'Progressing' : 'Not Eligible';
            statusColor = progress >= 100 ? 'emerald' : progress >= 70 ? 'amber' : 'red';
          }

          const statusMap = {
            emerald: isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
            amber:   isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'       : 'bg-amber-50 text-amber-700 border-amber-200',
            red:     isDark ? 'bg-red-900/30 text-red-300 border-red-700/40'             : 'bg-red-50 text-red-700 border-red-200',
          };

          return (
            <tr key={i} className={`transition-colors duration-100 border-b ${T.row}`}>
              <DateCell t={t} />
              <ItemCell name={displayName} code={code} />
              <BadgeCell value={fmtNum(t.ActualSales)} color="blue" />
              <BadgeCell value={fmtNum(qtyReb)} color="violet" />
              <BadgeCell value={fmtNum(qtyBal)} color={qtyBalColor} />

              {/* Progress */}
              {/*<td className="px-4 py-2.5 text-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-20 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium tabular-nums ${
                    isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isIncr ? (
                      t.CurrentRange
                        ? <span className={
                            t.CurrentRange === 1 ? (isDark ? 'text-blue-400' : 'text-blue-600')
                            : t.CurrentRange === 2 ? (isDark ? 'text-amber-400' : 'text-amber-600')
                            : (isDark ? 'text-emerald-400' : 'text-emerald-600')
                          }>R{t.CurrentRange}</span>
                        : <span className={T.tm}>—</span>
                    ) : (
                      <>{fmtNum(qtyBal)} / {fmtNum(targetQty)}</>
                    )}
                  </span>
                </div>
              </td>*/}

              {/* Status */}
              <td className="px-4 py-2.5 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${statusMap[statusColor]}`}>
                  {statusLabel}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col ${T.bg}`}>

      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 px-5 py-3 border-b flex items-center justify-between ${T.header}`}>
        <div>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Transaction Records</h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>
            {isMonthly
              ? `Monthly transactions · ${modalCustomer?.customer || 'customer'}`
              : `${modalCustomer?.rebateType || 'Rebate'} transactions · ${modalCustomer?.frequency || 'Quarterly'}`}
          </p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
          isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}>
          {filteredTransactions.length} record{filteredTransactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {paginated.length > 0 ? (
          isMonthly ? <MonthlyTable /> : <QuarterlyTable />
        ) : (
          <div className="h-full flex items-center justify-center py-16">
            <div className="text-center">
              <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${
                isDark ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
                <ClipboardList size={22} className={T.tm} />
              </div>
              <h3 className={`text-sm font-bold mb-1 ${T.tp}`}>No Transactions Found</h3>
              <p className={`text-xs ${T.ts}`}>No transaction records match the current period.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Pagination footer ────────────────────────────────────────────── */}
      {filteredTransactions.length > 0 && (
        <div className={`flex-shrink-0 flex flex-wrap gap-2 items-center justify-between px-5 py-2.5 border-t ${T.footer}`}>
          <div className="flex items-center gap-3">
            <p className={`text-[11px] ${T.ts}`}>
              Showing{' '}
              <span className={`font-semibold ${T.tp}`}>
                {(safePage - 1) * transactionRowsPerPage + 1}–{Math.min(safePage * transactionRowsPerPage, filteredTransactions.length)}
              </span>{' '}
              of{' '}
              <span className={`font-semibold ${T.tp}`}>{filteredTransactions.length}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${T.ts}`}>Per page</span>
              <select
                value={transactionRowsPerPage}
                onChange={(e) => { setTransactionRowsPerPage(Number(e.target.value)); setTransactionCurrentPage(1); }}
                className={`text-xs border rounded-md px-1.5 py-0.5 outline-none ${T.select}`}
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <PaginationBtn icon={ChevronsLeft}  onClick={() => setTransactionCurrentPage(1)}                              disabled={safePage === 1} />
            <PaginationBtn icon={ChevronLeft}   onClick={() => setTransactionCurrentPage(p => Math.max(p - 1, 1))}       disabled={safePage === 1} />
            {getPageNums().map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className={`w-7 text-center text-xs ${T.tm}`}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setTransactionCurrentPage(p)}
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
            <PaginationBtn icon={ChevronRight}  onClick={() => setTransactionCurrentPage(p => Math.min(p + 1, totalPages))} disabled={safePage === totalPages} />
            <PaginationBtn icon={ChevronsRight} onClick={() => setTransactionCurrentPage(totalPages)}                         disabled={safePage === totalPages} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VanTransactionRecords;