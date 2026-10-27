// src/components/rebate/ProductRangeModal.jsx
import React, { useState, useEffect } from "react";
import { TrendingUp, Save, X, Plus, Minus } from "lucide-react";

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens } from '../../design-system';

const ProductRangeModal = ({ isOpen, onClose, product, onSave, quotaPeriods, rebateType = "Fixed", quotaType = "withQuota" }) => {
  const { isDark, K } = useTokens();

  const [localRanges, setLocalRanges] = useState({});
  const [activePeriod, setActivePeriod] = useState(0);

  useEffect(() => {
    if (product && product.ranges) {
      const initializedRanges = {};
      quotaPeriods.forEach((_, periodIndex) => {
        if (product.ranges[periodIndex]) {
          initializedRanges[periodIndex] = product.ranges[periodIndex];
        } else {
          initializedRanges[periodIndex] = [
            { min: 0, max: 99, rebate: "" },
            { min: 100, max: 199, rebate: "" },
            { min: 200, max: 299, rebate: "" }
          ];
        }
      });
      setLocalRanges(initializedRanges);
    } else {
      const defaultRanges = {};
      quotaPeriods.forEach((_, periodIndex) => {
        defaultRanges[periodIndex] = [
          { min: 0, max: 99, rebate: "" },
          { min: 100, max: 199, rebate: "" },
          { min: 200, max: 299, rebate: "" }
        ];
      });
      setLocalRanges(defaultRanges);
    }
  }, [product, quotaPeriods]);

  const handleRangeChange = (periodIndex, rangeIndex, field, value) => {
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
    const newRanges = { ...localRanges };
    if (newRanges[periodIndex].length <= 1) return;
    newRanges[periodIndex] = newRanges[periodIndex].filter((_, i) => i !== rangeIndex);
    setLocalRanges(newRanges);
  };

  const handleSave = () => {
    onSave(localRanges);
    onClose();
  };

  const copyRangesToPeriod = (sourcePeriodIndex, targetPeriodIndex) => {
    const newRanges = { ...localRanges };
    newRanges[targetPeriodIndex] = JSON.parse(JSON.stringify(newRanges[sourcePeriodIndex]));
    setLocalRanges(newRanges);
  };

  const copyRangesToAllPeriods = (sourcePeriodIndex) => {
    const newRanges = { ...localRanges };
    for (let i = sourcePeriodIndex + 1; i < quotaPeriods.length; i++) {
      newRanges[i] = JSON.parse(JSON.stringify(newRanges[sourcePeriodIndex]));
    }
    setLocalRanges(newRanges);
  };

  if (!isOpen || !product) return null;

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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#BF5AF2] to-[#8B3FD1] shadow-[0_4px_12px_-4px_rgba(191,90,242,0.53)]">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold" style={{ color: K.ink }}>
                Manage Product Rebate Ranges
              </h2>
              <p className="text-sm" style={{ color: K.muted }}>
                {product.code} • {product.name} • Progressive Rebate Structure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Period Tabs */}
        {quotaPeriods.length > 1 && (
          <div className="px-6 py-3 border-b flex-shrink-0 border-[var(--ds-hairline)]">
            <div className="flex flex-wrap gap-2">
              {quotaPeriods.map((period, index) => {
                const isActive = activePeriod === index;
                return (
                  <button
                    key={index}
                    onClick={() => setActivePeriod(index)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-[#BF5AF2] to-[#8B3FD1] text-white shadow-[0_4px_12px_-4px_rgba(191,90,242,0.53)]'
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
          <div className="mb-6 p-4 rounded-2xl flex items-center justify-between gap-4 flex-wrap bg-[#BF5AF2]/8 border border-[#BF5AF2]/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#BF5AF2]/11 text-[#BF5AF2]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm text-[#BF5AF2]">
                  {quotaPeriods[activePeriod]?.period} : {quotaPeriods[activePeriod]?.dates}
                </h4>
                <p className="text-xs mt-0.5" style={{ color: K.muted }}>
                  Set progressive rebate ranges for this product. Higher rebates apply as sales volume increases.
                </p>
              </div>
            </div>

            {quotaPeriods.length > 1 && (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    const source = activePeriod;
                    const target = (activePeriod + 1) % quotaPeriods.length;
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
                className="ds-glass rounded-2xl p-5 transition-all duration-200 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] hover:border-[#BF5AF2]/33"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 bg-gradient-to-br from-[#BF5AF2] to-[#8B3FD1]"
                    >
                      {rangeIndex + 1}
                    </span>
                    <h3 className="font-bold text-base" style={{ color: K.ink }}>
                      Range {rangeIndex + 1}
                    </h3>
                  </div>
                  {localRanges[activePeriod].length > 1 && (
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
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
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
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
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
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs px-3 py-2 rounded-lg inline-block bg-[#BF5AF2]/8 text-[#BF5AF2] border border-[#BF5AF2]/20">
                  Range: <strong>{range.min}</strong> – <strong>{range.max}</strong> bags → Rebate: <strong>₱{range.rebate || "0"}</strong>/bag
                </div>
              </div>
            ))}
          </div>

          {/* Add Range */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => addRange(activePeriod)}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all text-white bg-gradient-to-br from-[#BF5AF2] to-[#8B3FD1] shadow-[0_4px_16px_-6px_rgba(191,90,242,0.53)] hover:brightness-110 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Add Another Range for {quotaPeriods[activePeriod]?.period}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0 border-[var(--ds-hairline)] bg-[var(--ds-glass-deep)]">
          <div className="text-sm" style={{ color: K.muted }}>
            <strong style={{ color: K.ink }}>{localRanges[activePeriod]?.length || 0}</strong>{' '}
            range{(localRanges[activePeriod]?.length || 0) !== 1 ? 's' : ''} configured for{' '}
            {quotaPeriods[activePeriod]?.period}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full text-sm font-medium transition-colors border border-[var(--ds-hairline)] text-[var(--ds-muted)] hover:text-[var(--ds-ink)] hover:bg-[var(--ds-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 text-white transition-all bg-gradient-to-br from-[#BF5AF2] to-[#8B3FD1] shadow-[0_4px_16px_-6px_rgba(191,90,242,0.53)] hover:brightness-110"
            >
              <Save className="w-4 h-4" />
              Save All Ranges
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductRangeModal;