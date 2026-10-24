// NexchemTransactionRecords.jsx
import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList, Lock } from 'lucide-react';

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
  access,
}) => {
  const isDark  = theme === 'dark';
  const canView = !!access?.canView;
  const isPercentage = modalCustomer?.rebateType === 'Percentage';
  const rebateType   = modalCustomer?.rebateType;

  // ── Has quota? Drives Status + Qty Reb / Qty Bal columns ─────────────────
  const hasQuota =
    modalCustomer?.quotaType === 'With Quota' ||
    modalCustomer?.rebateQuotaType === 'With Quota' ||
    modalCustomer?.withQuota === true ||
    modalCustomer?.hasQuota === true ||
    modalCustomer?.details?.quotaType === 'With Quota' ||
    modalCustomer?.details?.rebateDetails?.quotaType === 'With Quota';

  // ── Helpers ──────────────────────────────────────────────────────────────
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

  const fmtNum = (n) => Math.round(parseFloat(n) || 0).toLocaleString('en-US');

  const fmtDecimal = (n) =>
    (parseFloat(n) || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtQty = (n) => {
    const num = Math.round((parseFloat(n) || 0) * 100) / 100;
    if (Number.isInteger(num)) return num.toLocaleString('en-US');
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const fmtDate = (s) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch { return s; }
  };

  const is25kg = (t) =>
    t.Is25kgItem || (t.Item && t.Item.toLowerCase().includes('25kg'));

  // ── Rebate / Percentage value ────────────────────────────────────────────
  const getRebatePerUnit = (t) => {
    const direct = parseFloat(t.RebatePerBag ?? t.RebatePerUnit);
    if (!isNaN(direct) && direct > 0) return direct;

    const items = modalCustomer?.items || modalCustomer?.rebateItems || [];
    if (Array.isArray(items) && items.length > 0) {
      const byCode = items.find((i) => i.code === t.ItemCode || i.itemCode === t.ItemCode);
      if (byCode) {
        const v = parseFloat(byCode.rebate ?? byCode.rebatePerBag ?? byCode.rebatePerUnit);
        if (!isNaN(v)) return v;
      }
      const byName = items.find((i) => (i.description || i.itemName || i.name) === t.Item);
      if (byName) {
        const v = parseFloat(byName.rebate ?? byName.rebatePerBag ?? byName.rebatePerUnit);
        if (!isNaN(v)) return v;
      }
    }
    return 0;
  };

  // For Percentage programs, prefer the row's Percentage field
  const getRateValue = (t) => {
    if (isPercentage) {
      return parseFloat(t.Percentage ?? t.percentagePerBag ?? t.RebatePerBag ?? 0) || 0;
    }
    return getRebatePerUnit(t);
  };

  const getRateLabel = (t) =>
    isPercentage ? `${getRateValue(t)}%` : `₱${fmtDecimal(getRateValue(t))}`;

  // ── Qty for rebate (ActualSales / UnitPerQty for 25kg items) ─────────────
  const getQtyForReb = (t) => {
    const actual = parseFloat(t.ActualSales) || 0;
    const unitPerQty = parseFloat(t.UnitPerQty) || 1;

    if (isPercentage) {
      return unitPerQty > 1 ? actual / unitPerQty : actual;
    }
    if (is25kg(t)) {
      const upq = unitPerQty || 2;
      return actual / upq;
    }
    return actual;
  };

  // Simple VAN-style Qty Reb (used for the Qty Reb column when hasQuota)
  const calculateQtyReb = (t) => {
    const actual     = parseFloat(t.ActualSales) || 0;
    const unitPerQty = parseFloat(t.UnitPerQty)  || 1;
    return unitPerQty > 1 ? actual / unitPerQty : actual;
  };

  // ── Row Amount ───────────────────────────────────────────────────────────
  const getAmount = (t) => {
    const rate        = getRateValue(t);
    const actualSales = parseFloat(t.ActualSales) || 0;
    const qtyForReb   = getQtyForReb(t);

    if (isPercentage) {
      const priceAfVAT =
        parseFloat(t.PriceAfVAT) ||
        (actualSales > 0 ? (parseFloat(t.Gtotal) || 0) / actualSales : 0);
      return qtyForReb * priceAfVAT * (rate / 100);
    }

    return qtyForReb * rate;
  };

  const getCalcNote = (t) => {
    const qty   = getQtyForReb(t);
    const rate  = getRateValue(t);
    const actual = parseFloat(t.ActualSales) || 0;

    if (isPercentage) {
      const priceAfVAT =
        parseFloat(t.PriceAfVAT) ||
        (actual > 0 ? (parseFloat(t.Gtotal) || 0) / actual : 0);
      const amount = qty * priceAfVAT * (rate / 100);
      return `${qty.toFixed(2)} qty × ₱${priceAfVAT.toFixed(2)} × ${rate}% = ₱${amount.toFixed(2)}`;
    }

    const amount = qty * rate;
    if (is25kg(t)) {
      const upq = parseFloat(t.UnitPerQty) || 2;
      return `${actual} ÷ ${upq} = ${qty.toFixed(2)} qty × ₱${rate.toFixed(2)} = ₱${amount.toFixed(2)}`;
    }
    return `${actual} qty × ₱${rate.toFixed(2)} = ₱${amount.toFixed(2)}`;
  };

  // ── Period-aware cycle helpers (ported from VAN) ─────────────────────────
  const getPeriodAnchorDay = (mc) => {
    const periodStart = mc?.details?.rebateDetails?.dateFrom;
    if (!periodStart) return 1;
    const d = new Date(periodStart);
    return isNaN(d.getTime()) ? 1 : d.getDate();
  };

  const getPeriodCycleKey = (dateStr, anchorDay) => {
    const d = new Date(dateStr);
    let year  = d.getFullYear();
    let month = d.getMonth();
    if (d.getDate() < anchorDay) {
      month -= 1;
      if (month < 0) { month = 11; year -= 1; }
    }
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  };

  const getPeriodCycleMonthName = (dateStr, anchorDay) => {
    const [year, month] = getPeriodCycleKey(dateStr, anchorDay).split('-').map(Number);
    return new Date(year, month - 1, anchorDay).toLocaleDateString('en-US', { month: 'long' });
  };

  const getPeriodCycleIndex = (dateStr, anchorDay, mc) => {
    const periodStart = mc?.details?.rebateDetails?.dateFrom;
    if (!periodStart) return new Date(dateStr).getMonth();
    const start = new Date(periodStart);
    const [y, m] = getPeriodCycleKey(dateStr, anchorDay).split('-').map(Number);
    return (y - start.getFullYear()) * 12 + (m - 1 - start.getMonth());
  };

  const calculateQtyBal = (transaction, allTransactions, currentIndex, mc) => {
    const anchorDay = getPeriodAnchorDay(mc);
    const cycleKey  = getPeriodCycleKey(transaction.Date, anchorDay);
    let cum = 0;
    for (let i = 0; i <= currentIndex; i++) {
      const t = allTransactions[i];
      if (getPeriodCycleKey(t.Date, anchorDay) === cycleKey) {
        const actual     = parseFloat(t.ActualSales) || 0;
        const unitPerQty = parseFloat(t.UnitPerQty)  || 1;
        cum += unitPerQty > 1 ? actual / unitPerQty : actual;
      }
    }
    return cum;
  };

  const getTargetQty = (transaction, mc) => {
    if (mc?.rebateType === 'Incremental') return null;
    if (mc?.details?.rebateDetails?.quotas) {
      try {
        const anchorDay = getPeriodAnchorDay(mc);
        const quotas = mc.details.rebateDetails.quotas;
        if (typeof quotas === 'object') {
          const cycleMonthName = getPeriodCycleMonthName(transaction.Date, anchorDay);
          if (quotas[cycleMonthName] !== undefined) return quotas[cycleMonthName];
          if (Array.isArray(quotas)) {
            const idx = getPeriodCycleIndex(transaction.Date, anchorDay, mc);
            if (idx >= 0 && idx < quotas.length) return quotas[idx];
          }
        }
      } catch {}
    }
    return transaction.TargetQty || transaction.MonthQuota || transaction.quota || 0;
  };

  const calculateProgress = (transaction, allTransactions, currentIndex, mc) => {
    const qtyBal = calculateQtyBal(transaction, allTransactions, currentIndex, mc);
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

  // ── Auto-load dates (re-syncs whenever the customer changes) ─────────
  useEffect(() => {
    if (!canView) return;
    if (customerModalTab !== 'transaction' || !modalCustomer) return;

    const from =
      modalCustomer.details?.rebateDetails?.dateFrom ||
      modalCustomer.dateFrom ||
      modalCustomer.details?.dateRange?.periodFrom;

    const to =
      modalCustomer.details?.rebateDetails?.dateTo ||
      modalCustomer.dateTo ||
      modalCustomer.details?.dateRange?.periodTo;

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

    loadDetailedTransactionsData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customerModalTab,
    modalCustomer?.code,
    modalCustomer?.rebateCode,
    canView,
  ]);

  if (customerModalTab !== 'transaction') return null;

  // ── Data ───────────────────────────────────────────────────────────────────
  const sorted     = sortByDate(filteredTransactions);
  const totalPages = Math.max(1, Math.ceil(sorted.length / transactionRowsPerPage));
  const safePage   = Math.min(transactionCurrentPage, totalPages);
  const paginated  = sorted.slice((safePage - 1) * transactionRowsPerPage, safePage * transactionRowsPerPage);

  const pageTotalAmount = paginated.reduce((sum, t) => sum + getAmount(t), 0);

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

  // ── Access denied ──────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <div className={`h-full flex flex-col ${T.bg}`}>
        <div className={`flex-shrink-0 px-5 py-3 border-b ${T.header}`}>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Transaction Records</h4>
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
              You don't have permission to view transaction records.
            </p>
          </div>
        </div>
      </div>
    );
  }

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

  // ── Status color map ──────────────────────────────────────────────────────
  const statusMap = {
    emerald: isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'       : 'bg-amber-50 text-amber-700 border-amber-200',
    rose:    isDark ? 'bg-rose-900/30 text-rose-300 border-rose-700/40'          : 'bg-rose-50 text-rose-700 border-rose-200',
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col min-h-0 ${T.bg}`}>

      {/* ── Section header (fixed) ──────────────────────────────────────── */}
      <div className={`flex-shrink-0 px-5 py-3 border-b flex items-center justify-between ${T.header}`}>
        <div>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Transaction Records</h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>
            {hasQuota
              ? `Quota-based transactions · ${modalCustomer?.customer || 'customer'}`
              : rebateType === 'Fixed'
              ? 'SAP transactions — fixed rebate program'
              : rebateType === 'Percentage'
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

      {/* ── Scrollable table area (flex-1, only this scrolls) ───────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        {paginated.length > 0 ? (
          <table className="w-full text-xs">
            <thead className={`sticky top-0 z-10 border-b ${T.thead}`}>
              <tr>
                <th className={`px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>Date</th>
                <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>Item</th>
                <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                  {hasQuota ? 'Act. Sales (Qty)' : (isPercentage ? 'Qty' : 'Act. Sales (Qty)')}
                </th>

                {/* Qty Reb / Qty Bal — only when hasQuota (mirrors VAN) */}
                {hasQuota && (
                  <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                    Qty Reb
                  </th>
                )}
                {hasQuota && (
                  <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                    Qty Bal
                  </th>
                )}

                {/* P. Value — only for Percentage programs (mirrors VCP) */}
                {isPercentage && (
                  <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                    Peso Value
                  </th>
                )}

                <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                  {isPercentage ? 'Percentage' : 'Rebate Per Unit'}
                </th>
                <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>Amount</th>

                {/* Status — only when hasQuota (mirrors VAN) */}
                {hasQuota && (
                  <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                    Status
                  </th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${T.divider}`}>
              {paginated.map((t, i) => {
                const itemName    = t.Item || t.ItemName || '—';
                const itemCode    = t.ItemCode || t.ItemCodeSAP || '—';
                const item25kg    = is25kg(t);
                const displayName = item25kg ? `${itemName} (25kg)` : itemName;
                const rateLabel   = getRateLabel(t);
                const amount      = getAmount(t);
                const calcNote    = getCalcNote(t);
                const priceAfVAT  = parseFloat(t.PriceAfVAT) ||
                  (parseFloat(t.ActualSales) > 0 ? (parseFloat(t.Gtotal) || 0) / parseFloat(t.ActualSales) : 0);

                // Quota-derived values (only meaningful when hasQuota)
                let qtyReb = 0, qtyBal = 0, targetQty = 0;
                let progress = 0;
                let qtyBalColor = 'amber';
                let statusLabel = '', statusColor = 'amber';

                if (hasQuota) {
                  const globalIdx = (safePage - 1) * transactionRowsPerPage + i;
                  qtyReb    = calculateQtyReb(t);
                  qtyBal    = calculateQtyBal(t, sorted, globalIdx, modalCustomer);
                  progress  = calculateProgress(t, sorted, globalIdx, modalCustomer);
                  targetQty = getTargetQty(t, modalCustomer);

                  qtyBalColor = (targetQty && qtyBal >= targetQty) ? 'emerald' : 'amber';

                  const isIncr = rebateType === 'Incremental';
                  if (isIncr) {
                    statusLabel = t.CurrentRange
                      ? `Range ${t.CurrentRange}`
                      : qtyBal > 0 ? 'Progressing' : 'Not in Range';
                    statusColor = t.CurrentRange ? 'emerald' : qtyBal > 0 ? 'amber' : 'rose';
                  } else {
                    statusLabel = progress >= 100 ? 'Eligible'
                                : progress >= 70  ? 'Progressing'
                                : 'Not Eligible';
                    statusColor = progress >= 100 ? 'emerald'
                                : progress >= 70  ? 'amber'
                                : 'rose';
                  }
                }

                return (
                  <tr key={i} className={`transition-colors duration-100 border-b ${T.row}`}>
                    <td className="px-5 py-2.5">
                      <span className={`font-medium tabular-nums ${T.tp}`}>{fmtDate(t.Date)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className={`font-medium truncate max-w-[220px] ${T.tp}`} title={displayName}>{displayName}</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${T.tm}`}>{itemCode}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded border font-semibold tabular-nums ${
                        isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40' : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {fmtNum(t.ActualSales)}
                      </span>
                    </td>

                    {/* Qty Reb / Qty Bal — quota only */}
                    {hasQuota && (
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded border font-semibold tabular-nums ${
                          isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40' : 'bg-violet-50 text-violet-700 border-violet-200'
                        }`}>
                          {fmtQty(qtyReb)}
                        </span>
                      </td>
                    )}
                    {hasQuota && (
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded border font-semibold tabular-nums ${
                          qtyBalColor === 'emerald'
                            ? (isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                            : (isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'       : 'bg-amber-50 text-amber-700 border-amber-200')
                        }`}>
                          {fmtQty(qtyBal)}
                        </span>
                      </td>
                    )}

                    {/* P. Value — only for Percentage (mirrors VCP) */}
                    {isPercentage && (
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded border font-semibold tabular-nums ${
                          isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          {fmtDecimal(priceAfVAT)}
                        </span>
                      </td>
                    )}

                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded border font-semibold tabular-nums ${
                        isDark ? 'bg-purple-900/30 text-purple-300 border-purple-700/40' : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {rateLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border font-semibold tabular-nums cursor-help ${
                          isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        title={calcNote}
                      >
                        ₱{fmtDecimal(amount)}
                      </span>
                    </td>

                    {/* Status — quota only */}
                    {hasQuota && (
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${statusMap[statusColor]}`}>
                          {statusLabel}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex items-center justify-center py-16">
            <div className="text-center">
              <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <ClipboardList size={22} className={T.tm} />
              </div>
              <h3 className={`text-sm font-bold mb-1 ${T.tp}`}>No Transactions Found</h3>
              <p className={`text-xs ${T.ts}`}>No transaction records match the current period.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Page Total — FIXED footer, always above pagination ──────────── */}
      {paginated.length > 0 && (
        <div className={`flex-shrink-0 flex items-center justify-end gap-2 px-5 py-2 border-t ${
          isDark ? 'border-slate-700/60 bg-slate-700/50' : 'border-slate-200 bg-slate-200'
        }`}>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${T.ts}`}>
            Total Amount :
          </span>
          <span className={`text-sm font-bold tabular-nums ${T.tp}`}>
            ₱{fmtDecimal(pageTotalAmount)}
          </span>
        </div>
      )}

      {/* ── Pagination — FIXED footer ───────────────────────────────────── */}
      {sorted.length > 0 && (
        <div className={`flex-shrink-0 flex flex-wrap gap-2 items-center justify-between px-5 py-2.5 border-t ${T.footer}`}>
          <div className="flex items-center gap-3">
            <p className={`text-[11px] ${T.ts}`}>
              Showing{' '}
              <span className={`font-semibold ${T.tp}`}>
                {(safePage - 1) * transactionRowsPerPage + 1}–{Math.min(safePage * transactionRowsPerPage, sorted.length)}
              </span>{' '}
              of <span className={`font-semibold ${T.tp}`}>{sorted.length}</span>
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