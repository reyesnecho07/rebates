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
  noDecimals = false // Add this new prop
}) => {
  // Theme-based styling - matching your exact pattern
  const isDark = theme === 'dark';
  
  // Card container styling
  const cardClasses = `relative overflow-hidden rounded-xl border shadow-sm transition-all duration-300 group hover:shadow-md ${
    isDark 
      ? 'bg-gray-800 border-gray-700 hover:shadow-lg hover:shadow-gray-900/30' 
      : 'bg-white border-gray-200 hover:shadow-lg'
  } ${className}`;
  
  // Text colors matching your pattern
  const titleClasses = `text-sm font-semibold truncate ${
    isDark ? 'text-gray-100' : 'text-gray-900'
  }`;
  
  const subtitleClasses = `text-xs mt-1 ${
    isDark ? 'text-gray-400' : 'text-gray-600'
  }`;
  
  const valueClasses = `text-3xl lg:text-4xl font-extrabold tracking-tight ${
    isDark ? 'text-white' : 'text-gray-900'
  }`;
  
  const suffixClasses = `ml-1 text-lg font-semibold ${
    isDark ? 'text-gray-300' : 'text-gray-700'
  }`;
  
  const dividerClasses = `h-1 w-12 rounded-full transition-colors duration-300 ${
    isDark 
      ? 'bg-gray-700 group-hover:bg-gray-600' 
      : 'bg-gray-900/10 group-hover:bg-gray-900/20'
  }`;
  
  // Variant-specific rail and icon colors
  const variantColors = {
    emerald: {
      rail: isDark ? 'bg-emerald-600' : 'bg-emerald-500',
      iconBg: isDark ? 'bg-emerald-700' : 'bg-emerald-600',
      iconColor: 'text-white',
      border: isDark ? 'border-emerald-800/50' : 'border-emerald-200',
      surface: isDark ? 'bg-emerald-900/20' : 'bg-emerald-50/40',
    },
    blue: {
      rail: isDark ? 'bg-blue-600' : 'bg-blue-500',
      iconBg: isDark ? 'bg-blue-700' : 'bg-blue-600',
      iconColor: 'text-white',
      border: isDark ? 'border-blue-800/50' : 'border-blue-200',
      surface: isDark ? 'bg-blue-900/20' : 'bg-blue-50/40',
    },
    amber: {
      rail: isDark ? 'bg-amber-600' : 'bg-amber-500',
      iconBg: isDark ? 'bg-amber-700' : 'bg-amber-600',
      iconColor: 'text-white',
      border: isDark ? 'border-amber-800/50' : 'border-amber-200',
      surface: isDark ? 'bg-amber-900/20' : 'bg-amber-50/40',
    },
    purple: {
      rail: isDark ? 'bg-purple-600' : 'bg-purple-500',
      iconBg: isDark ? 'bg-purple-700' : 'bg-purple-600',
      iconColor: 'text-white',
      border: isDark ? 'border-purple-800/50' : 'border-purple-200',
      surface: isDark ? 'bg-purple-900/20' : 'bg-purple-50/40',
    },
  };

  const colors = variantColors[variant] || variantColors.emerald;

  const formatNumber = (num) => {
    if (typeof num !== 'number') {
      if (typeof num === 'string' && num.includes('₱')) {
        return { value: num, suffix: '', hasCurrencySymbol: true };
      }
      return { value: num || '0', suffix: '', hasCurrencySymbol: false };
    }

    if (isCurrency) {
      return {
        value: `₱${num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`,
        suffix: '',
        hasCurrencySymbol: true
      };
    }

    // FIX: For noDecimals, show the full number with commas for thousands
    if (noDecimals) {
      // Format with commas for thousands but no decimal places
      const formattedNumber = Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return { value: formattedNumber, suffix: '', hasCurrencySymbol: false };
    }
    
    // For decimals (default), format with 2 decimal places and abbreviate
    const abs = Math.abs(num);
    
    if (abs >= 1e9) return { value: (num / 1e9).toFixed(2), suffix: 'B' };
    if (abs >= 1e6) return { value: (num / 1e6).toFixed(2), suffix: 'M' };
    if (abs >= 1e3) return { value: (num / 1e3).toFixed(2), suffix: 'K' };
    return { value: num.toFixed(2), suffix: '' };
  };

  const formattedValue = formatNumber(value);

  return (
    <div className={cardClasses}>
      {/* Vertical rail */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.rail}`} />

      {/* Layered surface */}
      <div className={`absolute inset-0 ${colors.surface} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative p-6 pl-7">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0">
            <h3 className={titleClasses}>
              {title}
            </h3>
            <p className={subtitleClasses}>
              {subtitle}
            </p>
          </div>

          {/* Icon badge */}
          <div className={`
            w-10 h-10 rounded-lg
            flex items-center justify-center
            ${colors.iconBg}
            shadow-md
            group-hover:scale-105
            transition-transform duration-300
          `}>
            <Icon size={20} className={colors.iconColor} />
          </div>
        </div>

        {/* Value */}
        <div className="space-y-3">
          <div className="flex items-baseline flex-wrap">
            <span className={valueClasses}>
              {formattedValue.hasCurrencySymbol ? (
                formattedValue.value
              ) : (
                <>
                  {formattedValue.value}
                  {formattedValue.suffix && (
                    <span className={suffixClasses}>
                      {formattedValue.suffix}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          {/* Bottom divider */}
          <div className={dividerClasses} />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;