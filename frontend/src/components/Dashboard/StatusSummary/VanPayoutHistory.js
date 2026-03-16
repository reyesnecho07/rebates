import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Edit, RefreshCw, Calculator, AlertCircle } from 'lucide-react';

const VanPayoutHistory = ({ 
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
  setFilteredPayouts,
  setPaginatedPayouts
}) => {
  const isDark = theme === 'dark';
  const [isProcessingData, setIsProcessingData] = useState(false);
  const [beginningBalances, setBeginningBalances] = useState([]);
  const [showBalanceInfo, setShowBalanceInfo] = useState(false);
  
  // SAP Integration States
  const [syncingSap, setSyncingSap] = useState(false);
  const [sapSyncMessage, setSapSyncMessage] = useState(null);
  const [showSapDetails, setShowSapDetails] = useState({});
  const [lastSapSync, setLastSapSync] = useState(null);
  
  // Extract customer info safely
  const customerCardCode = modalCustomer?.CardCode || modalCustomer?.cardCode || modalCustomer?.CustomerCode;
  const rebateType = modalCustomer?.rebateType || modalCustomer?.RebateType;
  const rebateCode = modalCustomer?.rebateCode || modalCustomer?.RebateCode;
  
  // Debug log
  useEffect(() => {
    console.log('PayoutHistory Debug:', {
      modalCustomer,
      customerCardCode,
      rebateType,
      rebateCode,
      customerModalTab
    });
  }, [modalCustomer, customerModalTab]);

  // Helper function to get quarter from period
  const getQuarterFromPeriod = useCallback((period) => {
    if (!period) return 0;
    
    if (period.includes('Q1') || period.includes('January') || period.includes('February') || period.includes('March')) {
      return 1;
    } else if (period.includes('Q2') || period.includes('April') || period.includes('May') || period.includes('June')) {
      return 2;
    } else if (period.includes('Q3') || period.includes('July') || period.includes('August') || period.includes('September')) {
      return 3;
    } else if (period.includes('Q4') || period.includes('October') || period.includes('November') || period.includes('December')) {
      return 4;
    }
    return 0;
  }, []);

  // Helper function to get year from period
  const getYearFromPeriod = useCallback((period) => {
    if (!period) return new Date().getFullYear();
    
    const yearMatch = period.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return parseInt(yearMatch[1]);
    }
    
    return new Date().getFullYear();
  }, []);

  // Function to automatically sync SAP data when payouts are loaded or generated
  const autoSyncSapData = useCallback(async () => {
    if (!customerCardCode) {
      console.log('No customer card code for SAP sync');
      return;
    }

    // Don't sync if we've already synced recently (within last 5 seconds)
    if (lastSapSync && (Date.now() - lastSapSync) < 5000) {
      console.log('SAP sync skipped - too recent');
      return;
    }

    try {
      console.log('🔄 Auto-syncing SAP data for customer:', customerCardCode);
      
      const payload = {
        db: 'VAN_OWN',
        rebateCode: rebateCode,
        periodFrom: modalCustomer?.dateRange?.periodFrom,
        periodTo: modalCustomer?.dateRange?.periodTo
      };
      
      const response = await fetch(`http://192.168.100.193:3006/api/van/customer/${customerCardCode}/sync-sap`, {
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
        console.log(`✅ Auto SAP sync complete: Updated ${result.data?.updatedCount || 0} payout records`);
        setLastSapSync(Date.now());
        
        // Update the payouts with SAP data
        if (result.data?.updatedCount > 0) {
          // Reload payouts to show the updated SAP amounts
          await loadPayoutsWithBalances();
        }
      }
      
    } catch (error) {
      console.error('Auto SAP sync error:', error);
    }
  }, [customerCardCode, rebateCode, modalCustomer?.dateRange, lastSapSync]);

  // Trigger SAP sync when payouts are first loaded or when the tab becomes visible
  useEffect(() => {
    if (customerModalTab === 'payout' && customerCardCode) {
      // Auto sync SAP data after a short delay to ensure payouts are loaded
      const timer = setTimeout(() => {
        autoSyncSapData();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [customerModalTab, customerCardCode, autoSyncSapData]);

  // Also sync when new payouts are generated
  const syncNewPayouts = useCallback(async () => {
    if (!customerCardCode) return;
    
    setSyncingSap(true);
    setSapSyncMessage("🔄 Syncing with SAP...");
    
    try {
      await autoSyncSapData();
      setSapSyncMessage("✅ SAP sync complete");
      setTimeout(() => setSapSyncMessage(null), 3000);
    } catch (error) {
      setSapSyncMessage(`❌ SAP sync failed: ${error.message}`);
      setTimeout(() => setSapSyncMessage(null), 5000);
    } finally {
      setSyncingSap(false);
    }
  }, [customerCardCode, autoSyncSapData]);

  // Toggle SAP details
  const toggleSapDetails = (payoutId) => {
    setShowSapDetails(prev => ({
      ...prev,
      [payoutId]: !prev[payoutId]
    }));
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

  // Helper function to get month order from period
  const getMonthOrder = useCallback((period) => {
    if (!period) return 99;
    
    const monthNames = {
      'January': 1, 'February': 2, 'March': 3,
      'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9,
      'October': 10, 'November': 11, 'December': 12
    };
    
    for (const [monthName, order] of Object.entries(monthNames)) {
      if (period.includes(monthName)) {
        return order;
      }
    }
    
    return 99; // Default high number for non-month periods
  }, []);

  // Load payouts with balances
  const loadPayoutsWithBalances = useCallback(async () => {
    try {
      if (!customerCardCode || !rebateType) {
        setSaveMessage("⚠️ Customer code and rebate type are required");
        return;
      }
      
      setSaveMessage("📊 Loading payout data...");
      
      // Load payouts (this will auto-calculate beginning balances)
      let payoutUrl = `http://192.168.100.193:3006/api/van/payouts/customer/${customerCardCode}/payouts?db=VAN_OWN&rebateType=${rebateType}`;
      if (rebateCode) payoutUrl += `&rebateCode=${rebateCode}`;
      
      console.log('Loading payouts from:', payoutUrl);
      
      const response = await fetch(payoutUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Loaded payouts:', {
          regular: result.data?.regularPayouts?.length || 0,
          beginning: result.data?.beginningBalances?.length || 0,
          all: result.data?.payouts?.length || 0
        });
        
        // Get the combined payouts array
        const allPayouts = result.data?.payouts || [];
        
        // Process the data to ensure proper order
        const processedData = organizePayoutsByQuarter(allPayouts);
        
        setBeginningBalances(result.data?.beginningBalances || []);
        setFilteredPayouts(processedData);
        
        // Update paginated data
        const startIndex = (payoutCurrentPage - 1) * payoutRowsPerPage;
        const endIndex = startIndex + payoutRowsPerPage;
        setPaginatedPayouts(processedData.slice(startIndex, endIndex));
        
        setSaveMessage(`✅ Loaded ${processedData.length} payout records`);
        setTimeout(() => setSaveMessage(null), 2000);
      } else {
        throw new Error(result.error || 'Failed to load payout data');
      }
    } catch (error) {
      console.error('Error loading payouts with balances:', error);
      setSaveMessage(`❌ Error loading data: ${error.message}`);
      setTimeout(() => setSaveMessage(null), 5000);
      
      // Set empty arrays on error
      setFilteredPayouts([]);
      setPaginatedPayouts([]);
      setBeginningBalances([]);
    }
  }, [customerCardCode, rebateCode, rebateType, payoutCurrentPage, payoutRowsPerPage, setFilteredPayouts, setPaginatedPayouts, setSaveMessage]);

  // Organize payouts by quarter with quarter rebates ALWAYS last
  const organizePayoutsByQuarter = useCallback((payouts) => {
    if (!payouts || payouts.length === 0) return [];
    
    console.log('🔄 Organizing payouts by quarter with quarter rebates last...');
    
    // Create a map to group by quarter
    const quarters = {};
    
    payouts.forEach(payout => {
      // Use regex for robust detection of beginning balances
      const isBegBalance = payout.isBeginningBalance || 
                          (payout.Period && /Balance\s+of\s+Q\d/i.test(payout.Period));
      
      // CRITICAL: Identify quarter rebates by their specific naming pattern
      const isQtrRebate = payout.isQtrRebate || 
                         (payout.Period && payout.Period.includes('Quarter') && 
                          payout.Period.includes('Rebate') && 
                          payout.Period.includes('-'));
      
      // Get quarter from various sources, with priority for beginning balances
      let quarter, year;

      if (isBegBalance) {
        // For beginning balances, extract target quarter/year directly from period
        const match = payout.Period.match(/Balance\s+of\s+Q(\d+)\s+(\d{4})/i);
        if (match) {
          quarter = parseInt(match[1]);
          year = parseInt(match[2]);
        } else {
          // Fallback (should not happen)
          quarter = getQuarterFromPeriod(payout.Period);
          year = getYearFromPeriod(payout.Period);
        }
      } else {
        // For non-beginning balances, try PayoutQuarter first
        if (payout.PayoutQuarter) {
          const match = payout.PayoutQuarter.match(/Q(\d+)\s+(\d{4})/);
          if (match) {
            quarter = parseInt(match[1]);
            year = parseInt(match[2]);
          }
        }
        if (!quarter || !year) {
          if (isQtrRebate) {
            // Extract from quarter rebate period like "Quarter 3 Rebate - 2024"
            const quarterMatch = payout.Period.match(/Quarter (\d+)/i);
            const yearMatch = payout.Period.match(/\b(20\d{2})\b/);
            quarter = quarterMatch ? parseInt(quarterMatch[1]) : getQuarterFromPeriod(payout.Period);
            year = yearMatch ? parseInt(yearMatch[1]) : getYearFromPeriod(payout.Period);
          } else {
            quarter = getQuarterFromPeriod(payout.Period);
            year = getYearFromPeriod(payout.Period);
          }
        }
      }
      
      const quarterKey = `Q${quarter}-${year}`;
      
      if (!quarters[quarterKey]) {
        quarters[quarterKey] = {
          year: year,
          quarter: quarter,
          beginningBalances: [],
          regularPayouts: [],
          quarterRebates: []
        };
      }
      
      // Separate into appropriate arrays
      if (isBegBalance) {
        quarters[quarterKey].beginningBalances.push({
          ...payout,
          isBeginningBalance: true
        });
      } else if (isQtrRebate) {
        quarters[quarterKey].quarterRebates.push({
          ...payout,
          isQtrRebate: true,
          quarterNumber: quarter,
          yearNumber: year
        });
      } else {
        quarters[quarterKey].regularPayouts.push(payout);
      }
    });
    
    // Sort quarters chronologically
    const sortedQuarters = Object.values(quarters).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.quarter - b.quarter;
    });
    
    // Flatten in correct order: beginning balances first, then regular payouts, then quarter rebates (ALWAYS LAST)
    const result = [];
    
    sortedQuarters.forEach(quarterData => {
      console.log(`📦 Quarter ${quarterData.quarter} ${quarterData.year}: ${quarterData.beginningBalances.length} beg balances, ${quarterData.regularPayouts.length} regular, ${quarterData.quarterRebates.length} quarter rebates`);
      
      // 1. Add beginning balances first
      quarterData.beginningBalances.forEach(balance => {
        result.push(balance);
      });
      
      // 2. Sort and add regular payouts by month order (January, February, March, etc.)
      const sortedRegular = quarterData.regularPayouts.sort((a, b) => {
        const monthOrderA = getMonthOrder(a.Period);
        const monthOrderB = getMonthOrder(b.Period);
        
        if (monthOrderA !== monthOrderB) {
          return monthOrderA - monthOrderB;
        }
        
        // Fallback to date if month order not found
        const dateA = new Date(a.Date || '');
        const dateB = new Date(b.Date || '');
        return dateA - dateB;
      });
      
      result.push(...sortedRegular);
      
      // 3. Add quarter rebates ALWAYS LAST in this quarter
      if (quarterData.quarterRebates.length > 0) {
        console.log(`✨ Adding ${quarterData.quarterRebates.length} quarter rebate(s) at the end of Q${quarterData.quarter} ${quarterData.year}`);
        
        // Sort quarter rebates by date if multiple
        const sortedRebates = quarterData.quarterRebates.sort((a, b) => {
          const dateA = new Date(a.Date || '');
          const dateB = new Date(b.Date || '');
          return dateA - dateB;
        });
        
        // Add each quarter rebate with clear identification
        sortedRebates.forEach(rebate => {
          result.push({
            ...rebate,
            isLastInQuarter: true // Mark as last in quarter
          });
        });
      }
    });
    
    console.log(`✅ Organized ${result.length} payouts with quarter rebates at the end of each quarter`);
    
    return result;
  }, [getQuarterFromPeriod, getYearFromPeriod, getMonthOrder]);

  const savePayoutChanges = async (payout) => {
    try {
      const amount = parseFloat(editedAmountReleased) || 0;
      const totalAmount = parseFloat(payout.TotalAmount || payout.Amount || payout.totalAmount || payout.amount || 0);
      
      if (amount < 0 || amount > totalAmount) {
        setSaveMessage(`❌ Amount must be between 0 and ${totalAmount.toFixed(2)}`);
        setTimeout(() => setSaveMessage(null), 3000);
        return;
      }
      
      setSaveMessage("💾 Saving changes...");
      
      // Determine the correct endpoint based on payout type
      const isBeginningBalance = payout.isBeginningBalance;
      const endpoint = isBeginningBalance 
        ? `http://192.168.100.193:3006/api/van/payouts/${encodeURIComponent(payout.PayoutId || payout.Id)}/status`
        : `http://192.168.100.193:3006/api/van/payouts/${encodeURIComponent(payout.PayoutId || payout.Id)}/amount-released`;
      
      const payload = {
        db: 'VAN_OWN',
        amountReleased: amount
      };
      
      // For regular payouts, also include status
      if (!isBeginningBalance) {
        const status = payout.Status || payout.status || 'Pending';
        payload.status = status;
      }
      
      
      const response = await fetch(endpoint, {
        method: 'PUT',
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
        setEditingPayoutId(null);
        setEditedAmountReleased('');
        
        // Reload data
        await loadPayoutsWithBalances();
        
        setSaveMessage("✅ Changes saved!");
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        throw new Error(result.message || 'Save failed');
      }
      
    } catch (error) {
      console.error('Save error:', error);
      setSaveMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  // Recalculate beginning balances
  const recalculateBeginningBalances = async () => {
    try {
      setIsProcessingData(true);
      setSaveMessage("🔄 Recalculating beginning balances...");
      
      const response = await fetch('http://192.168.100.193:3006/api/van/payouts/recalculate-beginning-balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          db: 'VAN_OWN',
          cardCode: customerCardCode,
          rebateType: rebateType
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setSaveMessage(`✅ ${result.message}`);
        setTimeout(() => setSaveMessage(null), 3000);
        
        // Reload data
        await loadPayoutsWithBalances();
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to recalculate balances');
      }
    } catch (error) {
      console.error('Error recalculating balances:', error);
      setSaveMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setSaveMessage(null), 5000);
      throw error;
    } finally {
      setIsProcessingData(false);
    }
  };

  // Effect to load payouts when component mounts or customer changes
  useEffect(() => {
    if (customerModalTab === 'payout' && customerCardCode && rebateType) {
      loadPayoutsWithBalances();
    }
  }, [customerModalTab, customerCardCode, rebateType, loadPayoutsWithBalances]);
  
  // Sort payout rows for display (quarter rebates ALWAYS last in their quarter)
  const sortedPaginatedPayouts = useMemo(() => {
    if (!paginatedPayouts || paginatedPayouts.length === 0) return [];
    
    console.log('🔀 Sorting paginated payouts with quarter rebates last...');
    
    // Create a copy to avoid mutating the original
    const payouts = [...paginatedPayouts];
    
    // Group by quarter
    const quarterGroups = {};
    
    payouts.forEach(payout => {
      // Use regex for robust detection
      const isQtrRebate = payout.isQtrRebate || 
                         (payout.Period && payout.Period.includes('Quarter') && 
                          payout.Period.includes('Rebate') && 
                          payout.Period.includes('-'));
      
      const isBegBalance = payout.isBeginningBalance || 
                          (payout.Period && /Balance\s+of\s+Q\d/i.test(payout.Period));

      let quarter, year;

      if (isBegBalance) {
        // For beginning balances, extract target quarter/year directly from period
        const match = payout.Period.match(/Balance\s+of\s+Q(\d+)\s+(\d{4})/i);
        if (match) {
          quarter = parseInt(match[1]);
          year = parseInt(match[2]);
        } else {
          quarter = getQuarterFromPeriod(payout.Period);
          year = getYearFromPeriod(payout.Period);
        }
      } else {
        if (payout.PayoutQuarter) {
          const match = payout.PayoutQuarter.match(/Q(\d+)\s+(\d{4})/);
          if (match) {
            quarter = parseInt(match[1]);
            year = parseInt(match[2]);
          }
        }
        if (!quarter || !year) {
          if (isQtrRebate) {
            const quarterMatch = payout.Period.match(/Quarter (\d+)/i);
            const yearMatch = payout.Period.match(/\b(20\d{2})\b/);
            quarter = quarterMatch ? parseInt(quarterMatch[1]) : getQuarterFromPeriod(payout.Period);
            year = yearMatch ? parseInt(yearMatch[1]) : getYearFromPeriod(payout.Period);
          } else {
            quarter = getQuarterFromPeriod(payout.Period);
            year = getYearFromPeriod(payout.Period);
          }
        }
      }
      
      const quarterKey = `Q${quarter}-${year}`;
      
      if (!quarterGroups[quarterKey]) {
        quarterGroups[quarterKey] = {
          regular: [],
          rebates: []
        };
      }
      
      if (isQtrRebate) {
        console.log(`🔍 Identified Quarter Rebate for sorting: ${payout.Period}`);
        quarterGroups[quarterKey].rebates.push(payout);
      } else {
        quarterGroups[quarterKey].regular.push(payout);
      }
    });
    
    // Flatten with quarter rebates ALWAYS last in their quarter
    const result = [];
    
    // Get sorted quarter keys
    const sortedQuarterKeys = Object.keys(quarterGroups).sort((a, b) => {
      const [qA, yA] = a.split('-');
      const [qB, yB] = b.split('-');
      const yearA = parseInt(yA);
      const yearB = parseInt(yB);
      const quarterA = parseInt(qA.replace('Q', ''));
      const quarterB = parseInt(qB.replace('Q', ''));
      
      if (yearA !== yearB) return yearA - yearB;
      return quarterA - quarterB;
    });
    
    sortedQuarterKeys.forEach(quarterKey => {
      const group = quarterGroups[quarterKey];
      
      console.log(`📊 Quarter ${quarterKey}: ${group.regular.length} regular, ${group.rebates.length} quarter rebates`);
      
      // Sort regular payouts (beginning balances first, then by month order)
      const sortedRegular = group.regular.sort((a, b) => {
        // Use robust detection for beginning balances
        const aIsBeg = a.isBeginningBalance || /Balance\s+of\s+Q\d/i.test(a.Period);
        const bIsBeg = b.isBeginningBalance || /Balance\s+of\s+Q\d/i.test(b.Period);
        
        if (aIsBeg && !bIsBeg) return -1;
        if (!aIsBeg && bIsBeg) return 1;
        
        // Sort regular months by month order
        const monthOrderA = getMonthOrder(a.Period);
        const monthOrderB = getMonthOrder(b.Period);
        
        if (monthOrderA !== monthOrderB) {
          return monthOrderA - monthOrderB;
        }
        
        // Fallback to date
        const dateA = new Date(a.Date || '');
        const dateB = new Date(b.Date || '');
        return dateA - dateB;
      });
      
      // Add regular payouts first
      result.push(...sortedRegular);
      
      // Add quarter rebates LAST (always at the bottom of the quarter)
      if (group.rebates.length > 0) {
        console.log(`✨ Adding ${group.rebates.length} quarter rebate(s) at the end of ${quarterKey}`);
        
        const sortedRebates = group.rebates.sort((a, b) => {
          const dateA = new Date(a.Date || '');
          const dateB = new Date(b.Date || '');
          return dateA - dateB;
        });
        
        // Mark quarter rebates as last in quarter
        sortedRebates.forEach(rebate => {
          result.push({
            ...rebate,
            isLastInQuarter: true
          });
        });
      }
    });
    
    console.log(`✅ Sorted ${result.length} payouts with quarter rebates at the end`);
    
    return result;
  }, [paginatedPayouts, getQuarterFromPeriod, getYearFromPeriod, getMonthOrder]);

  // Function to render beginning balance row
  const renderBeginningBalanceRow = (payout, index) => {
    const period = payout.Period || '';
    
    const match = period.match(/Balance of Q(\d+) (\d+)/);
    const targetQuarter = match ? match[1] : '';
    const targetYear = match ? match[2] : '';
    
    // Calculate which quarter this balance came FROM
    let sourceQuarter = '';
    let sourceYear = '';
    if (targetQuarter && targetYear) {
      const prevQuarter = parseInt(targetQuarter) === 1 ? 4 : parseInt(targetQuarter) - 1;
      const prevYear = parseInt(targetQuarter) === 1 ? parseInt(targetYear) - 1 : targetYear;
      sourceQuarter = `Q${prevQuarter}`;
      sourceYear = prevYear;
    }
    
    const totalAmount = parseFloat(payout.TotalAmount) || parseFloat(payout.Balance) || 0;
    const balanceAmount = totalAmount;
    
    const rowClasses = `
      ${isDark 
        ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 hover:bg-green-900/30 border-l-4 border-l-green-500' 
        : 'bg-gradient-to-r from-green-50 to-emerald-50 hover:bg-green-50 border-l-4 border-l-green-400'
      }
    `;
    
    const periodTextClasses = `font-bold ${isDark ? 'text-green-300' : 'text-green-700'}`;
    const amountClasses = `inline-block px-2 py-0.5 font-bold rounded border ${
      isDark 
        ? 'bg-green-900/30 text-green-300 border-green-700' 
        : 'bg-green-100 text-green-700 border-green-200'
    }`;
    
    return (
      <tr key={`beg-bal-${payout.Id || index}`} className={rowClasses}>
        <td className="px-6 py-2">
          <div className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-medium`}>
            {payout.Date || new Date().toLocaleDateString()}
          </div>
          <div className={`text-[10px] font-medium ${
            isDark ? 'text-green-400' : 'text-green-600'
          }`}>
            Beginning Balance
          </div>
        </td>
        <td className="px-3 py-2">
          <div className={periodTextClasses}>
            {payout.Period}
            {sourceQuarter && (
              <div className={`text-xs ${isDark ? 'text-green-400/70' : 'text-green-600/70'}`}>
                (From {sourceQuarter} {sourceYear} transactions)
              </div>
            )}
          </div>
        </td>

        
        <td className="px-3 py-2 text-center">
          {/* Base Amount Column - Blank */}
        </td>
        <td className="px-3 py-2 text-center">
          {/* Total Amount Column - Blank */}
        </td>
        <td className="px-3 py-2 text-center">
          {/* Status Column - Blank */}
        </td>
        <td className="px-3 py-2 text-center">
          {/* Amount Released Column - Blank */}
        </td>
        <td className="px-3 py-2 text-center">
          <span className={amountClasses}>
            {formatCurrency(balanceAmount)}
          </span>
        </td>
      </tr>
    );
  };

  const renderPayoutRow = (payout, index) => {
    // Check if this is a beginning balance row
    const isBeginningBalance = payout.isBeginningBalance || (payout.Period && /Balance\s+of\s+Q\d/i.test(payout.Period));
    
    if (isBeginningBalance) {
      return renderBeginningBalanceRow(payout, index);
    }
    
    const isQtrRebate = payout.isQtrRebate;
    
    // Extract values from payout data
    const totalAmount = parseFloat(payout.TotalAmount || payout.Amount || payout.totalAmount || payout.amount || 0);
    const baseAmount = parseFloat(payout.BaseAmount || payout.baseAmount || 0);
    
    // FIXED: Use amountReleased from backend (which now includes SAP journal amounts)
    const amountReleased = parseFloat(payout.amountReleased || payout.AmountReleased || 0);
    
    // Check if this payout has SAP journal entry
    const hasSapJournal = payout.hasSapJournal || false;
    const journalRemarks = payout.journalRemarks || '';
    const journalDate = payout.journalDate || null;
    
    const previousBalance = parseFloat(payout.PreviousBalance || 0);
    
    // Calculate balance correctly
    const calculatedBalance = Math.max(0, totalAmount - amountReleased);
    const balance = calculatedBalance;
    
    const status = payout.status || payout.Status || 'Pending';
    
    // DEBUG: Log payout data to see SAP properties
    if (hasSapJournal) {
      console.log('💰 SAP Journal Entry found:', { 
        id: payout.id || payout.Id, 
        period: payout.period || payout.Period,
        amountReleased,
        hasSapJournal,
        journalRemarks,
        journalDate
      });
    }
    
    // Simplified eligibility logic
    const isNoPayoutStatus = status === 'No Payout';
    const hasValidAmount = totalAmount > 0;
    const isEditable = !isNoPayoutStatus && (hasValidAmount || isQtrRebate);
    
    // For display purposes, show as "no data" only if it's truly no payout
    const shouldShowNoData = isNoPayoutStatus && !hasValidAmount && !isQtrRebate;
    
    const isEditing = editingPayoutId === (payout.id || payout.Id);
    
    // Get the quarter from PayoutQuarter or calculate it
    const payoutQuarter = payout.payoutQuarter || payout.PayoutQuarter || '';
    
    // If PayoutQuarter is not available, try to calculate it from period
    let quarterDisplay = payoutQuarter;
    if (!quarterDisplay) {
      const period = payout.period || payout.Period || '';
      const quarterMatch = period.match(/Q(\d+)/i);
      const yearMatch = period.match(/\b(20\d{2})\b/);
      
      if (quarterMatch && yearMatch) {
        quarterDisplay = `Q${quarterMatch[1]} ${yearMatch[1]}`;
      } else {
        // Try to determine from month
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        for (let i = 0; i < monthNames.length; i++) {
          if (period.includes(monthNames[i])) {
            const quarter = Math.floor(i / 3) + 1;
            let year = new Date().getFullYear();
            if (yearMatch) year = parseInt(yearMatch[1]);
            quarterDisplay = `Q${quarter} ${year}`;
            break;
          }
        }
      }
    }

    const rowClasses = `
      ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} 
      ${isQtrRebate ? 
        (isDark 
          ? 'bg-gradient-to-r from-blue-900/20 to-sky-900/20 border-l-4 border-l-blue-500' 
          : 'bg-gradient-to-r from-blue-50 to-sky-50 border-l-4 border-l-blue-400') : ''}
      ${shouldShowNoData ? 
        (isDark ? 'bg-gray-700/30' : 'bg-gray-50/60') : ''}
      ${hasSapJournal ? 
        (isDark ? 'border-l-2 border-l-purple-500' : 'border-l-2 border-l-purple-400') : ''}
    `;

    const dateTextClasses = `font-medium ${
      isDark ? 'text-gray-100' : 'text-gray-900'
    }`;

    const qtrRebateTextClasses = `text-[10px] font-medium ${
      isDark ? 'text-blue-400' : 'text-blue-600'
    }`;

    const sapIndicatorClasses = `text-[10px] font-medium flex items-center gap-0.5 ${
      isDark ? 'text-purple-400' : 'text-purple-600'
    }`;

    const periodTextClasses = `font-medium ${
      isQtrRebate ? 
        (isDark ? 'text-purple-300' : 'text-purple-700') : 
      shouldShowNoData ? 
        (isDark ? 'text-gray-400 italic' : 'text-gray-500 italic') :
      isDark ? 'text-gray-200' : 'text-gray-800'
    }`;

    const quarterTextClasses = `font-medium ${
      isQtrRebate ? 
        (isDark ? 'text-purple-300' : 'text-purple-700') :
      shouldShowNoData ? 
        (isDark ? 'text-gray-400' : 'text-gray-500') :
      (isDark ? 'text-blue-300' : 'text-blue-700')
    }`;

    const baseAmountClasses = `inline-block px-2 py-0.5 font-medium rounded border whitespace-nowrap ${
      baseAmount > 0 ? 
        (isDark 
          ? 'bg-blue-900/30 text-blue-300 border-blue-700' 
          : 'bg-blue-100 text-blue-700 border-blue-200') : 
      shouldShowNoData ?
        (isDark 
          ? 'bg-gray-700 text-gray-400 border-gray-600 italic' 
          : 'bg-gray-100 text-gray-500 border-gray-200 italic') :
      isDark 
        ? 'bg-gray-700 text-gray-400 border-gray-600' 
        : 'bg-gray-100 text-gray-500 border-gray-200'
    }`;

    const totalAmountClasses = `inline-block px-2 py-0.5 font-medium rounded border whitespace-nowrap ${
      shouldShowNoData ? 
        (isDark 
          ? 'bg-gray-700 text-gray-400 border-gray-600 italic' 
          : 'bg-gray-100 text-gray-500 border-gray-200 italic') :
      isQtrRebate ? 
        (isDark 
          ? 'bg-purple-900/30 text-purple-300 border-purple-700' 
          : 'bg-purple-100 text-purple-700 border-purple-200') :
      totalAmount > 0 ? 
        (isDark 
          ? 'bg-amber-900/30 text-amber-300 border-amber-700' 
          : 'bg-amber-50 text-amber-700 border-amber-100') : 
      isDark 
        ? 'bg-gray-700 text-gray-400 border-gray-600' 
        : 'bg-gray-50 text-gray-500 border-gray-200'
    }`;

    const statusSelectClasses = `px-2 py-0.5 text-center rounded font-medium border appearance-none focus:outline-none w-full max-w-[100px] whitespace-nowrap text-xs ${
      !isEditable ? 
        (isDark 
          ? 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed italic' 
          : 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed italic') :
      status === 'Paid' ? 
        (isDark 
          ? 'bg-green-900/30 text-green-300 border-green-700 cursor-pointer' 
          : 'bg-green-100 text-green-800 border-green-300 cursor-pointer') :
      status === 'Partially Paid' ? 
        (isDark 
          ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 cursor-pointer' 
          : 'bg-yellow-100 text-yellow-800 border-yellow-300 cursor-pointer') :
      status === 'Pending' ? 
        (isDark 
          ? 'bg-blue-900/30 text-blue-300 border-blue-700 cursor-pointer' 
          : 'bg-blue-100 text-blue-800 border-blue-300 cursor-pointer') : 
      isDark 
        ? 'bg-gray-700 text-gray-300 border-gray-600 cursor-pointer' 
        : 'bg-gray-100 text-gray-800 border-gray-300 cursor-pointer'
    }`;

    const amountInputClasses = `w-28 pl-6 pr-2 py-1 border rounded text-center focus:outline-none text-xs ${
      !isEditable ? 
        (isDark 
          ? 'border-gray-600 bg-gray-700 text-gray-400 italic cursor-not-allowed' 
          : 'border-gray-300 bg-gray-100 text-gray-400 italic cursor-not-allowed') :
      isEditing ? 
        (isDark 
          ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-900/30' 
          : 'border-blue-500 ring-1 ring-blue-500 bg-blue-50') :
      hasSapJournal ?
        (isDark 
          ? 'border-purple-500 bg-purple-900/30 text-purple-300' 
          : 'border-purple-400 bg-purple-50 text-purple-700') :
      isDark 
        ? 'border-gray-600 hover:border-blue-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-700 cursor-pointer' 
        : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer'
    }`;

    const balanceClasses = `inline-block px-3 py-1 font-medium rounded border whitespace-nowrap cursor-help transition-colors ${
      !isEditable ? 
        (isDark 
          ? 'bg-gray-700 text-gray-400 border-gray-600 italic' 
          : 'bg-gray-100 text-gray-500 border-gray-200 italic') :
      balance > 0 ? 
        (isDark 
          ? 'bg-red-900/30 text-red-300 border-red-700 hover:bg-red-900/50' 
          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100') :
      balance === 0 ? 
        (isDark 
          ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50' 
          : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100') : 
      isDark 
        ? 'bg-gray-700 text-gray-400 border-gray-600' 
        : 'bg-gray-100 text-gray-500 border-gray-200'
    }`;

    // Tooltip classes
    const tooltipClasses = `absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none min-w-max ${
      isDark ? 'bg-gray-900 text-white' : 'bg-gray-900 text-white'
    }`;

    const tooltipArrowClasses = `absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent ${
      isDark ? 'border-t-gray-900' : 'border-t-gray-900'
    }`;

    return (
      <tr key={payout.id || payout.Id || payout.PayoutId || index} className={rowClasses}>
        <td className="px-6 py-2">
          <div className={dateTextClasses}>{payout.date || payout.Date || payout.PayoutDate || 'N/A'}</div>
          {isQtrRebate && (
            <div className={qtrRebateTextClasses}>Quarter Rebate</div>
          )}
          {hasSapJournal && !isQtrRebate && (
            <div className={sapIndicatorClasses} title={journalRemarks || 'SAP Journal Entry'}>
              <span>📋 SAP</span>
              {journalDate && (
                <span className="text-[8px] opacity-70">
                  {new Date(journalDate).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
          {shouldShowNoData && !isQtrRebate && (
            <div className={`text-[10px] font-medium ${
              isDark ? 'text-gray-500' : 'text-gray-500'
            }`}>
              No Payout
            </div>
          )}
        </td>
        
        {/* Period Column */}
        <td className="px-3 py-2">
          <div className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <div className={periodTextClasses}>
              {payout.period || payout.Period || 'N/A'}
            </div>
            {payout.calculationNote || payout.CalculationNote && !shouldShowNoData && (
              <div className={`text-[10px] mt-0.5 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {payout.calculationNote || payout.CalculationNote}
              </div>
            )}
            {/* Show SAP remarks if available */}
            {hasSapJournal && journalRemarks && (
              <div className={`text-[9px] mt-0.5 truncate max-w-[200px] ${
                isDark ? 'text-purple-400' : 'text-purple-600'
              }`} title={journalRemarks}>
                📝 {journalRemarks}
              </div>
            )}
            {/* Show previous balance for quarter rebates */}
            {isQtrRebate && previousBalance > 0 && (
              <div className={`text-[9px] mt-0.5 ${
                isDark ? 'text-blue-400' : 'text-blue-600'
              }`}>
                + Previous: ₱{previousBalance.toFixed(2)}
              </div>
            )}
          </div>
        </td>
        
        {/* Base Amount Column */}
        <td className="px-3 py-2 text-center">
          <div className="relative group inline-block">
            <span className={baseAmountClasses}>
              {formatCurrency(baseAmount)}
            </span>
            {baseAmount > 0 && (
              <div className={tooltipClasses}>
                {payout.calculationNote || payout.CalculationNote || 'Base amount calculated from transactions'}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
          </div>
        </td>
        
        {/* Total Amount Column */}
        <td className="px-3 py-2 text-center">
          <div className="relative group inline-block">
            <span className={totalAmountClasses}>
              {formatCurrency(totalAmount)}
            </span>
            {totalAmount > 0 && (
              <div className={tooltipClasses} style={{ whiteSpace: 'pre-line' }}>
                {isQtrRebate 
                  ? `Base: ₱${baseAmount.toFixed(2)}\n+ Carry Over: ₱${previousBalance.toFixed(2)}\n= Total: ₱${totalAmount.toFixed(2)}`
                  : `Total amount eligible for payout`
                }
                {hasSapJournal && `\nSAP Released: ₱${amountReleased.toFixed(2)}`}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
          </div>
        </td>
        
        {/* Status Column */}
        <td className="px-3 py-2 text-center">
          <select 
            value={status}
            onChange={(e) => {
              if (isEditable) {
                handlePayoutStatusChange(payout.id || payout.Id || payout.PayoutId, e.target.value);
              }
            }}
            disabled={!isEditable}
            className={statusSelectClasses}
          >
            <option value="No Payout">No Payout</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </td>
        
        {/* Amount Released Column */}
        <td className="px-3 py-2 text-center">
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <span className={`absolute left-2 top-1/2 transform -translate-y-1/2 text-xs z-10 ${
                !isEditable ? 
                  (isDark ? 'text-gray-500' : 'text-gray-400') : 
                  hasSapJournal ?
                    (isDark ? 'text-purple-300' : 'text-purple-700') :
                  (isDark ? 'text-white' : 'text-black')
              }`}>
                ₱
              </span>
              <input
                type="text"
                value={amountReleased ? 
                  new Intl.NumberFormat('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }).format(amountReleased) : '0.00'}
                className={`${amountInputClasses} ${
                  isDark ? 'text-white' : 'text-black'
                } ${hasSapJournal ? (isDark ? 'border-purple-500 text-purple-300' : 'border-purple-400 text-purple-700') : ''}`}
                placeholder={!isEditable ? "N/A" : "0.00"}
                readOnly
                disabled
              />
            </div>
            {hasSapJournal && (
              <span className={`text-[8px] ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                From SAP
              </span>
            )}
          </div>
        </td>
        
        {/* Balance Column */}
        <td className="px-3 py-2 text-center">
          <div className="relative group inline-block">
            <span className={balanceClasses}>
              {formatCurrency(balance)}
            </span>
            {isEditable && balance >= 0 && (
              <div className={tooltipClasses} style={{ whiteSpace: 'pre-line' }}>
                Total: ₱{totalAmount.toFixed(2)}<br/>
                - Released: ₱{amountReleased.toFixed(2)}<br/>
                {hasSapJournal && `(SAP Journal Entry)`}<br/>
                = Balance: ₱{balance.toFixed(2)}
                <div className={tooltipArrowClasses}></div>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // Calculate total beginning balance
  const totalBeginningBalance = beginningBalances.reduce((sum, balance) => 
    sum + (balance.TotalAmount || balance.Balance || 0), 0
  );

  // Calculate total pages for pagination
  const totalPages = Math.ceil(filteredPayouts.length / payoutRowsPerPage);
  
  // Get pagination range
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

  if (customerModalTab !== 'payout') return null;
  
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

  return (
    <div className="h-full flex flex-col">
      {/* Header with SAP Sync Button */}
      <div className={headerClasses}>
        <div className="flex justify-between items-center">
          <div>
            <h4 className={titleClasses}>Payout History</h4>
            <p className={subtitleClasses}>
              Rebate payment records - Beginning balances calculated from previous quarter transactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* SAP Sync Button */}
            <button
              onClick={syncNewPayouts}
              disabled={syncingSap}
              className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                isDark 
                  ? 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 border border-purple-700' 
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300'
              } ${syncingSap ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw size={12} className={syncingSap ? 'animate-spin' : ''} />
              {syncingSap ? 'Syncing...' : 'Sync SAP'}
            </button>
            
            {totalBeginningBalance > 0 && (
              <div className={`px-3 py-1 rounded text-xs font-medium ${
                isDark 
                  ? 'bg-green-900/30 text-green-300 border border-green-700/30' 
                  : 'bg-green-100 text-green-700 border border-green-200'
              }`}>
                Total Beginning Balance: {formatCurrency(totalBeginningBalance)}
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
      
      {/* Table Content */}
      <div className={tableContainerClasses}>
        <table className="w-full text-xs">
          <thead className={tableHeaderClasses}>
            <tr className={tableHeaderRowClasses}>
              <th className="px-6 py-2 text-left w-[18%]">Date</th>
              <th className="px-3 py-2 text-left w-[21%]">Period</th>
              <th className="px-3 py-2 text-center w-[13%]">Rebate Earned</th>
              <th className="px-3 py-2 text-center w-[13%]">Total Amount</th>
              <th className="px-3 py-2 text-center w-[11%]">Status</th>
              <th className="px-3 py-2 text-center w-[13%]">Amount Released</th>
              <th className="px-3 py-2 text-center w-[13%]">Balance</th>
            </tr>
          </thead>
          <tbody className={tableBodyClasses}>
            {sortedPaginatedPayouts.length > 0 ? (
              sortedPaginatedPayouts.map((payout, index) => renderPayoutRow(payout, index))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center">
                  <div className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    No payout records found
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className={footerClasses}>
        <div className="flex items-center justify-between">
          <div className={footerTextClasses}>
            Showing {Math.min((payoutCurrentPage - 1) * payoutRowsPerPage + 1, filteredPayouts.length)} to {Math.min(payoutCurrentPage * payoutRowsPerPage, filteredPayouts.length)} of <span className="font-bold">{filteredPayouts.length}</span> payout records
            {beginningBalances.length > 0 && (
              <span className={`ml-2 ${
                isDark ? 'text-green-400' : 'text-green-600'
              }`}>
                • {beginningBalances.length} beginning balance(s)
              </span>
            )}
            {/* Total SAP Amount */}
            {filteredPayouts.reduce((sum, p) => sum + (p.SapReleasedAmount || 0), 0) > 0 && (
              <span className={`ml-2 ${
                isDark ? 'text-purple-400' : 'text-purple-600'
              }`}>
                • Total SAP: ₱{filteredPayouts.reduce((sum, p) => sum + (p.SapReleasedAmount || 0), 0).toFixed(2)}
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
                  
                  // Update paginated data
                  const startIndex = (1 - 1) * Number(e.target.value);
                  const endIndex = startIndex + Number(e.target.value);
                  setPaginatedPayouts(filteredPayouts.slice(startIndex, endIndex));
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
                onClick={() => {
                  const newPage = Math.max(payoutCurrentPage - 1, 1);
                  setPayoutCurrentPage(newPage);
                  
                  const startIndex = (newPage - 1) * payoutRowsPerPage;
                  const endIndex = startIndex + payoutRowsPerPage;
                  setPaginatedPayouts(filteredPayouts.slice(startIndex, endIndex));
                }}
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
                      onClick={() => {
                        setPayoutCurrentPage(page);
                        
                        const startIndex = (page - 1) * payoutRowsPerPage;
                        const endIndex = startIndex + payoutRowsPerPage;
                        setPaginatedPayouts(filteredPayouts.slice(startIndex, endIndex));
                      }}
                      className={paginationButtonClasses(payoutCurrentPage === page)}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>
              
              <button 
                onClick={() => {
                  const newPage = Math.min(payoutCurrentPage + 1, totalPages);
                  setPayoutCurrentPage(newPage);
                  
                  const startIndex = (newPage - 1) * payoutRowsPerPage;
                  const endIndex = startIndex + payoutRowsPerPage;
                  setPaginatedPayouts(filteredPayouts.slice(startIndex, endIndex));
                }}
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

export default VanPayoutHistory;