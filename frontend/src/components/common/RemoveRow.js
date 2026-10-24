import React from "react";
import { X, Trash2 } from "lucide-react";

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

const injectFonts = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('remove-row-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'remove-row-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

/**
 * RemoveRow — confirms deletion of a customer or item row.
 *
 * Props:
 *  isOpen      {boolean}  — controls visibility
 *  onClose     {function} — called when user clicks "Cancel"
 *  onConfirm   {function} — called when user confirms deletion
 *  title       {string}   — modal title (e.g., "Delete Customer")
 *  message     {string}   — confirmation message
 *  theme       {string}   — "dark" | "light"
 */
const RemoveRow = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Item",
  message = "Are you sure you want to delete this item?",
  theme = "light",
}) => {
  React.useEffect(() => { injectFonts(); }, []);
  if (!isOpen) return null;

  const isDark = theme === "dark";
  const K = dashTokens(isDark);
  const fontStack = "'Outfit', system-ui, sans-serif";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: isDark ? "rgba(0,0,0,0.65)" : "rgba(10,14,26,0.45)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        className="dash-glass"
        style={{
          width: "100%",
          maxWidth: 400,
          borderRadius: 22,
          overflow: "hidden",
          background: K.glassDeep,
          border: `1px solid ${K.rim}`,
          boxShadow: K.shadow,
          fontFamily: fontStack,
          animation: "dash-pop 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px",
          borderBottom: `1px solid ${K.hairline}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: `${APPLE.red}14`,
              border: `1px solid ${APPLE.red}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Trash2 size={18} color={APPLE.red} strokeWidth={1.9} />
            </div>
            <h3 style={{
              fontSize: 14, fontWeight: 700, color: K.ink,
              margin: 0, letterSpacing: "-0.01em",
            }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", cursor: "pointer",
              color: K.muted, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = K.muted; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px" }}>
          <p style={{
            fontSize: 13, lineHeight: 1.55,
            color: K.muted, margin: 0,
          }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          display: "flex", gap: 10, justifyContent: "flex-end",
          padding: "0 20px 20px",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px", borderRadius: 999,
              border: `1px solid ${K.hairline}`,
              background: "transparent",
              color: K.muted,
              fontSize: 13, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s",
              fontFamily: fontStack,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "9px 18px", borderRadius: 999,
              border: "none",
              background: `linear-gradient(155deg, ${APPLE.red} 0%, #D63A30 100%)`,
              color: "#fff",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              boxShadow: `0 6px 20px -6px ${APPLE.red}88`,
              fontFamily: fontStack,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "brightness(1)"; }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoveRow;