// src/components/Dashboard/StatusSummary/CustomerLedgerModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wallet,
} from "lucide-react";
import {
  APPLE, MONTH_NAMES,
  dashTokens, DASH_FONT,
  colorForType, extractPeriod,
  formatCurrency, formatDisplayDate,
  processPayoutData,
} from "./customerLedgerUtils";

/* ── Last day of a given month, rendered as MM/DD/YYYY ──────────────── */
const lastDayOfMonthLabel = (year, monthIndex) => {
  const y = parseInt(year, 10) || new Date().getFullYear();
  const lastDay = new Date(y, monthIndex + 1, 0).getDate();
  return `${String(monthIndex + 1).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${y}`;
};

/* ── Round a number to 2 decimal places (avoids FP drift on currency) ── */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ── Pull a document number out of a payout row (any known key) ────── */
const pickDocNum = (source) => {
  if (!source) return "";
  const candidate =
    source.DocumentNumber ??
    source.DocumentNo ??
    source.DocumentNum ??
    source.DocNumber ??
    source.DocNum ??
    source.DocNo ??
    source.documentNumber ??
    source.documentNo ??
    source.documentNum ??
    source.docNumber ??
    source.docNum ??
    source.docNo ??
    source.Document_Number ??
    source.DOC_NUM ??
    "";
  return String(candidate).trim();
};

/* ── Parse "MM.DD.YY" / "MM.DD.YYYY" / ISO into a timestamp ──────────── */
const parseRedemptionDate = (v) => {
  if (!v) return 0;
  const s = String(v).trim();
  const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m1) {
    const mm = parseInt(m1[1], 10);
    const dd = parseInt(m1[2], 10);
    let yy = parseInt(m1[3], 10);
    if (yy < 100) yy += 2000;
    return new Date(yy, mm - 1, dd).getTime();
  }
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
};

/* ── Resolve the display/filter year for a payout row ─────────────────
   Redemption/deduction docs (ARCM, APCM, AR, AP, JE) must be classified
   by their real document date, not by the Period string. Otherwise an
   ARCM dated 10/09/2026 can get filtered out while viewing 2026.       */
const getPayoutRowYear = (p) => {
  if (!p) return undefined;

  if (p.DocumentType) {
    const candidates = [p.Date, p.PayoutDate, p.DocDate, p.PostingDate];
    for (const c of candidates) {
      if (!c) continue;
      const t = parseRedemptionDate(c);
      if (t) return new Date(t).getFullYear();
    }
    // Last resort: parse the Period string itself
    const periodT = parseRedemptionDate(p.Period);
    if (periodT) return new Date(periodT).getFullYear();
  }

  const parsed = extractPeriod(p);
  return parsed?.year;
};

/**
 * Customer ledger modal — aggregated across every rebate code the customer owns.
 *
 * Year behaviour:
 *  - The default year is the CURRENT year (e.g. 2026).
 *  - Monthly earned + redemptions shown are ONLY those in the selected year.
 *  - Beginning Balance = net of all rows BEFORE the selected year
 *    (earned − released). For the current year, the server value wins.
 *  - The Year field is a free-text input: the user types any 4-digit year
 *    (e.g. 2023) and it commits on valid input, Enter, or blur. Suggestions
 *    from availableYears are offered via a <datalist>, but any year works.
 *
 * Deduction-year rule:
 *  - Earned rows are bucketed by their Period (the rebate period they belong to).
 *  - Redemption/deduction rows (ARCM, APCM, AR, AP, JE) are bucketed by the
 *    actual document date. So an ARCM posted 10/09/2026 will only appear when
 *    viewing 2026, and disappears when viewing 2025 — even if its Period
 *    string still references an older quarter.
 */
const CustomerLedgerModal = ({
  customer,
  db,
  apiBase,
  theme = "light",
  detailsUseRebatePeriod = false,
  onClose,
  onViewTransactions,
}) => {
  const K = dashTokens(theme === "dark");
  const dbSlug = String(db || "").toLowerCase();
  const currentYear = new Date().getFullYear();

  const customerCode       = customer?.code || customer?.customerCode;
  const customerName       = customer?.customer || "Unknown Customer";
  const customerAgent      = customer?.agent || null;
  const fallbackRebateCode = customer?.rebateCode || customer?.rows?.[0]?.rebateCode || null;
  const fallbackRebateType = customer?.rebateType || customer?.rows?.[0]?.rebateType || null;

  const [loading, setLoading]                       = useState(true);
  const [allPayouts, setAllPayouts]                 = useState([]);
  const [previousBalance, setPreviousBalance]       = useState(0);
  const [rebateCodesFetched, setRebateCodesFetched] = useState([]);
  const [rightCardPage, setRightCardPage]           = useState(1);
  const [rightCardRowsPerPage, setRightCardRowsPerPage] = useState(10);

  /* ── Selected year (defaults to current year) ─────────────────────── */
  const [selectedYear, setSelectedYear] = useState(currentYear);

  /* ── Free-text mirror of the year, so the user can type freely ────── */
  const [yearInput, setYearInput] = useState(String(currentYear));

  /* Keep the text input in sync whenever selectedYear changes
     (e.g. reset to currentYear on refetch, or committed from another source) */
  useEffect(() => {
    setYearInput(String(selectedYear));
  }, [selectedYear]);

  /* Commit a typed year value (used by onChange / onBlur / Enter) */
  const commitYear = (raw) => {
    const n = Number(raw);
    if (String(raw).length === 4 && Number.isFinite(n) && n >= 1900 && n <= 9999) {
      if (n !== selectedYear) {
        setSelectedYear(n);
        setRightCardPage(1);
      }
      return true;
    }
    return false;
  };

  /* ── Fetch every rebate code's payouts ──────────────────────────────── */
  useEffect(() => {
    if (!customerCode) { setLoading(false); return; }
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setAllPayouts([]);
      setRebateCodesFetched([]);
      setPreviousBalance(0);
      setRightCardPage(1);
      setSelectedYear(currentYear);

      try {
        /* 1. Details (non-fatal) */
        const detailParams = new URLSearchParams({
          rebateCode: fallbackRebateCode || '',
          rebateType: fallbackRebateType || '',
        });
        if (detailsUseRebatePeriod) {
          detailParams.append('useRebatePeriod', 'true');
        } else {
          detailParams.append('useRebatePeriod', 'false');
          detailParams.append('allPeriods', 'true');
        }
        try {
          await fetch(
            `${apiBase}/api/${dbSlug}/dashboard/customer/${customerCode}/details` +
            `?db=${db}&${detailParams.toString()}`
          );
        } catch { /* non-fatal */ }

        /* 2. Payout-summary → every rebate code this customer owns */
        const rebateCodesToFetch = [];
        try {
          const sRes = await fetch(
            `${apiBase}/api/${dbSlug}/payouts/customer/${customerCode}/payout-summary?db=${db}`
          );
          const sJson = await sRes.json();
          if (sJson.success && sJson.data?.byRebateCode) {
            sJson.data.byRebateCode.forEach(r => {
              if (r.rebateCode) {
                rebateCodesToFetch.push({
                  code: r.rebateCode,
                  type: (r.rebateTypes && r.rebateTypes[0]) || 'Unknown',
                });
              }
            });
          }
        } catch { /* fall through */ }

        if (fallbackRebateCode && !rebateCodesToFetch.some(r => r.code === fallbackRebateCode)) {
          rebateCodesToFetch.push({
            code: fallbackRebateCode,
            type: fallbackRebateType || 'Unknown',
          });
        }

        /* 3. Fetch payouts per rebate code in parallel */
        const seen = new Set();
        const results = await Promise.all(rebateCodesToFetch.map(async (rb) => {
          if (seen.has(rb.code)) return null;
          seen.add(rb.code);
          try {
            const url =
              `${apiBase}/api/${dbSlug}/payouts/customer/${customerCode}/payouts` +
              `?db=${db}` +
              `&rebateCode=${encodeURIComponent(rb.code)}` +
              `&rebateType=${encodeURIComponent(rb.type)}` +
              `&useRebatePeriod=true`;
            const res  = await fetch(url);
            const json = await res.json();
            if (json.success) {
              return {
                rebateCode: rb.code,
                rebateType: rb.type,
                rows: json.data.payouts || [],
                monthlyRaw: json.data.monthlyRaw || [],
                previousBalance: parseFloat(json.data.previousBalance) || 0,
              };
            }
          } catch { /* skip */ }
          return null;
        }));

        const merged = [];
        let bestPrev = 0;
        results.filter(Boolean).forEach(r => {
          const rawMap = new Map(r.monthlyRaw.map(x => [x.period, x.rawAmount]));
          r.rows.forEach(row => merged.push({
            ...row,
            _rebateCode: r.rebateCode,
            _rebateType: r.rebateType,
            _rawBase: !row.DocumentType && rawMap.has(row.Period) ? rawMap.get(row.Period) : undefined,
          }));
          if (r.previousBalance > bestPrev) bestPrev = r.previousBalance;
        });

        if (cancelled) return;
        setAllPayouts(processPayoutData(merged));
        setPreviousBalance(bestPrev);
        setRebateCodesFetched(rebateCodesToFetch.map(r => r.code));
      } catch (e) {
        console.error('[CustomerLedgerModal] load failed:', e);
        if (!cancelled) setAllPayouts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [
    customerCode, fallbackRebateCode, fallbackRebateType,
    db, dbSlug, apiBase, detailsUseRebatePeriod, currentYear,
  ]);

  /* ── Available years — used only as <datalist> suggestions ─────────────
     Derived dynamically from the data (earliest → latest present), plus the
     current year, with every year in between filled in so there are no gaps.
     The user is NOT restricted to these — any typed year is accepted. */
  const availableYears = useMemo(() => {
    const years = new Set();
    years.add(currentYear);

    allPayouts.forEach((p) => {
      const y = getPayoutRowYear(p);
      if (Number.isFinite(y)) years.add(y);
    });

    const numeric = Array.from(years).filter((y) => Number.isFinite(y));
    const minYear = numeric.length ? Math.min(...numeric) : currentYear;
    const maxYear = numeric.length ? Math.max(...numeric) : currentYear;

    for (let y = minYear; y <= maxYear; y++) years.add(y);

    return Array.from(years).sort((a, b) => b - a); // newest first
  }, [allPayouts, currentYear]);

  /* ── Rows belonging to the selected year ─────────────────────────────
     Earned rows    → year comes from Period.
     Deduction rows → year comes from the actual doc date (10/09/2026 → 2026). */
  const yearFilteredPayouts = useMemo(() => {
    return allPayouts.filter(p => getPayoutRowYear(p) === selectedYear);
  }, [allPayouts, selectedYear]);

  /* ── Beginning balance ─────────────────────────────────────────────── */
  /* For the current year → trust the server's computed previousBalance.
     For any other year → compute from the payouts we have (years < selectedYear). */
  const beginningBalanceAmount = useMemo(() => {
    if (selectedYear === currentYear && previousBalance > 0) return previousBalance;

    let earned = 0;
    let released = 0;
    allPayouts.forEach(p => {
      const y = getPayoutRowYear(p);
      if (!y || y >= selectedYear) return;
      if (p.DocumentType) {
        released += parseFloat(p.AmountReleased) || 0;
      } else if (!p.isBeginningBalance && !(p.Period || '').startsWith('Balance of ')) {
        earned += parseFloat(p.BaseAmount) || 0;
      }
    });
    return earned - released;
  }, [allPayouts, selectedYear, currentYear, previousBalance]);

  /* ── Beginning-balance date: last day of the PREVIOUS year ───────────── */
  const beginningBalanceDate = useMemo(
    () => lastDayOfMonthLabel(selectedYear - 1, 11),
    [selectedYear]
  );

  /* ── Monthly earned breakdown (LEFT card) — selected year only ─────── */
  const monthlyBreakdown = useMemo(() => {
    const months = MONTH_NAMES.map((name, idx) => ({
      name,
      index: idx,
      year: selectedYear,
      earned: 0,
    }));

    yearFilteredPayouts.forEach(p => {
      if (p.DocumentType) return;
      if (p.IsBeginningBalance === 1 || p.isBeginningBalance === true) return;
      if ((p.Period || '').startsWith('Balance of ')) return;
      if (p.isQtrRebate) return;

      const parsed = extractPeriod(p);
      const amt = parseFloat(p.BaseAmount) || 0;

      if (parsed?.monthIndex != null && parsed.monthIndex >= 0 && parsed.monthIndex < 12) {
        months[parsed.monthIndex].earned += amt;
      }
    });

    return months;
  }, [yearFilteredPayouts, selectedYear]);

  const totalEarned = useMemo(() => {
    return yearFilteredPayouts.reduce((s, p) => {
      if (p.DocumentType) return s;
      if (p.IsBeginningBalance === 1 || p.isBeginningBalance === true) return s;
      if ((p.Period || '').startsWith('Balance of ')) return s;
      return s + (p._rawBase ?? (parseFloat(p.BaseAmount) || 0));
    }, 0);
  }, [yearFilteredPayouts]);

  const totalReleased = useMemo(() => {
    return yearFilteredPayouts.reduce((s, p) => {
      if (!p.DocumentType) return s;
      if (p.IsBeginningBalance === 1 || p.isBeginningBalance === true) return s;
      if ((p.Period || '').startsWith('Balance of ')) return s;
      return s + Math.abs(parseFloat(p.AmountReleased) || 0);
    }, 0);
  }, [yearFilteredPayouts]);

  // Total Amount (left-card footer) = beginning balance + earned for the SELECTED year
  const grandTotalEarned = round2(totalEarned + beginningBalanceAmount);

  // ── Header Balance ──────────────────────────────────────────────────
  // Mirrors:  SELECT SUM(BaseAmount) - SUM(AmountReleased)
  //           FROM PayoutHistory
  //           WHERE CardCode = 'C0007'          -- selected customer
  //
  // We aggregate over ALL rows (every rebate code) that the payouts
  // endpoint returned for this customer — BUT we cap the view at the
  // selected year:
  //   • Rows from a FUTURE year (year > selectedYear) are skipped, so
  //     selecting 2025 no longer pulls in 2026 activity.
  //   • Rows from PAST years + the selected year are included, which
  //     preserves the carry-over: the 2025 balance still appears when
  //     viewing 2026.
  // Beginning-balance and "Balance of …" rows are excluded because the
  // endpoint already returns them outside the `payouts` array.
  const balance = useMemo(() => {
    return allPayouts.reduce((sum, p) => {
      if (p.IsBeginningBalance === 1 || p.isBeginningBalance === true) return sum;
      if ((p.Period || '').startsWith('Balance of '))       return sum;
      if ((p.Period || '').startsWith('Beginning Balance')) return sum;

      const rowYear = getPayoutRowYear(p);
      if (rowYear != null && rowYear > selectedYear) return sum;   // ← the fix

      const base     = parseFloat(p.BaseAmount)     || 0;
      const released = parseFloat(p.AmountReleased) || 0;   // signed: ARCM/APCM already negative
      return sum + base - released;
    }, 0);
  }, [allPayouts, selectedYear]);

  /* ── RIGHT card: redemption rows (selected year only) ──────────────── */
  const transactionRows = useMemo(() => {
    const rows = [];

    const pushDoc = (uid, source, rawType, rawAmount, dateOverride) => {
      const raw = parseFloat(rawAmount) || 0;
      if (!raw) return;

      const type = String(rawType || '').toUpperCase().trim();
      if (!type || type === 'AMOUNT' || type === 'TOTAL') return;

      // ARCM / APCM = deduction → force negative
      // AR / AP / JE = released    → keep positive
      const isDeduction = type === 'ARCM' || type === 'APCM';
      const amt = isDeduction ? -Math.abs(raw) : Math.abs(raw);

      rows.push({
        id: `${type}-${uid}-${rows.length}`,
        date: dateOverride || source.Date || source.PostingDate || source.DocDate || '',
        period: source.Period || '',
        rebateCode: source._rebateCode || '',
        docNum: pickDocNum(source),
        type,
        amount: amt,
        color: colorForType(type),
      });
    };

    yearFilteredPayouts.forEach((p, idx) => {
      if (p.IsBeginningBalance === 1 || p.isBeginningBalance === true) return;
      if ((p.Period || '').startsWith('Balance of ')) return;

      if (p.DocumentType) {
        const raw = parseFloat(p.AmountReleased) || 0;
        pushDoc(
          idx,
          p,
          p.DocumentType,
          Math.abs(raw),
          // Prefer the actual document date so the rendered date
          // matches the year bucket it was placed in.
          p.Date || p.PayoutDate || p.DocDate || p.PostingDate || p.Period,
        );
      }
    });

    // Newest first
    return rows.sort((a, b) => {
      const ta = parseRedemptionDate(a.date) || parseRedemptionDate(a.period);
      const tb = parseRedemptionDate(b.date) || parseRedemptionDate(b.period);
      if (tb !== ta) return tb - ta;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [yearFilteredPayouts]);

  const transactionRowsTotal = useMemo(
    () => transactionRows.reduce((s, r) => s + r.amount, 0),
    [transactionRows]
  );

  /* ── Right card pagination ──────────────────────────────────────────── */
  const totalRightPages = Math.max(1, Math.ceil(transactionRows.length / rightCardRowsPerPage));
  const safeRightPage = Math.min(rightCardPage, totalRightPages);
  const paginatedTransactionRows = transactionRows.slice(
    (safeRightPage - 1) * rightCardRowsPerPage,
    safeRightPage * rightCardRowsPerPage
  );

  const getRightPageNums = () => {
    const total = totalRightPages, cur = safeRightPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)         return [1, 2, 3, 4, 5, '...', total];
    if (cur >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', cur - 1, cur, cur + 1, '...', total];
  };

  const PaginationBtn = ({ icon: Icon, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded flex items-center justify-center transition-all"
      style={{ color: disabled ? K.faint : K.muted, cursor: disabled ? 'not-allowed' : 'pointer' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = K.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={14} />
    </button>
  );

  const showSkeleton = loading && allPayouts.length === 0;

  /* ── Click handler for the "Transactions" left-card title ───────────── */
  const handleViewTransactionsClick = () => {
    if (!onViewTransactions) return;
    onViewTransactions({
      customer,
      customerCode,
      customerName,
      customerAgent,
      rebateCodes: rebateCodesFetched,
      fallbackRebateCode,
      fallbackRebateType,
      db,
    });
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="dash-page fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: theme === 'dark' ? "rgba(10,10,14,0.65)" : "rgba(0,0,0,0.4)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      onClick={onClose}
    >
      <style>{DASH_FONT}</style>

      <div
        className="dash-glass dash-pop flex flex-col rounded-[28px] border w-[88%] max-w-[1400px] h-[92vh] overflow-hidden relative"
        style={{ background: K.glassDeep, borderColor: K.rim, boxShadow: K.shadow }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all"
          style={{ background: K.chipBg, color: K.muted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
        >
          <X size={16} />
        </button>

        {/* Header — customer + year on the left, Balance on the upper-right */}
        <div
          className="flex-shrink-0 px-7 py-5 border-b flex items-center justify-between gap-6"
          style={{
            borderColor: K.hairline,
            background: `linear-gradient(135deg, ${APPLE.blue}0a 0%, ${APPLE.purple}0a 100%)`,
          }}
        >
          {/* LEFT: identity + year selector */}
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg font-bold text-white"
              style={{
                background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                boxShadow: `0 8px 20px -6px ${APPLE.blue}aa`,
              }}
            >
              {(customerName || "?").charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: K.muted }}>
                Customer Rebate Earned
              </p>
              <h1
                className="text-xl font-bold leading-tight truncate"
                style={{ color: K.ink, letterSpacing: '-0.02em' }}
                title={customerName}
              >
                {customerName}
              </h1>
              <p className="text-[11px] font-mono mt-0.5" style={{ color: K.muted }}>
                {customerCode}
                {customerAgent && customerAgent !== 'Unknown Agent' && (
                  <span style={{ color: K.faint }}> · {customerAgent}</span>
                )}
                {rebateCodesFetched?.length > 1 && (
                  <span style={{ color: K.faint }}> · {rebateCodesFetched.length} rebate programs</span>
                )}
              </p>
            </div>

            {/* Year input — sits next to the identity block */}
            <div
              className="flex flex-col items-start ml-2 pl-4 flex-shrink-0 self-center"
              style={{ borderLeft: `1px solid ${K.hairline}` }}
            >
              <label
                htmlFor="ledger-year-input"
                className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                style={{ color: K.muted }}
              >
                Year
              </label>
              <input
                id="ledger-year-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                list="ledger-year-suggestions"
                autoComplete="off"
                value={yearInput}
                onChange={(e) => {
                  // digits only, up to 4 chars
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setYearInput(raw);
                  // commit live as soon as it's a valid 4-digit year
                  if (raw.length === 4) commitYear(raw);
                }}
                onBlur={() => {
                  // if invalid/empty, revert the text to the committed year
                  if (!commitYear(yearInput)) {
                    setYearInput(String(selectedYear));
                  } else {
                    // normalize text to the committed value
                    setYearInput(String(Number(yearInput)));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitYear(yearInput);
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setYearInput(String(selectedYear));
                    e.currentTarget.blur();
                  }
                }}
                className="text-[11px] font-mono rounded-md px-2 py-0.5 outline-none w-[68px] text-center"
                style={{
                  background: K.chipBg,
                  border: `1px solid ${K.hairline}`,
                  color: K.ink,
                }}
                placeholder={String(currentYear)}
                title="Type a year (e.g. 2023)"
              />
              <datalist id="ledger-year-suggestions">
                {availableYears.map((y) => (
                  <option key={y} value={y} />
                ))}
              </datalist>
            </div>
          </div>

          {/* RIGHT: Balance only */}
          <div className="flex items-center gap-3 flex-shrink-0 pr-10">
            <span
              className="text-[15px] font-extrabold uppercase tracking-[0.18em]"
              style={{ color: K.muted }}
            >
              Balance:
            </span>
            {showSkeleton ? (
              <div
                className="h-8 w-40 rounded-md animate-pulse"
                style={{ background: K.chipBg }}
              />
            ) : (
              <span
                className="text-3xl font-bold ledger-num leading-none"
                style={{
                  color: K.ink,
                  letterSpacing: '-0.02em',
                }}
              >
                {balance < 0
                  ? `-${formatCurrency(Math.abs(balance))}`
                  : formatCurrency(balance)}
              </span>
            )}
          </div>
        </div>

        {/* Body — two equal cards */}
        <div className="flex-1 min-h-0 flex gap-3 p-3 overflow-hidden" style={{ background: K.bg }}>

          {/* LEFT CARD — Transactions (monthly) */}
          <div
            className="flex flex-col flex-1 min-w-0 rounded-2xl border overflow-hidden"
            style={{ background: K.glassDeep, borderColor: K.hairline }}
          >
            <div
              className="flex-shrink-0 px-5 py-3 border-b flex items-center justify-between"
              style={{ borderColor: K.hairline }}
            >
              <button
                type="button"
                disabled={!onViewTransactions}
                onClick={handleViewTransactionsClick}
                className="text-left group flex items-center gap-1.5 rounded-md -mx-1.5 px-1.5 py-0.5 transition-colors"
                style={{ cursor: onViewTransactions ? 'pointer' : 'default', background: 'transparent' }}
                onMouseEnter={(e) => {
                  if (onViewTransactions) e.currentTarget.style.background = K.hover;
                }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                title={onViewTransactions ? 'View transaction records' : undefined}
              >
                <div>
                  <h4
                    className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5"
                    style={{ color: K.ink }}
                  >
                    Transactions
                    {onViewTransactions && (
                      <ChevronRight
                        size={12}
                        style={{ color: K.muted }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                  </h4>
                  <p className="text-[11px] mt-0.5" style={{ color: K.muted }}>
                    {selectedYear} · rebate earned per month
                  </p>
                </div>
              </button>

              <div className="text-right">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: K.muted }}
                >
                  Total Amount
                </p>
                {showSkeleton ? (
                  <div
                    className="h-5 w-24 rounded ml-auto mt-0.5 animate-pulse"
                    style={{ background: K.chipBg }}
                  />
                ) : (
                  <p className="text-base font-bold ledger-num" style={{ color: K.ink }}>
                    {grandTotalEarned < 0
                      ? `-${formatCurrency(Math.abs(grandTotalEarned))}`
                      : formatCurrency(grandTotalEarned)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto dash-scroll">
              {showSkeleton ? (
                <div className="animate-pulse">
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                      style={{ borderBottom: `1px solid ${K.hairline}` }}
                    >
                      <div className="h-3 w-24 rounded" style={{ background: K.chipBg }} />
                      <div className="h-3 w-20 rounded" style={{ background: K.chipBg }} />
                    </div>
                  ))}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10" style={{ background: K.glassDeep }}>
                    <tr style={{ borderBottom: `1px solid ${K.hairline}` }}>
                      <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: K.muted }}>
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: K.muted }}>
                        Period
                      </th>
                      <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: K.muted }}>
                        Earned
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {beginningBalanceAmount > 0 && (
                      <tr style={{ borderBottom: `1px solid ${K.hairline}`, background: `${APPLE.green}0d` }}>
                        <td
                          className="px-5 py-2 font-medium ledger-num whitespace-nowrap"
                          style={{ color: K.faint }}
                          title={`Carried forward from ${selectedYear - 1}`}
                        >
                          {beginningBalanceDate}
                        </td>
                        <td className="px-4 py-2 font-bold" style={{ color: APPLE.green }}>
                          Beginning Balance
                        </td>
                        <td className="px-5 py-2 text-right font-bold ledger-num" style={{ color: APPLE.green }}>
                          {formatCurrency(beginningBalanceAmount)}
                        </td>
                      </tr>
                    )}
                    {monthlyBreakdown.map((m, i) => (
                      <tr
                        key={m.name}
                        style={{
                          borderBottom: `1px solid ${K.hairline}`,
                          background: i % 2 === 0 ? 'transparent' : K.zebra,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = K.hover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : K.zebra; }}
                      >
                        <td
                          className="px-5 py-2 font-medium ledger-num whitespace-nowrap"
                          style={{ color: m.earned > 0 ? K.ink : K.faint }}
                        >
                          {lastDayOfMonthLabel(selectedYear, m.index)}
                        </td>
                        <td className="px-4 py-2 font-medium" style={{ color: K.ink }}>{m.name}</td>
                        <td
                          className="px-5 py-2 text-right ledger-num"
                          style={{
                            color: m.earned > 0 ? K.ink : K.faint,
                            fontWeight: m.earned > 0 ? 600 : 400,
                          }}
                        >
                          {m.earned > 0 ? formatCurrency(m.earned) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT CARD — Redemptions */}
          <div
            className="flex flex-col flex-1 min-w-0 rounded-2xl border overflow-hidden"
            style={{ background: K.glassDeep, borderColor: K.hairline }}
          >
            <div
              className="flex-shrink-0 px-5 py-3 border-b flex items-center justify-between"
              style={{ borderColor: K.hairline }}
            >
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: K.ink }}>
                  Redemptions
                </h4>
                <p className="text-[11px] mt-0.5" style={{ color: K.muted }}>
                  {selectedYear} · released payouts
                </p>
              </div>
              <div className="text-right">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: K.muted }}
                >
                  Total Amount
                </p>
                {showSkeleton ? (
                  <div
                    className="h-5 w-24 rounded ml-auto mt-0.5 animate-pulse"
                    style={{ background: K.chipBg }}
                  />
                ) : (
                  <p
                    className="text-base font-bold ledger-num"
                    style={{ color: transactionRowsTotal < 0 ? APPLE.red : K.ink }}
                  >
                    {transactionRowsTotal < 0
                      ? `-${formatCurrency(Math.abs(transactionRowsTotal))}`
                      : formatCurrency(transactionRowsTotal)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto dash-scroll">
              {showSkeleton ? (
                <div className="animate-pulse">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-5 py-3"
                      style={{ borderBottom: `1px solid ${K.hairline}` }}
                    >
                      <div className="h-3 w-24 rounded" style={{ background: K.chipBg }} />
                      <div className="h-4 w-16 rounded" style={{ background: K.chipBg }} />
                      <div className="h-3 w-20 rounded" style={{ background: K.chipBg }} />
                      <div className="h-3 w-20 rounded ml-auto" style={{ background: K.chipBg }} />
                    </div>
                  ))}
                </div>
              ) : transactionRows.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10" style={{ background: K.glassDeep }}>
                    <tr style={{ borderBottom: `1px solid ${K.hairline}` }}>
                      <th className="px-5 py-2 text-left  text-[10px] font-bold uppercase tracking-widest" style={{ color: K.muted }}>Date</th>
                      <th className="px-4 py-2 text-left  text-[10px] font-bold uppercase tracking-widest" style={{ color: K.muted }}>DocNum</th>
                      <th className="px-4 py-2 text-left  text-[10px] font-bold uppercase tracking-widest" style={{ color: K.muted }}>Type</th>
                      <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: K.muted }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactionRows.map((t, i) => (
                      <tr
                        key={t.id}
                        style={{
                          borderBottom: `1px solid ${K.hairline}`,
                          background: i % 2 === 0 ? 'transparent' : K.zebra,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = K.hover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : K.zebra; }}
                      >
                        <td className="px-5 py-2 font-medium ledger-num whitespace-nowrap" style={{ color: K.ink }}>
                          {formatDisplayDate(t.date || t.period)}
                        </td>
                        <td
                          className="px-4 py-2 font-mono text-[11px] whitespace-nowrap"
                          style={{ color: t.docNum ? K.ink : K.faint }}
                          title={t.docNum || ''}
                        >
                          {t.docNum || '—'}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className="inline-block px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap tracking-wide"
                            style={{ background: `${t.color}1a`, borderColor: `${t.color}55`, color: t.color }}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td
                          className="px-5 py-2 text-right font-semibold ledger-num"
                          style={{ color: t.amount < 0 ? APPLE.red : K.ink }}
                        >
                          {t.amount < 0
                            ? `-${formatCurrency(Math.abs(t.amount))}`
                            : formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center py-10 px-4">
                  <div className="text-center max-w-md">
                    <div
                      className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4"
                      style={{ background: K.chipBg }}
                    >
                      <Wallet size={22} style={{ color: K.faint }} />
                    </div>
                    <h3 className="text-sm font-bold mb-1" style={{ color: K.ink }}>No Redemptions</h3>
                    <p className="text-xs" style={{ color: K.muted }}>
                      No redemption entries found for {selectedYear}.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Pagination footer */}
            {!showSkeleton && transactionRows.length > 0 && (
              <div
                className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-t"
                style={{ borderColor: K.hairline }}
              >
                <div className="flex items-center gap-3">
                  <p className="text-[11px]" style={{ color: K.muted }}>
                    Showing{' '}
                    <span className="font-semibold ledger-num" style={{ color: K.ink }}>
                      {(safeRightPage - 1) * rightCardRowsPerPage + 1}–{Math.min(safeRightPage * rightCardRowsPerPage, transactionRows.length)}
                    </span>{' '}
                    of <span className="font-semibold ledger-num" style={{ color: K.ink }}>{transactionRows.length}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: K.muted }}>Per page</span>
                    <select
                      value={rightCardRowsPerPage}
                      onChange={(e) => { setRightCardRowsPerPage(Number(e.target.value)); setRightCardPage(1); }}
                      className="text-xs border rounded-md px-1.5 py-0.5 outline-none"
                      style={{ background: K.chipBg, borderColor: K.hairline, color: K.ink }}
                    >
                      {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <PaginationBtn icon={ChevronsLeft}  onClick={() => setRightCardPage(1)}                                     disabled={safeRightPage === 1} />
                  <PaginationBtn icon={ChevronLeft}   onClick={() => setRightCardPage(p => Math.max(p - 1, 1))}             disabled={safeRightPage === 1} />
                  {getRightPageNums().map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} className="w-7 text-center text-xs" style={{ color: K.faint }}>…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setRightCardPage(p)}
                        className="w-7 h-7 rounded text-xs font-medium transition-all ledger-num"
                        style={{
                          background: safeRightPage === p ? APPLE.blue : 'transparent',
                          color: safeRightPage === p ? '#FFFFFF' : K.muted,
                          boxShadow: safeRightPage === p ? `0 4px 12px -4px ${APPLE.blue}88` : 'none',
                        }}
                        onMouseEnter={(e) => { if (safeRightPage !== p) e.currentTarget.style.background = K.hover; }}
                        onMouseLeave={(e) => { if (safeRightPage !== p) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <PaginationBtn icon={ChevronRight}  onClick={() => setRightCardPage(p => Math.min(p + 1, totalRightPages))} disabled={safeRightPage === totalRightPages} />
                  <PaginationBtn icon={ChevronsRight} onClick={() => setRightCardPage(totalRightPages)}                       disabled={safeRightPage === totalRightPages} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerLedgerModal;