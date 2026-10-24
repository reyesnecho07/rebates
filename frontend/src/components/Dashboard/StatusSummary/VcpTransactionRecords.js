// VcpTransactionRecords.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  FileText, ClipboardList, Lock, FileSpreadsheet,
} from 'lucide-react';

const VcpTransactionRecords = ({
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

  // export state (hook — must stay above any early return)
  const [isExporting, setIsExporting] = useState(false);

  // case-insensitive, whitespace-safe quota detection
  const normQuota = (v) => String(v ?? '').trim().toLowerCase();
  const isWithQuota =
    [
      modalCustomer?.quotaType,
      modalCustomer?.rebateQuotaType,
      modalCustomer?.details?.quotaType,
      modalCustomer?.details?.rebateDetails?.quotaType,
    ].some((v) => normQuota(v) === 'with quota') ||
    modalCustomer?.withQuota === true ||
    modalCustomer?.hasQuota === true;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isInvoice = (t) => {
    const tt = t.Treetype || t.treetype || t.type;
    return tt === '';
  };

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

  // Round to 2 decimals, half away from zero. 427.9275 → 427.93, -427.925 → -427.93
  const round2 = (n) => {
    const v = parseFloat(n) || 0;
    if (v === 0) return 0;
    const sign = v < 0 ? -1 : 1;
    return sign * Number(Math.round(Number(Math.abs(v) + 'e2')) + 'e-2');
  };

  // Qty — up to 2 decimals, integers stay clean (1,500 not 1,500.00)
  const fmtNum = (n) => {
    const num = round2(n);
    if (Number.isInteger(num)) return num.toLocaleString('en-US');
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  // Money — ALWAYS exactly 2 decimals, computed from round2()
  const fmtMoney = (n) =>
    round2(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // peso with the minus sign in front: -₱1,200.00
  const fmtPeso = (n) => {
    const v = round2(n);
    return v < 0 ? `-₱${fmtMoney(Math.abs(v))}` : `₱${fmtMoney(v)}`;
  };

  const fmtDate = (s) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch { return s; }
  };

  const is25kg = (t) =>
    t.Is25kgItem || (t.Item && t.Item.toLowerCase().includes('25kg'));

  // ── Period-aware cycle helpers ──────────────────────────────────────────
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

  // ══════════════════════════════════════════════════════════════════════════
  // ALL HOOKS MUST RUN UNCONDITIONALLY — before any early return
  // ══════════════════════════════════════════════════════════════════════════

  // ── Auto-load dates ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canView) return;
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
  }, [customerModalTab, modalCustomer, canView]);

  // ── Period boundaries ────────────────────────────────────────────────────
  const periodStart = useMemo(() => {
    if (!periodFrom) return null;
    const d = new Date(periodFrom);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodFrom]);

  const periodEnd = useMemo(() => {
    if (!periodTo) return null;
    const d = new Date(periodTo);
    if (isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
  }, [periodTo]);

  // ── Data — filter strictly by the selected period ───────────────────────
  const periodFiltered = useMemo(() => {
    if (!Array.isArray(filteredTransactions)) return [];
    if (!periodStart && !periodEnd) return filteredTransactions;

    return filteredTransactions.filter(t => {
      const raw = t.Date || t.transactionDate || t.date;
      if (!raw) return true;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return true;
      if (periodStart && d < periodStart) return false;
      if (periodEnd   && d > periodEnd)   return false;
      return true;
    });
  }, [filteredTransactions, periodStart, periodEnd]);

  // ── Early return (AFTER all hooks) ──────────────────────────────────────
  if (customerModalTab !== 'transaction') return null;

  // ── Non-hook derivations ────────────────────────────────────────────────
  const sorted = sortByDate(periodFiltered);

  // ── Retroactive rate resolution (Incremental + With Quota only) ────────
  const periodRetroactiveRates = (() => {
    const map = new Map();
    if (!isWithQuota || modalCustomer?.rebateType !== 'Incremental') return map;

    const ranges = modalCustomer?.details?.rebateDetails?.ranges || [];
    if (!ranges.length) return map;

    const sortedRanges = [...ranges].sort(
      (a, b) => (parseFloat(a.minQty) || 0) - (parseFloat(b.minQty) || 0)
    );
    const anchorDay = getPeriodAnchorDay(modalCustomer);

    // ARCM rows carry negative quantities, so the totals here are NET sales.
    const periodTotals = new Map();
    sorted.forEach(t => {
      const key        = getPeriodCycleKey(t.Date, anchorDay);
      const actual     = parseFloat(t.ActualSales) || 0;
      const unitPerQty = parseFloat(t.UnitPerQty)  || 1;
      const qty        = unitPerQty > 1 ? actual / unitPerQty : actual;
      periodTotals.set(key, (periodTotals.get(key) || 0) + qty);
    });

    periodTotals.forEach((total, key) => {
      let matched = null;
      for (const range of sortedRanges) {
        const mn = parseFloat(range.minQty) || 0;
        const mx = parseFloat(range.maxQty) || 0;
        if (total >= mn && (total <= mx || !mx)) {
          matched = range;
          break;
        }
      }
      if (!matched && sortedRanges.length > 0) {
        const last = sortedRanges[sortedRanges.length - 1];
        if (total >= (parseFloat(last.minQty) || 0)) matched = last;
      }

      const rate = matched ? (parseFloat(matched.rebatePerBag) || 0) : 0;
      map.set(key, { rate, rangeNo: matched?.rangeNo ?? null });
    });

    return map;
  })();

  const getRetroactiveRate = (t) => {
    if (!isWithQuota || modalCustomer?.rebateType !== 'Incremental') return null;
    const key = getPeriodCycleKey(t.Date, getPeriodAnchorDay(modalCustomer));
    return periodRetroactiveRates.get(key) || null;
  };

  // FINAL qty of each cycle (whole cycle, not running) — net of ARCM rows.
  const cycleFinalBalances = (() => {
    const map = new Map();
    if (!isWithQuota) return map;
    const anchorDay = getPeriodAnchorDay(modalCustomer);
    sorted.forEach(t => {
      const key        = getPeriodCycleKey(t.Date, anchorDay);
      const actual     = parseFloat(t.ActualSales) || 0;
      const unitPerQty = parseFloat(t.UnitPerQty)  || 1;
      const qty        = unitPerQty > 1 ? actual / unitPerQty : actual;
      map.set(key, (map.get(key) || 0) + qty);
    });
    return map;
  })();

  const calculateCycleProgress = (t) => {
    const anchorDay = getPeriodAnchorDay(modalCustomer);
    const finalBal  = cycleFinalBalances.get(getPeriodCycleKey(t.Date, anchorDay)) || 0;
    const target    = getTargetQty(t, modalCustomer) || 0;
    return target <= 0 ? 0 : Math.min(100, (finalBal / target) * 100);
  };

  // ── Per-unit rate label + per-line amount ──────────────────────────────
  const getRateValue = (t) => {
    if (isWithQuota && modalCustomer?.rebateType === 'Incremental') {
      const retro = getRetroactiveRate(t);
      if (retro && retro.rate > 0) return retro.rate;
    }

    if (modalCustomer?.rebateType === 'Percentage') {
      return parseFloat(t.Percentage ?? t.percentagePerBag ?? t.RebatePerBag ?? 0) || 0;
    }
    return parseFloat(t.RebatePerBag ?? t.rebatePerBag ?? t.Rebate ?? 0) || 0;
  };

  const getRateLabel = (t) => {
    if (modalCustomer?.rebateType === 'Percentage') {
      return `${round2(getRateValue(t))}%`;
    }
    return `₱${fmtMoney(getRateValue(t))}`;
  };

  // ARCM = A/R Credit Memo (from ORIN). Everything else is an AR Invoice (OINV).
  const isReturnRow = (t) =>
    !!(t.IsReturn || t.TransType === 'ARCM' || t.EligibilityStatus === 'Return');

  const getTypeLabel = (t) => t.TransType || (isReturnRow(t) ? 'ARCM' : 'AR Invoice');

  // Document number: invoice DocNum (OINV) or credit memo DocNum (ORIN)
  const getDocNum = (t) =>
    String(t.InvoiceNumber ?? t.DocNum ?? t.DocNumber ?? t.docNum ?? '').trim();

  // ARCM rows follow the same eligibility rules as invoices, so their
  // (negative) amount is deducted whenever the invoices of that period are paid.
  const isRowCounted = (t, idx) => {
    if (!isWithQuota) return t.QuotaMetThisMonth !== false;
    const e = getEligibility(t, idx, sorted);
    return e.label === 'Eligible' || e.label.startsWith('Range');
  };

  const getRowAmount = (t, idx) => {
    if (!isRowCounted(t, idx)) return 0;

    const rate        = getRateValue(t);
    const actualSales = parseFloat(t.ActualSales) || 0;  
    const unitPerQty  = parseFloat(t.UnitPerQty)  || 1;
    const qtyForReb   = unitPerQty > 1 ? actualSales / unitPerQty : actualSales;

    if (modalCustomer?.rebateType === 'Percentage') {
      // ✅ Calculate directly from Gtotal to prevent float precision errors like 285.2849999
      const gtotal = parseFloat(t.Gtotal) || 0;
      return round2((gtotal * rate) / 100);
    }

    return round2(qtyForReb * rate);
  };

  // ── Eligibility label + color ─────────────────────────────────────────────
  const isPercentage = modalCustomer?.rebateType === 'Percentage';

  const getEligibility = (t, globalIdx, allTransactions) => {
    if (isPercentage && t.QuotaMetThisMonth === false) {
      return { label: 'Not Eligible', color: 'rose' };
    }

    if (isWithQuota && isPercentage && t.QuotaMetThisMonth === true) {
      return { label: 'Eligible', color: 'emerald' };
    }

    if (isWithQuota && allTransactions && globalIdx !== undefined) {
      const isIncr   = modalCustomer?.rebateType === 'Incremental';
      const progress = isIncr
        ? calculateProgress(t, allTransactions, globalIdx, modalCustomer)
        : calculateCycleProgress(t);

      if (isIncr) {
        const retro = getRetroactiveRate(t);
        if (retro && retro.rangeNo != null) {
          return { label: `Range ${retro.rangeNo}`, color: 'emerald' };
        }
        if (t.CurrentRange) return { label: `Range ${t.CurrentRange}`, color: 'emerald' };
        return progress > 0
          ? { label: 'Progressing', color: 'amber' }
          : { label: 'Not in Range', color: 'rose' };
      }
      if (progress >= 100) return { label: 'Eligible',           color: 'emerald' };
      if (progress >= 70)  return { label: 'Progressing',        color: 'amber' };
      return                     { label: 'Not Eligible',       color: 'rose' };
    }

    switch (t.EligibilityStatus) {
      case 'Eligible':            return { label: 'Eligible',           color: 'emerald' };
      case 'Partially Eligible':  return { label: 'Partially Eligible', color: 'amber' };
      case 'Progressing':         return { label: 'Progressing',        color: 'amber' };
      case 'Not Eligible':        return { label: 'Not Eligible',       color: 'rose' };
    }

    const target = parseFloat(t.MonthQuota) || 0;
    const qty    = parseFloat(t.QtyForReb || t.ActualSales) || 0;

    if (target > 0) {
      if (qty >= target)          return { label: 'Eligible',           color: 'emerald' };
      if (qty >= target * 0.7)    return { label: 'Partially Eligible', color: 'amber' };
      return                             { label: 'Not Eligible',       color: 'rose' };
    }

    return { label: '—', color: 'slate' };
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / transactionRowsPerPage));
  const safePage   = Math.min(transactionCurrentPage, totalPages);
  const paginated  = sorted.slice((safePage - 1) * transactionRowsPerPage, safePage * transactionRowsPerPage);

  // Net total: ARCM rows are negative, so they reduce the total.
  // Round the SUM of already-rounded lines so it matches the visible rows.
  const grandTotalAmount = round2(
    sorted.reduce((sum, t, idx) => sum + getRowAmount(t, idx), 0)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Excel export — exports ALL rows in the selected From/To range
  // ══════════════════════════════════════════════════════════════════════════
  const exportToExcel = async () => {
    if (!sorted.length || isExporting) return;
    setIsExporting(true);

    try {
      const ExcelJS = (await import('exceljs')).default;

      const COLS       = 9;
      const HEADER_ROW = 8;
      const FIRST_DATA = HEADER_ROW + 1;
      const LAST_DATA  = HEADER_ROW + sorted.length;
      const TOTAL_ROW  = LAST_DATA + 1;

      const PESO = '"₱"#,##0.00;[Red]-"₱"#,##0.00';
      const QTY  = '#,##0.00;[Red]-#,##0.00';
      const FONT = 'Calibri';
      const C = {
        navy: 'FF1E3A8A', blue: 'FF2563EB', zebra: 'FFF8FAFC', label: 'FFEFF6FF',
        border: 'FFCBD5E1', ink: 'FF0F172A', muted: 'FF64748B', white: 'FFFFFFFF',
        totalBg: 'FFDBEAFE', red: 'FFE11D48', arcmBg: 'FFFFF1F2',
      };
      const thin = { style: 'thin', color: { argb: C.border } };
      const allBorders = { top: thin, left: thin, bottom: thin, right: thin };
      const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

      // local calendar date -> UTC midnight so Excel doesn't shift the day
      const toExcelDate = (raw) => {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return null;
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      };

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Rebate Management System';
      wb.created = new Date();

      const ws = wb.addWorksheet('Transactions', {
        views: [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }],
        pageSetup: {
          paperSize: 9, orientation: 'landscape',
          fitToPage: true, fitToWidth: 1, fitToHeight: 0,
          margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
        },
        headerFooter: { oddFooter: '&LTransaction Records&CPage &P of &N&R&D' },
      });

      ws.columns = [
        { width: 13 }, // Type
        { width: 14 }, // Doc No.
        { width: 14 }, // Date
        { width: 18 }, // Item Code
        { width: 46 }, // Item Name
        { width: 12 }, // Qty
        { width: 18 }, // Peso Value
        { width: 16 }, // Percentage / Rebate per unit
        { width: 18 }, // Amount
      ];

      // ── Title banner ──
      ws.mergeCells(1, 1, 1, COLS);
      const title = ws.getCell(1, 1);
      title.value = 'TRANSACTION RECORDS';
      title.font = { name: FONT, size: 18, bold: true, color: { argb: C.white } };
      title.fill = fill(C.navy);
      title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(1).height = 34;

      // ── Info block ──
      const rebateTypeLabel = modalCustomer?.rebateType || '—';
      const info = [
        ['Customer', modalCustomer?.customer || modalCustomer?.customerName || 'Unknown Customer'],
        ['Customer Code', [modalCustomer?.code || modalCustomer?.customerCode, modalCustomer?.rebateCode]
          .filter(Boolean).join('  ·  ') || '—'],
        ['Rebate Type', `${rebateTypeLabel}${isWithQuota ? ' (With Quota)' : ''}`],
        ['Date Range', `${periodFrom ? fmtDate(periodFrom) : '—'}  to  ${periodTo ? fmtDate(periodTo) : '—'}`],
        ['Generated', new Date().toLocaleString('en-US', {
          month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })],
      ];
      info.forEach(([label, value], i) => {
        const rowNo = 2 + i;
        const lc = ws.getCell(rowNo, 1);
        lc.value = label;
        lc.font = { name: FONT, size: 10, bold: true, color: { argb: C.navy } };
        lc.fill = fill(C.label);
        lc.alignment = { vertical: 'middle', indent: 1 };
        lc.border = { bottom: thin };
        ws.mergeCells(rowNo, 2, rowNo, COLS);
        const vc = ws.getCell(rowNo, 2);
        vc.value = value;
        vc.font = { name: FONT, size: 11, bold: i === 0, color: { argb: C.ink } };
        vc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        vc.border = { bottom: thin };
        ws.getRow(rowNo).height = 20;
      });
      ws.getRow(7).height = 10; // spacer

      // ── Table header ──
      const headers = [
        'Type', 'Doc No.', 'Date', 'Item Code', 'Item Name', 'Qty', 'Peso Value',
        isPercentage ? 'Percentage' : 'Rebate / Unit', 'Amount',
      ];
      const hr = ws.getRow(HEADER_ROW);
      hr.height = 26;
      headers.forEach((h, i) => {
        const c = hr.getCell(i + 1);
        c.value = h.toUpperCase();
        c.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
        c.fill = fill(C.blue);
        c.border = allBorders;
        c.alignment = {
          vertical: 'middle',
          horizontal: i <= 4 ? 'left' : 'right',
          indent: 1,
        };
      });

      // ── Data rows ──
      let arcmCount = 0;
      sorted.forEach((t, idx) => {
        const row = ws.getRow(FIRST_DATA + idx);
        row.height = 20;

        const isArcm      = isReturnRow(t);
        if (isArcm) arcmCount += 1;
        const itemName    = t.Item || t.ItemName || '—';
        const displayName = is25kg(t) && !/25kg/i.test(itemName) ? `${itemName} (25kg)` : itemName;
        const rate        = getRateValue(t);
        const amount      = getRowAmount(t, idx);   // already rounded to 2 dp
        const notCounted  = amount === 0 && (isWithQuota || t.QuotaMetThisMonth === false);

        const docNumRaw = getDocNum(t);
        const values = [
          getTypeLabel(t),
          docNumRaw === '' ? '—' : (/^\d+$/.test(docNumRaw) ? Number(docNumRaw) : docNumRaw),
          toExcelDate(t.Date || t.transactionDate || t.date),
          t.ItemCode || t.ItemCodeSAP || '—',
          displayName,
          round2(parseFloat(t.ActualSales) || 0),
          round2(parseFloat(t.Gtotal) || 0),
          isPercentage ? round2(rate) / 100 : round2(rate),
          amount,
        ];
        const formats = ['@', '0', 'mmm dd, yyyy', '@', '@', QTY, PESO, isPercentage ? '0.00%' : PESO, PESO];

        values.forEach((v, i) => {
          const c = row.getCell(i + 1);
          c.value = v;
          c.numFmt = formats[i];
          c.border = allBorders;
          const red = (i === 0 && isArcm) || (i === 8 && (amount < 0 || notCounted));
          c.font = {
            name: FONT, size: 10,
            bold: i === 0 || i === 8,
            color: { argb: red ? C.red : C.ink },
          };
          c.alignment = {
            vertical: 'middle',
            horizontal: i <= 4 ? 'left' : 'right',
            indent: 1,
            wrapText: i === 4,
          };
          if (isArcm)            c.fill = fill(C.arcmBg);
          else if (idx % 2 === 1) c.fill = fill(C.zebra);
        });
      });

      // ── Totals row (live SUM formulas) ──
      const tr = ws.getRow(TOTAL_ROW);
      tr.height = 26;
      ws.mergeCells(TOTAL_ROW, 1, TOTAL_ROW, 6);
      const totalPeso = round2(sorted.reduce((s, t) => s + (parseFloat(t.Gtotal) || 0), 0));

      for (let col = 1; col <= COLS; col++) {
        const c = tr.getCell(col);
        c.fill = fill(C.totalBg);
        c.font = { name: FONT, size: 11, bold: true, color: { argb: C.navy } };
        c.border = {
          top: { style: 'medium', color: { argb: C.navy } },
          bottom: { style: 'double', color: { argb: C.navy } },
          left: thin, right: thin,
        };
        c.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      }
      const lbl = tr.getCell(1);
      lbl.value = 'TOTAL';
      lbl.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

      const pesoCell = tr.getCell(7);
      pesoCell.value = { formula: `SUM(G${FIRST_DATA}:G${LAST_DATA})`, result: totalPeso };
      pesoCell.numFmt = PESO;

      const amtCell = tr.getCell(9);
      amtCell.value = { formula: `SUM(I${FIRST_DATA}:I${LAST_DATA})`, result: grandTotalAmount };
      amtCell.numFmt = PESO;

      // Footnote
      ws.mergeCells(TOTAL_ROW + 2, 1, TOTAL_ROW + 2, COLS);
      const note = ws.getCell(TOTAL_ROW + 2, 1);
      note.value =
        `${sorted.length} transaction${sorted.length !== 1 ? 's' : ''} ` +
        `(${sorted.length - arcmCount} AR Invoice, ${arcmCount} ARCM) · ` +
        `ARCM = A/R Credit Memo, deducted from the total. Amounts in red are deductions or not counted.`;
      note.font = { name: FONT, size: 9, italic: true, color: { argb: C.muted } };

      // Filter dropdowns + print header
      ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: LAST_DATA, column: COLS } };
      ws.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;

      // ── Download ──
      const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '_');
      const fileName =
        `Transactions_${safe(modalCustomer?.customer || modalCustomer?.code)}` +
        `_${periodFrom || 'start'}_to_${periodTo || 'end'}.xlsx`;

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[VcpTransactionRecords] Excel export failed:', err);
      alert('Failed to export Excel file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getPageNums = () => {
    const total = totalPages, cur = safePage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)        return [1, 2, 3, 4, 5, '...', total];
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

  // ── Loading state ──────────────────────────────────────────────────────────
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

      {/* ── Section header: title, record count, From / To, Export ───────── */}
      <div className={`flex-shrink-0 px-5 py-3 border-b flex items-center justify-between gap-3 ${T.header}`}>
        <div className="min-w-0">
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>Transaction Records</h4>
          <p className={`text-[11px] mt-0.5 truncate ${T.ts}`}>
            {isWithQuota
              ? `Quota-based transactions · ${modalCustomer?.customer || 'customer'}`
              : modalCustomer?.rebateType === 'Fixed'
              ? 'SAP transactions — fixed rebate program'
              : modalCustomer?.rebateType === 'Percentage'
              ? 'SAP transactions — percentage rebate program'
              : 'SAP transactions — incremental rebate program'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Record count badge */}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}>
            {sorted.length} record{sorted.length !== 1 ? 's' : ''}
          </span>

          {/* From */}
          <div className="flex items-center gap-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>From</label>
            <input
              type="date"
              value={periodFrom || ''}
              onChange={(e) => { setPeriodFrom?.(e.target.value); setTransactionCurrentPage(1); }}
              className={`text-xs border rounded-md px-2 py-1 outline-none ${T.select}`}
            />
          </div>

          {/* To */}
          <div className="flex items-center gap-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>To</label>
            <input
              type="date"
              value={periodTo || ''}
              onChange={(e) => { setPeriodTo?.(e.target.value); setTransactionCurrentPage(1); }}
              className={`text-xs border rounded-md px-2 py-1 outline-none ${T.select}`}
            />
          </div>

          {/* Export to Excel */}
          <button
            onClick={exportToExcel}
            disabled={sorted.length === 0 || isExporting}
            title={sorted.length === 0 ? 'No transactions to export' : 'Export to Excel'}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-all ${
              sorted.length === 0 || isExporting
                ? isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                : isDark
                  ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <FileSpreadsheet size={14} />
            {isExporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {paginated.length > 0 ? (
          <table className="w-full text-xs table-fixed">
            <thead className={`sticky top-0 border-b ${T.thead}`}>
              <tr>
                <th className={`px-2 pl-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide ${isWithQuota ? 'w-[8%]' : 'w-[9%]'} ${T.ts}`}>
                  Type
                </th>
                <th className={`px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide ${isWithQuota ? 'w-[8%]' : 'w-[9%]'} ${T.ts}`}>
                  Doc No.
                </th>
                <th className={`px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide ${isWithQuota ? 'w-[9%]' : 'w-[10%]'} ${T.ts}`}>
                  Date
                </th>
                <th className={`px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide ${isWithQuota ? 'w-[20%]' : 'w-[27%]'} ${T.ts}`}>
                  Item
                </th>
                <th className={`px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide ${isWithQuota ? 'w-[8%]' : 'w-[10%]'} ${T.ts}`}>
                  {isWithQuota ? 'Act. Sales (Qty)' : 'Qty'}
                </th>

                <th className={`px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide ${isWithQuota ? 'w-[11%]' : 'w-[12%]'} ${T.ts}`}>
                  Peso Value
                </th>
                <th className={`px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide ${isWithQuota ? 'w-[10%]' : 'w-[11%]'} ${T.ts}`}>
                  {isPercentage ? 'Percentage' : 'Rebate / Unit'}
                </th>
                <th className={`px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide ${isWithQuota ? 'w-[12%]' : 'w-[12%]'} ${T.ts}`}>
                  Amount
                </th>
                {isWithQuota && (
                  <th className={`px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide w-[12%] ${T.ts}`}>
                    Eligibility
                  </th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${T.divider}`}>
              {paginated.map((t, i) => {
                const globalIdx   = (safePage - 1) * transactionRowsPerPage + i;
                const inv         = isInvoice(t);
                const arcm        = isReturnRow(t);
                const typeLabel   = getTypeLabel(t);
                const itemName    = t.Item || t.ItemName || '—';
                const itemCode    = t.ItemCode || t.ItemCodeSAP || '—';
                const item25      = is25kg(t);
                const displayName = item25 ? `${itemName} (25kg)` : itemName;

                const rowAmount   = getRowAmount(t, globalIdx);
                const counted     = isRowCounted(t, globalIdx);
                const dimmed      = isWithQuota ? !counted : t.QuotaMetThisMonth === false;
                const isDeduction = rowAmount < 0;

                return (
                  <tr
                    key={i}
                    className={`transition-colors duration-100 border-b ${T.row} ${
                      inv ? 'opacity-60 italic' : ''
                    } ${
                      dimmed ? 'opacity-60' : ''
                    } ${
                      arcm ? (isDark ? 'bg-rose-900/10' : 'bg-rose-50/50') : ''
                    }`}
                  >
                    {/* Type */}
                    <td className="px-2 pl-4 py-2.5 text-left">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${
                        arcm
                          ? isDark
                            ? 'bg-rose-900/30 text-rose-300 border-rose-700/40'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                          : isDark
                            ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {typeLabel}
                      </span>
                    </td>

                    {/* Doc No. */}
                    <td className="px-2 py-2.5 text-left">
                      <span
                        className={`font-mono text-[11px] tabular-nums whitespace-nowrap ${getDocNum(t) ? T.tp : T.tm}`}
                        title={getDocNum(t) || ''}
                      >
                        {getDocNum(t) || '—'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-2 py-2.5 text-left">
                      <span className={`font-medium tabular-nums whitespace-nowrap ${T.tp}`}>
                        {fmtDate(t.Date)}
                      </span>
                    </td>

                    {/* Item */}
                    <td className="px-2 py-2.5 text-left min-w-0">
                      <div
                        className={`font-medium ${T.tp}`}
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}
                        title={displayName}
                      >
                        {displayName}
                      </div>
                      <div className={`text-[10px] font-mono mt-0.5 truncate ${T.tm}`}>
                        {itemCode}
                      </div>
                    </td>

                    {/* Act. Sales / Qty */}
                    <td className="px-2 py-2.5 text-left">
                      <span className={`inline-block px-1.5 py-0.5 rounded border font-semibold tabular-nums ${
                        arcm
                          ? isDark
                            ? 'bg-rose-900/20 text-rose-300 border-rose-700/40'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                          : inv
                            ? isDark
                              ? 'bg-slate-800 text-slate-500 border-slate-700'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                            : isDark
                              ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {fmtNum(t.ActualSales)}
                      </span>
                    </td>

                    {/* P. Value */}
                    <td className="px-2 py-2.5 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded border font-semibold tabular-nums ${
                        arcm
                          ? isDark
                            ? 'bg-rose-900/20 text-rose-300 border-rose-700/40'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                          : isDark
                            ? 'bg-slate-800 text-slate-300 border-slate-700'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {fmtMoney(t.Gtotal)}
                      </span>
                    </td>

                    {/* Rebate per Unit / Percentage */}
                    <td className="px-2 py-2.5 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded border font-semibold tabular-nums ${
                        isDark
                          ? 'bg-purple-900/30 text-purple-300 border-purple-700/40'
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {getRateLabel(t)}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-2 py-2.5 text-right">
                      <span
                        title={
                          arcm && isDeduction
                            ? 'A/R Credit Memo — deducted from the total'
                            : arcm && dimmed
                            ? 'A/R Credit Memo — not counted (period not eligible)'
                            : dimmed && t.RawRebateAmount > 0
                            ? `Not eligible — would have been ₱${fmtMoney(t.RawRebateAmount)}`
                            : dimmed && isWithQuota
                            ? 'Not eligible yet — amount not counted'
                            : undefined
                        }
                        className={`inline-block px-1.5 py-0.5 rounded border font-bold tabular-nums cursor-help ${
                          dimmed || isDeduction
                            ? isDark
                              ? 'bg-rose-900/20 text-rose-300 border-rose-700/40'
                              : 'bg-rose-50 text-rose-600 border-rose-200'
                            : isDark
                              ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {fmtPeso(rowAmount)}
                      </span>
                    </td>

                    {/* Eligibility — only for quota-based programs */}
                    {isWithQuota && (() => {
                      const e = getEligibility(t, globalIdx, sorted);
                      const colorMap = {
                        emerald: isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        amber:   isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700/40'       : 'bg-amber-50 text-amber-700 border-amber-200',
                        rose:    isDark ? 'bg-rose-900/30 text-rose-300 border-rose-700/40'          : 'bg-rose-50 text-rose-700 border-rose-200',
                        slate:   isDark ? 'bg-slate-700 text-slate-400 border-slate-600'             : 'bg-slate-100 text-slate-500 border-slate-200',
                      };
                      return (
                        <td className="px-2 py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded border text-[10px] font-semibold leading-tight text-center ${colorMap[e.color]}`}>
                            {e.label}
                          </span>
                        </td>
                      );
                    })()}
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

      {/* ── Grand total bar ──────────────────────────────────────────────── */}
      {sorted.length > 0 && (
        <div className={`flex-shrink-0 flex items-center justify-end gap-2 px-5 py-2 border-t ${
          isDark ? 'border-slate-700/60 bg-slate-700/50' : 'border-slate-200 bg-slate-200'
        }`}>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${T.ts}`}>
            Total Amount :
          </span>
          <span className={`text-sm font-bold tabular-nums ${T.tp}`}>
            {fmtPeso(grandTotalAmount)}
          </span>
        </div>
      )}

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

export default VcpTransactionRecords;