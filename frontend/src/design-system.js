// src/design-system.jsx
// ─────────────────────────────────────────────────────────────────
// SINGLE-FILE DESIGN SYSTEM — COMPLETE EDITION
//
// Import anything from here in any page. CSS self-injects once on
// first import (guarded by id "ds-styles" — never duplicates).
//
//   import {
//     PALETTE, tokens, useTokens, useSkeletonStyle, useReducedMotion,
//     DesignPage, GlassCard, Field, StrengthMeter, Divider, Badge,
//     ThemeToggle, PrimaryButton, SecondaryButton, TextButton, IconButton,
//     Spinner, Skeleton, SkeletonText, Modal, Toast, Tabs, Avatar,
//     SectionTitle,
//   } from "../design-system";
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useId } from "react";
import {
  Sun, Moon, Loader2, CheckCircle, X, AlertCircle, Info, XCircle,
} from "lucide-react";
import { useTheme } from "./context/ThemeContext";

/* ═══════════════════════════════════════════════════════════════════
   1. PALETTE — shared color language
   ═══════════════════════════════════════════════════════════════════ */
export const PALETTE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  yellow: "#FFD60A",
  gray:   "#8E8E93",
};

/* ═══════════════════════════════════════════════════════════════════
   2. TOKENS — per-mode surface / text / border values
   ═══════════════════════════════════════════════════════════════════ */
export const tokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"     : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"    : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
  panel:     isDark ? "rgba(22,22,28,0.92)"    : "rgba(255,255,255,0.98)",
});

/* ═══════════════════════════════════════════════════════════════════
   3. HOOKS
   ═══════════════════════════════════════════════════════════════════ */
export const useTokens = () => {
  const { theme, updateTheme } = useTheme();
  const isDark = theme === "dark";
  return { theme, isDark, updateTheme, K: tokens(isDark) };
};

/* Shimmer placeholder for loading states */
export function useSkeletonStyle() {
  const { isDark } = useTokens();
  const base      = isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.045)";
  const highlight = isDark ? "rgba(255,255,255,0.12)"  : "rgba(0,0,0,0.085)";
  return (extra = {}) => ({
    backgroundImage: `linear-gradient(90deg, ${base} 0%, ${highlight} 50%, ${base} 100%)`,
    backgroundSize: "200% 100%",
    animation: "ds-shimmer 1.5s ease-in-out infinite",
    borderRadius: 8,
    ...extra,
  });
}

/* Respect user's reduced-motion preference */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

/* ═══════════════════════════════════════════════════════════════════
   4. GLOBAL CSS — injected ONCE at module load
   ═══════════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; }

body,
.ds-page, .ds-page * {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont,
    "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif;
}

/* ── Glass surface ────────────────────────────────────────────── */
.ds-glass {
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
}

/* ── Thin scrollbars ──────────────────────────────────────────── */
.ds-scroll::-webkit-scrollbar        { width: 7px; height: 7px; }
.ds-scroll::-webkit-scrollbar-thumb  { background: rgba(142,142,147,0.4); border-radius: 999px; }
.ds-scroll::-webkit-scrollbar-track  { background: transparent; }
.ds-scroll                          { scrollbar-width: thin; scrollbar-color: rgba(142,142,147,0.4) transparent; }

/* ── Focus-visible ring (accessibility) ───────────────────────── */
.ds-focusable:focus-visible {
  outline: 2px solid #0A84FF;
  outline-offset: 2px;
  border-radius: 8px;
}

/* ═══════════════════════════════════════════════════════════════
   THEME CSS VARIABLES
   ═══════════════════════════════════════════════════════════════ */
[data-ds-theme="light"] {
  --ds-ink:        #1C1C1E;
  --ds-muted:      #6E6E73;
  --ds-faint:      #AEAEB2;
  --ds-glass:      rgba(255,255,255,0.65);
  --ds-glass-deep: rgba(255,255,255,0.98);
  --ds-hairline:   rgba(60,60,67,0.12);
  --ds-rim:        rgba(255,255,255,0.8);
  --ds-chip-bg:    rgba(0,0,0,0.045);
  --ds-hover:      rgba(0,0,0,0.035);
  --ds-bg:         #EEF1F7;
  --ds-shadow:     0 20px 50px -18px rgba(30,41,79,0.18);
}
[data-ds-theme="dark"] {
  --ds-ink:        #F2F2F7;
  --ds-muted:      #98989F;
  --ds-faint:      #68686D;
  --ds-glass:      rgba(30,30,36,0.6);
  --ds-glass-deep: rgba(24,24,28,0.95);
  --ds-hairline:   rgba(255,255,255,0.08);
  --ds-rim:        rgba(255,255,255,0.06);
  --ds-chip-bg:    rgba(255,255,255,0.06);
  --ds-hover:      rgba(255,255,255,0.055);
  --ds-bg:         #000000;
  --ds-shadow:     0 20px 50px -14px rgba(0,0,0,0.65);
}

/* ═══════════════════════════════════════════════════════════════
   KEYFRAMES
   ═══════════════════════════════════════════════════════════════ */
@keyframes floatBlob  { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(18px,-22px) scale(1.04)} 66%{transform:translate(-14px,16px) scale(.97)} }
@keyframes floatBlob2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-20px,18px) scale(1.05)} 66%{transform:translate(16px,-14px) scale(.96)} }
@keyframes swirl      { 0%{transform:rotate(0) scale(1);opacity:.9} 50%{transform:rotate(180deg) scale(1.06);opacity:1} 100%{transform:rotate(360deg) scale(1);opacity:.9} }
@keyframes swirlRv    { 0%{transform:rotate(0) scale(1.05)} 100%{transform:rotate(-360deg) scale(1.05)} }
@keyframes carouselFadeIn  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
@keyframes carouselFadeOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-14px)} }
@keyframes fadeInScale   { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }
@keyframes spinSlow      { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes spin          { to { transform: rotate(360deg); } }
@keyframes pulse2        { 0%,100%{opacity:.5} 50%{opacity:1} }
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(10,132,255,0.35); }
  70%  { box-shadow: 0 0 0 10px rgba(10,132,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(10,132,255,0); }
}
@keyframes slideIn       { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes pop-in        { from{opacity:0;transform:scale(.97) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
@keyframes ds-shimmer    { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes ds-skel-in    { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes ds-fade       { from { opacity: 0; } to { opacity: 1; } }
@keyframes ds-fade-up    { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ds-toast-in   { from { opacity: 0; transform: translateY(-12px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes ds-modal-in   { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

/* ═══════════════════════════════════════════════════════════════
   ANIMATION CLASSES
   ═══════════════════════════════════════════════════════════════ */
.ds-pop       { animation: pop-in .22s cubic-bezier(0.16,1,0.3,1); }
.ds-skel-in   { animation: ds-skel-in 0.25s cubic-bezier(0.16,1,0.3,1); }
.ds-fade      { animation: ds-fade 0.2s ease-out; }
.ds-fade-up   { animation: ds-fade-up 0.3s ease both; }

/* ═══════════════════════════════════════════════════════════════
   BUTTON HELPERS
   ═══════════════════════════════════════════════════════════════ */
.ds-btn-primary:hover:not(:disabled)   { transform: translateY(-1px); filter: brightness(1.05); }
.ds-btn-primary:active:not(:disabled)  { transform: translateY(0); }
.ds-btn-secondary:hover:not(:disabled) { transform: translateY(-1px); }
.ds-btn-lift                           { transition: transform 0.15s; }
.ds-btn-lift:hover:not(:disabled)      { transform: translateY(-1px); }

/* ═══════════════════════════════════════════════════════════════
   INPUT / SELECT FOCUS
   ═══════════════════════════════════════════════════════════════ */
.ds-input:focus,
.ds-select:focus {
  border-color: #0A84FF !important;
  box-shadow: 0 0 0 3px rgba(10,132,255,0.15);
}
.ds-select:focus { outline: none; }

/* ═══════════════════════════════════════════════════════════════
   GRADIENT HELPERS
   ═══════════════════════════════════════════════════════════════ */
.ds-gradient-primary { background: linear-gradient(155deg, #0A84FF 0%, #BF5AF2 100%); }
.ds-gradient-soft    { background: linear-gradient(135deg, rgba(10,132,255,0.04) 0%, rgba(191,90,242,0.04) 100%); }

/* ═══════════════════════════════════════════════════════════════
   REDUCED MOTION — respect user preference
   ═══════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  .ds-page *, .ds-page *::before, .ds-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

if (typeof window !== "undefined" && !document.getElementById("ds-styles")) {
  const styleEl = document.createElement("style");
  styleEl.id = "ds-styles";
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
}

/* ═══════════════════════════════════════════════════════════════════
   5. LAYOUT COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── DesignPage — page wrapper; sets theme CSS vars via data-ds-theme ── */
export function DesignPage({ children, style, className = "", ...rest }) {
  const { K, isDark } = useTokens();
  return (
    <div
      {...rest}
      data-ds-theme={isDark ? "dark" : "light"}
      className={`ds-page ${className}`}
      style={{
        minHeight: "100vh",
        background: K.bg,
        color: K.ink,
        transition: "background 300ms ease, color 300ms ease",
        ...style,
      }}>
      {children}
    </div>
  );
}

/* ── GlassCard — reusable glass surface (renders any element via `as`) ── */
export function GlassCard({
  children, style, className = "", as: Tag = "div", ...rest
}) {
  const { K } = useTokens();
  return (
    <Tag
      {...rest}
      className={`ds-glass rounded-[22px] ${className}`}
      style={{
        border: `1px solid ${K.hairline}`,
        boxShadow: K.shadow,
        ...style,
      }}>
      {children}
    </Tag>
  );
}

/* ── Divider — hairline separator ────────────────────────────────── */
export function Divider({ style, vertical = false, label }) {
  const { K } = useTokens();
  if (label) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          color: K.faint, fontSize: 11, fontWeight: 600,
          letterSpacing: ".6px", textTransform: "uppercase",
          ...style,
        }}>
        <span style={{ flex: 1, height: 1, background: K.hairline }} />
        <span>{label}</span>
        <span style={{ flex: 1, height: 1, background: K.hairline }} />
      </div>
    );
  }
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      style={{
        background: K.hairline,
        width: vertical ? 1 : "100%",
        height: vertical ? "100%" : 1,
        ...style,
      }}
    />
  );
}

/* ── SectionTitle — consistent heading block ─────────────────────── */
export function SectionTitle({ children, subtitle, right, style }) {
  const { K } = useTokens();
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", gap: 12, marginBottom: 14,
        ...style,
      }}>
      <div>
        <h2 style={{
          margin: 0, fontSize: 17, fontWeight: 700,
          letterSpacing: "-0.2px", color: K.ink,
        }}>{children}</h2>
        {subtitle && (
          <p style={{
            margin: "3px 0 0", fontSize: 12.5,
            color: K.muted, lineHeight: 1.4,
          }}>{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   6. FORM COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Field — floating-label input ────────────────────────────────── */
export function Field({
  label, icon: Icon, type = "text", value, onChange,
  disabled, placeholder, right, autoComplete, id, name,
  error, hint, maxLength, required,
}) {
  const { isDark, K } = useTokens();
  const [focused, setFocused] = useState(false);
  const autoId = useId();
  const inputId = id || `ds-field-${autoId}`;
  const safeValue = value == null ? "" : String(value);
  const lifted = focused || safeValue.length > 0;
  const borderColor = error
    ? PALETTE.red
    : focused ? PALETTE.blue : K.hairline;

  return (
    <div className="relative">
      {Icon && (
        <div
          className="absolute left-[14px] top-1/2 -translate-y-1/2 z-[2] pointer-events-none transition-colors duration-150"
          style={{ color: error ? PALETTE.red : focused ? PALETTE.blue : K.faint }}>
          <Icon size={14} />
        </div>
      )}

      <label
        htmlFor={inputId}
        className="absolute z-[2] pointer-events-none transition-all duration-150"
        style={{
          left: Icon ? "42px" : "14px",
          top: lifted ? "7px" : "50%",
          transform: lifted ? "none" : "translateY(-50%)",
          fontSize: lifted ? "9px" : "13px",
          fontWeight: lifted ? 600 : 400,
          letterSpacing: lifted ? ".8px" : "0",
          textTransform: lifted ? "uppercase" : "none",
          color: error ? PALETTE.red : focused ? PALETTE.blue : K.muted,
        }}>
        {label}{required && <span style={{ color: PALETTE.red }}> *</span>}
      </label>

      <input
        id={inputId}
        name={name}
        type={type}
        value={safeValue}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${inputId}-help` : undefined}
        placeholder={focused ? placeholder : ""}
        className="ds-input ds-focusable w-full rounded-xl outline-none transition-all duration-150"
        style={{
          height: "54px",
          paddingLeft: Icon ? "42px" : "14px",
          paddingRight: right ? "44px" : "14px",
          paddingTop: lifted ? "16px" : "0",
          fontSize: "13.5px",
          background: error
            ? `${PALETTE.red}0C`
            : isDark
              ? (focused ? `${PALETTE.blue}10` : K.chipBg)
              : (focused ? `${PALETTE.blue}08` : K.chipBg),
          color: K.ink,
          border: `1.5px solid ${borderColor}`,
          boxShadow: focused ? `0 0 0 3px ${PALETTE.blue}22` : "none",
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />

      {right && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[2]">{right}</div>
      )}

      {(error || hint) && (
        <p
          id={`${inputId}-help`}
          style={{
            margin: "6px 2px 0",
            fontSize: 11,
            color: error ? PALETTE.red : K.faint,
            fontWeight: 500,
          }}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

/* ── StrengthMeter — 4-bar password strength indicator ───────────── */
export function StrengthMeter({ password }) {
  const { K } = useTokens();
  if (!password || typeof password !== "string") return null;

  let score = 0;
  if (password.length >= 6)           score++;
  if (password.length >= 10)          score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9!@#$%^&*]/.test(password)) score++;

  const levels = [
    { label: "Weak",   color: PALETTE.red },
    { label: "Fair",   color: PALETTE.orange },
    { label: "Good",   color: PALETTE.orange },
    { label: "Strong", color: PALETTE.green },
  ];
  const lv = levels[Math.max(0, score - 1)];

  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-1 h-[3px] rounded-[3px] transition-all duration-[250ms]"
            style={{ background: i <= score ? lv.color : K.chipBg }}
          />
        ))}
      </div>
      <p className="m-0 text-[10px] font-semibold" style={{ color: lv.color }}>{lv.label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   7. BUTTONS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Spinner — inline loading indicator ──────────────────────────── */
export function Spinner({ size = 15, color = "currentColor", style }) {
  return (
    <Loader2
      size={size}
      color={color}
      style={{ animation: "spinSlow .8s linear infinite", ...style }}
    />
  );
}

/* ── PrimaryButton — gradient CTA ────────────────────────────────── */
export function PrimaryButton({
  loading = false, children, style, className = "",
  type = "button", ...rest
}) {
  return (
    <button
      {...rest}
      type={type}
      disabled={loading || rest.disabled}
      className={`ds-btn-primary ds-focusable h-[52px] rounded-[12px] border-none text-white text-sm font-semibold tracking-[0.2px] flex items-center justify-center gap-2 transition-all duration-200 ${className}`}
      style={{
        background: loading
          ? PALETTE.blue
          : `linear-gradient(155deg, ${PALETTE.blue} 0%, ${PALETTE.purple} 100%)`,
        cursor: loading || rest.disabled ? "not-allowed" : "pointer",
        boxShadow: loading ? "none" : `0 8px 24px -8px ${PALETTE.blue}88`,
        opacity: loading ? 0.80 : 1,
        ...style,
      }}>
      {loading && <Spinner size={15} />}
      {children}
    </button>
  );
}

/* ── SecondaryButton — outlined / glass CTA ──────────────────────── */
export function SecondaryButton({
  loading = false, children, style, className = "",
  type = "button", danger = false, ...rest
}) {
  const { K, isDark } = useTokens();
  const accent = danger ? PALETTE.red : K.ink;
  return (
    <button
      {...rest}
      type={type}
      disabled={loading || rest.disabled}
      className={`ds-btn-secondary ds-focusable h-[52px] rounded-[12px] text-sm font-semibold tracking-[0.2px] flex items-center justify-center gap-2 transition-all duration-200 ${className}`}
      style={{
        background: isDark ? K.chipBg : "#FFFFFF",
        color: accent,
        border: `1.5px solid ${danger ? `${PALETTE.red}55` : K.hairline}`,
        cursor: loading || rest.disabled ? "not-allowed" : "pointer",
        opacity: loading || rest.disabled ? 0.55 : 1,
        ...style,
      }}>
      {loading && <Spinner size={15} color={accent} />}
      {children}
    </button>
  );
}

/* ── TextButton — inline text button ─────────────────────────────── */
export function TextButton({
  children, color, style, className = "",
  type = "button", ...rest
}) {
  const { K } = useTokens();
  return (
    <button
      {...rest}
      type={type}
      className={`ds-focusable bg-transparent border-none cursor-pointer text-xs font-semibold transition-opacity duration-150 hover:opacity-70 ${className}`}
      style={{
        color: color || PALETTE.blue,
        padding: "4px 6px",
        margin: "-4px -6px",
        borderRadius: 6,
        opacity: rest.disabled ? 0.45 : 1,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        ...style,
      }}>
      {children}
    </button>
  );
}

/* ── IconButton — square icon-only button ────────────────────────── */
export function IconButton({
  icon: Icon, label, size = 36, iconSize = 15,
  color, style, className = "", type = "button", ...rest
}) {
  const { K } = useTokens();
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={`ds-focusable ds-glass flex items-center justify-center transition-all duration-200 ${className}`}
      style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.32),
        border: `1px solid ${K.hairline}`,
        background: K.glass,
        color: color || K.muted,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.45 : 1,
        ...style,
      }}>
      <Icon size={iconSize} />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   8. FEEDBACK / STATUS
   ═══════════════════════════════════════════════════════════════════ */

/* ── ThemeToggle — works with or without props ───────────────────── */
export function ThemeToggle({ onToggle, status = {} }) {
  const { isDark, K, updateTheme } = useTokens();

  const handleClick = () => {
    if (onToggle) {
      onToggle();
      return;
    }
    const next = isDark ? "light" : "dark";
    updateTheme(next);
    try {
      localStorage.setItem("userTheme", next);
      localStorage.setItem("lastActiveTheme", next);
    } catch { /* ignore quota/private mode */ }
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex items-center gap-2">
      {status.saving && (
        <span className="text-[11px] flex items-center gap-1" style={{ color: PALETTE.blue }}>
          <Spinner size={11} /> Saving…
        </span>
      )}
      {status.saved && (
        <span className="text-[11px] flex items-center gap-1" style={{ color: PALETTE.green }}>
          <CheckCircle size={11} /> Saved
        </span>
      )}
      {status.error && (
        <span className="text-[11px] flex items-center gap-1" style={{ color: PALETTE.red }}>
          <X size={11} /> Error
        </span>
      )}
      <button
        onClick={handleClick}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Switch to Light" : "Switch to Dark"}
        className="ds-glass ds-focusable w-9 h-9 rounded-[12px] flex items-center justify-center cursor-pointer transition-all duration-200"
        style={{
          border: `1px solid ${K.hairline}`,
          background: K.glass,
          boxShadow: K.shadow,
          color: K.muted,
        }}>
        {isDark
          ? <Sun  size={14} color={PALETTE.orange} />
          : <Moon size={14} color={K.muted} />}
      </button>
    </div>
  );
}

/* ── Badge — small pill label ────────────────────────────────────── */
export function Badge({
  children, color = PALETTE.blue, variant = "soft", style,
}) {
  const isSoft = variant === "soft";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 22,
        padding: "0 9px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.3px",
        textTransform: "uppercase",
        background: isSoft ? `${color}18` : color,
        color: isSoft ? color : "#FFFFFF",
        border: isSoft ? `1px solid ${color}33` : "none",
        ...style,
      }}>
      {children}
    </span>
  );
}

/* ── Toast — transient notification pill ─────────────────────────── */
export function Toast({
  message, type = "info", onClose, duration = 3200, style,
}) {
  const { K, isDark } = useTokens();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  if (!visible) return null;

  const config = {
    success: { color: PALETTE.green,  Icon: CheckCircle },
    error:   { color: PALETTE.red,    Icon: XCircle },
    warning: { color: PALETTE.orange, Icon: AlertCircle },
    info:    { color: PALETTE.blue,   Icon: Info },
  }[type] || { color: PALETTE.blue, Icon: Info };

  return (
    <div
      role="status"
      className="ds-glass ds-pop"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
        padding: "10px 12px 10px 14px",
        borderRadius: 14,
        background: isDark ? K.glassDeep : K.glass,
        border: `1px solid ${config.color}40`,
        boxShadow: K.shadow,
        fontSize: 12.5,
        fontWeight: 500,
        color: K.ink,
        animation: "ds-toast-in .25s cubic-bezier(0.16,1,0.3,1)",
        ...style,
      }}>
      <config.Icon size={16} color={config.color} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          onClick={() => { setVisible(false); onClose(); }}
          aria-label="Dismiss"
          className="ds-focusable"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: K.faint, display: "flex", padding: 2, borderRadius: 6,
          }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   9. LOADING SKELETONS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Skeleton — rectangular shimmer placeholder ──────────────────── */
export function Skeleton({ width = "100%", height = 14, radius = 8, style }) {
  const skel = useSkeletonStyle();
  return (
    <div
      aria-hidden="true"
      className="ds-skel-in"
      style={skel({ width, height, borderRadius: radius, ...style })}
    />
  );
}

/* ── SkeletonText — N shimmer lines ──────────────────────────────── */
export function SkeletonText({ lines = 3, gap = 8, lastLineWidth = "60%" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? lastLineWidth : "100%"}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   10. OVERLAYS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Modal — glass overlay dialog ────────────────────────────────── */
export function Modal({
  open, onClose, title, children, footer, width = 420, style,
}) {
  const { K, isDark } = useTokens();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        background: isDark ? "rgba(0,0,0,0.55)" : "rgba(20,24,40,0.28)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "ds-fade .18s ease-out",
      }}>
      <div
        ref={dialogRef}
        className="ds-glass"
        style={{
          width: "100%", maxWidth: width,
          background: isDark ? K.glassDeep : "#FFFFFF",
          border: `1px solid ${K.hairline}`,
          borderRadius: 20,
          boxShadow: K.shadow,
          padding: 22,
          animation: "ds-modal-in .25s cubic-bezier(0.16,1,0.3,1)",
          ...style,
        }}>
        {title && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 16, gap: 12,
          }}>
            <h3 style={{
              margin: 0, fontSize: 16, fontWeight: 700, color: K.ink,
              letterSpacing: "-0.2px",
            }}>{title}</h3>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="ds-focusable"
                style={{
                  background: "transparent", border: "none",
                  cursor: "pointer", color: K.muted,
                  display: "flex", padding: 4, borderRadius: 8,
                }}>
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div style={{ color: K.ink, fontSize: 13.5, lineHeight: 1.55 }}>
          {children}
        </div>
        {footer && (
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 8,
            marginTop: 20,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   11. NAVIGATION
   ═══════════════════════════════════════════════════════════════════ */

/* ── Tabs — segmented nav ────────────────────────────────────────── */
export function Tabs({ items, value, onChange, style }) {
  const { K, isDark } = useTokens();
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        gap: 3,
        padding: 3,
        borderRadius: 12,
        background: K.chipBg,
        border: `1px solid ${K.hairline}`,
        ...style,
      }}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(it.value)}
            className="ds-focusable"
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: active ? 700 : 500,
              color: active ? K.ink : K.muted,
              background: active
                ? (isDark ? "rgba(255,255,255,0.10)" : "#FFFFFF")
                : "transparent",
              boxShadow: active
                ? (isDark
                    ? "0 1px 4px rgba(0,0,0,0.3)"
                    : "0 1px 4px rgba(30,41,79,0.10)")
                : "none",
              transition: "all 0.15s ease",
            }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Avatar — initials or image ──────────────────────────────────── */
export function Avatar({ name = "", src, size = 36, style }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: src
          ? "transparent"
          : `linear-gradient(155deg, ${PALETTE.blue} 0%, ${PALETTE.purple} 100%)`,
        color: "#FFFFFF",
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        letterSpacing: "0.2px",
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}>
      {src
        ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : (initials || "?")}
    </div>
  );
}