import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * SideBarError Component
 * 
 * Displays error messages in the sidebar with a retry button.
 * Used when navigation data fails to load from the API.
 * 
 * @param {string} error - The error message to display
 * @param {function} onRetry - Callback function to retry loading data
 * @param {boolean} collapsed - Whether the sidebar is collapsed
 * @param {boolean} isDark - Whether dark theme is active
 */
const SideBarError = ({ error, onRetry, collapsed, isDark }) => {
  return (
    <div className={`
      flex flex-col items-center justify-center 
      ${collapsed ? 'h-auto py-4' : 'h-full p-6'}
      text-center gap-3
    `}>
      {/* Error Icon with subtle animation */}
      <div className={`
        relative
        ${!collapsed ? 'mb-2' : ''}
      `}>
        <div className={`
          absolute inset-0 rounded-full animate-ping opacity-20
          ${isDark ? 'bg-red-400' : 'bg-red-500'}
        `} />
        <AlertCircle className={`
          relative w-8 h-8
          ${isDark ? 'text-red-400' : 'text-red-500'}
        `} />
      </div>

      {/* Error Message with improved typography */}
      {!collapsed && (
        <div className="space-y-1">
          <p className={`
            text-sm font-medium
            ${isDark ? 'text-gray-200' : 'text-gray-800'}
          `}>
            Failed to load navigation
          </p>
          <p className={`
            text-xs max-w-[180px] mx-auto
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}>
            {error}
          </p>
        </div>
      )}

      {/* Enhanced Retry Button */}
      <button
        onClick={onRetry}
        title={collapsed ? "Retry" : ""}
        className={`
          group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
          transition-all duration-200 ease-in-out
          ${collapsed ? 'mt-2' : 'mt-3'}
          ${isDark 
            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-600' 
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow'
          }
        `}
      >
        <RefreshCw 
          size={14} 
          className={`
            transition-transform duration-300 ease-in-out
            group-hover:rotate-180
            ${isDark ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-700'}
          `} 
        />
        {!collapsed && (
          <span className="transition-colors duration-200">
            Try again
          </span>
        )}
      </button>

      {/* Optional subtle hint for collapsed state */}
      {collapsed && (
        <div className={`
          w-1 h-1 rounded-full mt-1
          ${isDark ? 'bg-gray-700' : 'bg-gray-300'}
        `} />
      )}
    </div>
  );
};

export default SideBarError;