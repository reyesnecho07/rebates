// src/components/rebate/ProductRangeModal.jsx
import React, { useState, useEffect } from "react";
import { TrendingUp, Save, X, Plus, Minus } from "lucide-react";
import { useTheme } from '../../context/ThemeContext';

/* ─── Apple system colour language ───────────────────────────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const dashTokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"  : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const DASH_FONT = `
  .dash-page, .dash-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .dash-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .dash-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.4); border-radius: 999px; }
  .dash-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes dash-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dash-pop { animation: dash-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
`;

const ProductRangeModal = ({ isOpen, onClose, product, onSave, quotaPeriods, rebateType = "Fixed", quotaType = "withQuota" }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const K = dashTokens(isDark);

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
    <div className="dash-page fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        backgroundColor: isDark ? "rgba(10,10,14,0.65)" : "rgba(0,0,0,0.4)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}>
      <style>{DASH_FONT}</style>

      <div
        className="dash-glass dash-pop rounded-[28px] w-[95%] max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ background: K.glassDeep, border: `1px solid ${K.rim}`, boxShadow: K.shadow }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: K.hairline }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(155deg, ${APPLE.purple} 0%, #8B3FD1 100%)`,
                boxShadow: `0 4px 12px -4px ${APPLE.purple}88`,
              }}
            >
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
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: K.chipBg, color: K.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Period Tabs */}
        {quotaPeriods.length > 1 && (
          <div
            className="px-6 py-3 border-b flex-shrink-0"
            style={{ borderColor: K.hairline }}
          >
            <div className="flex flex-wrap gap-2">
              {quotaPeriods.map((period, index) => {
                const isActive = activePeriod === index;
                return (
                  <button
                    key={index}
                    onClick={() => setActivePeriod(index)}
                    className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                    style={{
                      background: isActive
                        ? `linear-gradient(155deg, ${APPLE.purple} 0%, #8B3FD1 100%)`
                        : K.chipBg,
                      color: isActive ? "#FFFFFF" : K.muted,
                      border: `1px solid ${isActive ? "transparent" : K.hairline}`,
                      boxShadow: isActive ? `0 4px 12px -4px ${APPLE.purple}88` : "none",
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; } }}
                  >
                    {period.period}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto dash-scroll">
          {/* Period info banner */}
          <div
            className="mb-6 p-4 rounded-2xl flex items-center justify-between gap-4 flex-wrap"
            style={{
              background: `${APPLE.purple}14`,
              border: `1px solid ${APPLE.purple}33`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${APPLE.purple}1c`, color: APPLE.purple }}
              >
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm" style={{ color: APPLE.purple }}>
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
                  className="px-3 py-1.5 text-xs rounded-full font-medium transition-colors"
                  style={{ background: `${APPLE.blue}1c`, color: APPLE.blue, border: `1px solid ${APPLE.blue}33` }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Copy to Next
                </button>
                <button
                  onClick={() => copyRangesToAllPeriods(activePeriod)}
                  className="px-3 py-1.5 text-xs rounded-full font-medium transition-colors"
                  style={{ background: `${APPLE.purple}1c`, color: APPLE.purple, border: `1px solid ${APPLE.purple}33` }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
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
                className="rounded-2xl p-5 transition-all duration-200 dash-glass"
                style={{
                  background: K.glass,
                  border: `1px solid ${K.hairline}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${APPLE.purple}55`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = K.hairline; }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{
                        background: `linear-gradient(155deg, ${APPLE.purple} 0%, #8B3FD1 100%)`,
                      }}
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
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ color: APPLE.red, background: `${APPLE.red}14` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = `${APPLE.red}28`}
                      onMouseLeave={(e) => e.currentTarget.style.background = `${APPLE.red}14`}
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
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all dash-glass"
                      style={{ background: K.glass, border: `1px solid ${K.hairline}`, color: K.ink }}
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
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all dash-glass"
                      style={{ background: K.glass, border: `1px solid ${K.hairline}`, color: K.ink }}
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
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all dash-glass"
                      style={{ background: K.glass, border: `1px solid ${K.hairline}`, color: K.ink }}
                    />
                  </div>
                </div>

                <div
                  className="mt-3 text-xs px-3 py-2 rounded-lg inline-block"
                  style={{ background: `${APPLE.purple}14`, color: APPLE.purple, border: `1px solid ${APPLE.purple}33` }}
                >
                  Range: <strong>{range.min}</strong> – <strong>{range.max}</strong> bags → Rebate: <strong>₱{range.rebate || "0"}</strong>/bag
                </div>
              </div>
            ))}
          </div>

          {/* Add Range */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => addRange(activePeriod)}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all text-white"
              style={{
                background: `linear-gradient(155deg, ${APPLE.purple} 0%, #8B3FD1 100%)`,
                boxShadow: `0 4px 16px -6px ${APPLE.purple}88`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <Plus className="w-4 h-4" />
              Add Another Range for {quotaPeriods[activePeriod]?.period}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0"
          style={{ borderColor: K.hairline, background: K.glassDeep }}
        >
          <div className="text-sm" style={{ color: K.muted }}>
            <strong style={{ color: K.ink }}>{localRanges[activePeriod]?.length || 0}</strong> range{(localRanges[activePeriod]?.length || 0) !== 1 ? 's' : ''} configured for {quotaPeriods[activePeriod]?.period}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full text-sm font-medium transition-all"
              style={{ border: `1px solid ${K.hairline}`, color: K.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = 'transparent'; }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 text-white transition-all"
              style={{
                background: `linear-gradient(155deg, ${APPLE.purple} 0%, #8B3FD1 100%)`,
                boxShadow: `0 4px 16px -6px ${APPLE.purple}88`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
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