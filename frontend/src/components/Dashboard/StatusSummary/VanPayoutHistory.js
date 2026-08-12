// VanPayoutHistory.jsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Wallet } from 'lucide-react';

const VanPayoutHistory = ({
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
  setFilteredPayouts,
  setPaginatedPayouts,
}) => {
  const isDark = theme === 'dark';
  const [isProcessingData, setIsProcessingData]   = useState(false);
  const [beginningBalances, setBeginningBalances]   = useState([]);
  const [syncingSap, setSyncingSap]                 = useState(false);
  const [sapSyncMessage, setSapSyncMessage]         = useState(null);
  const [showSapDetails, setShowSapDetails]         = useState({});
  const [lastSapSync, setLastSapSync]               = useState(null);

  const [localFilteredPayouts, setLocalFilteredPayouts] = useState([]);
  const [localPaginatedPayouts, setLocalPaginatedPayouts] = useState([]);

  const customerCardCode = modalCustomer?.CardCode || modalCustomer?.cardCode || modalCustomer?.CustomerCode;
  const rebateType       = modalCustomer?.rebateType || modalCustomer?.RebateType;
  const rebateCode       = modalCustomer?.rebateCode || modalCustomer?.RebateCode;

  // ── Quarter / month helpers ───────────────────────────────────────────────
  const getQuarterFromPeriod = useCallback((period) => {
    if (!period) return 0;
    if (period.includes('Q1') || /January|February|March/.test(period))    return 1;
    if (period.includes('Q2') || /April|May|June/.test(period))            return 2;
    if (period.includes('Q3') || /July|August|September/.test(period))     return 3;
    if (period.includes('Q4') || /October|November|December/.test(period)) return 4;
    return 0;
  }, []);

  const getYearFromPeriod = useCallback((period) => {
    if (!period) return new Date().getFullYear();
    const m = period.match(/\b(20\d{2})\b/);
    return m ? parseInt(m[1]) : new Date().getFullYear();
  }, []);

  const getMonthOrder = useCallback((period) => {
    if (!period) return 99;
    const map = { January:1, February:2, March:3, April:4, May:5, June:6,
                  July:7, August:8, September:9, October:10, November:11, December:12 };
    for (const [name, order] of Object.entries(map)) {
      if (period.includes(name)) return order;
    }
    return 99;
  }, []);

  const formatSapDate = (s) => {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); }
    catch { return s; }
  };

  // ── SAP sync ──────────────────────────────────────────────────────────────
  const autoSyncSapData = useCallback(async () => {
    if (!customerCardCode) return;
    if (lastSapSync && (Date.now() - lastSapSync) < 5000) return;
    try {
      const response = await fetch(
        `http://192.168.100.193:3006/api/van/customer/${customerCardCode}/sync-sap`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            db: 'VAN',
            rebateCode,
            periodFrom: modalCustomer?.dateRange?.periodFrom,
            periodTo:   modalCustomer?.dateRange?.periodTo,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const result = await response.json();
      if (result.success) {
        setLastSapSync(Date.now());
        if (result.data?.updatedCount > 0) await loadPayoutsWithBalances();
      }
    } catch (err) {
      console.error('Auto SAP sync error:', err);
    }
  }, [customerCardCode, rebateCode, modalCustomer?.dateRange, lastSapSync]);

  const syncNewPayouts = useCallback(async () => {
    if (!customerCardCode) return;
    setSyncingSap(true);
    setSapSyncMessage('Syncing with SAP…');
    try {
      await autoSyncSapData();
      setSapSyncMessage('✅ SAP sync complete');
      setTimeout(() => setSapSyncMessage(null), 3000);
    } catch (err) {
      setSapSyncMessage(`❌ SAP sync failed: ${err.message}`);
      setTimeout(() => setSapSyncMessage(null), 5000);
    } finally {
      setSyncingSap(false);
    }
  }, [customerCardCode, autoSyncSapData]);

  useEffect(() => {
    if (customerModalTab === 'payout' && customerCardCode) {
      const t = setTimeout(() => autoSyncSapData(), 1000);
      return () => clearTimeout(t);
    }
  }, [customerModalTab, customerCardCode, autoSyncSapData]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const organizePayoutsByQuarter = useCallback((payouts) => {
    if (!payouts?.length) return [];
    const quarters = {};

    payouts.forEach(payout => {
      const isBeg = payout.isBeginningBalance || (payout.Period && /Balance\s+of\s+Q\d/i.test(payout.Period));
      const isQtr = payout.isQtrRebate || (payout.Period && payout.Period.includes('Quarter') && payout.Period.includes('Rebate') && payout.Period.includes('-'));

      let quarter, year;
      if (isBeg) {
        const m = payout.Period.match(/Balance\s+of\s+Q(\d+)\s+(\d{4})/i);
        quarter = m ? parseInt(m[1]) : getQuarterFromPeriod(payout.Period);
        year    = m ? parseInt(m[2]) : getYearFromPeriod(payout.Period);
      } else {
        if (payout.PayoutQuarter) {
          const m = payout.PayoutQuarter.match(/Q(\d+)\s+(\d{4})/);
          if (m) { quarter = parseInt(m[1]); year = parseInt(m[2]); }
        }
        if (!quarter || !year) {
          if (isQtr) {
            const qm = payout.Period.match(/Quarter (\d+)/i);
            const ym = payout.Period.match(/\b(20\d{2})\b/);
            quarter = qm ? parseInt(qm[1]) : getQuarterFromPeriod(payout.Period);
            year    = ym ? parseInt(ym[1]) : getYearFromPeriod(payout.Period);
          } else {
            quarter = getQuarterFromPeriod(payout.Period);
            year    = getYearFromPeriod(payout.Period);
          }
        }
      }

      const key = `Q${quarter}-${year}`;
      if (!quarters[key]) quarters[key] = { year, quarter, beginningBalances: [], regularPayouts: [], quarterRebates: [] };

      if (isBeg)  quarters[key].beginningBalances.push({ ...payout, isBeginningBalance: true });
      else if (isQtr) quarters[key].quarterRebates.push({ ...payout, isQtrRebate: true });
      else        quarters[key].regularPayouts.push(payout);
    });

    const result = [];
    Object.values(quarters)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter)
      .forEach(qd => {
        qd.beginningBalances.forEach(b => result.push(b));
        [...qd.regularPayouts].sort((a, b) => getMonthOrder(a.Period) - getMonthOrder(b.Period) || new Date(a.Date) - new Date(b.Date)).forEach(p => result.push(p));
        [...qd.quarterRebates].sort((a, b) => new Date(a.Date) - new Date(b.Date)).forEach(r => result.push({ ...r, isLastInQuarter: true }));
      });

    return result;
  }, [getQuarterFromPeriod, getYearFromPeriod, getMonthOrder]);

  const loadPayoutsWithBalances = useCallback(async () => {
    if (!customerCardCode || !rebateType) return;
    try {
      let url = `http://192.168.100.193:3006/api/van/payouts/customer/${customerCardCode}/payouts?db=VAN&rebateType=${rebateType}`;
      if (rebateCode) url += `&rebateCode=${rebateCode}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const result = await response.json();
      if (result.success) {
        const processed = organizePayoutsByQuarter(result.data?.payouts || []);
        setBeginningBalances(result.data?.beginningBalances || []);
        setFilteredPayouts(processed);
        const start = (payoutCurrentPage - 1) * payoutRowsPerPage;
        setPaginatedPayouts(processed.slice(start, start + payoutRowsPerPage));
      }
    } catch (err) {
      console.error('Error loading payouts:', err);
      setFilteredPayouts([]);
      setPaginatedPayouts([]);
      setBeginningBalances([]);
    }
  }, [customerCardCode, rebateCode, rebateType, payoutCurrentPage, payoutRowsPerPage, setFilteredPayouts, setPaginatedPayouts, organizePayoutsByQuarter]);

  useEffect(() => {
    if (customerModalTab === 'payout' && customerCardCode && rebateType) {
      loadPayoutsWithBalances();
    }
  }, [customerModalTab, customerCardCode, rebateType, loadPayoutsWithBalances]);

  // ── Sorted paginated data ─────────────────────────────────────────────────
  const sortedPaginated = useMemo(() => {
    if (!paginatedPayouts?.length) return [];
    const quarters = {};

    paginatedPayouts.forEach(payout => {
      const isQtr = payout.isQtrRebate || (payout.Period && payout.Period.includes('Quarter') && payout.Period.includes('Rebate') && payout.Period.includes('-'));
      const isBeg = payout.isBeginningBalance || /Balance\s+of\s+Q\d/i.test(payout.Period);

      let quarter, year;
      if (isBeg) {
        const m = payout.Period.match(/Balance\s+of\s+Q(\d+)\s+(\d{4})/i);
        quarter = m ? parseInt(m[1]) : getQuarterFromPeriod(payout.Period);
        year    = m ? parseInt(m[2]) : getYearFromPeriod(payout.Period);
      } else {
        if (payout.PayoutQuarter) {
          const m = payout.PayoutQuarter.match(/Q(\d+)\s+(\d{4})/);
          if (m) { quarter = parseInt(m[1]); year = parseInt(m[2]); }
        }
        if (!quarter || !year) {
          if (isQtr) {
            const qm = payout.Period.match(/Quarter (\d+)/i);
            const ym = payout.Period.match(/\b(20\d{2})\b/);
            quarter = qm ? parseInt(qm[1]) : getQuarterFromPeriod(payout.Period);
            year    = ym ? parseInt(ym[1]) : getYearFromPeriod(payout.Period);
          } else {
            quarter = getQuarterFromPeriod(payout.Period);
            year    = getYearFromPeriod(payout.Period);
          }
        }
      }

      const key = `Q${quarter}-${year}`;
      if (!quarters[key]) quarters[key] = { regular: [], rebates: [] };
      if (isQtr) quarters[key].rebates.push(payout);
      else       quarters[key].regular.push(payout);
    });

    const result = [];
    Object.keys(quarters)
      .sort((a, b) => {
        const [qa, ya] = a.split('-'), [qb, yb] = b.split('-');
        return parseInt(ya) !== parseInt(yb) ? parseInt(ya) - parseInt(yb) : parseInt(qa.replace('Q','')) - parseInt(qb.replace('Q',''));
      })
      .forEach(key => {
        const g = quarters[key];
        [...g.regular]
          .sort((a, b) => {
            const aB = a.isBeginningBalance || /Balance\s+of\s+Q\d/i.test(a.Period);
            const bB = b.isBeginningBalance || /Balance\s+of\s+Q\d/i.test(b.Period);
            if (aB && !bB) return -1;
            if (!aB && bB) return 1;
            return getMonthOrder(a.Period) - getMonthOrder(b.Period) || new Date(a.Date) - new Date(b.Date);
          })
          .forEach(p => result.push(p));
        [...g.rebates]
          .sort((a, b) => new Date(a.Date) - new Date(b.Date))
          .forEach(r => result.push({ ...r, isLastInQuarter: true }));
      });

    return result;
  }, [paginatedPayouts, getQuarterFromPeriod, getYearFromPeriod, getMonthOrder]);

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

  const goToPage = (page) => {
    setPayoutCurrentPage(page);
    const start = (page - 1) * payoutRowsPerPage;
    setLocalPaginatedPayouts(localFilteredPayouts.slice(start, start + payoutRowsPerPage)); // ← was setPaginatedPayouts / filteredPayouts
  };

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const T = {
    bg:      isDark ? 'bg-slate-900'                     : 'bg-white',
    header:  isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200',
    thead:   isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200',
    divider: isDark ? 'divide-slate-700'  : 'divide-slate-100',
    footer:  isDark ? 'bg-slate-800 border-slate-700'    : 'bg-white border-slate-200',
    select:  isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-700',
    row:     isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50',
    tp:      isDark ? 'text-slate-100'  : 'text-slate-800',
    ts:      isDark ? 'text-slate-400'  : 'text-slate-500',
    tm:      isDark ? 'text-slate-500'  : 'text-slate-400',
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
      blue:    isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'         : 'bg-blue-50 text-blue-700 border-blue-200',
      violet:  isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40'   : 'bg-violet-50 text-violet-700 border-violet-200',
      emerald: isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber:   isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'      : 'bg-amber-50 text-amber-700 border-amber-200',
      red:     isDark ? 'bg-red-900/30 text-red-300 border-red-700/40'            : 'bg-red-50 text-red-700 border-red-200',
      slate:   isDark ? 'bg-slate-700 text-slate-400 border-slate-600'             : 'bg-slate-100 text-slate-500 border-slate-200',
      purple:  isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40'   : 'bg-violet-50 text-violet-600 border-violet-200',
    };
    return `inline-block px-2 py-0.5 rounded border font-semibold tabular-nums text-xs whitespace-nowrap ${map[color] || map.slate}`;
  };

  const statusSelectCls = (status, editable) => {
    if (!editable) return `appearance-none px-2 py-0.5 rounded border text-xs font-semibold italic ${isDark ? 'bg-slate-700 text-slate-500 border-slate-600' : 'bg-slate-100 text-slate-400 border-slate-200'}`;
    const map = {
      Paid:             isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Partially Paid': isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'       : 'bg-amber-50 text-amber-700 border-amber-200',
      Pending:          isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'          : 'bg-blue-50 text-blue-700 border-blue-200',
      'No Payout':      isDark ? 'bg-slate-700 text-slate-400 border-slate-600'              : 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return `appearance-none px-2 py-0.5 rounded border text-xs font-semibold cursor-pointer focus:outline-none ${map[status] || map['No Payout']}`;
  };

  // ── Beginning balance row ─────────────────────────────────────────────────
  const renderBeginningBalanceRow = (payout, index) => {
    const m = (payout.Period || '').match(/Balance of Q(\d+) (\d+)/);
    const tQ = m ? m[1] : '';
    const tY = m ? m[2] : '';
    let srcQ = '', srcY = '';
    if (tQ && tY) {
      const pq = parseInt(tQ) === 1 ? 4 : parseInt(tQ) - 1;
      const py = parseInt(tQ) === 1 ? parseInt(tY) - 1 : tY;
      srcQ = `Q${pq}`; srcY = py;
    }
    const amount = parseFloat(payout.TotalAmount) || parseFloat(payout.Balance) || 0;

    return (
      <tr key={`beg-${payout.Id || index}`} className={`border-b ${
        isDark ? 'border-slate-700/50 bg-emerald-900/10 border-l-2 border-l-emerald-500' : 'border-slate-100 bg-emerald-50/60 border-l-2 border-l-emerald-400'
      }`}>
        <td className="px-5 py-2.5">
          <span className={`font-medium ${T.tp}`}>{payout.Date || new Date().toLocaleDateString()}</span>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Beginning Balance</div>
        </td>
        <td className="px-4 py-2.5">
          <div className={`font-medium text-xs ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
            {(payout.Period || '').replace(/Balance\s+of\s+(Q\d+\s+\d{4})/i, 'Beginning Balance')}
          </div>
          {srcQ && (
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              (From {srcQ} {srcY} transactions)
            </div>
          )}
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

  // ── Regular row ────────────────────────────────────────────────────────────
  const renderPayoutRow = (payout, index) => {
    const isBeg = payout.isBeginningBalance || (payout.Period && /Balance\s+of\s+Q\d/i.test(payout.Period));
    if (isBeg) return renderBeginningBalanceRow(payout, index);

    const isQtr         = payout.isQtrRebate;
    const totalAmount   = parseFloat(payout.TotalAmount || payout.Amount || 0);
    const baseAmount    = parseFloat(payout.BaseAmount  || payout.baseAmount || 0);
    const amountReleased = parseFloat(payout.amountReleased || payout.AmountReleased || 0);
    const prevBalance   = parseFloat(payout.PreviousBalance || 0);
    const balance       = Math.max(0, totalAmount - amountReleased);
    const status        = payout.status || payout.Status || 'Pending';
    const hasSap        = payout.hasSapJournal || false;
    const journalRemarks = payout.journalRemarks || '';
    const journalDate   = payout.journalDate || null;
    const isNoPayout    = status === 'No Payout' && totalAmount <= 0 && !isQtr;
    const isEditable    = status !== 'No Payout' && (totalAmount > 0 || isQtr);
    const isEditing     = editingPayoutId === (payout.id || payout.Id);

    let rowAccent = '';
    if (isQtr) rowAccent = isDark ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-blue-400';
    if (hasSap) rowAccent = isDark ? 'border-l-2 border-l-violet-500' : 'border-l-2 border-l-violet-400';
    const rowOpacity = isNoPayout ? 'opacity-70' : '';

    const baseColor  = baseAmount > 0 ? 'blue' : 'slate';
    const totalColor = isNoPayout ? 'slate' : isQtr ? 'violet' : totalAmount > 0 ? 'amber' : 'slate';
    const balColor   = !isEditable ? 'slate' : balance > 0 ? 'red' : balance === 0 ? 'emerald' : 'slate';

    return (
      <tr key={payout.id || payout.Id || payout.PayoutId || index}
        className={`transition-colors duration-100 border-b ${T.row} ${
          isDark ? 'border-slate-700/50' : 'border-slate-100'
        } ${rowAccent} ${rowOpacity}`}
      >
        {/* Date */}
        <td className="px-5 py-2.5">
          <span className={`font-medium ${T.tp}`}>{payout.date || payout.Date || 'N/A'}</span>
          {isQtr && <div className={`text-[10px] mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Quarter Rebate</div>}
          {hasSap && !isQtr && (
            <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
              <span>📋 SAP</span>
              {journalDate && <span className="text-[8px] opacity-70">{new Date(journalDate).toLocaleDateString()}</span>}
            </div>
          )}
          {isNoPayout && <div className={`text-[10px] mt-0.5 ${T.tm}`}>No Payout</div>}
        </td>

        {/* Period */}
        <td className="px-4 py-2.5">
          <div className={`font-medium text-xs ${
            isNoPayout ? `italic ${T.ts}` : isQtr ? (isDark ? 'text-violet-300' : 'text-violet-700') : T.tp
          }`}>
            {payout.period || payout.Period || 'N/A'}
          </div>
          {(payout.calculationNote || payout.CalculationNote) && !isNoPayout && (
            <div className={`text-[10px] mt-0.5 ${T.tm}`}>{payout.calculationNote || payout.CalculationNote}</div>
          )}
          {hasSap && journalRemarks && (
            <div className={`text-[9px] mt-0.5 truncate max-w-[180px] ${isDark ? 'text-violet-400' : 'text-violet-600'}`}
              title={journalRemarks}>
              📝 {journalRemarks}
            </div>
          )}
          {isQtr && prevBalance > 0 && (
            <div className={`text-[9px] mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              + Prev: ₱{prevBalance.toFixed(2)}
            </div>
          )}
        </td>

        {/* Rebate Earned */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatCurrency(baseAmount), baseColor)}>
            {formatCurrency(baseAmount)}
          </span>
        </td>

        {/* Total Amount */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatCurrency(totalAmount), totalColor)}>
            {formatCurrency(totalAmount)}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-2.5 text-center">
          {isEditable ? (
            <select
              value={status}
              onChange={(e) => handlePayoutStatusChange(payout.id || payout.Id || payout.PayoutId, e.target.value)}
              className={statusSelectCls(status, true)}
            >
              <option value="No Payout">No Payout</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
            </select>
          ) : (
            <span className={statusSelectCls(status, false)}>{status}</span>
          )}
        </td>

        {/* Amount Released */}
        <td className="px-4 py-2.5 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <span className={badge(
              `₱${amountReleased
                ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountReleased)
                : '0.00'}`,
              hasSap ? 'purple' : !isEditable ? 'slate' : 'blue'
            )}>
              ₱{amountReleased
                ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountReleased)
                : '0.00'}
            </span>
            {hasSap && (
              <span className={`text-[9px] ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>From SAP</span>
            )}
          </div>
        </td>

        {/* Balance */}
        <td className="px-4 py-2.5 text-center">
          <span className={badge(formatCurrency(balance), balColor)}>
            {formatCurrency(balance)}
          </span>
        </td>
      </tr>
    );
  };

  if (customerModalTab !== 'payout') return null;

  const totalBegBalance = beginningBalances.reduce((s, b) => s + (b.TotalAmount || b.Balance || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col ${T.bg}`}>

      {/* ── Section header ──────────────────────────────────────────────── */}
     {/* <div className={`flex-shrink-0 px-5 py-3 border-b flex items-center justify-between ${T.header}`}>
        <div>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Payout History</h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>Rebate payment records — beginning balances from previous quarter</p>
        </div>
        <div className="flex items-center gap-2">
          {totalBegBalance > 0 && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              isDark ? 'bg-emerald-900/20 border-emerald-700/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              Beg. Bal: {formatCurrency(totalBegBalance)}
            </span>
          )}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}>
            {filteredPayouts.length} record{filteredPayouts.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={syncNewPayouts}
            disabled={syncingSap}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              syncingSap
                ? isDark ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                : isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <RefreshCw size={12} className={syncingSap ? 'animate-spin' : ''} />
            SAP Sync
          </button>
        </div>
      </div> */}

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
{/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {sortedPaginated.length === 0 ? (
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
                <th className={`${thCls} text-left  w-[18%]`}>Date</th>
                <th className={`${thCls} text-left  w-[21%]`}>Period</th>
                <th className={`${thCls} text-center w-[12%]`}>Rebate Earned</th>
                <th className={`${thCls} text-center w-[12%]`}>Total Amount</th>
                <th className={`${thCls} text-center w-[10%]`}>Status</th>
                <th className={`${thCls} text-center w-[13%]`}>Amount Released</th>
                <th className={`${thCls} text-center w-[13%]`}>Balance</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${T.divider}`}>
              {sortedPaginated.map((payout, i) => renderPayoutRow(payout, i))}
            </tbody>
          </table>
        )}
      </div>

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
            {beginningBalances.length > 0 && (
              <span className={`text-[11px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                · {beginningBalances.length} beginning balance{beginningBalances.length !== 1 ? 's' : ''}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${T.ts}`}>Per page</span>
              <select
                value={payoutRowsPerPage}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setPayoutRowsPerPage(n);
                  setPayoutCurrentPage(1);
                  setLocalPaginatedPayouts(localFilteredPayouts.slice(0, n)); // ← was setPaginatedPayouts / filteredPayouts
                }}
                className={`text-xs border rounded-md px-1.5 py-0.5 outline-none ${T.select}`}
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <PaginationBtn icon={ChevronsLeft}  onClick={() => goToPage(1)}                      disabled={safePage === 1} />
            <PaginationBtn icon={ChevronLeft}   onClick={() => goToPage(Math.max(safePage-1,1))} disabled={safePage === 1} />
            {getPageNums().map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className={`w-7 text-center text-xs ${T.tm}`}>…</span>
              ) : (
                <button key={p} onClick={() => goToPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                    safePage === p
                      ? 'bg-blue-600 text-white shadow'
                      : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >{p}</button>
              )
            )}
            <PaginationBtn icon={ChevronRight}  onClick={() => goToPage(Math.min(safePage+1, totalPages))} disabled={safePage === totalPages} />
            <PaginationBtn icon={ChevronsRight} onClick={() => goToPage(totalPages)}                       disabled={safePage === totalPages} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VanPayoutHistory;