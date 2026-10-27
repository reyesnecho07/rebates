// src/components/Dashboard/DashboardHeader.jsx
// ─────────────────────────────────────────────────────────────────
// Rebuilt on top of src/design-system.jsx.
//
// • No hardcoded slate colours — every theme value comes from the
//   `--ds-*` CSS variables exposed by <DesignPage data-ds-theme="…">.
// • Theme source is the design-system `useTokens()` hook, so it stays
//   in sync with everything else on the page. The optional `theme`
//   prop still works as a manual override.
// • Refresh icon uses lucide-react (same library as the rest of the
//   design system) instead of a raw inline SVG.
// ─────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { PALETTE, useTokens } from "../../design-system";

const DashboardHeader = ({
  title       = "Rebate Analytics Dashboard",
  userName    = "User",
  userCode    = "",
  onRefresh   = null,
  showRefresh = true,
  subtitle    = null,
  theme: propTheme = null,
}) => {
  const { isDark: contextIsDark } = useTokens();
  const isDark = propTheme ? propTheme === "dark" : contextIsDark;

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
  });

  return (
    <div
      /* Ensures the --ds-* variables resolve even if this header is
         mounted outside a <DesignPage> wrapper */
      data-ds-theme={isDark ? "dark" : "light"}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      {/* ── LEFT — title + greeting ──────────────────────────────── */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-[var(--ds-ink)]">
          {title}
        </h1>

        <p className="mt-1 text-sm text-[var(--ds-muted)]">
          {subtitle || (
            <>
              {greeting},{" "}
              <span className="font-semibold text-[var(--ds-ink)]">
                {userName}.
              </span>
              {userCode && (
                <span className="ml-1.5 font-mono text-xs text-[var(--ds-faint)]">
                  {userCode}
                </span>
              )}{" "}
              Here&apos;s your overview for today.
            </>
          )}
        </p>
      </div>

      {/* ── RIGHT — date + refresh ───────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 pb-0.5">
        {/* Date */}
        <span className="text-xs text-[var(--ds-faint)]">{dateStr}</span>

        {/* Refresh */}
        {showRefresh && onRefresh && (
          <>
            <div className="h-4 w-px bg-[var(--ds-hairline)]" />
            <button
              type="button"
              onClick={onRefresh}
              className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-[var(--ds-muted)] transition-colors duration-150 hover:text-[var(--ds-ink)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:rgba(10,132,255,0.25)]"
              style={{ "--ds-refresh-accent": PALETTE.blue }}
            >
              <RefreshCw
                size={14}
                className="transition-transform duration-500 group-hover:rotate-[360deg]"
              />
              Refresh
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;