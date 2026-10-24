// src/components/Dashboard/StatusSummary/customerLedgerUtils.js

/* ─── Apple system colour language ───────────────────────────────────────── */
export const APPLE = {
  blue: "#0A84FF", purple: "#BF5AF2", red: "#FF453A",
  orange: "#FF9F0A", green: "#32D74B", gray: "#8E8E93",
};
export const EXTRA = {
  teal:   "#5AC8FA",
  pink:   "#FF2D55",
  indigo: "#5E5CE6",
};

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
export const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const dashTokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"  : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  zebra:     isDark ? "rgba(255,255,255,0.02)"  : "rgba(0,0,0,0.015)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

export const DASH_FONT = `
  .dash-page, .dash-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .dash-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .dash-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.4); border-radius: 999px; }
  .dash-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes dash-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dash-pop { animation: dash-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
  .ledger-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
`;

/* ── Colour per document type ──────────────────────────────────────────
   AR / AP / JE   → green   (released / positive)
   ARCM / APCM    → red     (deduction / negative)
   SAP            → purple
   RELEASE/PAYOUT → blue
   anything else  → blue
   ─────────────────────────────────────────────────────────────────── */
export const colorForType = (type) => {
  const t = String(type || '').toUpperCase().trim();
  if (t.includes('RELEASE') || t.includes('PAYOUT')) return APPLE.blue;
  if (t === 'SAP')   return APPLE.purple;

  // Deductions — RED
  if (t === 'ARCM' || t === 'APCM') return APPLE.red;

  // Released / positives — GREEN
  if (t === 'AR' || t === 'AP' || t === 'JE') return APPLE.green;

  return APPLE.blue;
};

/* Extract {monthIndex, year} from a payout row using many fallbacks. */
export const extractPeriod = (p) => {
  const explicitMonth = parseInt(p.Month ?? p.MonthNo ?? p.MonthNumber ?? p.month ?? 0, 10);
  const explicitYear  = parseInt(p.Year ?? p.year ?? 0, 10);
  if (explicitMonth >= 1 && explicitMonth <= 12 && explicitYear > 1900) {
    return { monthIndex: explicitMonth - 1, year: explicitYear };
  }
  const dateStr = p.Date || p.PostingDate || p.DocDate || p.PayoutDate;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d)) return { monthIndex: d.getMonth(), year: d.getFullYear() };
  }
  const period = String(p.Period || '').trim();
  if (!period) return null;
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (period.includes(MONTH_NAMES[i])) {
      const ym = period.match(/\b(20\d{2})\b/);
      return { monthIndex: i, year: ym ? parseInt(ym[1], 10) : new Date().getFullYear() };
    }
  }
  for (let i = 0; i < MONTH_SHORT.length; i++) {
    const re = new RegExp(`\\b${MONTH_SHORT[i]}\\b`, 'i');
    if (re.test(period)) {
      const ym = period.match(/\b(20\d{2})\b/);
      return { monthIndex: i, year: ym ? parseInt(ym[1], 10) : new Date().getFullYear() };
    }
  }
  const iso = period.match(/\b(20\d{2})[-/](\d{1,2})\b/);
  if (iso) {
    const y = parseInt(iso[1], 10), m = parseInt(iso[2], 10);
    if (m >= 1 && m <= 12) return { monthIndex: m - 1, year: y };
  }
  const iso2 = period.match(/\b(\d{1,2})[-/](20\d{2})\b/);
  if (iso2) {
    const m = parseInt(iso2[1], 10), y = parseInt(iso2[2], 10);
    if (m >= 1 && m <= 12) return { monthIndex: m - 1, year: y };
  }
  const q = period.match(/\bQ([1-4])\s*(20\d{2})?\b/i);
  if (q) {
    const qi = parseInt(q[1], 10) - 1;
    const y = q[2] ? parseInt(q[2], 10) : new Date().getFullYear();
    return { monthIndex: qi * 3 + 2, year: y };
  }
  const y = period.match(/\b(20\d{2})\b/);
  if (y) return { monthIndex: null, year: parseInt(y[1], 10) };
  return null;
};

export const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return `₱${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export const formatDisplayDate = (d) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  } catch { return d; }
};

export const processPayoutData = (payouts) =>
  payouts.map(payout => {
    const baseAmount   = parseFloat(payout.BaseAmount) || 0;
    const totalAmount  = parseFloat(payout.TotalAmount) || parseFloat(payout.Amount) || 0;
    const amountReleased = parseFloat(payout.AmountReleased) || 0;
    const calculatedBalance = Math.max(0, totalAmount - amountReleased);
    const isBeginningBalance =
      payout.IsBeginningBalance === 1 || payout.isBeginningBalance === true ||
      (payout.Period && payout.Period.startsWith('Balance of '));
    return {
      ...payout,
      Id: payout.Id || payout.PayoutId,
      BaseAmount: baseAmount,
      TotalAmount: totalAmount,
      Amount: totalAmount,
      AmountReleased: amountReleased,
      Balance: calculatedBalance,
      PreviousBalance: 0,
      isBeginningBalance,
      IsBeginningBalance: payout.IsBeginningBalance || (isBeginningBalance ? 1 : 0),
      isQtrRebate: payout.Period?.includes('Quarter') || false,
    };
  });