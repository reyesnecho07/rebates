// VcpTransactionRecords.jsx - Simplified version

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

const VcpTransactionRecords = ({ 
  theme = 'light',
  customerModalTab,
  modalCustomer,
  filteredTransactions,
  transactionCurrentPage,
  setTransactionCurrentPage,
  transactionRowsPerPage,
  setTransactionRowsPerPage,
  isLoading = false,
  periodFrom,
  periodTo,
  setPeriodFrom,
  setPeriodTo,
  loadDetailedTransactionsData,
  isAutoLoading = false
}) => {
  const isDark = theme === 'dark';

  // Helper function to check if Treetype is 'I' (Invoice)
  const isInvoiceTransaction = (transaction) => {
    // Check for Treetype in various possible property names
    const treetype = transaction.Treetype || 
                     transaction.treetype || 
                     transaction.type;
    
    // If it's exactly 'I', it's an invoice transaction and should be italicized
    return treetype === 'I';
  };

  // Sorting function to order transactions by date (earliest first)
  const sortTransactionsByDate = (transactions) => {
    if (!transactions || !Array.isArray(transactions)) return [];
    
    return [...transactions].sort((a, b) => {
      const dateA = new Date(a.Date || a.transactionDate || a.date);
      const dateB = new Date(b.Date || b.transactionDate || b.date);
      
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      
      return dateA - dateB;
    });
  };

  // Create sorted transactions for display
  const sortedTransactions = sortTransactionsByDate(filteredTransactions);

  useEffect(() => {
    if (customerModalTab === 'transaction' && modalCustomer && !periodFrom) {
      console.log('📅 Transaction tab activated - auto-loading dates...');
      
      loadDetailedTransactionsData(true);
      
      const dateFrom = modalCustomer.details?.rebateDetails?.dateFrom || 
                      modalCustomer.dateFrom || 
                      modalCustomer.details?.dateRange?.periodFrom;
      
      const dateTo = modalCustomer.details?.rebateDetails?.dateTo || 
                    modalCustomer.dateTo || 
                    modalCustomer.details?.dateRange?.periodTo;
      
      if (dateFrom && dateTo) {
        console.log('📅 Setting auto-loaded dates:', { dateFrom, dateTo });
        setPeriodFrom(dateFrom);
        setPeriodTo(dateTo);
      } else {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        const quarterEndMonth = quarterStartMonth + 2;
        
        const quarterStartDate = new Date(currentYear, quarterStartMonth, 1);
        const quarterEndDate = new Date(currentYear, quarterEndMonth + 1, 0);
        
        setPeriodFrom(quarterStartDate.toISOString().split('T')[0]);
        setPeriodTo(quarterEndDate.toISOString().split('T')[0]);
        
        console.log('📅 Using default quarter dates:', {
          from: quarterStartDate.toISOString().split('T')[0],
          to: quarterEndDate.toISOString().split('T')[0]
        });
      }
    }
  }, [customerModalTab, modalCustomer]);
  
  if (customerModalTab !== 'transaction') return null;
  
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

  // Styling classes
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
  const totalPages = Math.ceil(sortedTransactions.length / transactionRowsPerPage);
  const paginatedTransactions = sortedTransactions.slice(
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={headerClasses}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className={titleClasses}>Transaction Records</h4>
            <p className={subtitleClasses}>
              {modalCustomer?.rebateType === 'Fixed'
                ? `SAP transactions for fixed rebate program`
                : modalCustomer?.rebateType === 'Percentage'
                ? `SAP transactions for percentage rebate program`
                : `SAP transactions for incremental rebate program`}
            </p>
          </div>
        </div>
      </div>
      
      {/* Table Content */}
      <div className={contentAreaClasses}>
        {paginatedTransactions.length > 0 ? (
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
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {paginatedTransactions.map((transaction, index) => {
                const globalIndex = (transactionCurrentPage - 1) * transactionRowsPerPage + index;
                const itemName = transaction.Item || transaction.ItemName || 'N/A';
                const itemCode = transaction.ItemCode || transaction.ItemCodeSAP || 'N/A';
                const is25kgItem = transaction.Is25kgItem || itemName.toLowerCase().includes('25kg');
                const displayItemName = is25kgItem ? `${itemName} (25kg)` : itemName;
                
                // Check if this is an invoice transaction (Treetype = 'I')
                const isInvoice = isInvoiceTransaction(transaction);
                
                // Get Treetype for display
                const treetype = transaction.Treetype || 
                                transaction.treetype || 
                                transaction.type || 
                                'N/A';
                
                return (
                  <tr 
                    key={index} 
                    className={`
                      ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}
                      ${isInvoice ? (
                        isDark 
                          ? 'italic text-gray-400' 
                          : 'italic text-gray-500'
                      ) : ''}
                    `}
                  >
                    {/* Date Column */}
                    <td className="px-4 py-2">
                      <div className={`font-medium ${
                        isInvoice ? '' : (isDark ? 'text-gray-100' : 'text-gray-900')
                      }`}>
                        {formatDate(transaction.Date)}
                      </div>
                    </td>
                    
                    {/* Item Column (with Item Code and Treetype below) */}
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <div className={`font-medium truncate ${
                          isInvoice ? '' : (isDark ? 'text-gray-100' : 'text-gray-900')
                        }`}>
                          {displayItemName}
                        </div>
                        <div className={`text-[10px] font-mono flex items-center gap-1 ${
                          isInvoice ? '' : (isDark ? 'text-gray-400' : 'text-gray-500')
                        }`}>
                          <span>{itemCode}</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* Actual Sales Column */}
                    <td className="px-4 py-2 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`inline-block px-2 py-0.5 font-medium rounded border ${
                          isDark
                            ? (isInvoice 
                                ? 'bg-gray-800 text-gray-400 border-gray-700' 
                                : 'bg-blue-900/30 text-blue-300 border-blue-700')
                            : (isInvoice
                                ? 'bg-gray-100 text-gray-500 border-gray-200'
                                : 'bg-blue-50 text-blue-700 border-blue-100')
                        }`}>
                          {formatDecimal(transaction.ActualSales)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className={`flex-1 flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`mt-7 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
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
            Showing {Math.min((transactionCurrentPage - 1) * transactionRowsPerPage + 1, sortedTransactions.length)} to {Math.min(transactionCurrentPage * transactionRowsPerPage, sortedTransactions.length)} of <span className="font-bold">{sortedTransactions.length}</span> transactions
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

export default VcpTransactionRecords;