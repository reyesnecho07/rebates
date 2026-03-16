// src/components/Dashboard/StatusSummary/VanTransactionRecords.js
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const VanTransactionRecords = ({ 
  theme = 'light',
  modalCustomer,
  filteredTransactions,
  transactionCurrentPage,
  setTransactionCurrentPage,
  transactionRowsPerPage,
  setTransactionRowsPerPage,
  isLoading = false
}) => {
  const isDark = theme === 'dark';
  
  // Helper function to format decimal numbers
  const formatDecimal = (num) => {
    const number = parseFloat(num) || 0;
    return number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Check if customer is monthly frequency
  const isMonthly = modalCustomer?.frequency === 'Monthly';
  
  // ========== MONTHLY TRANSACTION TABLE ==========
  const renderMonthlyTransactionTable = () => {
    return (
      <table className="w-full text-xs">
        <thead className={`sticky top-0 ${
          isDark 
            ? 'bg-gradient-to-r from-gray-800 to-gray-900' 
            : 'bg-gray-50'
        }`}>
          <tr className={`font-semibold uppercase tracking-wider border-b ${
            isDark 
              ? 'border-gray-700 text-gray-300' 
              : 'border-gray-200 text-gray-600'
          }`}>
            <th className="px-6 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-center">Actual Sales</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
          {paginatedTransactions.length > 0 ? (
            paginatedTransactions.map((transaction, index) => {
              const itemName = transaction.Item || transaction.ItemName || 'N/A';
              const itemCode = transaction.ItemCode || transaction.ItemCodeSAP || 'N/A';
              
              return (
                <tr key={index} className={`${
                  isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                }`}>
                  {/* Date Column */}
                  <td className="px-6 py-2">
                    <div className={`font-medium ${
                      isDark ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {formatDate(transaction.Date)}
                    </div>
                  </td>
                  
                  {/* Item Column */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <div className={`font-medium truncate ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {itemName}
                      </div>
                      <div className={`text-[10px] font-mono ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {itemCode}
                      </div>
                    </div>
                  </td>
                  
                  {/* Actual Sales Column */}
                  <td className="px-3 py-2 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`inline-block px-2 py-0.5 font-medium rounded border ${
                        isDark
                          ? 'bg-blue-900/30 text-blue-300 border-blue-700' 
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {formatDecimal(transaction.ActualSales)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
            <div className={`flex-1 flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <div className={`mt-7 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <p className="text-lg font-medium">No transaction found</p>
              </div>
            </div>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  // ========== QUARTERLY TRANSACTION TABLE ==========
  // Helper functions for quarterly table
  const calculateQtyBal = (transaction, allTransactions, currentIndex) => {
    // For 25kg items: divide by 2, otherwise use actual sales
    const is25kgItem = transaction.Is25kgItem || 
      (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
    
    const actualSales = parseFloat(transaction.ActualSales) || 0;
    const qtyReb = is25kgItem ? actualSales / 2 : actualSales;
    
    // Get the month of the current transaction
    const transactionDate = new Date(transaction.Date);
    const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Calculate cumulative qty for THIS SPECIFIC MONTH up to current transaction
    let monthlyCumulative = 0;
    
    // Iterate through all transactions and add up to current index for THIS MONTH ONLY
    for (let i = 0; i <= currentIndex; i++) {
      const trans = allTransactions[i];
      const transDate = new Date(trans.Date);
      const transMonthKey = `${transDate.getFullYear()}-${String(transDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Only add transactions from the same month
      if (transMonthKey === monthKey) {
        const transIs25kg = trans.Is25kgItem || 
          (trans.Item && trans.Item.toLowerCase().includes('25kg'));
        const transActualSales = parseFloat(trans.ActualSales) || 0;
        monthlyCumulative += transIs25kg ? transActualSales / 2 : transActualSales;
      }
    }
    
    return monthlyCumulative;
  };

  const getTargetQty = (transaction, modalCustomer) => {
    if (modalCustomer?.rebateType === 'Incremental') {
      // For incremental, we don't use target qty in the same way
      return null;
    }
    
    // For Fixed and Percentage: Get the specific month's target based on transaction date
    if (modalCustomer?.details?.rebateDetails?.quotas) {
      try {
        const transactionDate = new Date(transaction.Date);
        const monthName = transactionDate.toLocaleDateString('en-US', { month: 'long' });
        
        // Check if quotas is an object with month names as keys
        if (typeof modalCustomer.details.rebateDetails.quotas === 'object') {
          // Try to get the quota for this specific month
          const monthlyQuota = modalCustomer.details.rebateDetails.quotas[monthName];
          
          if (monthlyQuota !== undefined && monthlyQuota !== null) {
            return monthlyQuota;
          }
          
          // If not found by month name, try to get it from the quotas array based on month index
          const monthIndex = transactionDate.getMonth(); // 0-indexed (0 = January)
          
          // If quotas is an array
          if (Array.isArray(modalCustomer.details.rebateDetails.quotas)) {
            // Try to get by index
            if (monthIndex < modalCustomer.details.rebateDetails.quotas.length) {
              return modalCustomer.details.rebateDetails.quotas[monthIndex];
            }
          }
        }
      } catch (e) {
        console.log('Error getting target qty:', e);
      }
    }
    
    // Fallback to transaction data if available
    return transaction.TargetQty || 
           transaction.MonthQuota || 
           transaction.quota || 
           0;
  };

  // Helper function to calculate progress percentage
  const calculateProgress = (transaction, allTransactions, currentIndex, modalCustomer) => {
    const qtyBal = calculateQtyBal(transaction, allTransactions, currentIndex);
    
    if (modalCustomer?.rebateType === 'Incremental') {
      // For incremental, progress is based on current range
      const currentRange = transaction.CurrentRange;
      const ranges = modalCustomer?.details?.rebateDetails?.ranges || [];
      
      if (currentRange && ranges.length > 0) {
        const range = ranges.find(r => r.rangeNo === currentRange);
        if (range) {
          const rangeMin = parseFloat(range.minQty) || 0;
          const rangeMax = parseFloat(range.maxQty) || 0;
          
          if (rangeMax > rangeMin) {
            // Calculate progress within current range
            return Math.min(((qtyBal - rangeMin) / (rangeMax - rangeMin)) * 100, 100);
          } else if (rangeMax === 0 || !rangeMax) {
            // For infinite range (no max), show 100% once min is reached
            return qtyBal >= rangeMin ? 100 : Math.min((qtyBal / rangeMin) * 100, 100);
          }
        }
      }
      
      // If no current range, progress towards first range
      if (ranges.length > 0) {
        const firstRange = ranges[0];
        const firstRangeMin = parseFloat(firstRange.minQty) || 0;
        return Math.min((qtyBal / firstRangeMin) * 100, 100);
      }
      
      return 0;
    } else {
      // For Fixed and Percentage: progress based on MONTHLY target
      const targetQty = getTargetQty(transaction, modalCustomer) || 0;
      if (targetQty <= 0) return 0;
      return Math.min(100, (qtyBal / targetQty) * 100);
    }
  };

  // Helper function to calculate Qty Reb (divided for 25kg items)
  const calculateQtyReb = (transaction) => {
    const is25kgItem = transaction.Is25kgItem || 
      (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
    
    const actualSales = parseFloat(transaction.ActualSales) || 0;
    return is25kgItem ? actualSales / 2 : actualSales;
  };

  const renderQuarterlyTransactionTable = () => {
    return (
      <table className="w-full text-xs">
        <thead className={`sticky top-0 ${
          isDark 
            ? 'bg-gradient-to-r from-gray-800 to-gray-900' 
            : 'bg-gray-50'
        }`}>
          <tr className={`font-semibold uppercase tracking-wider border-b ${
            isDark 
              ? 'border-gray-700 text-gray-300' 
              : 'border-gray-200 text-gray-600'
          }`}>
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Item</th>
            <th className="px-4 py-2 text-center">Act. Sales</th>
            <th className="px-4 py-2 text-center">Qty Reb</th>
            <th className="px-4 py-2 text-center">Qty Bal</th>
            <th className="px-4 py-2 text-center">Progress</th>
            <th className="px-4 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
          {paginatedTransactions.map((transaction, index) => {
            const globalIndex = (transactionCurrentPage - 1) * transactionRowsPerPage + index;
            const itemName = transaction.Item || transaction.ItemName || 'N/A';
            const itemCode = transaction.ItemCode || transaction.ItemCodeSAP || 'N/A';
            const is25kgItem = transaction.Is25kgItem || itemName.toLowerCase().includes('25kg');
            const displayItemName = is25kgItem ? `${itemName} (25kg)` : itemName;
            
            // Calculate values using the updated helper functions
            const qtyReb = calculateQtyReb(transaction);
            const qtyBal = calculateQtyBal(transaction, filteredTransactions, globalIndex);
            const progress = calculateProgress(transaction, filteredTransactions, globalIndex, modalCustomer);
            const targetQty = getTargetQty(transaction, modalCustomer);
            
            return (
              <tr key={index} className={`${
                isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
              }`}>
                {/* Date Column */}
                <td className="px-4 py-2">
                  <div className={`font-medium ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    {formatDate(transaction.Date)}
                  </div>
                </td>
                
                {/* Item Column */}
                <td className="px-4 py-2">
                  <div className="flex flex-col">
                    <div className={`font-medium truncate ${
                      isDark ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {displayItemName}
                    </div>
                    <div className={`text-[10px] font-mono ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {itemCode}
                    </div>
                  </div>
                </td>
                
                {/* Actual Sales Column */}
                <td className="px-4 py-2 text-center">
                  <div className="flex flex-col items-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${
                      isDark
                        ? 'bg-blue-900/30 text-blue-300 border-blue-700' 
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {formatDecimal(transaction.ActualSales)}
                    </span>
                  </div>
                </td>
                
                {/* Qty Reb Column */}
                <td className="px-4 py-2 text-center">
                  <div className="flex flex-col items-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${
                      isDark
                        ? 'bg-purple-900/30 text-purple-300 border-purple-700' 
                        : 'bg-purple-50 text-purple-700 border-purple-100'
                    }`}>
                      {formatDecimal(qtyReb)}
                    </span>
                  </div>
                </td>
                
                {/* Qty Bal Column */}
                <td className="px-4 py-2 text-center">
                  <div className="flex flex-col items-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${
                      qtyBal >= targetQty
                        ? isDark
                          ? 'bg-green-900/30 text-green-300 border-green-700'
                          : 'bg-green-50 text-green-700 border-green-100'
                        : isDark
                        ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                    }`}>
                      {formatDecimal(qtyBal)}
                    </span>
                  </div>
                </td>
                
                {/* Progress Column */}
                <td className="px-4 py-2 text-center">
                  <div className="flex flex-col items-center">
                    {/* Progress Bar */}
                    <div className={`w-24 h-1.5 rounded-full overflow-hidden ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <div 
                        className={`h-full rounded-full ${
                          progress >= 100 
                            ? isDark ? 'bg-green-500' : 'bg-green-600'
                            : progress >= 75 
                            ? isDark ? 'bg-blue-500' : 'bg-blue-600'
                            : progress >= 50
                            ? isDark ? 'bg-yellow-500' : 'bg-yellow-600'
                            : isDark ? 'bg-red-500' : 'bg-red-600'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    
                    {/* Progress Text based on Rebate Type */}
                    <div className={`text-[9px] mt-0.5 px-1.5 py-0.5 rounded ${
                      isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {modalCustomer?.rebateType === 'Incremental' ? (
                        // For Incremental: Show Qty Bal and Range
                        <>
                          <span className="font-medium">{formatDecimal(qtyBal)}</span>
                          <span className="mx-1">/</span>
                          <span>
                            {transaction.CurrentRange ? (
                              <span className={`font-medium ${
                                transaction.CurrentRange === 1 
                                  ? isDark ? 'text-blue-400' : 'text-blue-600'
                                  : transaction.CurrentRange === 2
                                  ? isDark ? 'text-yellow-400' : 'text-yellow-600'
                                  : isDark ? 'text-green-400' : 'text-green-600'
                              }`}>
                                Range {transaction.CurrentRange}
                              </span>
                            ) : (
                              <span className="text-gray-400">No range</span>
                            )}
                          </span>
                        </>
                      ) : (
                        // For Fixed and Percentage: Show Qty Bal / Target Qty
                        <>
                          <span className="font-medium">{formatDecimal(qtyBal)}</span>
                          <span className="mx-1">/</span>
                          <span className="font-medium">{formatDecimal(targetQty)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </td>
                
                {/* Status Column */}
                <td className="px-4 py-2 text-center">
                  {modalCustomer?.rebateType === 'Incremental' ? (
                    // Status for Incremental
                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-xs ${
                      transaction.CurrentRange
                        ? isDark
                          ? 'bg-green-900/30 text-green-300 border border-green-700/30' 
                          : 'bg-green-100 text-green-800'
                        : qtyBal > 0
                        ? isDark
                          ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30' 
                          : 'bg-yellow-100 text-yellow-800'
                        : isDark
                        ? 'bg-red-900/30 text-red-300 border border-red-700/30' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.CurrentRange 
                        ? `Range ${transaction.CurrentRange}`
                        : qtyBal > 0 
                        ? 'Progressing'
                        : 'Not in Range'
                      }
                    </span>
                  ) : (
                    // Status for Fixed and Percentage
                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-xs ${
                      progress >= 100
                        ? isDark
                          ? 'bg-green-900/30 text-green-300 border border-green-700/30' 
                          : 'bg-green-100 text-green-800'
                        : progress >= 70
                        ? isDark
                          ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30' 
                          : 'bg-yellow-100 text-yellow-800'
                        : isDark
                        ? 'bg-red-900/30 text-red-300 border border-red-700/30' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {progress >= 100 ? 'Eligible' : 
                      progress >= 70 ? 'On Track' : 
                      'Not Eligible'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
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

  const contentAreaClasses = `flex-1 overflow-auto ${
    isDark ? 'bg-gray-800' : 'bg-white'
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

  // Calculate pagination
  const totalPages = Math.ceil(filteredTransactions.length / transactionRowsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (transactionCurrentPage - 1) * transactionRowsPerPage,
    transactionCurrentPage * transactionRowsPerPage
  );

  const getPaginationRange = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (transactionCurrentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (transactionCurrentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', transactionCurrentPage - 1, transactionCurrentPage, transactionCurrentPage + 1, '...', totalPages);
      }
    }
    
    return pages;
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className={headerClasses}>
          <h4 className={titleClasses}>Transaction Records</h4>
          <p className={subtitleClasses}>Loading transaction data from SAP...</p>
        </div>
        <div className={`flex-1 flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Fetching transaction data from SAP database...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render main content
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={headerClasses}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className={titleClasses}>Transaction Records</h4>
            <p className={subtitleClasses}>
              {isMonthly 
                ? `Monthly transactions for ${modalCustomer?.customer || 'customer'} (${modalCustomer?.frequency || 'Quarterly'})`
                : `${modalCustomer?.rebateType || 'Rebate'} transactions for ${modalCustomer?.customer || 'customer'} (${modalCustomer?.frequency || 'Quarterly'})`}
            </p>
          </div>
        </div>
      </div>
      
      {/* Table Content */}
      <div className={contentAreaClasses}>
        {paginatedTransactions.length > 0 ? (
          isMonthly 
            ? renderMonthlyTransactionTable()
            : renderQuarterlyTransactionTable()
        ) : (
        <div className={`flex-1 flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className={`mt-7 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-lg font-medium">No transaction found</p>
          </div>
        </div>
        )}
      </div>
      
      {/* Pagination Footer */}
      <div className={footerClasses}>
        <div className="flex items-center justify-between">
          <div className={footerTextClasses}>
            Showing {Math.min((transactionCurrentPage - 1) * transactionRowsPerPage + 1, filteredTransactions.length)} to {Math.min(transactionCurrentPage * transactionRowsPerPage, filteredTransactions.length)} of <span className="font-bold">{filteredTransactions.length}</span> transactions
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>Rows per page</span>
              <select 
                value={transactionRowsPerPage}
                onChange={(e) => {
                  setTransactionRowsPerPage(Number(e.target.value));
                  setTransactionCurrentPage(1);
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
                onClick={() => setTransactionCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={transactionCurrentPage === 1}
                className={navButtonClasses(transactionCurrentPage === 1)}
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
                      onClick={() => setTransactionCurrentPage(page)}
                      className={paginationButtonClasses(transactionCurrentPage === page)}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>
              
              <button 
                onClick={() => setTransactionCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={transactionCurrentPage >= totalPages}
                className={navButtonClasses(transactionCurrentPage >= totalPages)}
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

export default VanTransactionRecords;