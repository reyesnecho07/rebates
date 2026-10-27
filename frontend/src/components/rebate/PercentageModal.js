// src/components/rebate/PercentageModal.jsx
import React, { useState, useEffect } from "react";
import { Percent, Save, X } from "lucide-react";

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens } from '../../design-system';

const PercentageModal = ({ isOpen, onClose, customer, onSave, quotaPeriods, selectedFrequency = "" }) => {
  const { isDark, K } = useTokens();
  const [localQuotas, setLocalQuotas] = useState({});

  useEffect(() => {
    console.log('🎯 Modal opened with customer:', customer);
    console.log('📊 Customer percentages:', customer?.percentages);
    console.log('📊 Customer quotas:', customer?.quotas);
    console.log('📊 Customer quotaDetails:', customer?.quotaDetails);

    if (customer) {
      const initialQuotas = {};
      const displayPeriods = getDisplayPeriods();

      displayPeriods.forEach((_, index) => {
        if (customer.percentages && customer.percentages[index] !== undefined) {
          console.log(`📊 Loading from percentages[${index}]:`, customer.percentages[index]);
          initialQuotas[index] = customer.percentages[index] || "";
        }
        else if (customer.quotaDetails && customer.quotaDetails[index]) {
          console.log(`📊 Loading from quotaDetails[${index}]:`, customer.quotaDetails[index].TargetQty);
          initialQuotas[index] = customer.quotaDetails[index].TargetQty || "";
        }
        else if (customer.quotas && customer.quotas[index] !== undefined) {
          console.log(`📊 Loading from quotas[${index}]:`, customer.quotas[index]);
          initialQuotas[index] = customer.quotas[index] || "";
        }
        else {
          initialQuotas[index] = "";
        }
      });

      console.log('📤 Initial quotas to set:', initialQuotas);
      setLocalQuotas(initialQuotas);
    }
  }, [customer, quotaPeriods, isOpen]);

  const getMonthlyPeriodsFromQuotaPeriods = () => {
    const monthlyPeriods = [];

    quotaPeriods.forEach((quarterPeriod) => {
      if (quarterPeriod.startDate && quarterPeriod.endDate) {
        const startDate = new Date(quarterPeriod.startDate);
        const endDate = new Date(quarterPeriod.endDate);

        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          const monthStart = new Date(currentDate);
          const monthEnd = new Date(currentDate);
          monthEnd.setMonth(monthEnd.getMonth() + 1);
          monthEnd.setDate(0);

          const actualEnd = monthEnd > endDate ? endDate : monthEnd;

          const monthName = monthStart.toLocaleDateString('en-US', { month: 'long' });
          const year = monthStart.getFullYear();

          monthlyPeriods.push({
            period: `${monthName} ${year}`,
            label: monthName,
            startDate: new Date(monthStart),
            endDate: new Date(actualEnd),
            dates: `${monthStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${actualEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            month: monthName,
            year: year,
            quarter: quarterPeriod.quarter,
            quarterPeriod: quarterPeriod.period
          });

          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(1);
        }
      } else {
        const quarterNames = ["Q1", "Q2", "Q3", "Q4"];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const quarterIndex = quarterNames.indexOf(quarterPeriod.quarter);
        const startMonth = quarterIndex * 3;

        for (let i = 0; i < 3; i++) {
          const monthIndex = startMonth + i;
          const monthName = monthNames[monthIndex];
          const year = new Date().getFullYear();

          monthlyPeriods.push({
            period: `${monthName} ${year}`,
            label: monthName,
            month: monthName,
            year: year,
            quarter: quarterPeriod.quarter,
            quarterPeriod: quarterPeriod.period,
            dates: `${monthName} ${year}`
          });
        }
      }
    });

    return monthlyPeriods;
  };

  const handleQuotaChange = (periodIndex, value) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setLocalQuotas(prev => ({
        ...prev,
        [periodIndex]: value
      }));
    }
  };

  const handleSave = () => {
    const displayPeriods = getDisplayPeriods();

    const quotasData = displayPeriods.map((period, index) => ({
      Month: period.label || period.month || period.period || `Month ${index + 1}`,
      TargetQty: localQuotas[index] || "0"
    }));

    console.log('💾 Modal saving data:', quotasData);
    console.log('📊 Local quotas state:', localQuotas);

    const quotasArray = displayPeriods.map((_, index) => localQuotas[index] || "");

    console.log('💾 Saving percentages array:', quotasArray);

    onSave(quotasArray);
    onClose();
  };

  const getDisplayPeriods = () => {
    if (selectedFrequency === "Quarterly") {
      return getMonthlyPeriodsFromQuotaPeriods();
    } else {
      return quotaPeriods.map((period, index) => ({
        ...period,
        label: period.label || period.month || period.period
      }));
    }
  };

  const displayPeriods = getDisplayPeriods();

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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#FF9F0A] to-[#C77700] shadow-[0_4px_12px_-4px_rgba(255,159,10,0.53)]">
              <Percent className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold" style={{ color: K.ink }}>
                Manage Rebate Targets - {selectedFrequency}
              </h2>
              <p className="text-sm" style={{ color: K.muted }}>
                {customer.code} • {customer.name}
                {selectedFrequency === "Quarterly" && ` • ${quotaPeriods.length} Quarter${quotaPeriods.length !== 1 ? 's' : ''}`}
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

        {/* Quarter chips */}
        {selectedFrequency === "Quarterly" && (
          <div className="px-6 py-3 border-b flex-shrink-0 border-[var(--ds-hairline)]">
            <div className="flex flex-wrap gap-2">
              {quotaPeriods.map((quarter, index) => (
                <div
                  key={index}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#FF9F0A]/11 text-[#FF9F0A] border border-[#FF9F0A]/20"
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
            {displayPeriods.map((period, index) => (
              <div
                key={index}
                className="ds-glass rounded-2xl p-5 transition-all duration-200 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] hover:border-[#FF9F0A]/33"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-[#FF9F0A]" />
                      <h3 className="font-bold text-base truncate" style={{ color: K.ink }}>
                        {period.label}
                      </h3>
                    </div>
                    {selectedFrequency === "Quarterly" && period.quarter && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 bg-[#FF9F0A]/11 text-[#FF9F0A] border border-[#FF9F0A]/20">
                        {period.quarter}
                      </span>
                    )}
                  </div>
                  {period.dates && (
                    <p className="text-xs font-medium" style={{ color: K.faint }}>
                      {period.dates}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: K.muted }}>
                    Target Qty
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={localQuotas[index] || ""}
                      onChange={(e) => handleQuotaChange(index, e.target.value)}
                      placeholder="Enter target %"
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#FF9F0A] focus:shadow-[0_0_0_3px_rgba(255,159,10,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {displayPeriods.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-[#FF9F0A]/8 border border-[#FF9F0A]/20">
                <Percent className="w-8 h-8 text-[#FF9F0A]" />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: K.ink }}>
                No Target Periods
              </h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: K.muted }}>
                Configure date ranges and frequency settings to generate target periods for management.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0 border-[var(--ds-hairline)] bg-[var(--ds-glass-deep)]">
          <div className="text-sm" style={{ color: K.muted }}>
            <strong style={{ color: K.ink }}>{displayPeriods.length}</strong>{' '}
            month{displayPeriods.length !== 1 ? 's' : ''} configured
            {selectedFrequency === "Quarterly" && ` across ${quotaPeriods.length} quarter${quotaPeriods.length !== 1 ? 's' : ''}`}
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
              className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 text-white transition-all bg-gradient-to-br from-[#FF9F0A] to-[#C77700] shadow-[0_4px_16px_-6px_rgba(255,159,10,0.53)] hover:brightness-110"
            >
              <Save className="w-4 h-4" />
              Save All Targets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PercentageModal;