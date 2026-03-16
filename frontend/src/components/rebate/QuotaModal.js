import React, { useState, useEffect } from "react";
import { Calculator, Save, X } from "lucide-react";
import { useTheme } from '../../context/ThemeContext';

const QuotaModal = ({ isOpen, onClose, customer, onSave, quotaPeriods, importedQuotas = [], rebateType = "Fixed", quotaType = "withQuota", selectedFrequency = "" }) => {
  const { theme } = useTheme();
  const [localQuotas, setLocalQuotas] = useState({});

  useEffect(() => {
    if (customer && customer.quotas) {
      const initialQuotas = {};
      
      if (customer.quotas.length > 0) {
        const monthlyPeriods = getMonthlyPeriodsFromQuotaPeriods();
        monthlyPeriods.forEach((_, index) => {
          initialQuotas[index] = customer.quotas[index] || "";
        });
      } else if (importedQuotas.length > 0) {
        importedQuotas.forEach((quota, index) => {
          if (index < quotaPeriods.length) {
            initialQuotas[index] = quota || "";
          }
        });
      }
      
      const monthlyPeriods = getMonthlyPeriodsFromQuotaPeriods();
      monthlyPeriods.forEach((_, index) => {
        if (initialQuotas[index] === undefined) {
          initialQuotas[index] = "";
        }
      });
      
      setLocalQuotas(initialQuotas);
    }
  }, [customer, importedQuotas, quotaPeriods]);

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