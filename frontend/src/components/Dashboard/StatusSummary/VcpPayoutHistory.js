import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Edit, RefreshCw } from 'lucide-react';

const VcpPayoutHistory = ({ 
  theme = 'light',
  customerModalTab,
  modalCustomer,
  paginatedPayouts,
  filteredPayouts,
  payoutCurrentPage,
  setPayoutCurrentPage,
  payoutRowsPerPage,
  setPayoutRowsPerPage,
  editingPayoutId,
  setEditingPayoutId,
  editedAmountReleased,
  setEditedAmountReleased,
  saveMessage,
  setSaveMessage,
  handlePayoutStatusChange,
  loadDetailedPayoutsData,
  formatCurrency,
  beginningBalance = 0,
  beginningBalances = [],
  previousBalance = 0,
  beginningBalanceRecord = null
}) => {
  const isDark = theme === 'dark';
  
  // State for SAP sync
  const [syncingSap, setSyncingSap] = useState(false);
  const [sapSyncMessage, setSapSyncMessage] = useState(null);
  const [showSapDetails, setShowSapDetails] = useState({}); // Track which rows show SAP details
  
  if (customerModalTab !== 'payout') return null;

  const monthNames = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

const parsePeriodToNumber = (periodStr) => {
  if (!periodStr) return 0;
  for (let i = 0; i < monthNames.length; i++) {
    if (periodStr.includes(monthNames[i])) {
      const yearMatch = periodStr.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 0;
      return year * 100 + (i + 1);
    }
  }
  return 0;
};
  
  // Helper function to extract month and year from period string
  const extractMonthYear = (period) => {
    // Handle different period formats like "Jan 2024", "January 2024", "Q1 2024", etc.
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    const shortMonthNames = [
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];
    
    // Convert to lowercase for easier matching
    const lowerPeriod = period.toLowerCase().trim();
    
    // Try to match full month name
    for (let i = 0; i < monthNames.length; i++) {
      if (lowerPeriod.includes(monthNames[i])) {
        // Extract year (look for 4-digit number)
        const yearMatch = period.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        return { month: i + 1, year, quarter: null };
      }
    }
    
    // Try to match short month name
    for (let i = 0; i < shortMonthNames.length; i++) {
      if (lowerPeriod.includes(shortMonthNames[i])) {
        const yearMatch = period.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        return { month: i + 1, year, quarter: null };
      }
    }
    
    // Try to match quarter format (Q1 2024)
    const quarterMatch = lowerPeriod.match(/q([1-4])\s*(20\d{2})?/);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]);
      const year = quarterMatch[2] ? parseInt(quarterMatch[2]) : new Date().getFullYear();
      // Convert quarter to month (Q1 = Jan-Mar, but we'll use the first month for sorting)
      const month = (quarter - 1) * 3 + 1;
      return { month, year, quarter };
    }
    
    // Try to match month number format (MM/YYYY or MM-YYYY)
    const monthNumMatch = period.match(/(\d{1,2})[\/\-]\s*(20\d{2})/);
    if (monthNumMatch) {
      const month = parseInt(monthNumMatch[1]);
      const year = parseInt(monthNumMatch[2]);
      if (month >= 1 && month <= 12) {
        return { month, year, quarter: null };
      }
    }
    
    // Default: use current date
    return { month: 1, year: new Date().getFullYear(), quarter: null };
  };
  
  // Helper function to sort payouts by period (month/year)
// Helper function to sort payouts by period (month/year) in ASCENDING order
const sortPayoutsByPeriod = (payouts) => {
  return [...payouts].sort((a, b) => {
    const aDate = extractMonthYear(a.Period);
    const bDate = extractMonthYear(b.Period);
    
    // First compare by year - ascending (older years first)
    if (aDate.year !== bDate.year) {
      return aDate.year - bDate.year; // Ascending: smaller year first
    }
    
    // Then compare by month - ascending (January to December)
    if (aDate.month !== bDate.month) {
      return aDate.month - bDate.month; // Ascending: smaller month number first
    }
    
    // If same month/year, maintain original order
    return 0;
  });
};
  
  // Sort the payouts for display
  const sortedPaginatedPayouts = sortPayoutsByPeriod(paginatedPayouts);
  const sortedFilteredPayouts = sortPayoutsByPeriod(filteredPayouts);
  
  // Function to manually sync SAP data
  const handleSapSync = async () => {
    if (!modalCustomer?.cardCode) {
      setSapSyncMessage('❌ No customer selected');
      setTimeout(() => setSapSyncMessage(null), 3000);
      return;
    }
    
    setSyncingSap(true);
    setSapSyncMessage('🔄 Syncing with SAP Journal Entries...');
    
    try {
      const payload = {
        db: 'VCP_OWN',
        rebateCode: modalCustomer?.rebateCode,
        periodFrom: modalCustomer?.dateRange?.periodFrom,
        periodTo: modalCustomer?.dateRange?.periodTo
      };
      
      const response = await fetch(`http://192.168.100.193:3006/api/vcp/customer/${modalCustomer.cardCode}/sync-sap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setSapSyncMessage(`✅ SAP sync complete: Updated ${result.data.updatedCount} payout records`);
        // Reload payouts data
        await loadDetailedPayoutsData();
      } else {
        throw new Error(result.message || 'Sync failed');
      }
      
    } catch (error) {
      console.error('SAP sync error:', error);
      setSapSyncMessage(`❌ SAP sync failed: ${error.message}`);
    } finally {
      setSyncingSap(false);
      setTimeout(() => setSapSyncMessage(null), 5000);
    }
  };
  
  // Toggle SAP details for a specific row
  const toggleSapDetails = (payoutId) => {
    setShowSapDetails(prev => ({
      ...prev,
      [payoutId]: !prev[payoutId]
    }));
  };
  
  // Helper function to get calculation details for tooltip
  const getCalculationDetails = (payout) => {
    const isPercentage = modalCustomer?.rebateType === 'Percentage';
    const isQtrRebate = payout.isQtrRebate;
    
    if (!payout.BaseAmount || payout.BaseAmount === 0) {
      if (payout.BaseAmount === 0 && isPercentage) {
        return 'No actual sales → Percentage = 0';
      }
      return 'No transactions → Base = 0';
    }
    
    // Use calculation note from backend if available
    if (payout.calculationNote) {
      return payout.calculationNote;
    }
    
    if (isPercentage) {
      if (isQtrRebate) {
        return `Sales: ₱${payout.totalActualSales?.toFixed(2) || '0.00'} × ${payout.percentageValue || modalCustomer?.percentageValue || 0}% = ₱${payout.BaseAmount?.toFixed(2) || '0.00'}`;
      } else {
        return `Actual Sales: ₱${payout.totalActualSales?.toFixed(2) || '0.00'} × ${payout.percentageValue || modalCustomer?.percentageValue || 0}% = ₱${payout.BaseAmount?.toFixed(2) || '0.00'}`;
      }
    } else {
      if (isQtrRebate) {
        const totalBase = payout.totalBaseAmount || payout.BaseAmount;
        const qtrRebate = modalCustomer?.qtrRebate || 1;
        return `Total Base: ₱${totalBase.toFixed(2)} × ${qtrRebate} = ₱${payout.BaseAmount.toFixed(2)}`;
      } else {
        return `Qty: ${payout.totalQtyForReb?.toFixed(2) || '0.00'} × ₱${modalCustomer?.rebatePerBag || '0.00'} = ₱${payout.BaseAmount?.toFixed(2) || '0.00'}`;
      }
    }
  };

  const getTotalAmountDetails = (payout) => {
    const isPercentage = modalCustomer?.rebateType === 'Percentage';
    const isQtrRebate = payout.isQtrRebate;
    const hasPreviousBalance = payout.PreviousBalance > 0;
    
    let details = '';
    
    if (isPercentage) {
      details = `Base (${payout.percentageValue || modalCustomer?.percentageValue || 0}% of Sales): ₱${payout.BaseAmount?.toFixed(2) || '0.00'}`;
    } else if (isQtrRebate) {
      details = `Quarter Rebate: ₱${payout.BaseAmount?.toFixed(2) || '0.00'}`;
    } else {
      details = `Base (Qty × Rate): ₱${payout.BaseAmount?.toFixed(2) || '0.00'}`;
    }
    
    if (hasPreviousBalance && !isQtrRebate) {
      details += `\n+ Previous Balance: ₱${payout.PreviousBalance?.toFixed(2) || '0.00'}`;
      details += `\n= Total: ₱${payout.TotalAmount?.toFixed(2) || '0.00'}`;
    }
    
    // Add SAP info if available
    if (payout.SapReleasedAmount > 0) {
      details += `\n\nSAP Released: ₱${payout.SapReleasedAmount.toFixed(2)}`;
    }
    
    return details;
  };

  // Format SAP date
  const formatSapDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  };
  
  // Styling classes based on theme
  const headerClasses = `px-6 py-3 border-b ${
    isDark ? 'border-gray-700' : 'border-gray-200'
  } ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gray-50'}`;

  const titleClasses = `text-base font-bold ${
    isDark ? 'text-gray-100' : 'text-gray-900'
  }`;

  const subtitleClasses = `text-xs ${
    isDark ? 'text-gray-400' : 'text-gray-600'
  }`;

  const tableContainerClasses = `flex-1 overflow-auto ${
    isDark ? 'bg-gray-800' : 'bg-white'
  }`;

  const tableHeaderClasses = `sticky top-0 ${
    isDark 
      ? 'bg-gradient-to-r from-gray-800 to-gray-900' 
      : 'bg-gray-50'
  }`;

  const tableHeaderRowClasses = `font-semibold uppercase tracking-wider border-b ${
    isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'
  }`;

  const tableBodyClasses = `divide-y ${
    isDark ? 'divide-gray-700' : 'divide-gray-100'
  }`;

  const footerClasses = `px-6 py-2 border-t ${
    isDark ? 'border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900' : 'border-gray-200 bg-gray-50'
  }`;

  const footerTextClasses = `text-xs ${
    isDark ? 'text-gray-400' : 'text-gray-600'
  }`;

  const selectClasses = `border rounded px-2 py-1 text-xs ${
    isDark 
      ? 'bg-gray-700 border-gray-600 text-gray-100' 
      : 'border-gray-300 text-gray-700'
  }`;

  const paginationButtonClasses = (isActive, isDisabled = false) => {
    if (isDisabled) {
      return `p-1 rounded transition-colors ${
        isDark ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed'
      }`;
    }
    
    if (isActive) {
      return `px-2 py-0.5 text-xs rounded ${
        isDark 
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
      }`;
    }
    
    return `px-2 py-0.5 text-xs rounded transition-colors ${
      isDark 
        ? 'text-gray-300 hover:bg-gray-700' 
        : 'text-gray-700 hover:bg-gray-100'
    }`;
  };

  const navButtonClasses = (isDisabled = false) => {
    if (isDisabled) {
      return `p-1 rounded transition-colors ${
        isDark ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed'
      }`;
    }
    
    return `p-1 rounded transition-colors ${
      isDark 
        ? 'text-gray-300 hover:bg-gray-700' 
        : 'text-gray-700 hover:bg-gray-200'
    }`;
  };

  const ellipsisClasses = `text-gray-400 mx-1`;

  const totalPages = Math.ceil(sortedFilteredPayouts.length / payoutRowsPerPage);
  const getPaginationRange = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (payoutCurrentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (payoutCurrentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', payoutCurrentPage - 1, payoutCurrentPage, payoutCurrentPage + 1, '...', totalPages);
      }
    }
    
    return pages;
  };

  const renderPayoutRow = (payout, index) => {
    const isQtrRebate = payout.isQtrRebate;
    const isPercentage = modalCustomer?.rebateType === 'Percentage';
    const isFixed = modalCustomer?.rebateType === 'Fixed';
    const hasTransactions = payout.BaseAmount > 0;
    const isEligibleForPayout = payout.TotalAmount > 0;
    const isNoTransactionOrNotEligible = !isEligibleForPayout;
    const isEditable = payout.Status !== 'No Payout' && hasTransactions && isEligibleForPayout;
    
    // Check if this payout has SAP data
    const hasSapData = payout.SapReleasedAmount > 0;
    const isEditing = editingPayoutId === payout.Id;
    const showSapDetailsForRow = showSapDetails[payout.Id];
    
    // Determine the source of the amount released (SAP or Manual)
    const amountSource = hasSapData && payout.AmountReleased === payout.SapReleasedAmount 
      ? 'sap' 
      : 'manual';
    
    const rowClasses = `
      ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} 
      ${isQtrRebate ? 
        (isDark 
          ? 'bg-gradient-to-r from-blue-900/20 to-sky-900/20 border-l-4 border-l-blue-500' 
          : 'bg-gradient-to-r from-blue-50 to-sky-50 border-l-4 border-l-blue-400') : ''}
      ${isNoTransactionOrNotEligible ? 
        (isDark ? 'bg-gray-700/30' : 'bg-gray-50/60') : ''}
      ${payout.Status === 'No Payout' ? 
        (isDark ? 'bg-gray-700/40 opacity-70' : 'bg-gray-50 opacity-70') : ''}
      ${hasSapData ? 
        (isDark ? 'border-l-2 border-l-purple-500' : 'border-l-2 border-l-purple-400') : ''}
    `;

    const dateTextClasses = `font-medium ${
      isDark ? 'text-gray-100' : 'text-gray-900'
    }`;

    const qtrRebateTextClasses = `text-[10px] font-medium ${
      isDark ? 'text-blue-400' : 'text-blue-600'
    }`;

    const periodTextClasses = `font-medium ${
      isQtrRebate ? 
        (isDark ? 'text-purple-300' : 'text-purple-700') : 
      isNoTransactionOrNotEligible ? 
        (isDark ? 'text-gray-400 italic' : 'text-gray-500 italic') :
      payout.Status === 'No Payout' ? 
        (isDark ? 'text-gray-400' : 'text-gray-500') : 
      isDark ? 'text-gray-200' : 'text-gray-800'
    }`;

    // Base Amount Column Styling
    const baseAmountClasses = `inline-block px-2 py-0.5 font-medium rounded border whitespace-nowrap ${
      hasTransactions ? 
        (isPercentage ? 
          (isDark 
            ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' 
            : 'bg-emerald-100 text-emerald-700 border-emerald-200') :
          isDark 
            ? 'bg-blue-900/30 text-blue-300 border-blue-700' 
            : 'bg-blue-100 text-blue-700 border-blue-200'
        ) : 
      isDark 
        ? 'bg-gray-700 text-gray-400 border-gray-600' 
        : 'bg-gray-100 text-gray-500 border-gray-200'
    }`;

    // Total Amount Column Styling
    const totalAmountClasses = `inline-block px-2 py-0.5 font-medium rounded border whitespace-nowrap ${
      isNoTransactionOrNotEligible ? 
        (isDark 
          ? 'bg-gray-700 text-gray-400 border-gray-600 italic' 
          : 'bg-gray-100 text-gray-500 border-gray-200 italic') :
      isQtrRebate ? 
        (isDark 
          ? 'bg-purple-900/30 text-purple-300 border-purple-700' 
          : 'bg-purple-100 text-purple-700 border-purple-200') :
      payout.Status === 'No Payout' ? 
        (isDark 
          ? 'bg-gray-700 text-gray-400 border-gray-600' 
          : 'bg-gray-100 text-gray-500 border-gray-200') :
      payout.TotalAmount > 0 ? 
        (isPercentage ?
          (isDark 
            ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' 
            : 'bg-emerald-100 text-emerald-700 border-emerald-200') :
          isDark 
            ? 'bg-amber-900/30 text-amber-300 border-amber-700' 
            : 'bg-amber-50 text-amber-700 border-amber-100'
        ) : 
      isDark 
        ? 'bg-gray-700 text-gray-400 border-gray-600' 
        : 'bg-gray-50 text-gray-500 border-gray-200'
    }`;

    // Tooltip classes
    const tooltipClasses = `absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none min-w-max ${
      isDark ? 'bg-gray-900 text-white' : 'bg-gray-900 text-white'
    }`;

    const tooltipArrowClasses = `absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent ${
      isDark ? 'border-t-gray-900' : 'border-t-gray-900'
    }`;

    return (
      <tr key={payout.Id || index} className={rowClasses}>
        <td className="px-6 py-2">
          <div className={dateTextClasses}>{payout.Date}</div>
          {isQtrRebate && (
            <div className={qtrRebateTextClasses}>Quarter Rebate</div>
          )}
          {isNoTransactionOrNotEligible && (
            <div className={`text-[10px] font-medium ${
              isDark ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {!hasTransactions ? 'No Transactions' : 'Not Eligible'}
            </div>
          )}
        </td>
        <td className="px-3 py-2">
          <div className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <div className={periodTextClasses}>
              {payout.Period}
            </div>
            {isNoTransactionOrNotEligible && (
              <div className={`text-[10px] mt-0.5 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {!hasTransactions ? 'No transactions this month' : 'No eligible transactions'}
              </div>
            )}
          </div>
        </td>
        
        {/* Base Amount Column */}
        <td className="px-3 py-2 text-center">
          <div className="relative group inline-block">
            <span className={baseAmountClasses}>
              {formatCurrency(payout.BaseAmount || 0)}
            </span>
            {hasTransactions && (
              <div className={tooltipClasses}>
                {getCalculationDetails(payout)}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
          </div>
        </td>
        
        {/* Total Amount Column */}
        <td className="px-3 py-2 text-center">
          <div className="relative group inline-block">
            <span className={totalAmountClasses}>
              {formatCurrency(payout.TotalAmount)}
            </span>
            {isEligibleForPayout && (
              <div className={tooltipClasses} style={{ whiteSpace: 'pre-line' }}>
                {getTotalAmountDetails(payout)}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
            {isNoTransactionOrNotEligible && (
              <div className={`${tooltipClasses} ${isDark ? 'bg-gray-800' : 'bg-gray-700'}`}>
                {!hasTransactions ? 'No transactions → Total = 0' : 'Quota not met → Total = 0'}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
          </div>
        </td>
        
        {/* Status Column */}
        <td className="px-3 py-2 text-center">
          <select 
            value={payout.Status}
            onChange={(e) => {
              if (isEditable) {
                handlePayoutStatusChange(payout.Id, e.target.value);
              }
            }}
            disabled={isNoTransactionOrNotEligible || !isEditable}
            className={`px-2 py-0.5 text-center rounded font-medium border appearance-none focus:outline-none w-full max-w-[100px] whitespace-nowrap text-xs ${
              isNoTransactionOrNotEligible || !isEditable ? 
                (isDark 
                  ? 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed italic' 
                  : 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed italic') :
              payout.Status === 'Paid' ? 
                (isDark 
                  ? 'bg-green-900/30 text-green-300 border-green-700 cursor-pointer' 
                  : 'bg-green-100 text-green-800 border-green-300 cursor-pointer') :
              payout.Status === 'Partially Paid' ? 
                (isDark 
                  ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 cursor-pointer' 
                  : 'bg-yellow-100 text-yellow-800 border-yellow-300 cursor-pointer') :
              payout.Status === 'Pending' ? 
                (isDark 
                  ? 'bg-blue-900/30 text-blue-300 border-blue-700 cursor-pointer' 
                  : 'bg-blue-100 text-blue-800 border-blue-300 cursor-pointer') : 
              isDark 
                ? 'bg-gray-700 text-gray-300 border-gray-600 cursor-pointer' 
                : 'bg-gray-100 text-gray-800 border-gray-300 cursor-pointer'
            }`}
          >
            <option value="No Payout">No Payout</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </td>
        
        {/* Amount Released Column - UPDATED WITH SAP INTEGRATION */}
        <td className="px-3 py-2 text-center">
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <span className={`absolute left-2 top-1/2 transform -translate-y-1/2 text-xs z-10 ${
                isNoTransactionOrNotEligible ? 
                  (isDark ? 'text-gray-500' : 'text-gray-400') : 
                (isDark ? 'text-white' : 'text-black')
              }`}>
                ₱
              </span>
              <input
                type="number"
                value={payout.AmountReleased || 0}
                className={`w-28 pl-6 pr-2 py-1 border rounded text-center text-xs ${
                  isNoTransactionOrNotEligible ? 
                    (isDark 
                      ? 'border-gray-600 bg-gray-700 text-gray-400 italic' 
                      : 'border-gray-300 bg-gray-100 text-gray-400 italic') :
                  isDark 
                    ? 'border-gray-600 bg-gray-700' 
                    : 'border-gray-300 bg-gray-100'
                } ${isDark ? 'text-white' : 'text-black'}`}
                placeholder={isNoTransactionOrNotEligible ? "N/A" : "0.00"}
                readOnly
                disabled
              />
            </div>
            
            {/* SAP Badge and Details */}
            {hasSapData && (
              <div className="relative w-full">

                {/* SAP Details Dropdown */}
                {showSapDetailsForRow && payout.sapEntries && payout.sapEntries.length > 0 && (
                  <div className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-72 p-3 rounded-lg shadow-xl z-30 text-left ${
                    isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                  }`}>
                    <div className={`text-xs font-semibold mb-2 flex items-center justify-between ${
                      isDark ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      <span>SAP Journal Entries</span>
                      <button 
                        onClick={() => toggleSapDetails(payout.Id)}
                        className={`p-1 rounded hover:bg-gray-700`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto">
                      {payout.sapEntries.map((entry, idx) => (
                        <div key={idx} className={`text-[10px] mb-2 pb-2 border-b ${
                          isDark ? 'border-gray-700' : 'border-gray-100'
                        } last:border-0`}>
                          <div className="flex justify-between items-start">
                            <div className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                              {formatSapDate(entry.docDate)}
                            </div>
                            <div className={`font-mono font-bold ${
                              isDark ? 'text-purple-300' : 'text-purple-700'
                            }`}>
                              ₱{entry.amount.toFixed(2)}
                            </div>
                          </div>
                          <div className={`text-[9px] mt-0.5 truncate ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {entry.memo || entry.acctName || `Account: ${entry.account}`}
                          </div>
                          <div className={`text-[8px] ${
                            isDark ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            TransId: {entry.transId}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className={`mt-2 text-[8px] pt-1 border-t ${
                      isDark ? 'border-gray-700 text-gray-500' : 'border-gray-100 text-gray-400'
                    }`}>
                      Total SAP: ₱{payout.SapReleasedAmount.toFixed(2)} | {payout.sapEntries.length} transaction(s)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </td>
        
        {/* Balance Column */}
        <td className="px-3 py-2 text-center">
          <div className="relative group inline-block">
            <span className={`inline-block px-3 py-1 font-medium rounded border whitespace-nowrap cursor-help transition-colors ${
              isNoTransactionOrNotEligible ? 
                (isDark 
                  ? 'bg-gray-700 text-gray-400 border-gray-600 italic' 
                  : 'bg-gray-100 text-gray-500 border-gray-200 italic') :
              payout.Balance > 0 && isEditable ? 
                (isDark 
                  ? 'bg-red-900/30 text-red-300 border-red-700 hover:bg-red-900/50' 
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100') :
              payout.Balance === 0 ? 
                (isDark 
                  ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50' 
                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100') : 
              isDark 
                ? 'bg-gray-700 text-gray-400 border-gray-600' 
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}>
              {formatCurrency(payout.Balance)}
            </span>
            {isEligibleForPayout && payout.Balance >= 0 && (
              <div className={tooltipClasses} style={{ whiteSpace: 'pre-line' }}>
                Total: ₱{payout.TotalAmount.toFixed(2)}<br/>
                - Released: ₱{payout.AmountReleased.toFixed(2)}<br/>
                {hasSapData && `(SAP: ₱${payout.SapReleasedAmount.toFixed(2)})`}<br/>
                = Balance: ₱{payout.Balance.toFixed(2)}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
            {isNoTransactionOrNotEligible && (
              <div className={`${tooltipClasses} ${isDark ? 'bg-gray-800' : 'bg-gray-700'}`}>
                {!hasTransactions ? 'No transactions → Total = 0' : 'No eligible transactions → Total = 0'}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
          </div>
        </td>
        
      </tr>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with SAP Sync Button */}
      <div className={headerClasses}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className={titleClasses}>Payout History</h4>
            <p className={subtitleClasses}>Rebate payment records - Sorted by period (most recent first)</p>
          </div>
        </div>
        
        {/* SAP Sync Message */}
        {sapSyncMessage && (
          <div className={`mt-2 text-xs p-2 rounded flex items-center gap-2 ${
            sapSyncMessage.includes('✅') 
              ? (isDark ? 'bg-green-900/30 text-green-300 border border-green-700' : 'bg-green-50 text-green-700 border border-green-200')
              : sapSyncMessage.includes('❌')
                ? (isDark ? 'bg-red-900/30 text-red-300 border border-red-700' : 'bg-red-50 text-red-700 border border-red-200')
                : (isDark ? 'bg-blue-900/30 text-blue-300 border border-blue-700' : 'bg-blue-50 text-blue-700 border border-blue-200')
          }`}>
            {sapSyncMessage.includes('🔄') && <RefreshCw size={12} className="animate-spin" />}
            {sapSyncMessage}
          </div>
        )}
      </div>
      
      {/* Table Content */}
      <div className={tableContainerClasses}>
        <table className="w-full text-xs">
          <thead className={tableHeaderClasses}>
            <tr className={tableHeaderRowClasses}>
              <th className="px-6 py-2 text-left w-[12%]">Date</th>
              <th className="px-3 py-2 text-left w-[20%]">Period</th>
              <th className="px-3 py-2 text-center w-[12%]">Rebate Earned</th>
              <th className="px-3 py-2 text-center w-[12%]">Total Amount</th>
              <th className="px-3 py-2 text-center w-[10%]">Status</th>
              <th className="px-3 py-2 text-center w-[12%]">Amount Released</th>
              <th className="px-3 py-2 text-center w-[12%]">Balance</th>
            </tr>
          </thead>
<tbody className={tableBodyClasses}>
            {(() => {
              const regularRows = sortedPaginatedPayouts.filter(p =>
                !p.isBeginningBalance && !p.Period?.startsWith('Balance of ')
              );

              const firstRegularNum = regularRows.length > 0
                ? Math.min(...regularRows.map(p => parsePeriodToNumber(p.Period)))
                : 0;

              const showBegBalance = previousBalance > 0 && firstRegularNum > 0;

              const renderBegBalanceRow = () => {
                if (!showBegBalance) return null;

                const year = Math.floor(firstRegularNum / 100);
                const month = firstRegularNum % 100;
                const mm = String(month).padStart(2, '0');
                const dateDisplay = `${mm}.01.${year}`;

                const currentMonth = `${monthNames[month - 1]} ${year}`;
                const prevMonthIdx = month === 1 ? 11 : month - 2;
                const prevYear = month === 1 ? year - 1 : year;
                const fromMonth = `${monthNames[prevMonthIdx]} ${prevYear}`;

                const rowCls = isDark
                  ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-l-4 border-l-green-500'
                  : 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-400';
                const amtCls = `inline-block px-3 py-1 font-bold rounded border ${
                  isDark ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-200'
                }`;
                const labelCls = `font-bold ${isDark ? 'text-green-300' : 'text-green-700'}`;
                const subCls = `text-[10px] mt-0.5 ${isDark ? 'text-green-400' : 'text-green-600'}`;

                return (
                  <tr key="beg-balance-row" className={rowCls}>
                    <td className="px-6 py-3">
                      <div className={labelCls}>{dateDisplay}</div>
                      <div className={subCls}>Beginning Balance</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className={`font-medium ${isDark ? 'text-green-200' : 'text-green-800'}`}>
                        Balance for {currentMonth}
                      </div>
                      <div className={subCls}>(From {fromMonth} transactions)</div>
                    </td>
                    <td className="px-3 py-3 text-center" />
                    <td className="px-3 py-3 text-center" />
                    <td className="px-3 py-3 text-center" />
                    <td className="px-3 py-3 text-center" />
                    <td className="px-3 py-3 text-center">
                      <span className={amtCls}>{formatCurrency(previousBalance)}</span>
                    </td>
                  </tr>
                );
              };

              if (regularRows.length === 0 && !showBegBalance) {
                return (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center">
                      <div className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        No payout records found
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <>
                  {renderBegBalanceRow()}
                  {regularRows.map((payout, index) => renderPayoutRow(payout, index))}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className={footerClasses}>
        <div className="flex items-center justify-between">
          <div className={footerTextClasses}>
            Showing {Math.min((payoutCurrentPage - 1) * payoutRowsPerPage + 1, sortedFilteredPayouts.length)} to {Math.min(payoutCurrentPage * payoutRowsPerPage, sortedFilteredPayouts.length)} of <span className="font-bold">{sortedFilteredPayouts.length}</span> payout records
            {modalCustomer?.sapData?.totalAmount > 0 && (
              <span className={`ml-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                | Total SAP: ₱{modalCustomer.sapData.totalAmount.toFixed(2)}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>Rows per page</span>
              <select 
                value={payoutRowsPerPage}
                onChange={(e) => {
                  setPayoutRowsPerPage(Number(e.target.value));
                  setPayoutCurrentPage(1);
                }}
                className={selectClasses}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPayoutCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={payoutCurrentPage === 1}
                className={navButtonClasses(payoutCurrentPage === 1)}
              >
                <ChevronLeft size={14} />
              </button>
              
              <div className="flex items-center gap-1">
                {getPaginationRange().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className={ellipsisClasses}>...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setPayoutCurrentPage(page)}
                      className={paginationButtonClasses(payoutCurrentPage === page)}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>
              
              <button 
                onClick={() => setPayoutCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={payoutCurrentPage >= totalPages}
                className={navButtonClasses(payoutCurrentPage >= totalPages)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VcpPayoutHistory;