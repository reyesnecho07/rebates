import React from 'react';

const MetricCard = ({ 
  title, 
  value, 
  subtitle = "Cumulative total",
  icon: Icon,
  variant = "emerald",
  isCurrency = false,
  className = "",
  theme = "light"
}) => {
  const isDark = theme === 'dark';
  
  // Dark mode variants - matching the sidebar style
  const lightVariants = {
    emerald: {
      rail: "bg-emerald-500",
      iconBg: "bg-emerald-600",
      iconColor: "text-white",
      border: "border-emerald-200",
      surface: "bg-emerald-50/40",
      title: "text-gray-900",
      subtitle: "text-gray-600",
      value: "text-gray-900",
      divider: "bg-gray-900/10",
      dividerHover: "bg-gray-900/20",
      bg: "bg-white",
      shadow: "shadow-md hover:shadow-xl",
    },
    blue: {
      rail: "bg-blue-500",
      iconBg: "bg-blue-600",
      iconColor: "text-white",
      border: "border-blue-200",
      surface: "bg-blue-50/40",
      title: "text-gray-900",
      subtitle: "text-gray-600",
      value: "text-gray-900",
      divider: "bg-gray-900/10",
      dividerHover: "bg-gray-900/20",
      bg: "bg-white",
      shadow: "shadow-md hover:shadow-xl",
    },
    amber: {
      rail: "bg-amber-500",
      iconBg: "bg-amber-600",
      iconColor: "text-white",
      border: "border-amber-200",
      surface: "bg-amber-50/40",
      title: "text-gray-900",
      subtitle: "text-gray-600",
      value: "text-gray-900",
      divider: "bg-gray-900/10",
      dividerHover: "bg-gray-900/20",
      bg: "bg-white",
      shadow: "shadow-md hover:shadow-xl",
    },
    purple: {
      rail: "bg-purple-500",
      iconBg: "bg-purple-600",
      iconColor: "text-white",
      border: "border-purple-200",
      surface: "bg-purple-50/40",
      title: "text-gray-900",
      subtitle: "text-gray-600",
      value: "text-gray-900",
      divider: "bg-gray-900/10",
      dividerHover: "bg-gray-900/20",
      bg: "bg-white",
      shadow: "shadow-md hover:shadow-xl",
    },
  };

  const darkVariants = {
    emerald: {
      rail: "bg-emerald-600",
      iconBg: "bg-emerald-700",
      iconColor: "text-white",
      border: "border-emerald-800/50",
      surface: "bg-emerald-900/20",
      title: "text-gray-100",
      subtitle: "text-gray-400",
      value: "text-white",
      divider: "bg-gray-700",
      dividerHover: "bg-gray-600",
      bg: "bg-gray-800/50 backdrop-blur-sm",
      shadow: "shadow-lg hover:shadow-xl hover:shadow-gray-900/50",
    },
    blue: {
      rail: "bg-blue-600",
      iconBg: "bg-blue-700",
      iconColor: "text-white",
      border: "border-blue-800/50",
      surface: "bg-blue-900/20",
      title: "text-gray-100",
      subtitle: "text-gray-400",
      value: "text-white",
      divider: "bg-gray-700",
      dividerHover: "bg-gray-600",
      bg: "bg-gray-800/50 backdrop-blur-sm",
      shadow: "shadow-lg hover:shadow-xl hover:shadow-gray-900/50",
    },
    amber: {
      rail: "bg-amber-600",
      iconBg: "bg-amber-700",
      iconColor: "text-white",
      border: "border-amber-800/50",
      surface: "bg-amber-900/20",
      title: "text-gray-100",
      subtitle: "text-gray-400",
      value: "text-white",
      divider: "bg-gray-700",
      dividerHover: "bg-gray-600",
      bg: "bg-gray-800/50 backdrop-blur-sm",
      shadow: "shadow-lg hover:shadow-xl hover:shadow-gray-900/50",
    },
    purple: {
      rail: "bg-purple-600",
      iconBg: "bg-purple-700",
      iconColor: "text-white",
      border: "border-purple-800/50",
      surface: "bg-purple-900/20",
      title: "text-gray-100",
      subtitle: "text-gray-400",
      value: "text-white",
      divider: "bg-gray-700",
      dividerHover: "bg-gray-600",
      bg: "bg-gray-800/50 backdrop-blur-sm",
      shadow: "shadow-lg hover:shadow-xl hover:shadow-gray-900/50",
    },
  };

  const colors = isDark ? darkVariants[variant] || darkVariants.emerald 
                       : lightVariants[variant] || lightVariants.emerald;

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

    const abs = Math.abs(num);
    if (abs >= 1e9) return { value: (num / 1e9).toFixed(2), suffix: 'B' };
    if (abs >= 1e6) return { value: (num / 1e6).toFixed(2), suffix: 'M' };
    if (abs >= 1e3) return { value: (num / 1e3).toFixed(2), suffix: 'K' };

    return { value: num.toFixed(2), suffix: '' };
  };

  const formattedValue = formatNumber(value);

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl 
        border ${colors.border}
        ${colors.bg}
        transition-all duration-300
        ${colors.shadow}
        group ${className}
      `}
    >
      {/* Vertical rail */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.rail}`} />

      {/* Layered surface */}
      <div className={`absolute inset-0 ${colors.surface} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative p-6 pl-7">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0">
            <h3 className={`text-sm font-semibold truncate ${colors.title}`}>
              {title}
            </h3>
            <p className={`text-xs mt-1 ${colors.subtitle}`}>
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
            <span className={`text-3xl lg:text-4xl font-extrabold tracking-tight ${colors.value}`}>
              {formattedValue.hasCurrencySymbol ? (
                formattedValue.value
              ) : (
                <>
                  {formattedValue.value}
                  {formattedValue.suffix && (
                    <span className={`ml-1 text-lg font-semibold ${colors.value}`}>
                      {formattedValue.suffix}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          {/* Bottom divider */}
          <div className={`h-1 w-12 rounded-full ${colors.divider} group-hover:${colors.dividerHover} transition-colors duration-300`} />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;