import React from 'react';

const MetricCard = ({
  title,
  value,
  subtitle = "Cumulative total",
  icon: Icon,
  variant = "emerald",
  isCurrency = false,
  className = "",
  theme = "light",
  noDecimals = false,
}) => {
  const isDark = theme === 'dark';

  const variantColors = {
    emerald: {
      rail:    isDark ? 'bg-emerald-500'                    : 'bg-emerald-500',
      iconBg:  isDark ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200',
      iconClr: isDark ? 'text-emerald-400'                  : 'text-emerald-600',
      value:   isDark ? 'text-emerald-300'                  : 'text-emerald-700',
      surface: isDark ? 'bg-emerald-500/5'                  : 'bg-emerald-50/50',
      divider: isDark ? 'bg-emerald-500/30'                 : 'bg-emerald-200',
    },
    blue: {
      rail:    isDark ? 'bg-blue-500'                       : 'bg-blue-500',
      iconBg:  isDark ? 'bg-blue-500/15 border-blue-500/30' : 'bg-blue-50 border-blue-200',
      iconClr: isDark ? 'text-blue-400'                     : 'text-blue-600',
      value:   isDark ? 'text-blue-300'                     : 'text-blue-700',
      surface: isDark ? 'bg-blue-500/5'                     : 'bg-blue-50/50',
      divider: isDark ? 'bg-blue-500/30'                    : 'bg-blue-200',
    },
    amber: {
      rail:    isDark ? 'bg-amber-500'                      : 'bg-amber-500',
      iconBg:  isDark ? 'bg-amber-500/15 border-amber-500/30' : 'bg-amber-50 border-amber-200',
      iconClr: isDark ? 'text-amber-400'                    : 'text-amber-600',
      value:   isDark ? 'text-amber-300'                    : 'text-amber-700',
      surface: isDark ? 'bg-amber-500/5'                    : 'bg-amber-50/50',
      divider: isDark ? 'bg-amber-500/30'                   : 'bg-amber-200',
    },
    purple: {
      rail:    isDark ? 'bg-violet-500'                     : 'bg-violet-500',
      iconBg:  isDark ? 'bg-violet-500/15 border-violet-500/30' : 'bg-violet-50 border-violet-200',
      iconClr: isDark ? 'text-violet-400'                   : 'text-violet-600',
      value:   isDark ? 'text-violet-300'                   : 'text-violet-700',
      surface: isDark ? 'bg-violet-500/5'                   : 'bg-violet-50/50',
      divider: isDark ? 'bg-violet-500/30'                  : 'bg-violet-200',
    },
  };

  const c = variantColors[variant] || variantColors.emerald;

  const formatNumber = (num) => {
    if (typeof num !== 'number') {
      if (typeof num === 'string' && num.includes('₱'))
        return { value: num, suffix: '', hasCurrencySymbol: true };
      return { value: num || '0', suffix: '', hasCurrencySymbol: false };
    }
    if (isCurrency)
      return { value: `₱${num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`, suffix: '', hasCurrencySymbol: true };
    if (noDecimals)
      return { value: Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','), suffix: '', hasCurrencySymbol: false };
    const abs = Math.abs(num);
    if (abs >= 1e9) return { value: (num / 1e9).toFixed(2), suffix: 'B' };
    if (abs >= 1e6) return { value: (num / 1e6).toFixed(2), suffix: 'M' };
    if (abs >= 1e3) return { value: (num / 1e3).toFixed(2), suffix: 'K' };
    return { value: num.toFixed(2), suffix: '' };
  };

  const fv = formatNumber(value);

  return (
    <div className={`relative overflow-hidden rounded-xl border shadow-sm transition-all duration-300 group hover:shadow-md ${
      isDark
        ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
        : 'bg-white border-slate-200 hover:border-slate-300'
    } ${className}`}>

      {/* Left accent rail */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${c.rail}`} />

      {/* Hover surface tint */}
      <div className={`absolute inset-0 ${c.surface} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative p-6 pl-7">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {title}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {subtitle}
            </p>
          </div>

          {/* Icon badge */}
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${c.iconBg}`}>
            <Icon size={18} className={c.iconClr} />
          </div>
        </div>

        {/* Value */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={`text-3xl lg:text-4xl font-extrabold tracking-tight tabular-nums ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {fv.hasCurrencySymbol ? fv.value : fv.value}
            </span>
            {!fv.hasCurrencySymbol && fv.suffix && (
              <span className={`text-lg font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {fv.suffix}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className={`h-0.5 w-10 rounded-full transition-all duration-300 group-hover:w-16 ${c.divider}`} />
        </div>

      </div>
    </div>
  );
};

export default MetricCard;