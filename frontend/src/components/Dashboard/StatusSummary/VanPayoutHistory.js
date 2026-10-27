// VanPayoutHistory.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wallet, Layers, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Lock } from 'lucide-react';

const VanPayoutHistory = ({
  theme = 'light',
  customerModalTab,
  modalCustomer,
  formatCurrency,
  access,
}) => {
  const isDark  = theme === 'dark';
  const canView = !!access?.canView;

  const [viewMode, setViewMode] = useState('quarter'); // 'detail' | 'rebateCode' | 'quarter'
  const [summaryRows, setSummaryRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [syncingSap, setSyncingSap] = useState(false);
  const [sapSyncMessage, setSapSyncMessage] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  // ── Detail view (per rebate code, VAN's own payout computation) ──────────
  const [rebateCodeOptions, setRebateCodeOptions] = useState([]); // [{rebateCode, rebateType}]
  const [selectedRebateCode, setSelectedRebateCode] = useState('');
  const [selectedRebateType, setSelectedRebateType] = useState('');
  const [detailRows, setDetailRows] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(null);
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const [detailRowsPerPage, setDetailRowsPerPage] = useState(25);

  // No longer depends on rebateCode / rebateType from the header —
  // Payout History is always the full customer-wide rollup.
  const customerCardCode =
    modalCustomer?.code ||
    modalCustomer?.CardCode ||
    modalCustomer?.cardCode ||
    modalCustomer?.CustomerCode;

  // ── Load the customer-wide payout rollup ──────────────────────────────────
  const loadPayoutSummary = useCallback(async () => {
    if (!canView) return;
    if (!customerCardCode) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const url = `/api/van/payouts/customer/${customerCardCode}/payout-summary?db=VAN`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const result = await response.json();
      if (result.success) {
        const rows = viewMode === 'quarter'
          ? (result.data?.byQuarter || [])
          : (result.data?.byRebateCode || []);
        setSummaryRows(rows);

        const byRebateCode = result.data?.byRebateCode || [];

        // Populate the rebate-code dropdown used by Detail mode from the
        // same byRebateCode data — no extra endpoint needed.
        const options = byRebateCode.map(r => ({
          rebateCode: r.rebateCode,
          rebateType: (r.rebateTypes && r.rebateTypes[0]) || '',
          quarterLabel: r.quarterLabel || '',
        }));
        setRebateCodeOptions(options);
        if (!selectedRebateCode && options.length > 0) {
          setSelectedRebateCode(options[options.length - 1].rebateCode); // default: most recent
          setSelectedRebateType(options[options.length - 1].rebateType);
        }
      } else {
        setSummaryRows([]);
        setLoadError(result.message || 'Failed to load payout summary');
      }
    } catch (err) {
      console.error('Error loading payout summary:', err);
      setSummaryRows([]);
      setLoadError(err.message || 'Failed to load payout summary');
    } finally {
      setIsLoading(false);
    }
  }, [customerCardCode, viewMode, selectedRebateCode, canView]);

  useEffect(() => {
    if (!canView) return;
    if (customerModalTab === 'payout' && customerCardCode) {
      loadPayoutSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerModalTab, customerCardCode, viewMode, canView]);

  // ── Load detailed per-transaction rows for one rebate code (VAN's own
  //    /payouts endpoint — same computation VAN already uses elsewhere,
  //    nothing recalculated here) ─────────────────────────────────────
  const loadDetailPayouts = useCallback(async () => {
    if (!canView) return;
    if (!customerCardCode || !selectedRebateCode || !selectedRebateType) return;
    setIsDetailLoading(true);
    setDetailLoadError(null);
    try {
      const url = `/api/van/payouts/customer/${customerCardCode}/payouts` +
        `?db=VAN&rebateCode=${selectedRebateCode}&rebateType=${selectedRebateType}&useRebatePeriod=true`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const result = await response.json();
      if (result.success) {
        setDetailRows(result.data?.payouts || []);
        setDetailCurrentPage(1);
      } else {
        setDetailRows([]);
        setDetailLoadError(result.message || 'Failed to load payout details');
      }
    } catch (err) {
      console.error('Error loading payout details:', err);
      setDetailRows([]);
      setDetailLoadError(err.message || 'Failed to load payout details');
    } finally {
      setIsDetailLoading(false);
    }
  }, [customerCardCode, selectedRebateCode, selectedRebateType, canView]);

  useEffect(() => {
    if (!canView) return;
    if (customerModalTab === 'payout' && viewMode === 'detail' && selectedRebateCode) {
      loadDetailPayouts();
    }
  }, [customerModalTab, viewMode, selectedRebateCode, loadDetailPayouts, canView]);

  // ── Optional: manual SAP sync trigger (customer-wide, not rebate-scoped) ──
  const syncNewPayouts = useCallback(async () => {
    if (!canView) return;
    if (!customerCardCode) return;
    setSyncingSap(true);
    setSapSyncMessage('Syncing with SAP…');
    try {
      const response = await fetch(
        `/api/van/customer/${customerCardCode}/sync-sap`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ db: 'VAN' }),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      setSapSyncMessage('✅ SAP sync complete');
      await loadPayoutSummary();
      setTimeout(() => setSapSyncMessage(null), 3000);
    } catch (err) {
      setSapSyncMessage(`❌ SAP sync failed: ${err.message}`);
      setTimeout(() => setSapSyncMessage(null), 5000);
    } finally {
      setSyncingSap(false);
    }
  }, [customerCardCode, loadPayoutSummary, canView]);

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

  // ── Badge helpers ──────────────────────────────────────────────────────────
  const badge = (value, color) => {
    const map = {
      blue:    isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'         : 'bg-blue-50 text-blue-700 border-blue-200',
      violet:  isDark ? 'bg-violet-900/30 text-violet-300 border-violet-700/40'   : 'bg-violet-50 text-violet-700 border-violet-200',
      emerald: isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber:   isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'      : 'bg-amber-50 text-amber-700 border-amber-200',
      red:     isDark ? 'bg-red-900/30 text-red-300 border-red-700/40'            : 'bg-red-50 text-red-700 border-red-200',
      slate:   isDark ? 'bg-slate-700 text-slate-400 border-slate-600'             : 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return `inline-block px-2 py-0.5 rounded border font-semibold tabular-nums text-xs whitespace-nowrap ${map[color] || map.slate}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'emerald';
      case 'Partially Paid': return 'amber';
      case 'Pending': return 'blue';
      case 'Over-Released': return 'red';
      case 'No Payout': return 'slate';
      default: return 'slate';
    }
  };

  const RebateTypeBadge = ({ type }) => {
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

  const formatDateShort = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return ''; }
  };

  // ── Detail-row helpers ────────────────────────────────────────────────
  const isBegBalanceRow = (row) =>
    !!row.isBeginningBalance || (row.Period && row.Period.includes('Balance of Q'));

  const totalPages = Math.max(1, Math.ceil(detailRows.length / detailRowsPerPage));
  const safeDetailPage = Math.min(detailCurrentPage, totalPages);
  const paginatedDetailRows = detailRows.slice(
    (safeDetailPage - 1) * detailRowsPerPage,
    safeDetailPage * detailRowsPerPage
  );

  const getDetailPageNums = () => {
    const total = totalPages, cur = safeDetailPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)         return [1, 2, 3, 4, 5, '...', total];
    if (cur >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', cur - 1, cur, cur + 1, '...', total];
  };

  if (customerModalTab !== 'payout') return null;

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

  const totalRebateEarned  = summaryRows.reduce((s, r) => s + (r.baseAmount || 0), 0);
  const totalAmount        = summaryRows.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const totalReleased      = summaryRows.reduce((s, r) => s + (r.amountReleased || 0), 0);
  const totalBalance       = summaryRows.reduce((s, r) => s + (r.balance || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col ${T.bg}`}>

    {/* ── Toolbar: view mode dropdown (right) ─────────────────────────────── */}
    <div className={`flex-shrink-0 flex items-center justify-end gap-3 px-5 py-2.5 border-b ${T.header}`}>
      {viewMode === 'detail' && rebateCodeOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${T.ts}`}>Rebate code</span>
          <select
            value={selectedRebateCode}
            onChange={(e) => {
              const opt = rebateCodeOptions.find(o => o.rebateCode === e.target.value);
              setSelectedRebateCode(e.target.value);
              setSelectedRebateType(opt?.rebateType || '');
            }}
            className={`pl-3 pr-6 py-1.5 rounded-lg text-[11px] font-semibold border outline-none transition-all appearance-none cursor-pointer ${T.select}`}
          >
            {rebateCodeOptions.map(o => (
              <option key={o.rebateCode} value={o.rebateCode}>
                {o.quarterLabel ? `${o.rebateCode} — ${o.quarterLabel}` : o.rebateCode}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-medium ${T.ts}`}>View by</span>

        <div className="relative">
          {viewMode === 'quarter'
            ? <Calendar
                size={12}
                className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${T.tm}`}
              />
            : viewMode === 'rebateCode'
            ? <Layers
                size={12}
                className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${T.tm}`}
              />
            : null
          }

          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className={`${viewMode !== 'detail' ? 'pl-7' : 'pl-3'} pr-6 py-1.5 rounded-lg text-[11px] font-semibold border outline-none transition-all appearance-none cursor-pointer ${T.select}`}
          >
            <option value="detail">Detail</option>
            <option value="quarter">Quarter</option>
            <option value="rebateCode">Rebate Code</option>
          </select>
        </div>
      </div>
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
      <div className="flex-1 overflow-auto">
        {viewMode === 'detail' ? (
          isDetailLoading ? (
            <div className="animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`px-5 py-3 border-b flex items-center gap-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                  <div className={`h-3 w-24 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  <div className={`h-3 w-16 rounded ml-auto ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  <div className={`h-3 w-16 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                </div>
              ))}
            </div>
          ) : detailLoadError ? (
            <div className="h-full flex items-center justify-center py-16">
              <div className="text-center">
                <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Failed to load payout details</p>
                <p className={`text-xs ${T.ts}`}>{detailLoadError}</p>
                <button
                  onClick={loadDetailPayouts}
                  className="mt-3 px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : !selectedRebateCode ? (
            <div className="h-full flex items-center justify-center py-16">
              <div className="text-center">
                <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Wallet size={22} className={T.tm} />
                </div>
                <h3 className={`text-sm font-bold mb-1 ${T.tp}`}>No Rebate Programs</h3>
                <p className={`text-xs ${T.ts}`}>This customer has no rebate programs to show.</p>
              </div>
            </div>
          ) : detailRows.length === 0 ? (
            <div className="h-full flex items-center justify-center py-16">
              <div className="text-center">
                <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Wallet size={22} className={T.tm} />
                </div>
                <h3 className={`text-sm font-bold mb-1 ${T.tp}`}>No Payout Records</h3>
                <p className={`text-xs ${T.ts}`}>No payout records found for {selectedRebateCode}.</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className={`sticky top-0 border-b ${T.thead}`}>
                <tr>
                  <th className={`${thCls} text-left w-[12%]`}>Date</th>
                  <th className={`${thCls} text-left w-[22%]`}>Period</th>
                  <th className={`${thCls} text-center w-[13%]`}>Rebate Earned</th>
                  <th className={`${thCls} text-center w-[13%]`}>Total Amount</th>
                  <th className={`${thCls} text-center w-[10%]`}>Status</th>
                  <th className={`${thCls} text-center w-[15%]`}>Released</th>
                  <th className={`${thCls} text-center w-[15%]`}>Balance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${T.divider}`}>
                {paginatedDetailRows.map((row, i) => {
                  const isBegBalance = isBegBalanceRow(row);
                  const isQtr = !!row.isQtrRebate;

                  if (isBegBalance) {
                    return (
                      <tr
                        key={row.PayoutId || `beg-${i}`}
                        className={`border-b ${
                          isDark
                            ? 'border-slate-700/50 bg-emerald-900/10 border-l-2 border-l-emerald-500'
                            : 'border-slate-100 bg-emerald-50/60 border-l-2 border-l-emerald-400'
                        }`}
                      >
                        <td className="px-5 py-2.5">
                          <span className={`font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{row.Date}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className={`font-medium text-xs ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
                            {row.Period}
                          </div>
                          {row.CarrySourceNote && (
                            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                              {row.CarrySourceNote}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5 text-center">
                          <span className={badge(formatCurrency(row.TotalAmount ?? row.Balance ?? 0), 'emerald')}>
                            {formatCurrency(row.TotalAmount ?? row.Balance ?? 0)}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  const rowAccent = isQtr
                    ? (isDark ? 'border-l-2 border-l-violet-500' : 'border-l-2 border-l-violet-400')
                    : '';
                  const isNoPayout = row.Status === 'No Payout';

                  return (
                    <tr
                      key={row.PayoutId || i}
                      className={`transition-colors duration-100 border-b ${T.row} ${
                        isDark ? 'border-slate-700/50' : 'border-slate-100'
                      } ${rowAccent} ${isNoPayout ? 'opacity-70' : ''}`}
                    >
                      <td className="px-5 py-2.5">
                        <span className={`font-medium ${T.tp}`}>{row.Date}</span>
                        {isQtr && (
                          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
                            Quarter Rebate
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className={`font-medium text-xs ${isQtr ? (isDark ? 'text-violet-300' : 'text-violet-700') : T.tp}`}>
                          {row.Period}
                        </div>
                        {row.CalculationNote && (
                          <div className={`text-[10px] mt-0.5 ${T.tm}`}>{row.CalculationNote}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.BaseAmount || 0), 'blue')}>
                          {formatCurrency(row.BaseAmount || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.TotalAmount || 0), isQtr ? 'violet' : row.TotalAmount > 0 ? 'amber' : 'slate')}>
                          {formatCurrency(row.TotalAmount || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(row.Status, getStatusColor(row.Status))}>{row.Status || 'No Payout'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.AmountReleased || 0), 'blue')}>
                          {formatCurrency(row.AmountReleased || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.Balance || 0), row.Balance > 0 ? 'red' : 'emerald')}>
                          {formatCurrency(row.Balance || 0)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : isLoading ? (
          <div className="animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`px-5 py-3 border-b flex items-center gap-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                <div className={`h-3 w-24 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                <div className={`h-3 w-16 rounded ml-auto ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                <div className={`h-3 w-16 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                <div className={`h-3 w-16 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="h-full flex items-center justify-center py-16">
            <div className="text-center">
              <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Failed to load payout history</p>
              <p className={`text-xs ${T.ts}`}>{loadError}</p>
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
              <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${
                isDark ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
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
                  {viewMode === 'quarter' ? 'Quarter' : 'Rebate Code'}
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
                const dedupeKey = viewMode === 'quarter' ? row.quarterLabel : row.rebateCode;
                const key = `${dedupeKey || 'row'}-${i}`;
                const isExpanded = expandedRow === key;
                return (
                  <React.Fragment key={key}>
                    <tr
                      className={`transition-colors duration-100 cursor-pointer border-b ${T.row} ${
                        isDark ? 'border-slate-700/50' : 'border-slate-100'
                      }`}
                      onClick={() => setExpandedRow(isExpanded ? null : key)}
                    >
                    {/* Rebate code / Quarter */}
                    <td className="px-5 py-2.5">
                      {viewMode === 'rebateCode' ? (
                        <>
                          {/* Rebate Code */}
                          <span className={`font-semibold ${T.tp}`}>
                            {row.rebateCode}
                          </span>

                          {/* Quarter + Date Range */}
                          {row.quarterLabel && row.dateFrom && row.dateTo && (
                            <div className={`text-[10px] mt-0.5 ${T.tm}`}>
                              {row.quarterLabel} : {formatDateShort(row.dateFrom)} – {formatDateShort(row.dateTo)}
                            </div>
                          )}
                          {row.carriedIn > 0.01 && (
                            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                              + Carried in {formatCurrency(row.carriedIn)}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Quarter */}
                          <span className={`font-semibold ${T.tp}`}>
                            {row.quarterLabel}
                          </span>

                          {/* Rebate Codes */}
                          {row.rebateCodes?.length > 0 && (
                            <div className={`text-[10px] mt-0.5 ${T.tm}`}>
                              {row.rebateCodes.join(', ')}
                            </div>
                          )}
                        </>
                      )}
                    </td>

                      {/* Type(s) */}
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(row.rebateTypes || []).map(t => <RebateTypeBadge key={t} type={t} />)}
                        </div>
                        {viewMode === 'rebateCode' && (
                          <div className="mt-1">

                          </div>
                        )}
                      </td>

                      {/* Rebate Earned */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.baseAmount), 'blue')}>
                          {formatCurrency(row.baseAmount)}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.totalAmount), row.totalAmount > 0 ? 'amber' : 'slate')}>
                          {formatCurrency(row.totalAmount)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(row.status, getStatusColor(row.status))}>{row.status}</span>
                      </td>

                      {/* Released */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={badge(formatCurrency(row.amountReleased), 'blue')}>
                          {formatCurrency(row.amountReleased)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.isOverReleased ? (
                          <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={badge(
                          formatCurrency(row.balance),
                          row.balance > 0 ? 'red' : row.balance === 0 ? 'emerald' : 'slate'
                        )}
                      >
                        {row.balance < 0
                          ? `(${formatCurrency(Math.abs(row.balance))})`
                          : formatCurrency(row.balance)}
                      </span>
                            <span className={`text-[9px] ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                              Over-released
                            </span>
                          </div>
                        ) : (
                          <span className={badge(
                            formatCurrency(row.balance),
                            row.balance > 0 ? 'red' : row.balance === 0 ? 'emerald' : 'slate'
                          )}>
                            {formatCurrency(row.balance)}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail row — quarter view shows its rebate codes' breakdown */}
                    {isExpanded && viewMode === 'quarter' && (
                      <tr className={isDark ? 'bg-slate-800/30' : 'bg-slate-50'}>
                        <td colSpan={7} className="px-8 py-2">
                          <span className={`text-[10px] ${T.ts}`}>
                            This quarter combines: <strong>{row.rebateCodes?.join(', ')}</strong>
                          </span>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer count / pagination ─────────────────────────────────────── */}
      {viewMode === 'detail' && detailRows.length > 0 && (
        <div className={`flex-shrink-0 flex flex-wrap gap-2 items-center justify-between px-5 py-2.5 border-t ${T.footer}`}>
          <div className="flex items-center gap-3">
            <p className={`text-[11px] ${T.ts}`}>
              Showing{' '}
              <span className={`font-semibold ${T.tp}`}>
                {(safeDetailPage - 1) * detailRowsPerPage + 1}–{Math.min(safeDetailPage * detailRowsPerPage, detailRows.length)}
              </span>{' '}
              of <span className={`font-semibold ${T.tp}`}>{detailRows.length}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${T.ts}`}>Per page</span>
              <select
                value={detailRowsPerPage}
                onChange={(e) => { setDetailRowsPerPage(Number(e.target.value)); setDetailCurrentPage(1); }}
                className={`text-xs border rounded-md px-1.5 py-0.5 outline-none ${T.select}`}
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setDetailCurrentPage(1)} disabled={safeDetailPage === 1}
              className={`w-7 h-7 rounded flex items-center justify-center ${safeDetailPage === 1 ? (isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed') : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100')}`}>
              <ChevronsLeft size={14} />
            </button>
            <button onClick={() => setDetailCurrentPage(p => Math.max(p - 1, 1))} disabled={safeDetailPage === 1}
              className={`w-7 h-7 rounded flex items-center justify-center ${safeDetailPage === 1 ? (isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed') : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100')}`}>
              <ChevronLeft size={14} />
            </button>
            {getDetailPageNums().map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className={`w-7 text-center text-xs ${T.tm}`}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setDetailCurrentPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                    safeDetailPage === p
                      ? 'bg-blue-600 text-white shadow'
                      : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button onClick={() => setDetailCurrentPage(p => Math.min(p + 1, totalPages))} disabled={safeDetailPage === totalPages}
              className={`w-7 h-7 rounded flex items-center justify-center ${safeDetailPage === totalPages ? (isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed') : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100')}`}>
              <ChevronRight size={14} />
            </button>
            <button onClick={() => setDetailCurrentPage(totalPages)} disabled={safeDetailPage === totalPages}
              className={`w-7 h-7 rounded flex items-center justify-center ${safeDetailPage === totalPages ? (isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed') : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100')}`}>
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
      {viewMode !== 'detail' && summaryRows.length > 0 && (
        <div className={`flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-t ${T.footer}`}>
          <p className={`text-[11px] ${T.ts}`}>
            <span className={`font-semibold ${T.tp}`}>{summaryRows.length}</span>{' '}
            {viewMode === 'quarter' ? (summaryRows.length !== 1 ? 'quarters' : 'quarter') : (summaryRows.length !== 1 ? 'rebate codes' : 'rebate code')}
          </p>
        </div>
      )}
    </div>
  );
};

export default VanPayoutHistory;