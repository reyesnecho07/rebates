// src/components/rebate/QuotaModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Calculator, Save, X, Lock } from "lucide-react";

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens } from '../../design-system';

const QuotaModal = ({
  isOpen,
  onClose,
  customer,
  onSave,
  quotaPeriods,
  importedQuotas = [],
  rebateType = "Fixed",
  quotaType = "withQuota",
  selectedFrequency = "",
  access,
}) => {
  const { isDark, K } = useTokens();

  const canEdit = !!access?.canEdit;

  const [localQuotas, setLocalQuotas] = useState({});

  /* ── Derive the periods to display ─────────────────────────────────────
     • Quarterly frequency → ONE entry per QUARTER (never expand to months).
       If the parent already supplied quarterly entries (each with `.quarter`),
       use them as-is. Otherwise, consolidate any monthly entries into their
       parent quarter.
     • Any other frequency → use the periods exactly as given.
  */
  const displayPeriods = useMemo(() => {
    if (!Array.isArray(quotaPeriods) || quotaPeriods.length === 0) return [];

    if (selectedFrequency !== "Quarterly") return quotaPeriods;

    // Already quarterly? (every entry carries a .quarter)
    const alreadyQuarterly = quotaPeriods.every(p => p && p.quarter);
    if (alreadyQuarterly) return quotaPeriods;

    // Consolidate monthly periods into quarters, preserving order.
    const order = [];
    const byKey = new Map();
    const fmt = (d, opts) => new Date(d).toLocaleDateString('en-US', opts);

    quotaPeriods.forEach(p => {
      if (!p) return;
      const start = p.startDate ? new Date(p.startDate) : null;
      const qIdx  = start ? Math.floor(start.getMonth() / 3) : 0;
      const y     = p.year || (start ? start.getFullYear() : "");
      const qName = p.quarter || ["Q1", "Q2", "Q3", "Q4"][qIdx];
      const key   = `${qName} ${y}`;

      if (!byKey.has(key)) {
        byKey.set(key, {
          period:    key,
          label:     key,
          quarter:   qName,
          year:      y,
          startDate: p.startDate,
          endDate:   p.endDate,
          dates:     p.dates,
        });
        order.push(key);
      } else {
        const existing = byKey.get(key);
        existing.endDate = p.endDate || existing.endDate;
        if (existing.startDate && existing.endDate) {
          existing.dates = `${fmt(existing.startDate, { month: 'short', day: 'numeric' })} - ${fmt(existing.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
      }
    });

    return order.map(k => byKey.get(k));
  }, [quotaPeriods, selectedFrequency]);

  useEffect(() => {
    if (!customer) return;

    const initialQuotas = {};

    const totalSlots = Math.max(
      displayPeriods.length,
      customer.quotas?.length || 0,
      importedQuotas?.length || 0
    );

    if (totalSlots === 0) {
      setLocalQuotas({});
      return;
    }

    for (let i = 0; i < totalSlots; i++) {
      const fromCustomer = customer.quotas?.[i];
      const fromImported = Array.isArray(importedQuotas)
        ? (typeof importedQuotas[i] === 'object'
            ? importedQuotas[i]?.TargetQty
            : importedQuotas[i])
        : undefined;

      initialQuotas[i] = (fromCustomer !== undefined && fromCustomer !== "")
        ? fromCustomer
        : (fromImported !== undefined && fromImported !== "")
          ? String(fromImported)
          : "";
    }

    setLocalQuotas(initialQuotas);
  }, [customer, importedQuotas, displayPeriods]);

  const handleQuotaChange = (periodIndex, value) => {
    if (!canEdit) return;
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
      setLocalQuotas(prev => ({
        ...prev,
        [periodIndex]: value
      }));
    }
  };

  const handleSave = () => {
    if (!canEdit) return;
    const quotasArray = displayPeriods.map((period, index) => ({
      Month: period.label || period.month || period.period,
      TargetQty: localQuotas[index] || "0"
    }));

    console.log('🟢 QuotaModal saving:', quotasArray);

    onSave(quotasArray);
    onClose();
  };

  const getQuotaFields = () => {
    return displayPeriods.map((period, index) => ({
      label: period.label || period.month || period.period,
      key: index.toString(),
      dates: period.dates,
      quarter: period.quarter,
      quarterPeriod: period.quarterPeriod
    }));
  };

  if (!isOpen || !customer) return null;

  const isQuarterlyView = selectedFrequency === "Quarterly";

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-2xl ${
        isDark ? 'bg-[rgba(10,10,14,0.65)]' : 'bg-black/40'
      }`}
    >
      <div className="ds-glass ds-pop rounded-[28px] w-[95%] max-w-7xl max-h-[90vh] overflow-hidden flex flex-col bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0 border-[var(--ds-hairline)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#0A84FF] to-[#0A4FD1] shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold" style={{ color: K.ink }}>
                Manage Fixed Quotas - {selectedFrequency}
              </h2>
              <p className="text-sm" style={{ color: K.muted }}>
                {customer.code} • {customer.name}
                {isQuarterlyView && ` • ${displayPeriods.length} Quarter${displayPeriods.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!canEdit && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FF453A]/11 text-[#FF453A] border border-[#FF453A]/20">
                <Lock className="w-3.5 h-3.5" /> View Only
              </span>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quarter Tabs — informational chips */}
        {isQuarterlyView && displayPeriods.length > 0 && (
          <div className="px-6 py-3 border-b flex-shrink-0 border-[var(--ds-hairline)]">
            <div className="flex flex-wrap gap-2">
              {displayPeriods.map((quarter, index) => (
                <div
                  key={index}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#0A84FF]/11 text-[#0A84FF] border border-[#0A84FF]/20"
                >
                  {quarter.period}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto ds-scroll">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {getQuotaFields().map((field, index) => (
              <div
                key={field.key}
                className="ds-glass rounded-2xl p-5 transition-all duration-200 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] hover:border-[#0A84FF]/33"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-[#0A84FF]" />
                      <h3 className="font-bold text-base truncate" style={{ color: K.ink }}>
                        {field.label}
                      </h3>
                    </div>
                    {isQuarterlyView && field.quarter && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 bg-[#0A84FF]/11 text-[#0A84FF] border border-[#0A84FF]/20">
                        {field.quarter}
                      </span>
                    )}
                  </div>
                  {field.dates && (
                    <p className="text-xs font-medium" style={{ color: K.faint }}>
                      {field.dates}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: K.muted }}>
                    Target Qty
                  </label>
                  <input
                    type="text"
                    value={localQuotas[index] || ""}
                    onChange={(e) => handleQuotaChange(index, e.target.value)}
                    placeholder="Enter qty"
                    disabled={!canEdit}
                    className="ds-glass w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                    style={{ opacity: !canEdit ? 0.6 : 1 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {displayPeriods.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-[#0A84FF]/8 border border-[#0A84FF]/20">
                <Calculator className="w-8 h-8 text-[#0A84FF]" />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: K.ink }}>
                No Quota Periods
              </h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: K.muted }}>
                Configure date ranges and frequency settings to generate quota periods for management.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0 border-[var(--ds-hairline)] bg-[var(--ds-glass-deep)]">
          <div className="text-sm" style={{ color: K.muted }}>
            <strong style={{ color: K.ink }}>{displayPeriods.length}</strong>{' '}
            {isQuarterlyView
              ? `quarter${displayPeriods.length !== 1 ? 's' : ''}`
              : `month${displayPeriods.length !== 1 ? 's' : ''}`}{' '}
            configured
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full text-sm font-medium transition-colors border border-[var(--ds-hairline)] text-[var(--ds-muted)] hover:text-[var(--ds-ink)] hover:bg-[var(--ds-hover)]"
            >
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            {canEdit ? (
              <button
                onClick={handleSave}
                className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 text-white transition-all bg-gradient-to-br from-[#0A84FF] to-[#0A4FD1] shadow-[0_4px_16px_-6px_rgba(10,132,255,0.53)] hover:brightness-110"
              >
                <Save className="w-4 h-4" />
                Save All Quotas
              </button>
            ) : (
              <button
                disabled
                title="You do not have permission to edit quotas"
                className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 cursor-not-allowed bg-[var(--ds-chip-bg)] text-[var(--ds-faint)]"
              >
                <Lock className="w-4 h-4" />
                Save All Quotas
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaModal;