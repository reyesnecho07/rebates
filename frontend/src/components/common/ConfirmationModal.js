import React, { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";

/* ─── Apple system colour language (Nexchem / VAN / VCP / Settings) ──────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const dashTokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"  : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
});

const CONFIRM_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  @keyframes dash-pop { from { opacity: 0; transform: scale(.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .confirm-modal, .confirm-modal * { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .confirm-modal .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
`;

const injectFonts = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('confirm-modal-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'confirm-modal-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

/* ─── Variants — colors pulled from the shared Apple palette ─────────────── */
const VARIANTS = {
  warning: {
    icon:       AlertTriangle,
    accent:     APPLE.orange,
    gradient:   `linear-gradient(155deg, ${APPLE.orange} 0%, #E08800 100%)`,
    glow:       `${APPLE.orange}88`,
  },
  danger: {
    icon:       XCircle,
    accent:     APPLE.red,
    gradient:   `linear-gradient(155deg, ${APPLE.red} 0%, #D63A30 100%)`,
    glow:       `${APPLE.red}88`,
  },
  success: {
    icon:       CheckCircle2,
    accent:     APPLE.green,
    gradient:   `linear-gradient(155deg, ${APPLE.green} 0%, #22B93C 100%)`,
    glow:       `${APPLE.green}88`,
  },
  info: {
    icon:       Info,
    accent:     APPLE.blue,
    gradient:   `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
    glow:       `${APPLE.blue}88`,
  },
};

/**
 * ConfirmationModal — glass confirm dialog in the shared Apple design language.
 *
 * Props:
 *   isOpen       {boolean}   — controls visibility
 *   onConfirm    {function}  — called when user confirms
 *   onCancel     {function}  — called when user cancels (Esc, backdrop, Cancel)
 *   title        {string}    — modal title
 *   message      {string}    — body copy
 *   confirmLabel {string}    — text on the confirm button
 *   cancelLabel  {string}    — text on the cancel button
 *   variant      {string}    — "warning" | "danger" | "success" | "info"
 *   theme        {string}    — "light" | "dark"
 */
const ConfirmationModal = ({
  isOpen       = false,
  onConfirm    = () => {},
  onCancel     = () => {},
  title        = "Are you sure?",
  message      = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  variant      = "warning",
  theme        = "light",
}) => {
  const confirmBtnRef = useRef(null);
  const isDark = theme === "dark";
  const K = dashTokens(isDark);
  const v = VARIANTS[variant] || VARIANTS.warning;
  const Icon = v.icon;

  useEffect(() => { injectFonts(); }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => confirmBtnRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(10,14,26,0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <style>{CONFIRM_STYLES}</style>

      <div
        className="dash-glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          borderRadius: 22,
          overflow: 'hidden',
          background: K.glassDeep,
          border: `1px solid ${K.rim}`,
          boxShadow: K.shadow,
          animation: 'dash-pop 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Top accent stripe — variant colored */}
        <div style={{
          height: 3,
          width: '100%',
          background: v.gradient,
        }} />

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '16px 18px',
          borderBottom: `1px solid ${K.hairline}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: `${v.accent}14`,
              border: `1px solid ${v.accent}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} color={v.accent} strokeWidth={1.9} />
            </div>
            <h2
              id="confirm-modal-title"
              style={{
                fontSize: 14, fontWeight: 700,
                color: K.ink, margin: 0, letterSpacing: '-0.01em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {title}
            </h2>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div style={{ padding: '18px 20px' }}>
          <p style={{
            fontSize: 13, lineHeight: 1.55,
            color: K.muted, margin: 0,
          }}>
            {message}
          </p>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 10,
          padding: '0 20px 20px',
        }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 18px', borderRadius: 999,
              border: `1px solid ${K.hairline}`,
              background: 'transparent',
              color: K.muted,
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = 'transparent'; }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px 18px', borderRadius: 999,
              border: 'none',
              background: v.gradient,
              color: '#fff',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: `0 6px 20px -6px ${v.glow}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'brightness(1)'; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;