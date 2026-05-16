import React from "react";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * AccessDenied
 *
 * A reusable access-denied / loading-permissions component.
 *
 * Props:
 *  - isDark       {boolean}  – current dark-mode state
 *  - accessError  {string}   – optional error message to surface
 *  - message      {string}   – optional override for the body text
 *  - homeRoute    {string}   – route for the "Go to Home" button (default: "/HomePage")
 */
function AccessDenied({
  isDark = false,
  accessError = "",
  message = "You don't have permission to view this page.",
  homeRoute = "/HomePage",
}) {
  const tp = isDark ? "text-slate-100" : "text-slate-800";
  const ts = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center gap-6 max-w-md w-full">
        {/* Icon badge */}
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
            isDark
              ? "bg-red-900/20 border border-red-700/30"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <Lock
            size={32}
            className={isDark ? "text-red-400" : "text-red-500"}
          />
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className={`text-xl font-bold ${tp}`}>Access Restricted</h2>
          <p className={`text-sm ${ts}`}>
            {message}
            {accessError && (
              <span className="block mt-2 text-xs opacity-70 font-mono">
                Error: {accessError}
              </span>
            )}
          </p>
        </div>

        {/* CTA */}
        <Link
          to={homeRoute}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}

export default AccessDenied;