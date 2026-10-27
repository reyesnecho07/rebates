// src/components/rebate/RangeModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, Save, X, Plus, Minus, Lock } from "lucide-react";

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens } from '../../design-system';

const RangeModal = ({
  isOpen,
  onClose,
  customer,
  onSave,
  quotaPeriods,
  rebateType = "Fixed",
  quotaType = "withQuota",
  selectedFrequency = "",
  access,
}) => {
  const { isDark, K } = useTokens();

  const canEdit = !!access?.canEdit;

  const [localRanges, setLocalRanges] = useState({});
  const [activePeriod, setActivePeriod] = useState(0);

  /* ── Derive the periods to display ─────────────────────────────────────
     • Quarterly frequency → ONE entry per QUARTER (never expand to months).
       If the parent has already supplied quarterly entries (each with a
       `.quarter` property), use them as-is. Otherwise, consolidate any
       monthly entries into their parent quarter.
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
    // ── Default template: only ONE range by default. User can add more. ────
    const DEFAULT_RANGES = [
      { min: 0, max: 99, rebate: "" },
    ];

    if (!customer) {
      setLocalRanges({});
      setActivePeriod(0);
      return;
    }

    // ── Find a fallback source of ranges ────────────────────────────────────
    //   Backend returns { default: [...] } — must handle it here, otherwise
    //   ranges fall back to the empty default template.
    let sourceRanges = null;
    if (customer.ranges && typeof customer.ranges === 'object') {
      if (Array.isArray(customer.ranges['default']) && customer.ranges['default'].length > 0) {
        sourceRanges = customer.ranges['default'];
      } else if (Array.isArray(customer.ranges[0]) && customer.ranges[0].length > 0) {
        sourceRanges = customer.ranges[0];
      } else {
        const numericKeys = Object.keys(customer.ranges)
          .filter(k => k !== 'default' && !isNaN(Number(k)))
          .sort((a, b) => Number(a) - Number(b));
        for (const k of numericKeys) {
          if (Array.isArray(customer.ranges[k]) && customer.ranges[k].length > 0) {
            sourceRanges = customer.ranges[k];
            break;
          }
        }
      }
    }

    // ── Rebuild per-period ranges for the CURRENT displayPeriods ────────────
    const initializedRanges = {};
    displayPeriods.forEach((_, periodIndex) => {
      if (Array.isArray(customer.ranges?.[periodIndex]) && customer.ranges[periodIndex].length > 0) {
        // Period-specific saved edits take precedence
        initializedRanges[periodIndex] = customer.ranges[periodIndex].map(r => ({ ...r }));
      } else if (sourceRanges) {
        // Fall back to the loaded/backend ranges (applied to every period)
        initializedRanges[periodIndex] = sourceRanges.map(r => ({ ...r }));
      } else {
        initializedRanges[periodIndex] = DEFAULT_RANGES.map(r => ({ ...r }));
      }
    });

    setLocalRanges(initializedRanges);
    setActivePeriod(0);
  }, [customer, displayPeriods]);

  const handleRangeChange = (periodIndex, rangeIndex, field, value) => {
    if (!canEdit) return;
    const newRanges = { ...localRanges };

    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
      newRanges[periodIndex][rangeIndex][field] = value;

      if (field === 'max' && rangeIndex < newRanges[periodIndex].length - 1) {
        newRanges[periodIndex][rangeIndex + 1].min = parseInt(value) + 1;
      }
      if (field === 'min' && rangeIndex > 0) {
        newRanges[periodIndex][rangeIndex - 1].max = parseInt(value) - 1;
      }

      setLocalRanges(newRanges);
    }
  };

  const addRange = (periodIndex) => {
    if (!canEdit) return;
    const newRanges = { ...localRanges };
    const periodRanges = newRanges[periodIndex];
    const lastRange = periodRanges[periodRanges.length - 1];
    const newMin = lastRange ? parseInt(lastRange.max) + 1 : 0;
    const newMax = newMin + 99;

    newRanges[periodIndex] = [
      ...periodRanges,
      { min: newMin, max: newMax, rebate: "" }
    ];
    setLocalRanges(newRanges);
  };

  const removeRange = (periodIndex, rangeIndex) => {
    if (!canEdit) return;
    const newRanges = { ...localRanges };
    if (newRanges[periodIndex].length <= 1) return;
    newRanges[periodIndex] = newRanges[periodIndex].filter((_, i) => i !== rangeIndex);
    setLocalRanges(newRanges);
  };

  const handleSave = () => {
    if (!canEdit) return;
    onSave(localRanges);
    onClose();
  };

  const copyRangesToPeriod = (sourcePeriodIndex, targetPeriodIndex) => {
    if (!canEdit) return;
    const newRanges = { ...localRanges };
    newRanges[targetPeriodIndex] = JSON.parse(JSON.stringify(newRanges[sourcePeriodIndex]));
    setLocalRanges(newRanges);
  };

  const copyRangesToAllPeriods = (sourcePeriodIndex) => {
    if (!canEdit) return;
    const newRanges = { ...localRanges };
    for (let i = sourcePeriodIndex + 1; i < displayPeriods.length; i++) {
      newRanges[i] = JSON.parse(JSON.stringify(newRanges[sourcePeriodIndex]));
    }
    setLocalRanges(newRanges);
  };

  if (!isOpen || !customer) return null;

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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] shadow-[0_4px_12px_-4px_rgba(50,215,75,0.53)]">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold" style={{ color: K.ink }}>
                Manage Incremental Rebate Ranges
              </h2>
              <p className="text-sm" style={{ color: K.muted }}>
                {customer.code} • {customer.name} • Progressive Rebate Structure
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!canEdit && (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FF453A]/11 text-[#FF453A] border border-[#FF453A]/20"
              >
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

        {/* Period Tabs */}
        {displayPeriods.length > 1 && (
          <div className="px-6 py-3 border-b flex-shrink-0 border-[var(--ds-hairline)]">
            <div className="flex flex-wrap gap-2">
              {displayPeriods.map((period, index) => {
                const isActive = activePeriod === index;
                return (
                  <button
                    key={index}
                    onClick={() => setActivePeriod(index)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] text-white shadow-[0_4px_12px_-4px_rgba(50,215,75,0.53)]'
                        : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] hover:text-[var(--ds-ink)]'
                    }`}
                  >
                    {period.period}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto ds-scroll">
          {/* Period info banner */}
          <div className="mb-6 p-4 rounded-2xl flex items-center justify-between gap-4 flex-wrap bg-[#32D74B]/8 border border-[#32D74B]/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#32D74B]/11 text-[#32D74B]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm text-[#32D74B]">
                  {displayPeriods[activePeriod]?.period} : {displayPeriods[activePeriod]?.dates}
                </h4>
                <p className="text-xs mt-0.5" style={{ color: K.muted }}>
                  Set progressive rebate ranges for this period. Customers earn higher rebates as they achieve higher sales targets.
                </p>
              </div>
            </div>

            {displayPeriods.length > 1 && canEdit && (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    const source = activePeriod;
                    const target = (activePeriod + 1) % displayPeriods.length;
                    copyRangesToPeriod(source, target);
                  }}
                  className="px-3 py-1.5 text-xs rounded-full font-medium transition-opacity bg-[#0A84FF]/11 text-[#0A84FF] border border-[#0A84FF]/20 hover:opacity-85"
                >
                  Copy to Next
                </button>
                <button
                  onClick={() => copyRangesToAllPeriods(activePeriod)}
                  className="px-3 py-1.5 text-xs rounded-full font-medium transition-opacity bg-[#BF5AF2]/11 text-[#BF5AF2] border border-[#BF5AF2]/20 hover:opacity-85"
                >
                  Copy to All Future
                </button>
              </div>
            )}
          </div>

          {/* Ranges */}
          <div className="space-y-4">
            {localRanges[activePeriod]?.map((range, rangeIndex) => (
              <div
                key={rangeIndex}
                className="ds-glass rounded-2xl p-5 transition-all duration-200 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] hover:border-[#32D74B]/33"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 bg-gradient-to-br from-[#32D74B] to-[#1D9E3F]"
                    >
                      {rangeIndex + 1}
                    </span>
                    <h3 className="font-bold text-base" style={{ color: K.ink }}>
                      Range {rangeIndex + 1}
                    </h3>
                  </div>
                  {localRanges[activePeriod].length > 1 && canEdit && (
                    <button
                      onClick={() => removeRange(activePeriod, rangeIndex)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-[#FF453A] bg-[#FF453A]/8 hover:bg-[#FF453A]/16"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: K.muted }}>
                      Minimum Quantity
                    </label>
                    <input
                      type="text"
                      value={range.min}
                      onChange={(e) => handleRangeChange(activePeriod, rangeIndex, 'min', e.target.value)}
                      placeholder="Min"
                      disabled={!canEdit}
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                      style={{ opacity: !canEdit ? 0.6 : 1 }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: K.muted }}>
                      Maximum Quantity
                    </label>
                    <input
                      type="text"
                      value={range.max}
                      onChange={(e) => handleRangeChange(activePeriod, rangeIndex, 'max', e.target.value)}
                      placeholder="Max"
                      disabled={!canEdit}
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                      style={{ opacity: !canEdit ? 0.6 : 1 }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: K.muted }}>
                      Rebate per Bag
                    </label>
                    <input
                      type="text"
                      value={range.rebate}
                      onChange={(e) => handleRangeChange(activePeriod, rangeIndex, 'rebate', e.target.value)}
                      placeholder="Rebate amount"
                      disabled={!canEdit}
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                      style={{ opacity: !canEdit ? 0.6 : 1 }}
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs px-3 py-2 rounded-lg inline-block bg-[#32D74B]/8 text-[#32D74B] border border-[#32D74B]/20">
                  Range: <strong>{range.min}</strong> – <strong>{range.max}</strong> bags → Rebate: <strong>₱{range.rebate || "0"}</strong>/bag
                </div>
              </div>
            ))}
          </div>

          {/* Add Range */}
          {canEdit && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => addRange(activePeriod)}
                className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all text-white bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] shadow-[0_4px_16px_-6px_rgba(50,215,75,0.53)] hover:brightness-110 hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                Add Another Range for {displayPeriods[activePeriod]?.period}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0 border-[var(--ds-hairline)] bg-[var(--ds-glass-deep)]">
          <div className="text-sm" style={{ color: K.muted }}>
            <strong style={{ color: K.ink }}>{localRanges[activePeriod]?.length || 0}</strong>{' '}
            range{(localRanges[activePeriod]?.length || 0) !== 1 ? 's' : ''} configured for{' '}
            {displayPeriods[activePeriod]?.period}
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
                className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 text-white transition-all bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] shadow-[0_4px_16px_-6px_rgba(50,215,75,0.53)] hover:brightness-110"
              >
                <Save className="w-4 h-4" />
                Save All Ranges
              </button>
            ) : (
              <button
                disabled
                title="You do not have permission to edit ranges"
                className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 cursor-not-allowed bg-[var(--ds-chip-bg)] text-[var(--ds-faint)]"
              >
                <Lock className="w-4 h-4" />
                Save All Ranges
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RangeModal;