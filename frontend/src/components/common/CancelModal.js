import React from "react";
import { X, AlertTriangle } from "lucide-react";

/**
 * CancelModal — confirms discarding unsaved changes.
 *
 * Props:
 *  isOpen   {boolean}  — controls visibility
 *  onClose  {function} — called when user clicks "Keep Editing"
 *  onConfirm{function} — called when user confirms discard
 *  theme    {string}   — "dark" | "light"
 */
const CancelModal = ({ isOpen, onClose, onConfirm, theme }) => {
  if (!isOpen) return null;

  const isDark = theme === "dark";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border shadow-2xl ${
          isDark
            ? "bg-slate-900 border-slate-700/60"
            : "bg-white border-slate-200"
        }`}
        style={{
          boxShadow: isDark
            ? "0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.6)"
            : "0 4px 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? "border-slate-800" : "border-slate-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isDark
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : "bg-amber-50 border border-amber-200"
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${
                  isDark ? "text-amber-400" : "text-amber-500"
                }`}
              />
            </div>
            <h3
              className={`text-sm font-semibold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Discard Changes?
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isDark
                ? "text-slate-500 hover:text-white hover:bg-slate-800"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p
            className={`text-sm leading-relaxed ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Any unsaved changes or entries you've added will be lost. Are you
            sure you want to discard them?
          </p>
        </div>

        {/* Actions */}
        <div
          className={`flex gap-2.5 justify-end px-5 pb-5`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all ${
              isDark
                ? "border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Keep Editing
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              isDark
                ? "bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-900/30"
                : "bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-200"
            }`}
          >
            Yes, Discard
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelModal;