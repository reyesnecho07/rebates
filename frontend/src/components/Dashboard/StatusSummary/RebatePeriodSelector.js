import React, { useState, useEffect } from 'react';

const RebatePeriodSelector = ({ customerCode, theme, onSelectRebate }) => {
  const [mode, setMode] = useState('quarter'); // 'quarter' | 'rebateCode'
  const [data, setData] = useState({ byQuarter: [], byRebateCode: [] });
  const [expandedQuarter, setExpandedQuarter] = useState(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!customerCode) return;
    fetch(`http://192.168.100.193:3009/api/van/dashboard/customer/${customerCode}/rebate-periods?db=VAN`)
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data); });
  }, [customerCode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          onClick={() => setMode('quarter')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            mode === 'quarter' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >By Quarter</button>
        <button
          onClick={() => setMode('rebateCode')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            mode === 'rebateCode' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >By Rebate Code</button>
      </div>

      {mode === 'quarter' ? (
        <div className="flex flex-col gap-2">
          {data.byQuarter.map(q => (
            <div key={q.quarterLabel} className="border rounded-lg">
              <button
                onClick={() => setExpandedQuarter(expandedQuarter === q.quarterLabel ? null : q.quarterLabel)}
                className="w-full flex justify-between items-center px-3 py-2 text-left"
              >
                <span className="font-semibold text-sm">{q.quarterLabel}</span>
                <span className="text-xs opacity-60">{q.rebates.length} rebate{q.rebates.length > 1 ? 's' : ''}</span>
              </button>
              {expandedQuarter === q.quarterLabel && (
                <div className="flex flex-col border-t divide-y">
                  {q.rebates.map(r => (
                    <button
                      key={r.rebateCode}
                      onClick={() => onSelectRebate(r)}
                      className="px-4 py-2 text-left text-xs hover:bg-slate-50"
                    >
                      {r.rebateType} — {r.rebateCode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Newest on top, oldest (rebate code #1) at the bottom — matches array order from API
        <div className="flex flex-col-reverse gap-2">
          {data.byRebateCode.map(r => (
            <button
              key={r.rebateCode}
              onClick={() => onSelectRebate(r)}
              className="px-3 py-2 rounded-lg text-left text-xs border hover:bg-slate-50"
            >
              <div className="font-semibold">{r.rebateCode} ({r.rebateType})</div>
              <div className="opacity-60">{r.quarterLabel}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RebatePeriodSelector;