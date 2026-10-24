import React, { useEffect } from "react";
import { Lock, Home } from "lucide-react";
import { Link } from "react-router-dom";

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
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const ACCESS_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(255,69,58,0.35); }
    70%  { box-shadow: 0 0 0 14px rgba(255,69,58,0);  }
    100% { box-shadow: 0 0 0 0 rgba(255,69,58,0);     }
  }
  .access-denied, .access-denied * { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .access-denied .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .access-denied-card { animation: fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
`;

const injectFonts = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('access-denied-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'access-denied-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

/**
 * AccessDenied
 *
 * Reusable access-denied / permissions component styled in the shared
 * Nexchem / VAN / VCP / Settings Apple design language.
 *
 * Props:
 *  - isDark      {boolean} – current dark-mode state (kept for backward compat;
 *                            a `theme` string is also accepted)
 *  - theme       {string}  – "light" | "dark" (preferred over isDark)
 *  - useTokens   {boolean} – if true, `tokens` prop is used for styling
 *  - tokens      {object}  – custom token override (from the records pages)
 *  - accessError {string}  – optional error message to surface
 *  - message     {string}  – optional override for the body text
 *  - homeRoute   {string}  – route for the "Return to Home" button
 *  - homeLabel   {string}  – label for the "Return to Home" button
 *  - title       {string}  – optional custom title (default "Access Restricted")
 */
function AccessDenied({
  isDark,
  theme,
  useTokens = false,
  tokens,
  accessError = "",
  message = "You don't have permission to view this page.",
  homeRoute = "/HomePage",
  homeLabel = "Return to Home",
  title = "Access Restricted",
}) {
  useEffect(() => { injectFonts(); }, []);

  // Resolve theme: prefer explicit `theme` string, else use `isDark`, else light
  const resolvedIsDark = theme
    ? theme === "dark"
    : (typeof isDark === "boolean" ? isDark : false);

  // If custom tokens passed (from the records pages), use them; else derive.
  const K = useTokens && tokens ? tokens : dashTokens(resolvedIsDark);

  return (
    <div
      className="access-denied dash-glass access-denied-card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        minHeight: 380,
        background: K.glass,
        border: `1px solid ${K.hairline}`,
        borderRadius: 22,
        boxShadow: K.shadow,
      }}
    >
      <style>{ACCESS_STYLES}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Icon badge */}
        <div
          style={{
            position: "relative",
            width: 80, height: 80,
            borderRadius: 22,
            background: `${APPLE.red}14`,
            border: `1px solid ${APPLE.red}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "pulse-ring 2.4s ease-in-out infinite",
          }}
        >
          {/* soft outer glow */}
          <div
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${APPLE.red}33 0%, transparent 70%)`,
              filter: "blur(12px)",
              pointerEvents: "none",
            }}
          />
          <Lock size={30} color={APPLE.red} strokeWidth={1.9} />
        </div>

        {/* Text */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: K.ink,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: K.muted,
              margin: 0,
            }}
          >
            {message}
          </p>
          {accessError && (
            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                fontSize: 11,
                color: K.faint,
                fontFamily: "'DM Mono', monospace",
                padding: "6px 10px",
                borderRadius: 8,
                background: K.chipBg,
                border: `1px solid ${K.hairline}`,
                wordBreak: "break-word",
              }}
            >
              Error: {accessError}
            </p>
          )}
        </div>

        {/* CTA */}
        <Link
          to={homeRoute}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 22px",
            borderRadius: 999,
            background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: `0 6px 20px -6px ${APPLE.blue}88`,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.filter = "brightness(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.filter = "brightness(1)";
          }}
        >
          <Home size={14} strokeWidth={2} />
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}

export default AccessDenied;