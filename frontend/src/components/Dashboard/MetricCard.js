// src/components/MetricCard.jsx
import React from 'react';
import { RedoDot, ArrowRight } from 'lucide-react';

/* ─── Apple system colour language ───────────────────────────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const tokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.85)"  : "rgba(255,255,255,0.9)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const EPS = 0.005;

const MetricCard = ({
  title,
  value,
  subtitle = "Cumulative total",
  icon: Icon,
  variant = "emerald",
  isCurrency = false,
  className = "",
  theme = "light",
  noDecimals = false,
  onClick,                 // ← NEW: makes the card interactive
  clickHint = "View",      // ← NEW: label next to the arrow
}) => {
  const isDark = theme === 'dark';
  const K = tokens(isDark);
  const clickable = typeof onClick === 'function';

  const VARIANT_ACCENT = {
    emerald: APPLE.green,
    blue:    APPLE.blue,
    amber:   APPLE.orange,
    purple:  APPLE.purple,
    red:     APPLE.red,
    gray:    APPLE.gray,
  };
  const accent = VARIANT_ACCENT[variant] || VARIANT_ACCENT.emerald;

  const formatNumber = (num) => {
    if (typeof num !== 'number') {
      if (typeof num === 'string' && num.trim() !== '') {
        const s = num.trim();
        const isParen = /^\(.*\)$/.test(s);
        const startsMinus = /^-/.test(s);
        const hasCurrencySymbol = s.includes('₱');
        const body = s.replace(/^\(+/, '').replace(/\)+$/, '').trim();
        const numeric = parseFloat(body.replace(/[₱,\s]/g, ''));
        const isNegative =
          isParen || startsMinus ||
          (Number.isFinite(numeric) && numeric < -EPS);
        const display = body.replace(/^-/, '').trim();
        return { display, suffix: '', hasCurrencySymbol, isNegative };
      }
      return { display: num ?? '0', suffix: '', hasCurrencySymbol: false, isNegative: false };
    }
    const isNegative = num < -EPS;
    const abs = Math.abs(num);
    let display, suffix = '', hasCurrencySymbol = false;
    if (isCurrency) {
      display = `₱${abs.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
      hasCurrencySymbol = true;
    } else if (noDecimals) {
      display = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } else {
      if (abs >= 1e9)      { display = (abs / 1e9).toFixed(2); suffix = 'B'; }
      else if (abs >= 1e6) { display = (abs / 1e6).toFixed(2); suffix = 'M'; }
      else if (abs >= 1e3) { display = (abs / 1e3).toFixed(2); suffix = 'K'; }
      else                 { display = abs.toFixed(2); }
    }
    return { display, suffix, hasCurrencySymbol, isNegative };
  };

  const fv = formatNumber(value);
  const valueColor = fv.isNegative ? APPLE.red : K.ink;
  const badgeAccent = fv.isNegative ? APPLE.red : accent;

  const handleKeyDown = (e) => {
    if (!clickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${title} — ${clickHint}` : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={handleKeyDown}
      className={`relative overflow-hidden rounded-[22px] transition-all duration-300 group ${className}`}
      style={{
        background: K.glass,
        border: `1px solid ${K.hairline}`,
        boxShadow: K.shadow,
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        cursor: clickable ? "pointer" : "default",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accent}55`;
        e.currentTarget.style.transform = clickable ? "translateY(-3px)" : "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = K.hairline;
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onFocus={(e) => {
        if (clickable) {
          e.currentTarget.style.borderColor = `${accent}88`;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}33, ${K.shadow}`;
        }
      }}
      onBlur={(e) => {
        if (clickable) {
          e.currentTarget.style.borderColor = K.hairline;
          e.currentTarget.style.boxShadow = K.shadow;
        }
      }}
    >
      {/* Left accent rail */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[22px]"
        style={{ background: accent }}
      />

      {/* Hover surface tint */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `${accent}0d` }}
      />

      <div className="relative p-6 pl-7">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: K.muted }}
            >
              {title}
            </p>
            <p className="text-xs" style={{ color: K.faint }}>
              {subtitle}
            </p>
          </div>

          {/* Icon badge */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
            style={{
              background: `${badgeAccent}1c`,
              border: `1px solid ${badgeAccent}33`,
              color: badgeAccent,
            }}
            title={fv.isNegative ? "Over-released" : undefined}
            aria-label={fv.isNegative ? "Over-released" : undefined}
            role={fv.isNegative ? "img" : undefined}
          >
            {fv.isNegative
              ? <RedoDot size={18} strokeWidth={2.5} />
              : (Icon ? <Icon size={18} /> : null)}
          </div>
        </div>

        {/* Value */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className="text-3xl lg:text-4xl font-extrabold tracking-tight tabular-nums"
              style={{ color: valueColor }}
              title={fv.isNegative ? "Negative — over-released" : undefined}
            >
              {fv.isNegative && '('}
              {fv.display}
              {!fv.hasCurrencySymbol && fv.suffix && (
                <span
                  className="text-lg font-semibold ml-0.5"
                  style={{ color: fv.isNegative ? APPLE.red : K.muted }}
                >
                  {fv.suffix}
                </span>
              )}
              {fv.isNegative && ')'}
            </span>
          </div>

          {/* Divider + "View →" hint when clickable */}
          <div className="flex items-center justify-between gap-3">
            <div
              className="h-0.5 w-10 rounded-full transition-all duration-300 group-hover:w-16"
              style={{ background: accent }}
            />
            {clickable && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold opacity-60 group-hover:opacity-100 transition-opacity duration-200"
                style={{ color: accent }}
              >
                {clickHint}
                <ArrowRight
                  size={12}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MetricCard;