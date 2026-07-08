// src/components/Dashboard/DashboardHeader.jsx
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

const DashboardHeader = ({
  title       = 'Rebate Analytics Dashboard',
  userName    = 'User',
  userCode    = '',
  onRefresh   = null,
  showRefresh = true,
  subtitle    = null,
  theme: propTheme = null,
}) => {
  const { theme: contextTheme } = useTheme();
  const theme = propTheme || contextTheme;

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    year:    'numeric',
  });

  const isDark = theme === 'dark';

  return (
    <div className="mb-8 flex items-end justify-between gap-4">

      {/* LEFT — title + greeting */}
      <div>
        <h1
          className={`text-2xl font-bold tracking-tight leading-tight ${
            isDark ? 'text-slate-100' : 'text-slate-800'
          }`}
        >
          {title}
        </h1>

        <p
          className={`mt-1 text-sm ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {subtitle || (
            <>
              {greeting},{' '}
              <span
                className={`font-semibold ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                {userName}.
              </span>
              {userCode && (
                <span
                  className={`ml-1.5 text-xs font-mono ${
                    isDark ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                </span>
              )}
              Here's your overview for today.
            </>
          )}
        </p>
      </div>

      {/* RIGHT — date + refresh */}
      <div className="flex items-center gap-3 flex-shrink-0 pb-0.5">

        {/* Date */}
        <span
          className={`text-xs ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          {dateStr}
        </span>

        {/* Refresh */}
        {showRefresh && onRefresh && (
          <>
            <div
              className={`h-4 w-px ${
                isDark ? 'bg-slate-700' : 'bg-slate-200'
              }`}
            />
            <button
              onClick={onRefresh}
              className={`group flex items-center gap-1.5 text-xs font-medium transition-colors duration-150 ${
                isDark
                  ? 'text-slate-500 hover:text-slate-200'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <svg
                className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-[360deg]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;