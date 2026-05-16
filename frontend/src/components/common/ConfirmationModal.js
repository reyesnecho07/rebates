import React, { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Info, X } from "lucide-react";

const VARIANTS = {
  warning: {
    icon:       AlertTriangle,
    iconBg:     "bg-amber-50 border-amber-100",
    iconBgDark: "bg-amber-900/20 border-amber-700/30",
    iconColor:  "text-amber-500",
    confirmBtn: "bg-amber-500 hover:bg-amber-600 text-white",
    stripe:     "bg-amber-500",
  },
  danger: {
    icon:       XCircle,
    iconBg:     "bg-red-50 border-red-100",
    iconBgDark: "bg-red-900/20 border-red-700/30",
    iconColor:  "text-red-500",
    confirmBtn: "bg-red-600 hover:bg-red-700 text-white",
    stripe:     "bg-red-500",
  },
  success: {
    icon:       CheckCircle2,
    iconBg:     "bg-emerald-50 border-emerald-100",
    iconBgDark: "bg-emerald-900/20 border-emerald-700/30",
    iconColor:  "text-emerald-500",
    confirmBtn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    stripe:     "bg-emerald-500",
  },
  info: {
    icon:       Info,
    iconBg:     "bg-blue-50 border-blue-100",
    iconBgDark: "bg-blue-900/20 border-blue-700/30",
    iconColor:  "text-blue-500",
    confirmBtn: "bg-blue-600 hover:bg-blue-700 text-white",
    stripe:     "bg-blue-500",
  },
};

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
  const v    = VARIANTS[variant] || VARIANTS.warning;
  const Icon = v.icon;

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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className={`relative w-full max-w-sm rounded-2xl border shadow-2xl font-sans overflow-hidden ${
          isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {/* Top accent stripe */}
        <div className={`h-0.5 w-full ${v.stripe}`} />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${
          isDark ? "border-slate-700/60 bg-slate-800/60" : "border-slate-100 bg-slate-50"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${
              isDark ? v.iconBgDark : v.iconBg
            }`}>
              <Icon size={14} className={v.iconColor} />
            </div>
            <h2
              id="confirm-modal-title"
              className={`text-xs font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className={`w-6 h-6 flex items-center justify-center rounded-lg border transition-colors ${
              isDark
                ? "text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                : "text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            <X size={12} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <p className={`text-xs leading-relaxed ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            {message}
          </p>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className={`flex gap-2 px-5 py-3.5 border-t ${
          isDark ? "border-slate-700/60 bg-slate-800/40" : "border-slate-100 bg-slate-50"
        }`}>
          <button
            onClick={onCancel}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm ${v.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ConfirmationModal;