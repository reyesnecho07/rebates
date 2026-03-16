import React, { useState, useEffect } from "react";
import { Percent, Save, X } from "lucide-react";
import { useTheme } from '../../context/ThemeContext';

const PercentageModal = ({ isOpen, onClose, customer, onSave, quotaPeriods, selectedFrequency = "" }) => {
  const { theme } = useTheme();
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
        // Try to get value from percentages array first
        if (customer.percentages && customer.percentages[index] !== undefined) {
          console.log(`📊 Loading from percentages[${index}]:`, customer.percentages[index]);
          initialQuotas[index] = customer.percentages[index] || "";
        }
        // Then try from quotaDetails (for backward compatibility)
        else if (customer.quotaDetails && customer.quotaDetails[index]) {
          console.log(`📊 Loading from quotaDetails[${index}]:`, customer.quotaDetails[index].TargetQty);
          initialQuotas[index] = customer.quotaDetails[index].TargetQty || "";
        }
        // Then try from quotas array (for backward compatibility)
        else if (customer.quotas && customer.quotas[index] !== undefined) {
          console.log(`📊 Loading from quotas[${index}]:`, customer.quotas[index]);
          initialQuotas[index] = customer.quotas[index] || "";
        }
        // Otherwise initialize empty
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
    // Allow only numbers and decimal points
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setLocalQuotas(prev => ({
        ...prev,
        [periodIndex]: value
      }));
    }
  };

  const handleSave = () => {
    const displayPeriods = getDisplayPeriods();
    
    // Create array of objects with Month and TargetQty
    const quotasData = displayPeriods.map((period, index) => ({
      Month: period.label || period.month || period.period || `Month ${index + 1}`,
      TargetQty: localQuotas[index] || "0"
    }));
    
    console.log('💾 Modal saving data:', quotasData);
    console.log('📊 Local quotas state:', localQuotas);
    
    // Also save the simple array format for backward compatibility
    const quotasArray = displayPeriods.map((_, index) => localQuotas[index] || "");
    
    console.log('💾 Saving percentages array:', quotasArray);
    
    // Call onSave with both formats
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`rounded-2xl w-[95%] max-w-7xl max-h-[90vh] overflow-hidden relative shadow-2xl border-0 ${
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-0'
      }`}>
        <div className={`flex items-center justify-between px-6 py-5 border-b ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-orange-900/30 to-orange-800/30 border-orange-800'
            : 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl backdrop-blur-sm ${
              theme === 'dark'
                ? 'bg-orange-500/30'
                : 'bg-orange-500/20'
            }`}>
              <Percent className={`w-5 h-5 ${
                theme === 'dark' ? 'text-orange-300' : 'text-orange-600'
              }`} />
            </div>
            <div className="space-y-1">
              <h2 className={`text-xl font-bold ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Manage Rebate Targets - {selectedFrequency}
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
                : 'bg-white/80 hover:bg-white border-orange-200 hover:border-orange-300'
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
                    ? 'bg-orange-700 text-orange-100'
                    : 'bg-orange-500 text-white'
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
            {displayPeriods.map((period, index) => (
              <div 
                key={index} 
                className={`border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 group ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 hover:border-orange-600 hover:bg-gray-700/50'
                    : 'bg-white border-orange-100 hover:border-orange-200 hover:bg-orange-50/30'
                }`}
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        theme === 'dark' ? 'bg-orange-400' : 'bg-orange-500'
                      }`}></div>
                      <h3 className={`font-bold text-base ${
                        theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                      }`}>{period.label}</h3>
                    </div>
                    {selectedFrequency === "Quarterly" && period.quarter && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        theme === 'dark'
                          ? 'bg-orange-900/50 text-orange-300'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {period.quarter}
                      </span>
                    )}
                  </div>
                  {period.dates && (
                    <p className={`text-xs font-medium ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>{period.dates}</p>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className={`text-sm font-semibold ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Target Qty
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={localQuotas[index] || ""}
                      onChange={(e) => handleQuotaChange(index, e.target.value)}
                      className={`w-full pl-8 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 font-medium ${
                        theme === 'dark'
                          ? 'bg-gray-600 border-gray-500 text-gray-200 placeholder-gray-400 focus:ring-orange-500/50 focus:border-orange-400'
                          : 'bg-white border-orange-200 text-gray-800 placeholder-gray-400 focus:ring-orange-500/50 focus:border-orange-400'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {displayPeriods.length === 0 && (
            <div className="text-center py-12">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
                theme === 'dark'
                  ? 'bg-orange-900/20 border-orange-800'
                  : 'bg-orange-50 border-orange-100'
              }`}>
                <Percent className={`w-8 h-8 ${
                  theme === 'dark' ? 'text-orange-400' : 'text-orange-400'
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>No Target Periods</h3>
              <p className={`text-sm max-w-md mx-auto ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Configure date ranges and frequency settings to generate target periods for management.
              </p>
            </div>
          )}
        </div>

        <div className={`flex justify-between items-center p-8 border-t ${
          theme === 'dark'
            ? 'bg-orange-900/10 border-orange-800'
            : 'bg-orange-50/30 border-orange-100'
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
              className="px-8 py-3 bg-orange-600 text-white hover:bg-orange-700 rounded-xl transition-all duration-200 font-semibold flex items-center gap-2 hover:scale-105 shadow-lg shadow-orange-500/30"
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