// src/components/Dashboard/MetricCard.js
// ─────────────────────────────────────────────────────────────────
// Rebuilt on top of src/design-system.jsx.
// Import path is ../../design-system because this file lives at
//   src/components/Dashboard/MetricCard.js
// → ../        = src/components
// → ../../     = src
// → ../../design-system = src/design-system.jsx  ✓
// ─────────────────────────────────────────────────────────────────

import React from "react";
import { RedoDot, ArrowRight } from "lucide-react";
import { PALETTE, useTokens } from "../../design-system";

const EPS = 0.005;

/* Variant → accent colour, mapped straight onto the shared palette */
const VARIANT_ACCENT = {
  emerald: PALETTE.green,
  blue:    PALETTE.blue,
  amber:   PALETTE.orange,
  purple:  PALETTE.purple,
  red:     PALETTE.red,
  gray:    PALETTE.gray,
};

/* ── value formatting ─────────────────────────────────────────────── */
function formatNumber(value, { isCurrency = false, noDecimals = false } = {}) {
  if (typeof value !== "number") {
    if (typeof value === "string" && value.trim() !== "") {
      const s = value.trim();
      const isParen = /^\(.*\)$/.test(s);
      const startsMinus = /^-/.test(s);
      const hasCurrencySymbol = s.includes("₱");
      const body = s.replace(/^\(+/, "").replace(/\)+$/, "").trim();
      const numeric = parseFloat(body.replace(/[₱,\s]/g, ""));
      const isNegative =
        isParen || startsMinus || (Number.isFinite(numeric) && numeric < -EPS);
      const display = body.replace(/^-/, "").trim();
      return { display, suffix: "", hasCurrencySymbol, isNegative };
    }
    return {
      display: value ?? "0",
      suffix: "",
      hasCurrencySymbol: false,
      isNegative: false,
    };
  }

  const isNegative = value < -EPS;
  const abs = Math.abs(value);
  let display;
  let suffix = "";
  let hasCurrencySymbol = false;

  if (isCurrency) {
    display = `₱${abs.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,")}`;
    hasCurrencySymbol = true;
  } else if (noDecimals) {
    display = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } else if (abs >= 1e9) {
    display = (abs / 1e9).toFixed(2);
    suffix = "B";
  } else if (abs >= 1e6) {
    display = (abs / 1e6).toFixed(2);
    suffix = "M";
  } else if (abs >= 1e3) {
    display = (abs / 1e3).toFixed(2);
    suffix = "K";
  } else {
    display = abs.toFixed(2);
  }

  return { display, suffix, hasCurrencySymbol, isNegative };
}

/* ── component ────────────────────────────────────────────────────── */
const MetricCard = ({
  title,
  value,
  subtitle = "Cumulative total",
  icon: Icon,
  variant = "emerald",
  isCurrency = false,
  className = "",
  noDecimals = false,
  onClick,
  clickHint = "View",
  theme, // optional override; defaults to the design-system ThemeContext
}) => {
  const { isDark: contextIsDark } = useTokens();
  const isDark = theme ? theme === "dark" : contextIsDark;

  const clickable = typeof onClick === "function";
  const accent = VARIANT_ACCENT[variant] || VARIANT_ACCENT.emerald;

  const fv = formatNumber(value, { isCurrency, noDecimals });
  const badgeAccent = fv.isNegative ? PALETTE.red : accent;

  const handleKeyDown = (e) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
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
      data-ds-theme={isDark ? "dark" : "light"}
      className={[
        "group relative overflow-hidden rounded-[22px] ds-glass",
        "border border-[var(--ds-hairline)]",
        "bg-[var(--ds-glass)] shadow-[var(--ds-shadow)]",
        "transition-all duration-300 ease-out",
        "hover:border-[var(--mc-accent-border)]",
        clickable
          ? "cursor-pointer hover:-translate-y-[3px] focus-visible:outline-none focus-visible:border-[var(--mc-accent-border)] focus-visible:ring-[3px] focus-visible:ring-[var(--mc-accent-ring)] focus-visible:ring-offset-0"
          : "cursor-default hover:-translate-y-[2px]",
        className,
      ].join(" ")}
      style={{
        "--mc-accent-border": `${accent}55`,
        "--mc-accent-ring": `${accent}33`,
      }}
    >
      {/* Left accent rail */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 top-0 w-1 rounded-l-[22px]"
        style={{ background: accent }}
      />

      {/* Hover surface tint */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `${accent}0d` }}
      />

      <div className="relative p-6 pl-7">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-5 flex items-start justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--ds-muted)]">
              {title}
            </p>
            <p className="text-xs text-[var(--ds-faint)]">{subtitle}</p>
          </div>

          {/* Icon badge */}
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105"
            style={{
              background: `${badgeAccent}1c`,
              borderColor: `${badgeAccent}33`,
              color: badgeAccent,
            }}
            title={fv.isNegative ? "Over-released" : undefined}
            aria-label={fv.isNegative ? "Over-released" : undefined}
            role={fv.isNegative ? "img" : undefined}
          >
            {fv.isNegative ? (
              <RedoDot size={18} strokeWidth={2.5} />
            ) : Icon ? (
              <Icon size={18} />
            ) : null}
          </div>
        </div>

        {/* ── Value ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span
              className="text-3xl font-extrabold tracking-tight tabular-nums text-[var(--ds-ink)] lg:text-4xl"
              style={fv.isNegative ? { color: PALETTE.red } : undefined}
              title={fv.isNegative ? "Negative — over-released" : undefined}
            >
              {fv.isNegative && "("}
              {fv.display}
              {!fv.hasCurrencySymbol && fv.suffix && (
                <span
                  className="ml-0.5 text-lg font-semibold text-[var(--ds-muted)]"
                  style={fv.isNegative ? { color: PALETTE.red } : undefined}
                >
                  {fv.suffix}
                </span>
              )}
              {fv.isNegative && ")"}
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
                className="inline-flex items-center gap-1 text-[11px] font-semibold opacity-60 transition-opacity duration-200 group-hover:opacity-100"
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