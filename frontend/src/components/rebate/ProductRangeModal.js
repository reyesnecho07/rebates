import React, { useState, useEffect } from "react";
import { TrendingUp, Save, X, Plus, Minus } from "lucide-react";
import { useTheme } from '../../context/ThemeContext';

const ProductRangeModal = ({ isOpen, onClose, product, onSave, quotaPeriods, rebateType = "Fixed", quotaType = "withQuota" }) => {
  const { theme } = useTheme();
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`rounded-2xl w-[95%] max-w-7xl max-h-[90vh] overflow-hidden relative shadow-2xl border-0 ${
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-0'
      }`}>
        <div className={`flex items-center justify-between px-6 py-5 border-b ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-purple-900/30 to-purple-800/30 border-purple-800'
            : 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl backdrop-blur-sm ${
              theme === 'dark'
                ? 'bg-purple-500/30'
                : 'bg-purple-500/20'
            }`}>
              <TrendingUp className={`w-5 h-5 ${
                theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
              }`} />
            </div>
            <div className="space-y-1">
              <h2 className={`text-xl font-bold ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Manage Product Rebate Ranges
              </h2>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {product.code} • {product.name} • Progressive Rebate Structure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2.5 rounded-xl transition-all duration-200 border ${
              theme === 'dark'
                ? 'bg-gray-700/80 hover:bg-gray-600 border-gray-600 hover:border-gray-500'
                : 'bg-white/80 hover:bg-white border-purple-200 hover:border-purple-300'
            }`}
          >
            <X className={`w-5 h-5 transition-colors ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-800'
            }`} />
          </button>
        </div>

        {quotaPeriods.length > 1 && (
          <div className={`px-6 py-4 border-b ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex flex-wrap gap-2">
              {quotaPeriods.map((period, index) => (
                <button
                  key={index}
                  onClick={() => setActivePeriod(index)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activePeriod === index
                      ? theme === 'dark'
                        ? "bg-purple-600 text-white shadow-md"
                        : "bg-purple-500 text-white shadow-md"
                      : theme === 'dark'
                      ? "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {period.period}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`p-8 max-h-[50vh] overflow-y-auto custom-scrollbar ${
          theme === 'dark' ? 'bg-gray-800' : ''
        }`}>
          <div className={`mb-6 p-4 border rounded-xl ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-purple-900/20 to-purple-900/20 border-purple-800'
              : 'bg-gradient-to-r from-purple-50 to-purple-50 border-purple-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`} />
                <div>
                  <h4 className={`font-semibold text-sm ${
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-800'
                  }`}>
                    {quotaPeriods[activePeriod]?.period} : {quotaPeriods[activePeriod]?.dates}
                  </h4>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-700'
                  }`}>
                    Set progressive rebate ranges for this product. Higher rebates apply as sales volume increases.
                  </p>
                </div>
              </div>
              
              {quotaPeriods.length > 1 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const source = activePeriod;
                      const target = (activePeriod + 1) % quotaPeriods.length;
                      copyRangesToPeriod(source, target);
                    }}
                    className={`px-3 py-1 text-xs rounded-lg hover:opacity-90 transition-colors ${
                      theme === 'dark'
                        ? 'bg-blue-700 text-blue-100 hover:bg-blue-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    Copy to Next
                  </button>
                  <button
                    onClick={() => copyRangesToAllPeriods(activePeriod)}
                    className={`px-3 py-1 text-xs rounded-lg hover:opacity-90 transition-colors ${
                      theme === 'dark'
                        ? 'bg-purple-700 text-purple-100 hover:bg-purple-600'
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                  >
                    Copy to All Future
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            {localRanges[activePeriod]?.map((range, rangeIndex) => (
              <div key={rangeIndex} className={`border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 hover:border-purple-600 hover:bg-gray-700/50'
                  : 'bg-white border-purple-100 hover:border-purple-200 hover:bg-purple-50/30'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold text-lg ${
                    theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                  }`}>Range {rangeIndex + 1}</h3>
                  {localRanges[activePeriod].length > 1 && (
                    <button
                      onClick={() => removeRange(activePeriod, rangeIndex)}
                      className={`p-2 rounded-xl transition-all ${
                        theme === 'dark'
                          ? 'text-red-400 hover:bg-red-900/30'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className={`text-sm font-semibold ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Minimum Quantity
                    </label>
                    <input
                      type="text"
                      value={range.min}
                      onChange={(e) => handleRangeChange(activePeriod, rangeIndex, 'min', e.target.value)}
                      placeholder="Min"
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 font-medium ${
                        theme === 'dark'
                          ? 'bg-gray-600 border-gray-500 text-gray-200 placeholder-gray-400 focus:ring-purple-500/50 focus:border-purple-400'
                          : 'bg-white border-purple-200 text-gray-800 placeholder-gray-400 focus:ring-purple-500/50 focus:border-purple-400'
                      }`}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className={`text-sm font-semibold ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Maximum Quantity
                    </label>
                    <input
                      type="text"
                      value={range.max}
                      onChange={(e) => handleRangeChange(activePeriod, rangeIndex, 'max', e.target.value)}
                      placeholder="Max"
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 font-medium ${
                        theme === 'dark'
                          ? 'bg-gray-600 border-gray-500 text-gray-200 placeholder-gray-400 focus:ring-purple-500/50 focus:border-purple-400'
                          : 'bg-white border-purple-200 text-gray-800 placeholder-gray-400 focus:ring-purple-500/50 focus:border-purple-400'
                      }`}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className={`text-sm font-semibold ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Rebate per Bag
                    </label>
                    <input
                      type="text"
                      value={range.rebate}
                      onChange={(e) => handleRangeChange(activePeriod, rangeIndex, 'rebate', e.target.value)}
                      placeholder="Rebate amount"
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 font-medium ${
                        theme === 'dark'
                          ? 'bg-gray-600 border-gray-500 text-gray-200 placeholder-gray-400 focus:ring-purple-500/50 focus:border-purple-400'
                          : 'bg-white border-purple-200 text-gray-800 placeholder-gray-400 focus:ring-purple-500/50 focus:border-purple-400'
                      }`}
                    />
                  </div>
                </div>
                
                <div className={`mt-3 text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Range: {range.min} - {range.max} bags → Rebate: {range.rebate || "0"}/bag
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={() => addRange(activePeriod)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl ${
                theme === 'dark'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Another Range for {quotaPeriods[activePeriod]?.period}
            </button>
          </div>
        </div>

        <div className={`flex justify-between items-center p-8 border-t ${
          theme === 'dark'
            ? 'bg-purple-900/10 border-purple-800'
            : 'bg-purple-50/30 border-purple-100'
        }`}>
          <div className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {localRanges[activePeriod]?.length || 0} range{(localRanges[activePeriod]?.length || 0) !== 1 ? 's' : ''} configured for {quotaPeriods[activePeriod]?.period}
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
              className={`px-8 py-3 rounded-xl transition-all duration-200 font-semibold flex items-center gap-2 hover:scale-105 shadow-lg ${
                theme === 'dark'
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-500/30'
                  : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-500/30'
              }`}
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