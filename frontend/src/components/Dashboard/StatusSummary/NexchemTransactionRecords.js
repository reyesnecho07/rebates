// NexchemTransactionRecords.jsx
import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList } from 'lucide-react';

const NexchemTransactionRecords = ({
  theme = 'light',
  customerModalTab,
  modalCustomer,
  filteredTransactions,
  transactionCurrentPage,
  setTransactionCurrentPage,
  transactionRowsPerPage,
  setTransactionRowsPerPage,
  isLoading = false,
  periodFrom,
  periodTo,
  setPeriodFrom,
  setPeriodTo,
  loadDetailedTransactionsData,
  isAutoLoading = false,
}) => {
  const isDark = theme === 'dark';

  // ── Helpers ───────────────────────────────────────────────────────────────
  const sortByDate = (arr) => {
    if (!Array.isArray(arr)) return [];
    return [...arr].sort((a, b) => {
      const da = new Date(a.Date || a.transactionDate || a.date);
      const db = new Date(b.Date || b.transactionDate || b.date);
      if (isNaN(da)) return 1;
      if (isNaN(db)) return -1;
      return da - db;
    });
  };

  const fmtNum = (n) =>
    (parseFloat(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const fmtDate = (s) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch { return s; }
  };

  const is25kg = (t) =>
    t.Is25kgItem || (t.Item && t.Item.toLowerCase().includes('25kg'));

  // ── Calculation helpers (unchanged logic) ────────────────────────────────
  const calculateQtyBal = (transaction, allTransactions, currentIndex) => {
    const actualSales = parseFloat(transaction.ActualSales) || 0;
    const transactionDate = new Date(transaction.Date);
    const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
    let monthlyCumulative = 0;
    for (let i = 0; i <= currentIndex; i++) {
      const trans = allTransactions[i];
      const transDate = new Date(trans.Date);
      const transMonthKey = `${transDate.getFullYear()}-${String(transDate.getMonth() + 1).padStart(2, '0')}`;
      if (transMonthKey === monthKey) {
        const transActual = parseFloat(trans.ActualSales) || 0;
        monthlyCumulative += is25kg(trans) ? transActual / 2 : transActual;
      }
    }
    return monthlyCumulative;
  };

  const getTargetQty = (transaction, mc) => {
    if (mc?.rebateType === 'Incremental') return null;
    if (mc?.details?.rebateDetails?.quotas) {
      try {
        const date = new Date(transaction.Date);
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        const quotas = mc.details.rebateDetails.quotas;
        if (typeof quotas === 'object') {
          if (quotas[monthName] !== undefined) return quotas[monthName];
          if (Array.isArray(quotas) && date.getMonth() < quotas.length) return quotas[date.getMonth()];
        }
      } catch {}
    }
    return transaction.TargetQty || transaction.MonthQuota || transaction.quota || 0;
  };

  const calculateQtyReb = (transaction) => {
    const actual = parseFloat(transaction.ActualSales) || 0;
    return is25kg(transaction) ? actual / 2 : actual;
  };

  // ── Auto-load dates ──────────────────────────────────────────────────────
  useEffect(() => {
    if (customerModalTab === 'transaction' && modalCustomer && !periodFrom) {
      loadDetailedTransactionsData(true);
      const from = modalCustomer.details?.rebateDetails?.dateFrom || modalCustomer.dateFrom || modalCustomer.details?.dateRange?.periodFrom;
      const to   = modalCustomer.details?.rebateDetails?.dateTo   || modalCustomer.dateTo   || modalCustomer.details?.dateRange?.periodTo;
      if (from && to) {
        setPeriodFrom(from);
        setPeriodTo(to);
      } else {
        const today  = new Date();
        const qStart = Math.floor(today.getMonth() / 3) * 3;
        const qEnd   = qStart + 2;
        setPeriodFrom(new Date(today.getFullYear(), qStart, 1).toISOString().split('T')[0]);
        setPeriodTo(new Date(today.getFullYear(), qEnd + 1, 0).toISOString().split('T')[0]);
      }
    }
  }, [customerModalTab, modalCustomer]);

  if (customerModalTab !== 'transaction') return null;

  // ── Data ───────────────────────────────────────────────────────────────────
  const sorted     = sortByDate(filteredTransactions);
  const totalPages = Math.max(1, Math.ceil(sorted.length / transactionRowsPerPage));
  const safePage   = Math.min(transactionCurrentPage, totalPages);
  const paginated  = sorted.slice((safePage - 1) * transactionRowsPerPage, safePage * transactionRowsPerPage);

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col ${T.bg}`}>

      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 px-5 py-3 border-b flex items-center justify-between ${T.header}`}>
        <div>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Transaction Records</h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>
            {modalCustomer?.rebateType === 'Fixed'
              ? 'SAP transactions — fixed rebate program'
              : modalCustomer?.rebateType === 'Percentage'
              ? 'SAP transactions — percentage rebate program'
              : 'SAP transactions — incremental rebate program'}
          </p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
          isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}>
          {sorted.length} record{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {paginated.length > 0 ? (
          <table className="w-full text-xs">
            <thead className={`sticky top-0 border-b ${T.thead}`}>
              <tr>
                <th className={`px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                  Date
                </th>
                <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                  Item
                </th>
                <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                  Act. Sales
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${T.divider}`}>
              {paginated.map((t, i) => {
                const itemName    = t.Item || t.ItemName || '—';
                const itemCode    = t.ItemCode || t.ItemCodeSAP || '—';
                const item25kg    = is25kg(t);
                const displayName = item25kg ? `${itemName} (25kg)` : itemName;

                return (
                  <tr key={i} className={`transition-colors duration-100 border-b ${T.row}`}>

                    {/* Date */}
                    <td className="px-5 py-2.5">
                      <span className={`font-medium tabular-nums ${T.tp}`}>
                        {fmtDate(t.Date)}
                      </span>
                    </td>

                    {/* Item */}
                    <td className="px-4 py-2.5">
                      <div className={`font-medium truncate max-w-[220px] ${T.tp}`} title={displayName}>
                        {displayName}
                      </div>
                      <div className={`text-[10px] font-mono mt-0.5 ${T.tm}`}>
                        {itemCode}
                      </div>
                    </td>

                    {/* Actual Sales */}
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded border font-semibold tabular-nums ${
                        isDark
                          ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {fmtNum(t.ActualSales)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
      {sorted.length > 0 && (
        <div className={`flex-shrink-0 flex flex-wrap gap-2 items-center justify-between px-5 py-2.5 border-t ${T.footer}`}>
          <div className="flex items-center gap-3">
            <p className={`text-[11px] ${T.ts}`}>
              Showing{' '}
              <span className={`font-semibold ${T.tp}`}>
                {(safePage - 1) * transactionRowsPerPage + 1}–{Math.min(safePage * transactionRowsPerPage, sorted.length)}
              </span>{' '}
              of{' '}
              <span className={`font-semibold ${T.tp}`}>{sorted.length}</span>
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

export default React.memo(NexchemTransactionRecords);