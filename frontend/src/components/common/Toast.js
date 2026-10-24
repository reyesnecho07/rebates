// components/common/Toast.js
import React, { useState, useCallback } from "react";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";

const DEFAULT_DURATION = 5000; // ms

// ─── Keyframes (injected once, via <ProgressStyles />) ──────────────────────
const ProgressStyles = () => (
  <style>{`
    @keyframes toast-progress {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
    .toast-progress-bar {
      transform-origin: left center;
      animation-name: toast-progress;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }
    /* Optional: pause the countdown while hovering the toast */
    .toast-pill:hover .toast-progress-bar {
      animation-play-state: paused;
    }
  `}</style>
);

// ─── Single toast pill ──────────────────────────────────────────────────────
const Toast = ({ message, type, onClose, isDark, duration = DEFAULT_DURATION }) => {
  const styles = {
    success: {
      bg:     isDark ? "bg-slate-900" : "bg-white",
      border: isDark ? "border-emerald-700/50" : "border-emerald-200",
      text:   isDark ? "text-emerald-400" : "text-emerald-600",
    },
    error: {
      bg:     isDark ? "bg-slate-900" : "bg-white",
      border: isDark ? "border-red-700/50" : "border-red-200",
      text:   isDark ? "text-red-400" : "text-red-600",
    },
    warning: {
      bg:     isDark ? "bg-slate-900" : "bg-white",
      border: isDark ? "border-amber-700/50" : "border-amber-200",
      text:   isDark ? "text-amber-400" : "text-amber-600",
    },
    info: {
      bg:     isDark ? "bg-slate-900" : "bg-white",
      border: isDark ? "border-blue-700/50" : "border-blue-200",
      text:   isDark ? "text-blue-400" : "text-blue-600",
    },
  };

  // Progress-line colours (one shade stronger than the text colour)
  const bars = {
    success: isDark ? "bg-emerald-500" : "bg-emerald-400",
    error:   isDark ? "bg-red-500"     : "bg-red-400",
    warning: isDark ? "bg-amber-500"   : "bg-amber-400",
    info:    isDark ? "bg-blue-500"    : "bg-blue-400",
  };
  const track = isDark ? "bg-slate-700/50" : "bg-slate-200";

  const s   = styles[type] || styles.info;
  const bar = bars[type]   || bars.info;

  const icons = {
    success: <CheckCircle className="w-4 h-4" />,
    error:   <AlertTriangle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info:    <Info className="w-4 h-4" />,
  };

  return (
    <div
      className={`toast-pill flex flex-col rounded-2xl border shadow-lg overflow-hidden ${s.bg} ${s.border} animate-slide-in-right`}
      style={{ minWidth: "300px", maxWidth: "380px" }}
    >
      <div className="flex items-center gap-2.5 pl-3.5 pr-3 py-2.5">
        <span className={`flex-shrink-0 ${s.text}`}>{icons[type] || icons.info}</span>
        <span className={`text-sm font-medium flex-1 leading-snug ${s.text}`}>{message}</span>
        <button
          onClick={onClose}
          className={`flex-shrink-0 ${s.text} hover:opacity-60 transition-opacity`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Countdown line: full → empty, then the toast removes itself */}
      <div className={`h-[3px] w-full ${track}`}>
        <div
          className={`toast-progress-bar h-full w-full ${bar}`}
          style={{ animationDuration: `${duration}ms` }}
          onAnimationEnd={onClose}
        />
      </div>
    </div>
  );
};

// ─── Stack container ────────────────────────────────────────────────────────
export const ToastContainer = ({ toasts, removeToast, isDark }) => (
  <>
    <ProgressStyles />
    <div className="fixed top-20 right-6 z-50 flex flex-col space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
          isDark={isDark}
        />
      ))}
    </div>
  </>
);

// ─── Hook: drop-in replacement for your old showToast/toasts state ─────────
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info", duration = DEFAULT_DURATION) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};

export default Toast;