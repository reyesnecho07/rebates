import React, { useState, useEffect } from "react";
import { Calculator, Save, X } from "lucide-react";
import { useTheme } from '../../context/ThemeContext';

const QuotaModal = ({ isOpen, onClose, customer, onSave, quotaPeriods, importedQuotas = [], rebateType = "Fixed", quotaType = "withQuota", selectedFrequency = "" }) => {
  const { theme } = useTheme();
  const [localQuotas, setLocalQuotas] = useState({});

useEffect(() => {
  if (!customer) return;
  
  const monthlyPeriods = getMonthlyPeriodsFromQuotaPeriods();
  const initialQuotas = {};
  
  const totalSlots = Math.max(
    monthlyPeriods.length,
    customer.quotas?.length || 0,
    importedQuotas?.length || 0
  );
  
  if (totalSlots === 0) {
    setLocalQuotas({});
    return;
  }

  for (let i = 0; i < totalSlots; i++) {
    // Priority: existing customer quota > imported quota > empty
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
}, [customer, importedQuotas, quotaPeriods]);

const addMonths = (date, n) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
};

const getMonthlyPeriodsFromQuotaPeriods = () => {
  const monthlyPeriods = [];
  const fmt = (d, opts) => d.toLocaleDateString('en-US', opts);
  const sOpt = { month: 'short', day: 'numeric' };
  const lOpt = { month: 'short', day: 'numeric', year: 'numeric' };

  quotaPeriods.forEach((qp) => {
    if (!qp.startDate || !qp.endDate) {
      // fallback: no dates, use quarter name
      const quarterNames = ["Q1","Q2","Q3","Q4"];
      const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const quarterIndex = quarterNames.indexOf(qp.quarter);
      const startMonth = quarterIndex * 3;
      for (let i = 0; i < 3; i++) {
        const mn = monthNames[startMonth + i];
        const yr = new Date().getFullYear();
        monthlyPeriods.push({
          period: `${mn} ${yr}`, label: mn, month: mn, year: yr,
          quarter: qp.quarter, quarterPeriod: qp.period,
          dates: `${mn} ${yr}`
        });
      }
      return;
    }

    const ed = new Date(qp.endDate);
    let mStart = new Date(qp.startDate);

    while (mStart <= ed) {
      // stop if we've landed exactly on the end date (previous slice closed it)
      if (mStart.getTime() === ed.getTime()) break;

      const mNext = addMonths(mStart, 1);
      const isLast = mNext >= ed;
      const mEnd = isLast
        ? new Date(ed)
        : (() => { const d = new Date(mNext); d.setDate(d.getDate() - 1); return d; })();

      const mn = fmt(mStart, { month: 'long' });
      const yr = mStart.getFullYear();

      monthlyPeriods.push({
        period:        `${mn} ${yr}`,
        label:         mn,
        startDate:     new Date(mStart),
        endDate:       new Date(mEnd),
        dates:         `${fmt(mStart, sOpt)} - ${fmt(mEnd, lOpt)}`,
        month:         mn,
        year:          yr,
        quarter:       qp.quarter,
        quarterPeriod: qp.period,
      });

      if (isLast) break;
      mStart = mNext;
    }
  });

  return monthlyPeriods;
};

  const handleQuotaChange = (periodIndex, value) => {
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
      setLocalQuotas(prev => ({
        ...prev,
        [periodIndex]: value
      }));
    }
  };

  // Add this helper function in Nexchem_RebateSetup.js
const getMonthNamesFromPeriods = () => {
  const monthlyPeriods = getMonthlyPeriodsFromQuotaPeriods();
  return monthlyPeriods.map(period => period.label || period.month || period.period);
};

// In QuotaModal.js:

const handleSave = () => {
  const monthlyPeriods = getMonthlyPeriodsFromQuotaPeriods();
  const quotasArray = monthlyPeriods.map((period, index) => ({
    Month: period.label || period.month || period.period,
    TargetQty: localQuotas[index] || "0"
  }));
  
  console.log('🟢 QuotaModal saving:', quotasArray); // ADD THIS DEBUG LINE
  
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

  const getQuotaFields = () => {
    const displayPeriods = getDisplayPeriods();
    
    return displayPeriods.map((period, index) => ({
      label: period.label || period.month || period.period,
      key: index.toString(),
      dates: period.dates,
      quarter: period.quarter,
      quarterPeriod: period.quarterPeriod
    }));
  };

  const displayPeriods = getDisplayPeriods();

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`rounded-2xl w-[95%] max-w-7xl max-h-[90vh] overflow-hidden relative shadow-2xl border-0 ${
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-0'
      }`}>
        <div className={`flex items-center justify-between px-6 py-5 border-b ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-blue-900/30 to-blue-800/30 border-blue-800'
            : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl backdrop-blur-sm ${
              theme === 'dark'
                ? 'bg-blue-500/30'
                : 'bg-blue-500/20'
            }`}>
              <Calculator className={`w-5 h-5 ${
                theme === 'dark' ? 'text-blue-300' : 'text-blue-600'
              }`} />
            </div>
            <div className="space-y-1">
              <h2 className={`text-xl font-bold ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Manage Fixed Quotas - {selectedFrequency}
              </h2>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {customer.code} • {customer.name}
                {selectedFrequency === "Quarterly" && ` • ${quotaPeriods.length} Quarter${quotaPeriods.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2.5 rounded-xl transition-all duration-200 border ${
              theme === 'dark'
                ? 'bg-gray-700/80 hover:bg-gray-600 border-gray-600 hover:border-gray-500'
                : 'bg-white/80 hover:bg-white border-blue-200 hover:border-blue-300'
            }`}
          >
            <X className={`w-5 h-5 transition-colors ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-800'
            }`} />
          </button>
        </div>

        {selectedFrequency === "Quarterly" && (
          <div className={`px-6 py-4 border-b ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex flex-wrap gap-2">
              {quotaPeriods.map((quarter, index) => (
                <div key={index} className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  theme === 'dark'
                    ? 'bg-blue-700 text-blue-100'
                    : 'bg-blue-500 text-white'
                }`}>
                  {quarter.period}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`p-8 max-h-[60vh] overflow-y-auto custom-scrollbar ${
          theme === 'dark' ? 'bg-gray-800' : ''
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {getQuotaFields().map((field, index) => (
              <div 
                key={field.key} 
                className={`border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 group ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 hover:border-blue-600 hover:bg-gray-700/50'
                    : 'bg-white border-blue-100 hover:border-blue-200 hover:bg-blue-50/30'
                }`}
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        theme === 'dark' ? 'bg-blue-400' : 'bg-blue-500'
                      }`}></div>
                      <h3 className={`font-bold text-base ${
                        theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                      }`}>{field.label}</h3>
                    </div>
                    {selectedFrequency === "Quarterly" && field.quarter && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        theme === 'dark'
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {field.quarter}
                      </span>
                    )}
                  </div>
                  {field.dates && (
                    <p className={`text-xs font-medium ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>{field.dates}</p>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className={`text-sm font-semibold ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Target Qty
                  </label>
                  <input
                    type="text"
                    value={localQuotas[index] || ""}
                    onChange={(e) => handleQuotaChange(index, e.target.value)}
                    placeholder="Enter qty"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 font-medium ${
                      theme === 'dark'
                        ? 'bg-gray-600 border-gray-500 text-gray-200 placeholder-gray-400 focus:ring-blue-500/50 focus:border-blue-400'
                        : 'bg-white border-blue-200 text-gray-800 placeholder-gray-400 focus:ring-blue-500/50 focus:border-blue-400'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          {displayPeriods.length === 0 && (
            <div className="text-center py-12">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
                theme === 'dark'
                  ? 'bg-blue-900/20 border-blue-800'
                  : 'bg-blue-50 border-blue-100'
              }`}>
                <Calculator className={`w-8 h-8 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-400'
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>No Quota Periods</h3>
              <p className={`text-sm max-w-md mx-auto ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Configure date ranges and frequency settings to generate quota periods for management.
              </p>
            </div>
          )}
        </div>

        <div className={`flex justify-between items-center p-8 border-t ${
          theme === 'dark'
            ? 'bg-blue-900/10 border-blue-800'
            : 'bg-blue-50/30 border-blue-100'
        }`}>
          <div className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {displayPeriods.length} month{displayPeriods.length !== 1 ? 's' : ''} configured
            {selectedFrequency === "Quarterly" && ` across ${quotaPeriods.length} quarter${quotaPeriods.length !== 1 ? 's' : ''}`}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`px-6 py-3 rounded-xl transition-all duration-200 font-medium border ${
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600 hover:border-gray-500'
                  : 'bg-white text-gray-700 hover:bg-white border-gray-300 hover:border-gray-400'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all duration-200 font-semibold flex items-center gap-2 hover:scale-105 shadow-lg shadow-blue-500/30"
            >
              <Save className="w-4 h-4" />
              Save All Quotas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaModal;