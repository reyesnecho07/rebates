// src/components/Dashboard/PayoutHistory.js
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Edit, ArrowRight, Info, RefreshCw } from 'lucide-react';

const NexchemPayoutHistory = ({ 
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
  handleSaveAmountReleased,
  beginningBalance = 0,
  beginningBalances = [],
  previousBalance = 0,
  beginningBalanceRecord = null
}) => {
  const isDark = theme === 'dark';
  const [showBalanceTooltip, setShowBalanceTooltip] = useState(false);
  
  // NEW: State for SAP sync
  const [syncingSap, setSyncingSap] = useState(false);
  const [sapSyncMessage, setSapSyncMessage] = useState(null);
  const [showSapDetails, setShowSapDetails] = useState({}); // Track which rows show SAP details

  console.log('🔍 [NEXCHEM FRONTEND] Props received:', {
    previousBalance,
    beginningBalanceRecord,
    beginningBalancesCount: beginningBalances?.length,
    paginatedPayoutsCount: paginatedPayouts?.length,
    firstPeriod: paginatedPayouts?.[0]?.Period
  });
  
  if (customerModalTab !== 'payout') return null;

  // In the render section, before mapping through paginatedPayouts,
// sort them in ascending order by date
const sortedPayouts = [...(paginatedPayouts || [])].sort((a, b) => {
  // Handle special cases like "Beginning Balance" first
  if (a.Date === 'Beginning Balance') return -1;
  if (b.Date === 'Beginning Balance') return 1;
  
  // Convert dates to comparable format (assuming format is like "Jan 2024" or "YYYY-MM-DD")
  const dateA = new Date(a.Date);
  const dateB = new Date(b.Date);
  
  // If dates are valid, sort ascending
  if (!isNaN(dateA) && !isNaN(dateB)) {
    return dateA - dateB;
  }
  
  // Fallback to string comparison
  return a.Date.localeCompare(b.Date);
});

// Then in the table body, use sortedPayouts instead of paginatedPayouts

  // NEW: Function to manually sync SAP data
  const handleSapSync = async () => {
    if (!modalCustomer?.CardCode) {
      setSapSyncMessage('❌ No customer selected');
      setTimeout(() => setSapSyncMessage(null), 3000);
      return;
    }
    
    setSyncingSap(true);
    setSapSyncMessage('🔄 Syncing with SAP Journal Entries...');
    
    try {
      const payload = {
        db: 'NEXCHEM_OWN',
        rebateCode: modalCustomer?.rebateCode,
        periodFrom: modalCustomer?.dateRange?.periodFrom,
        periodTo: modalCustomer?.dateRange?.periodTo
      };
      
      const response = await fetch(`http://192.168.100.193:3006/api/nexchem/customer/${modalCustomer.CardCode}/sync-sap`, {
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
        if (loadDetailedPayoutsData) {
          await loadDetailedPayoutsData();
        }
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
  
  // NEW: Toggle SAP details for a specific row
  const toggleSapDetails = (payoutId) => {
    setShowSapDetails(prev => ({
      ...prev,
      [payoutId]: !prev[payoutId]
    }));
  };

  // NEW: Format SAP date
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

  const totalPages = Math.ceil(filteredPayouts.length / payoutRowsPerPage);
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

  // Get the FIRST (earliest) transaction period in the current view
  const regularPayoutsInView = (paginatedPayouts || [])
    .filter(p => !p.isBeginningBalance && p.Period && !p.Period.startsWith('Balance of '));

  const firstTransactionNumber = regularPayoutsInView.length > 0
    ? Math.min(...regularPayoutsInView.map(p => parsePeriodToNumber(p.Period)))
    : 0;

  // STRATEGY 1: Check beginningBalances array (same rebate code)
  const matchingFromSameRebate = (beginningBalances || [])
    .filter(bb => {
      if (!bb.Period || !bb.Period.startsWith('Balance of ')) return false;
      const bbNum = parsePeriodToNumber(bb.Period.replace('Balance of ', '').trim());
      return bbNum > 0 && bbNum < firstTransactionNumber;
    })
    .sort((a, b) => {
      const aNum = parsePeriodToNumber(a.Period.replace('Balance of ', '').trim());
      const bNum = parsePeriodToNumber(b.Period.replace('Balance of ', '').trim());
      return bNum - aNum;
    })[0] || null;

  // STRATEGY 2: Use previousBalance/beginningBalanceRecord from cross-rebate lookup
  // This handles the case where balance came from a DIFFERENT rebate code (e.g. REB-00003 → REB-00004)
  const hasCrossRebateBalance = previousBalance > 0 && firstTransactionNumber > 0;

  // Determine which source to use — prefer same-rebate if found, otherwise use cross-rebate
  const matchingBeginningBalance = matchingFromSameRebate || 
    (hasCrossRebateBalance ? { 
      Period: beginningBalanceRecord?.Period || 'Previous Period',
      TotalAmount: previousBalance,
      Amount: previousBalance,
      isCrossRebate: true
    } : null);

  // Source label — strip "Balance of " prefix to get "December 2025"
  const sourcePeriodLabel = matchingBeginningBalance
    ? (matchingBeginningBalance.Period.startsWith('Balance of ')
        ? matchingBeginningBalance.Period.replace('Balance of ', '').trim()
        : matchingBeginningBalance.Period)
    : null;

  const shouldShowBeginningBalance = !!matchingBeginningBalance && firstTransactionNumber > 0;
  const activeBegBalAmount = matchingBeginningBalance
    ? (parseFloat(matchingBeginningBalance.TotalAmount) || parseFloat(matchingBeginningBalance.Amount) || 0)
    : 0;

const renderBeginningBalanceRow = () => {
    if (!shouldShowBeginningBalance || !matchingBeginningBalance) return null;

    const beginningRowClasses = `${
      isDark 
        ? 'bg-gradient-to-r from-amber-900/20 to-yellow-900/20 border-l-4 border-l-amber-500' 
        : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-l-amber-400'
    }`;
    const dateTextClasses = `font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`;
    const amountClasses = `inline-block px-3 py-1 font-bold rounded border ${
      isDark 
        ? 'bg-amber-900/30 text-amber-300 border-amber-700' 
        : 'bg-amber-100 text-amber-700 border-amber-200'
    }`;

    return (
      <tr className={beginningRowClasses}>
        <td className="px-6 py-3">
          <div className="flex items-center gap-2">
            <ArrowRight size={14} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
            <div className={dateTextClasses}>Beg. Balance</div>
          </div>
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            {sourcePeriodLabel ? `Carried over from ${sourcePeriodLabel}` : 'From previous period'}
          </div>
        </td>
        <td className="px-3 py-3">
          <div className={`font-medium ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
            Beginning Balance
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
            {modalCustomer?.CardCode} | {modalCustomer?.rebateType}
          </div>
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`${amountClasses} opacity-50`}>₱0.00</span>
        </td>
        <td className="px-3 py-3 text-center">
          <div className="relative group inline-block">
            <span className={amountClasses}>
              {formatCurrency(activeBegBalAmount)}
            </span>
            <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none min-w-max ${
              isDark ? 'bg-gray-900 text-white' : 'bg-gray-900 text-white'
            }`}>
              Unpaid balance from {sourcePeriodLabel || 'previous month'}
              <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900`}></div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`px-2 py-1 text-center rounded font-medium border ${
            isDark 
              ? 'bg-amber-900/30 text-amber-300 border-amber-700' 
              : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}>
            Carry-over
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`text-xs italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>N/A</span>
        </td>
        <td className="px-3 py-3 text-center">
          <div className="relative group inline-block">
            <span className={amountClasses}>
              {formatCurrency(activeBegBalAmount)}
            </span>
            <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none min-w-max ${
              isDark ? 'bg-gray-900 text-white' : 'bg-gray-900 text-white'
            }`}>
              Balance added to this month's total
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`text-xs italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Auto</span>
        </td>
      </tr>
    );
  };

  const renderPayoutRow = (payout, index) => {
    // Skip beginning balance rows that might come from database
    if (payout.Date === 'Beginning Balance' || payout.isBeginningBalance) {
      return null; // We'll render it separately
    }
    
    const isQtrRebate = payout.isQtrRebate;
    const hasTransactions = payout.BaseAmount > 0 || payout.dailySalesRebate > 0;
    const isEligibleForPayout = payout.TotalAmount > 0;
    const isNoTransactionOrNotEligible = !isEligibleForPayout;
    const isEditable = payout.Status !== 'No Payout' && hasTransactions && isEligibleForPayout;
    const isEditing = editingPayoutId === payout.Id;
    const isPercentage = modalCustomer?.rebateType === 'Percentage';
    const isFixed = modalCustomer?.rebateType === 'Fixed';
    const isIncremental = modalCustomer?.rebateType === 'Incremental';
    const isMonthlyFrequency = modalCustomer?.frequency === 'Monthly';
    const hasPreviousBalance = payout.PreviousBalance > 0;
    
    // NEW: Check if this payout has SAP data
    const hasSapData = payout.SapReleasedAmount > 0;
    const showSapDetailsForRow = showSapDetails[payout.Id];

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
      ${hasPreviousBalance ? 
        (isDark ? 'bg-gradient-to-r from-amber-900/10 to-yellow-900/10' : 'bg-gradient-to-r from-amber-50/30 to-yellow-50/30') : ''}
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

    const baseAmountClasses = `inline-block px-2 py-0.5 font-medium rounded border whitespace-nowrap ${
      hasTransactions ? 
        (isDark 
          ? 'bg-blue-900/30 text-blue-300 border-blue-700' 
          : 'bg-blue-100 text-blue-700 border-blue-200') : 
      isDark 
        ? 'bg-gray-700 text-gray-400 border-gray-600' 
        : 'bg-gray-100 text-gray-500 border-gray-200'
    }`;

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
      hasPreviousBalance ? 
        (isDark 
          ? 'bg-amber-900/30 text-amber-300 border-amber-700' 
          : 'bg-amber-50 text-amber-700 border-amber-100') :
      payout.TotalAmount > 0 ? 
        (isDark 
          ? 'bg-green-900/30 text-green-300 border-green-700' 
          : 'bg-green-50 text-green-700 border-green-100') : 
      isDark 
        ? 'bg-gray-700 text-gray-400 border-gray-600' 
        : 'bg-gray-50 text-gray-500 border-gray-200'
    }`;

    const statusSelectClasses = `px-2 py-0.5 text-center rounded font-medium border appearance-none focus:outline-none w-full max-w-[100px] whitespace-nowrap text-xs ${
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
    }`;

    const amountInputClasses = `w-28 pl-6 pr-2 py-1 border rounded text-center focus:outline-none text-xs ${
      isNoTransactionOrNotEligible ? 
        (isDark 
          ? 'border-gray-600 bg-gray-700 text-gray-400 italic cursor-not-allowed' 
          : 'border-gray-300 bg-gray-100 text-gray-400 italic cursor-not-allowed') :
      !isEditable ? 
        (isDark 
          ? 'border-gray-600 bg-gray-700 cursor-not-allowed' 
          : 'border-gray-300 bg-gray-100 cursor-not-allowed') :
      isEditing ? 
        (isDark 
          ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-900/30' 
          : 'border-blue-500 ring-1 ring-blue-500 bg-blue-50') :
      isDark 
        ? 'border-gray-600 hover:border-blue-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-700 cursor-pointer' 
        : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer'
    }`;

    const balanceClasses = `inline-block px-3 py-1 font-medium rounded border whitespace-nowrap cursor-help transition-colors ${
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
    }`;

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
          {hasPreviousBalance && (
            <div className={`text-[10px] font-medium ${
              isDark ? 'text-amber-400' : 'text-amber-600'
            }`}>
              + Prev: {formatCurrency(payout.PreviousBalance)}
            </div>
          )}
        </td>
        <td className="px-3 py-2">
          <div className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <div className={periodTextClasses}>
              {payout.Period}
            </div>
            {payout.CalculationNote && !isNoTransactionOrNotEligible && (
              <div className={`text-[10px] mt-0.5 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {payout.CalculationNote}
              </div>
            )}
            {isNoTransactionOrNotEligible && (
              <div className={`text-[10px] mt-0.5 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {!hasTransactions ? 'No transactions this month' : 'Quota not met this month'}
              </div>
            )}
          </div>
        </td>
        
        {/* Base Amount Column */}
        <td className="px-3 py-2 text-center">
          <span className={baseAmountClasses}>
            {formatCurrency(payout.BaseAmount || 0)}
            {!hasTransactions && payout.BaseAmount === 0}
          </span>
        </td>
        
        {/* Total Amount Column */}
        <td className="px-3 py-2 text-center">
          <div className="relative group inline-block">
            <span className={totalAmountClasses}>
              {formatCurrency(payout.TotalAmount)}
            </span>
            {hasPreviousBalance && (
              <div className={tooltipClasses}>
                Base: ₱{payout.BaseAmount.toFixed(2)}<br/>
                + Prev Month: ₱{payout.PreviousBalance.toFixed(2)}<br/>
                = ₱{payout.TotalAmount.toFixed(2)}
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
            className={statusSelectClasses}
          >
            <option value="No Payout">No Payout</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </td>
        
        {/* Amount Released Column - UPDATED WITH COMMA FORMATTING */}
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
                type="text"
                value={payout.AmountReleased ? 
                  new Intl.NumberFormat('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }).format(payout.AmountReleased) : '0.00'}
                className={`${amountInputClasses} ${
                  isDark ? 'text-white' : 'text-black'
                }`}
                placeholder={isNoTransactionOrNotEligible ? "N/A" : "0.00"}
                readOnly
                disabled
              />
            </div>
          </div>
        </td>
        
        {/* Balance Column */}
        <td className="px-3 py-2 text-center">
          <div className="relative group inline-block">
            <span className={balanceClasses}>
              {formatCurrency(payout.Balance)}
            </span>
            {isEligibleForPayout && payout.Balance >= 0 && (
              <div className={tooltipClasses} style={{ whiteSpace: 'pre-line' }}>
                Total: ₱{payout.TotalAmount.toFixed(2)}<br/>
                - Released: ₱{payout.AmountReleased.toFixed(2)}<br/>
                {hasSapData && `(SAP: ₱${payout.SapReleasedAmount?.toFixed(2)})`}<br/>
                = Balance: ₱{payout.Balance.toFixed(2)}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
            {isNoTransactionOrNotEligible && (
              <div className={`${tooltipClasses} ${isDark ? 'bg-gray-800' : 'bg-gray-700'}`}>
                {!hasTransactions ? 'No transactions → Balance = 0' : 'Quota not met → Balance = 0'}
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
      {/* Header - Updated with SAP Sync Button */}
      <div className={headerClasses}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className={titleClasses}>Payout History</h4>
            <p className={subtitleClasses}>Rebate payment records - Balances carry over month-to-month</p>
          </div>
          <div className="flex items-center gap-4">
            {beginningBalance > 0 && (
              <div className="relative">
                {showBalanceTooltip && (
                  <div className={`absolute top-full right-0 mt-1 w-64 p-3 rounded shadow-lg z-10 ${
                    isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                  }`}>
                    <div className="text-xs">
                      <div className="font-bold mb-1">Beginning Balance Details:</div>
                      <div className="mb-1">• Previous month's unpaid balance</div>
                      <div className="mb-1">• Matches by CardCode & RebateType</div>
                      <div className="mb-1">• Only shows when balance &gt; 0</div>
                      <div className={`text-[10px] mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Customer: {modalCustomer?.CardCode} | Type: {modalCustomer?.rebateType}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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
      
<div className={tableContainerClasses}>
  <table className="w-full text-xs">
    <thead className={tableHeaderClasses}>
      <tr className={tableHeaderRowClasses}>
        <th className="px-6 py-2 text-left w-[12%]">Date</th>
        <th className="px-3 py-2 text-left w-[20%]">Period</th>
        <th className="px-3 py-2 text-center w-[12%]">Rebate Earned</th>
        <th className="px-3 py-2 text-center w-[12%]">Total Amount</th>
        <th className="px-3 py-2 text-center w-[10%]">Status</th>
        <th className="px-3 py-2 text-center w-[14%]">Amount Released</th>
        <th className="px-3 py-2 text-center w-[14%]">Balance</th>
      </tr>
    </thead>
<tbody className={tableBodyClasses}>
{(() => {
        // Separate beginning balances from regular payouts
        const allPayouts = [...(paginatedPayouts || [])];
        
        // DEBUG - remove after fixing
        console.log('🔍 [FRONTEND DEBUG] allPayouts:', allPayouts.map(p => ({
          Period: p.Period,
          IsBeginningBalance: p.IsBeginningBalance,
          isBeginningBalance: p.isBeginningBalance,
          Status: p.Status,
          TotalAmount: p.TotalAmount
        })));
        console.log('🔍 [FRONTEND DEBUG] previousBalance prop:', previousBalance);
        console.log('🔍 [FRONTEND DEBUG] beginningBalanceRecord prop:', beginningBalanceRecord);
        console.log('🔍 [FRONTEND DEBUG] beginningBalances prop:', beginningBalances);
        
        const begBalanceRows = allPayouts.filter(p => 
          p.IsBeginningBalance === 1 || 
          p.isBeginningBalance === true || 
          (p.Period && p.Period.startsWith('Balance of '))
        );

        const regularRows = allPayouts
          .filter(p => 
            !p.IsBeginningBalance && 
            !p.isBeginningBalance && 
            p.Period && 
            !p.Period.startsWith('Balance of ')
          )
          .sort((a, b) => {
            const parseMonthYear = (str) => {
              if (!str) return 0;
              for (let i = 0; i < monthNames.length; i++) {
                if (str.includes(monthNames[i])) {
                  const y = str.match(/\b(20\d{2})\b/);
                  return (y ? parseInt(y[1]) : 0) * 100 + (i + 1);
                }
              }
              return 0;
            };
            return parseMonthYear(a.Period) - parseMonthYear(b.Period);
          });

        // Find the applicable beginning balance for THIS view
        // Get the earliest period in current regular rows
        const parseMonthYear = (str) => {
          if (!str) return 0;
          for (let i = 0; i < monthNames.length; i++) {
            if (str.includes(monthNames[i])) {
              const y = str.match(/\b(20\d{2})\b/);
              return (y ? parseInt(y[1]) : 0) * 100 + (i + 1);
            }
          }
          return 0;
        };

        const firstRegularNum = regularRows.length > 0
          ? Math.min(...regularRows.map(p => parseMonthYear(p.Period)))
          : 0;

        // From begBalanceRows: find latest one whose period is BEFORE current first transaction
        // "Balance of December 2025" (202512) must be < firstRegularNum (e.g. 202601)
const applicableBegBalance = begBalanceRows
          .filter(bb => {
            const periodStr = bb.Period.replace('Balance of ', '').trim();
            const num = parseMonthYear(periodStr);
            return num > 0 && num <= firstRegularNum;
          })
          .sort((a, b) => {
            const aNum = parseMonthYear(a.Period.replace('Balance of ', '').trim());
            const bNum = parseMonthYear(b.Period.replace('Balance of ', '').trim());
            return bNum - aNum; // descending — latest first
          })[0] || null;

        // Also check cross-rebate balance from props
        const crossRebateBal = !applicableBegBalance && previousBalance > 0 && firstRegularNum > 0
          ? (() => {
              // Parse the source period from beginningBalanceRecord
              // e.g. "Balance of December 2025" → sourceNum = 202512
              // Must be BEFORE current first transaction (e.g. 202601) to show
              const recPeriod = beginningBalanceRecord?.Period || '';
              const sourceStr = recPeriod.startsWith('Balance of ')
                ? recPeriod.replace('Balance of ', '').trim()
                : recPeriod;
              const sourceNum = parseMonthYear(sourceStr);

              // Show if: source period is before current first transaction
              // OR if we can't parse it (sourceNum === 0), still show it
              const shouldShow = sourceNum === 0 || sourceNum < firstRegularNum;

              if (!shouldShow) return null;

              return {
                Period: recPeriod || 'Previous Period',
                TotalAmount: previousBalance,
                isBeginningBalance: true,
                isCrossRebate: true
              };
            })()
          : null;

        const activeBegBal = applicableBegBalance || crossRebateBal;

        if (regularRows.length === 0 && !activeBegBal) {
          return (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center">
                <div className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  No payout records found
                </div>
              </td>
            </tr>
          );
        }

        // Render beg balance row inline
const renderActiveBegBalance = () => {
          if (!activeBegBal) return null;
          const amount = parseFloat(activeBegBal.TotalAmount) || parseFloat(activeBegBal.Amount) || 0;

          // Source label: e.g. "Balance of January 2026" → sourceLabel = "December 2025"
          // We want to show "Balance for January 2026" and "(From December 2025 transactions)"
          const periodStr = activeBegBal.Period || '';
          const currentMonthLabel = periodStr.startsWith('Balance of ')
            ? periodStr.replace('Balance of ', '').trim()
            : periodStr;

          // Derive "from" month: the month BEFORE currentMonthLabel
          const monthNames = ['January','February','March','April','May','June',
                              'July','August','September','October','November','December'];
          const deriveFromMonth = (str) => {
            for (let i = 0; i < monthNames.length; i++) {
              if (str.includes(monthNames[i])) {
                const yearMatch = str.match(/\b(20\d{2})\b/);
                const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
                const prevMonthIndex = i === 0 ? 11 : i - 1;
                const prevYear = i === 0 ? year - 1 : year;
                return `${monthNames[prevMonthIndex]} ${prevYear}`;
              }
            }
            return null;
          };
          const fromMonthLabel = deriveFromMonth(currentMonthLabel);

          // Date display: use PayoutDate from the record, or derive first day of currentMonth
// Date display: first day of the first transaction month e.g. 01.01.2026
  const dateDisplay = (() => {
    if (!firstRegularNum) return '';
    const year = Math.floor(firstRegularNum / 100);
    const month = firstRegularNum % 100;
    const mm = String(month).padStart(2, '0');
    const dd = '01';
    const yyyy = String(year);
    return `${mm}.${dd}.${yyyy}`;
  })();

          const rowCls = isDark
            ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-l-4 border-l-green-500'
            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-400';

          const amtCls = `inline-block px-3 py-1 font-bold rounded border ${
            isDark ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-200'
          }`;

          const labelCls = `font-bold ${isDark ? 'text-green-300' : 'text-green-700'}`;
          return (
            <tr className={rowCls}>
              {/* DATE column */}
              <td className="px-6 py-3">
                <div className={labelCls}>{dateDisplay}</div>
              </td>

              {/* PERIOD column */}
              <td className="px-3 py-3">
                <div className={`font-medium ${isDark ? 'text-green-200' : 'text-green-800'}`}>
                  Balance from Previous Transaction
                </div>

              </td>

              {/* REBATE EARNED - blank */}
              <td className="px-3 py-3 text-center" />

              {/* TOTAL AMOUNT - blank */}
              <td className="px-3 py-3 text-center" />

              {/* STATUS - blank */}
              <td className="px-3 py-3 text-center" />

              {/* AMOUNT RELEASED - blank */}
              <td className="px-3 py-3 text-center" />

              {/* BALANCE column — shows the amount */}
              <td className="px-3 py-3 text-center">
                <span className={amtCls}>{formatCurrency(amount)}</span>
              </td>
            </tr>
          );
        };

        return (
          <>
            {renderActiveBegBalance()}
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
            Showing {Math.min((payoutCurrentPage - 1) * payoutRowsPerPage + 1, filteredPayouts.length)} to {Math.min(payoutCurrentPage * payoutRowsPerPage, filteredPayouts.length)} of <span className="font-bold">{filteredPayouts.length}</span> payout records
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

export default React.memo(NexchemPayoutHistory);