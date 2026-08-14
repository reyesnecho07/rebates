// components/common/Toast.js
import React, { useState, useCallback } from "react";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

// ─── Single toast pill ──────────────────────────────────────────────────────
const Toast = ({ message, type, onClose, isDark }) => {
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
  const s = styles[type] || styles.info;
  const icons = {
    success: <CheckCircle className="w-4 h-4" />,
    error:   <X className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info:    <Info className="w-4 h-4" />,
  };
  return (
    <div
      className={`flex items-center gap-2.5 pl-3.5 pr-3 py-2.5 rounded-2xl border shadow-lg ${s.bg} ${s.border} animate-slide-in-right`}
      style={{ minWidth: "300px", maxWidth: "380px" }}
    >
      <span className={`flex-shrink-0 ${s.text}`}>{icons[type]}</span>
      <span className={`text-sm font-medium flex-1 leading-snug ${s.text}`}>{message}</span>
      <button onClick={onClose} className={`flex-shrink-0 ${s.text} hover:opacity-60 transition-opacity`}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ─── Stack container ────────────────────────────────────────────────────────
export const ToastContainer = ({ toasts, removeToast, isDark }) => (
  <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
    {toasts.map((toast) => (
      <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} isDark={isDark} />
    ))}
  </div>
);

// ─── Hook: drop-in replacement for your old showToast/toasts state ─────────
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};

export default Toast;