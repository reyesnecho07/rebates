import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from 'axios';
import {
  FileText,
  Users,
  User,
  BanknoteArrowDown,
  UserCheck,
  X,
  Blocks,
  Calendar,
  TrendingUp,
  CreditCard,
  Edit,
  Check,
  Clock,
  RefreshCw,
  BanknoteArrowUp,
} from "lucide-react";
import DashboardHeader from '../components/Dashboard/DashboardHeader';
import { useLocation, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import vanLogo from "../assets/van.png";
import Sidebar from "../components/Sidebar";
import MetricCard from '../components/Dashboard/MetricCard';
import Header from '../components/Header';
import RebateProgramList from "../components/Dashboard/RebateProgram/RebateProgramList";
import StatusSummary from "../components/Dashboard/StatusSummary/StatusSummary";
import Loading from "../components/common/Loading";
import RebateDetailsModal from '../components/Dashboard/RebateProgram/RebateDetailsModal';
import VanQuotaPerformance from '../components/Dashboard/StatusSummary/VanQuotaPerformance';
import VanTransactionRecords from '../components/Dashboard/StatusSummary/VanTransactionRecords';
import VanPayoutHistory from "../components/Dashboard/StatusSummary/VanPayoutHistory";
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import { ToastContainer, useToast } from "../components/common/Toast";

function Van_Dashboard() {
  const location = useLocation();
  const { theme, updateTheme } = useTheme();
  const { toasts, showToast, removeToast } = useToast();    
  // State declarations
  const dbType = "VAN";
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");
  const [activeTab, setActiveTab] = useState("customers");
  const [selectedAgent, setSelectedAgent] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [modalCustomer, setModalCustomer] = useState(null);
  const [selectedRebate, setSelectedRebate] = useState(null);
  const [rebateSearchTerm, setRebateSearchTerm] = useState("");
  const [customerModalTab, setCustomerModalTab] = useState("quota");
  const [activeFilter, setActiveFilter] = useState('all');

  const [showVanDropdown, setShowVanDropdown] = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown] = useState(false);

  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [statusSummaryPeriodFrom, setStatusSummaryPeriodFrom] = useState("");
  const [statusSummaryPeriodTo, setStatusSummaryPeriodTo] = useState("");
  const [selectedProgramStatus, setSelectedProgramStatus] = useState("Active");

  const [editingCustomers, setEditingCustomers] = useState({});
  const [editingItems, setEditingItems] = useState({});
  const [rebateDetails, setRebateDetails] = useState(null);
  const [originalRebateDetails, setOriginalRebateDetails] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRebateType, setSelectedRebateType] = useState("All");
  const [selectedProgressStatus, setSelectedProgressStatus] = useState("All");
  const [selectedRebateStatus, setSelectedRebateStatus] = useState("All");
  const [minRebateAmount, setMinRebateAmount] = useState("");
  const [maxRebateAmount, setMaxRebateAmount] = useState("");
  const [showRebateFilters, setShowRebateFilters] = useState(false);
  const [selectedRebateTypeFilter, setSelectedRebateTypeFilter] = useState("All");
  const [selectedRebateStatusFilter, setSelectedRebateStatusFilter] = useState("All");
  const [rebateDateFrom, setRebateDateFrom] = useState("");
  const [rebateDateTo, setRebateDateTo] = useState("");
  const [transactionCurrentPage, setTransactionCurrentPage] = useState(1);
  const [transactionRowsPerPage, setTransactionRowsPerPage] = useState(10);
  const [payoutCurrentPage, setPayoutCurrentPage] = useState(1);
  const [payoutRowsPerPage, setPayoutRowsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState('');
  const [detailedTransactions, setDetailedTransactions] = useState([]);
  const [detailedPayouts, setDetailedPayouts] = useState([]);
  const [isUsingAutoDates, setIsUsingAutoDates] = useState(true);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState({});
  const [currentCustomerData, setCurrentCustomerData] = useState(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentCustomerPage, setCurrentCustomerPage] = useState(1);
  const [itemsPerCustomerPage, setItemsPerCustomerPage] = useState(10);
  const [editingPayoutId, setEditingPayoutId] = useState(null);
  const [editedAmountReleased, setEditedAmountReleased] = useState('');
  const [useAutoDates, setUseAutoDates] = useState(false);

  // Cache state
  const [customerProgressCache, setCustomerProgressCache] = useState({});
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const CACHE_DURATION = 5 * 60 * 1000;

  // Guards to prevent infinite reload loops on incremental/quota data
  const incrementalDataLoadedRef = useRef({});
  const quotaAutoLoadedRef = useRef({});

  const componentMetadata = {
      name: 'Van_Dashboard',
      version: '2.0.0',
      description: 'Centralized dashboard providing an overall view and summary of rebate programs, balances, and performance.',
      routePath: '/Van_Dashboard'
    };
  
  useComponentRegistration(componentMetadata);


  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalRebatePaid: "₱0",
    totalUnpaidRebate: "₱0",
    activeCustomers: "0",
    newCustomersThisMonth: "+0",
    totalRebatePaidValue: 0,
    totalUnpaidRebateValue: 0,
    paidRebateChange: 0,
    unpaidRebateChange: 0,
    activeCustomersChange: 0,
    previousTotalPaid: 0,
    previousTotalUnpaid: 0,
    previousActiveCustomers: 0
  });

  const [rebates, setRebates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);

  const API_BASE = 'http://192.168.100.193:3009/api';
  const DB_NAME = 'USER';

  // Helper function to format decimal numbers with 2 decimal places
  const formatDecimal = (num) => {
    const number = parseFloat(num) || 0;
    return number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const getFilteredTransactionsHelper = () => {
    if (detailedTransactions.length > 0) {
      return detailedTransactions;
    }
    
    if (!modalCustomer?.details?.transactions) return [];
    
    let filtered = modalCustomer.details.transactions.map(trans => ({
      Date: trans.Date || 'N/A',
      Item: trans.Item || 'N/A',
      ItemCode: trans.ItemCode || '',
      ActualSales: trans.ActualSales || 0,
      QtyForReb: trans.QtyForReb || 0,
      QtyBal: trans.QtyBal || 0,
      Progress: trans.Progress || 0,
      EligibilityStatus: trans.EligibilityStatus || 'Not Eligible',
      MonthName: trans.MonthName || '',
      MonthQuota: trans.MonthQuota || 0,
      MonthQtyBal: trans.MonthQtyBal || 0,
      RebateAmount: trans.RebateAmount || 0,
      RebateType: trans.RebateType || 'Fixed'
    }));
    
    if (periodFrom && periodTo) {
      filtered = filtered.filter(trans => {
        const transDate = new Date(trans.Date);
        return transDate >= new Date(periodFrom) && transDate <= new Date(periodTo);
      });
    }
    
    if (filterStatus) {
      filtered = filtered.filter(trans => trans.EligibilityStatus === filterStatus);
    }
    
    return filtered;
  };

  const getFilteredPayoutsHelper = () => {
    if (detailedPayouts.length > 0) {
      return detailedPayouts;
    }
    
    if (!modalCustomer?.details?.payouts) return [];
    
    let filtered = modalCustomer.details.payouts;
    
    if (periodFrom && periodTo) {
      filtered = filtered.filter(payout => {
        const payoutDate = new Date(payout.Date);
        return payoutDate >= new Date(periodFrom) && payoutDate <= new Date(periodTo);
      });
    }
    
    return filtered;
  };

  // Calculate filtered data
  const filteredTransactions = getFilteredTransactionsHelper();
  const filteredPayouts = getFilteredPayoutsHelper();

  // Calculate paginated data
  const paginatedTransactions = filteredTransactions.slice(
    (transactionCurrentPage - 1) * transactionRowsPerPage,
    transactionCurrentPage * transactionRowsPerPage
  );

  const paginatedPayouts = filteredPayouts.slice(
    (payoutCurrentPage - 1) * payoutRowsPerPage,
    payoutCurrentPage * payoutRowsPerPage
  );

  // Format currency with peso sign
  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return `₱${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  // Helper function to format date range
  const formatDateRange = (dateFrom, dateTo) => {
    if (!dateFrom || !dateTo) return 'Not specified';
    
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const month = date.toLocaleString('default', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    };
    
    return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
  };

// Helper function to calculate progress from total achieved
const calculateCustomerProgress = async (customer) => {
  try {
    // First try to get total achieved from the dashboard endpoint
    const totalAchievedResponse = await fetch(
      `http://192.168.100.193:3009/api/van/dashboard/customer/${customer.code}/total-achieved?` +
      `db=VAN&rebateCode=${customer.rebateCode}&rebateType=${customer.rebateType}`
    );
    
    if (totalAchievedResponse.ok) {
      const result = await totalAchievedResponse.json();
      if (result.success) {
        const totalAchieved = result.data.totalAchieved || 0;
        const totalQuota = result.data.totalQuota || customer.totalQuota || 100;
        
        // Calculate percentage
        const progressPercentage = totalQuota > 0 ? 
          Math.min((totalAchieved / totalQuota) * 100, 100) : 0;
        
        return {
          ...customer,
          progress: Math.round(progressPercentage),
          quotaStatus: calculateQuotaStatus(customer.rebateType, totalAchieved, totalQuota, customer),
          totalAchieved: totalAchieved,
          totalQuota: totalQuota
        };
      }
    }
  } catch (error) {
    console.error('Error calculating progress:', error);
  }
  
  // Fallback to customer data
  const totalAchieved = customer.totalAchieved || 0;
  const totalQuota = customer.totalQuota || 100;
  const progressPercentage = totalQuota > 0 ? 
    Math.min((totalAchieved / totalQuota) * 100, 100) : 0;
  
  return {
    ...customer,
    progress: Math.round(progressPercentage),
    quotaStatus: calculateQuotaStatus(customer.rebateType, totalAchieved, totalQuota, customer),
    totalAchieved: totalAchieved,
    totalQuota: totalQuota
  };
};

// Helper function to determine status based on total achieved
const calculateQuotaStatus = (rebateType, totalAchieved, totalQuota, customer) => {
  if (rebateType === 'Fixed') {
    // Calculate total quota from rebate per bag
    let totalQuota = 0;
    if (customer.itemDetails && customer.itemDetails.length > 0) {
      const firstItem = customer.itemDetails[0];
      // Use rebate per bag as quota indicator
      totalQuota = firstItem.rebatePerBag * 100; // Example: scale it up
    }
    
    if (totalAchieved >= totalQuota) {
      return "Met Quota";
    } else if (totalAchieved >= (totalQuota * 0.7)) {
      return "On Track";
    } else if (totalAchieved > 0) {
      return "Starting";
    }
    return "Starting";
    
  } else if (rebateType === 'Percentage') {
    // Similar logic for percentage
    let totalQuota = 0;
    if (customer.itemDetails && customer.itemDetails.length > 0) {
      const firstItem = customer.itemDetails[0];
      // Use percentage per bag as quota indicator
      totalQuota = firstItem.percentagePerBag * 100;
    }
    
    if (totalAchieved >= totalQuota) {
      return "Met Quota";
    } else if (totalAchieved >= (totalQuota * 0.7)) {
      return "On Track";
    } else if (totalAchieved > 0) {
      return "Starting";
    }
    return "Starting";
      
  } else if (rebateType === 'Incremental') {
    if (customer.ranges && customer.ranges.length > 0) {
      for (const range of customer.ranges) {
        if (totalAchieved >= range.minQty && 
            (totalAchieved <= range.maxQty || !range.maxQty || range.maxQty === 0)) {
          return "In Range";
        }
      }
    }
    
    if (totalAchieved > 0) {
      return "Progressing";
    }
    return "Starting";
  }
  
  return "Starting";
};


  const applyBalanceCarryOver = (payouts) => {
    const sortedPayouts = [...payouts].sort((a, b) => {
      if (a.isQuarterRebate || b.isQuarterRebate) return 0;
      const dateA = new Date(a.date || a.Date || '');
      const dateB = new Date(b.date || b.Date || '');
      return dateA - dateB;
    });
    
    let carryOverBalance = 0;
    
    return sortedPayouts.map((payout) => {
      const isQuarterRebate = payout.Period?.includes('Quarter') || 
                             payout.Period?.includes('QTR') || 
                             payout.isQtrRebate;
      
      if (isQuarterRebate) {
        const adjustedAmount = payout.Amount || payout.BaseAmount || 0;
        const amountReleased = payout.AmountReleased || 0;
        const balance = Math.max(0, adjustedAmount - amountReleased);
        
        return {
          ...payout,
          AdjustedAmount: adjustedAmount,
          Balance: balance,
          Status: balance === 0 ? 'Paid' : (amountReleased > 0 ? 'Partially Paid' : 'Pending'),
          CarryOverBalance: 0,
        };
      }
      
      const adjustedAmount = (payout.Amount || payout.BaseAmount || 0) + carryOverBalance;
      const amountReleased = payout.AmountReleased || 0;
      let newBalance = Math.max(0, adjustedAmount - amountReleased);
      
      let newStatus = payout.Status;
      
      if (adjustedAmount === 0) {
        newStatus = 'No Payout';
      } else if (amountReleased === 0) {
        newStatus = 'Pending';
      } else if (amountReleased >= adjustedAmount) {
        newStatus = 'Paid';
        newBalance = 0;
      } else if (amountReleased > 0) {
        newStatus = 'Partially Paid';
      }
      
      carryOverBalance = newBalance;
      
      return {
        ...payout,
        AdjustedAmount: adjustedAmount,
        Balance: newBalance,
        Status: newStatus,
        CarryOverBalance: carryOverBalance,
      };
    });
  };

  useEffect(() => {
    return () => {
      setDetailedTransactions([]);
      setDetailedPayouts([]);
      setModalCustomer(null);
      setCurrentCustomerData(null);
    };
  }, []);

  const calculateFrontendCarryOver = (payouts) => {
    if (!Array.isArray(payouts) || payouts.length === 0) {
      return [];
    }
    
    const sortedPayouts = [...payouts].sort((a, b) => {
      const dateA = new Date(a.Date || a.date || '');
      const dateB = new Date(b.Date || b.date || '');
      return dateA - dateB;
    });
    
    let previousBalance = 0;
    const result = [];
    
    sortedPayouts.forEach((payout, index) => {
      const isQuarterRebate = payout.Period?.includes('Quarter') || 
                             payout.Period?.includes('QTR') || 
                             payout.isQtrRebate;
      const baseAmount = parseFloat(payout.BaseAmount) || 0;
      const totalAmount = parseFloat(payout.TotalAmount) || parseFloat(payout.Amount) || 0;
      const amountReleased = parseFloat(payout.AmountReleased) || 0;
      
      let totalAmountForMonth = baseAmount;
      let calculatedBalance = 0;
      
      if (isQuarterRebate) {
        totalAmountForMonth = baseAmount;
        calculatedBalance = Math.max(0, baseAmount - amountReleased);
      } else {
        totalAmountForMonth = baseAmount + previousBalance;
        calculatedBalance = Math.max(0, totalAmountForMonth - amountReleased);
      }
      
      let status = payout.Status || 'Pending';
      if (amountReleased === 0) {
        status = totalAmountForMonth > 0 ? 'Pending' : 'No Payout';
      } else if (amountReleased >= totalAmountForMonth) {
        status = 'Paid';
        calculatedBalance = 0;
      } else if (amountReleased > 0) {
        status = 'Partially Paid';
      }
      
      const payoutData = {
        ...payout,
        BaseAmount: baseAmount,
        TotalAmount: totalAmountForMonth,
        Amount: totalAmountForMonth,
        AmountReleased: amountReleased,
        Balance: calculatedBalance,
        Status: status,
        PreviousBalance: previousBalance,
        isQuarterRebate: isQuarterRebate,
        isMonthly: !isQuarterRebate
      };
      
      result.push(payoutData);
      
      if (!isQuarterRebate) {
        previousBalance = calculatedBalance;
      }
    });
    
    return result;
  };

  // Add a simple debounce function
  const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      
      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);
    
    return debouncedValue;
  };

  // Use it for period changes
  const debouncedPeriodFrom = useDebounce(periodFrom, 500);
  const debouncedPeriodTo = useDebounce(periodTo, 500);

  // Helper function to get month name
  const getMonthNameFromDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString.includes('-') ? dateString : dateString + '-01');
      return date.toLocaleDateString('en-US', { month: 'long' });
    } catch (error) {
      return dateString;
    }
  };

  const generateLinePath = (data) => {
    if (!data || data.length === 0) return '';
    
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - (item.achieved || 0);
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      const cp1x = prev.x + (curr.x - prev.x) / 3;
      const cp1y = prev.y;
      const cp2x = prev.x + (curr.x - prev.x) * 2 / 3;
      const cp2y = curr.y;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    }
    
    return path;
  };

  useEffect(() => {
  if (!userName || userName === "Unknown User") {
    console.log('⏳ Dashboard: Waiting for user data...');
    return;
  }
  
  console.log('🚀 Dashboard: Loading data for user:', userName);
  
  // Set period filters to empty (no filtering by default)
  setPeriodFrom("");  // EMPTY - no filter
  setPeriodTo("");    // EMPTY - no filter
  setStatusSummaryPeriodFrom("");  // EMPTY - no filter
  setStatusSummaryPeriodTo("");    // EMPTY - no filter
  
  loadDashboardData();
}, [userName]);


    useEffect(() => {
    const loadThemeFromDatabase = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
        const userId = storedUser.UserID || storedUser.User_ID;
        
        if (userId) {
          const response = await axios.get(`${API_BASE}/user/preferences/${userId}/theme?db=${DB_NAME}`);
          
          if (response.data.success && response.data.value) {
            const dbTheme = response.data.value.toLowerCase();
            // Only update if different from current theme
            if (dbTheme !== theme) {
              console.log('Loading theme from database:', dbTheme);
              updateTheme(dbTheme);
            }
          }
        }
      } catch (error) {
        console.error('Error loading theme from database:', error);
        // Use localStorage theme as fallback
        const localTheme = localStorage.getItem('userTheme');
        if (localTheme && localTheme !== theme) {
          updateTheme(localTheme);
        }
      }
    };
    
    loadThemeFromDatabase();
  }, []);



  useEffect(() => {
    if (modalCustomer && currentCustomerData) {
      const isDifferentCustomer = 
        modalCustomer.code !== currentCustomerData.code || 
        modalCustomer.rebateCode !== currentCustomerData.rebateCode;
      
      if (isDifferentCustomer) {
        console.log('🔄 Detected different customer, resetting...');
        setDetailedTransactions([]);
        setDetailedPayouts([]);
        setFilterStatus("");
        setTransactionCurrentPage(1);
        setPayoutCurrentPage(1);
        setCustomerModalTab("quota");
        setCurrentCustomerData(modalCustomer);
      }
    }
  }, [modalCustomer, currentCustomerData]);

  // This useEffect handles auto-loading for Fixed/Percentage but not for Incremental
  useEffect(() => {
    if (!modalCustomer || customerModalTab !== 'quota') return;
    if (modalCustomer.details?.monthlyQuotas?.length) return;

    const key = `${modalCustomer.code}_${modalCustomer.rebateCode}`;
    if (quotaAutoLoadedRef.current[key]) return;
    quotaAutoLoadedRef.current[key] = true;

    console.log('🔄 Auto-loading monthly quotas for quota tab...');

    const loadData = async () => {
      const quotaData = await fetchMonthlyQuotaData(
        modalCustomer.code,
        modalCustomer.rebateCode,
        modalCustomer.rebateType,
        true
      );

      if (quotaData && quotaData.monthlyQuotas?.length > 0) {
        setModalCustomer(prev => {
          if (!prev || prev.code !== modalCustomer.code || prev.rebateCode !== modalCustomer.rebateCode) return prev;
          return {
            ...prev,
            details: {
              ...prev.details,
              monthlyQuotas: quotaData.monthlyQuotas,
              summary: quotaData.summary,
              rebateDetails: quotaData.rebateDetails || prev.details?.rebateDetails,
              dateRange: quotaData.dateRange || prev.details?.dateRange
            }
          };
        });
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalCustomer?.code, modalCustomer?.rebateCode, customerModalTab]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const profileElement = document.querySelector('.profile-dropdown-trigger');
      if (profileElement && !profileElement.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  useEffect(() => {
    console.log('🔐 Checking authentication...');
    
    const userStr = localStorage.getItem("currentUser");
    
    if (!userStr) {
      console.log('❌ No user data found, redirecting to login');
      window.location.href = "/login";
      return;
    }
    
    try {
      const user = JSON.parse(userStr);
      
      if (!user || (!user.User_ID && !user.Username && !user.id)) {
        console.log('❌ Invalid user data');
        window.location.href = "/login";
        return;
      }
      
      const username = user.DisplayName || user.Username || user.name || "User";
      const userCode = user.User_ID || user.id || user.employeeId || "N/A";
      
      console.log('User authenticated:', username);
      
      setUserName(username);
      setUserCode(userCode);
      
      const getInitials = (name) => {
        if (!name) return "US";
        const parts = name.trim().split(" ");
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
      };
      
      setInitials(getInitials(username));
      
    } catch (error) {
      console.error('💥 Error parsing user data:', error);
      window.location.href = "/login";
    }
  }, []);


  const generateTargetLinePath = (data) => {
    if (!data || data.length === 0) return '';
    
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - (item.quota || 0);
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      const cp1x = prev.x + (curr.x - prev.x) / 3;
      const cp1y = prev.y;
      const cp2x = prev.x + (curr.x - prev.x) * 2 / 3;
      const cp2y = curr.y;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    }
    
    return path;
  };

  const generateAreaPath = (data) => {
    const linePath = generateLinePath(data);
    if (!linePath) return '';
    
    return `${linePath} L 100 100 L 0 100 Z`;
  };

  // Filtered data
  const filteredCustomers = customers
    .filter((c) => {
      const matchesAgent = selectedAgent === "All" || c.agent === selectedAgent;
      const matchesRebateType = selectedRebateType === "All" || c.rebateType === selectedRebateType;
      const matchesProgressStatus = selectedProgressStatus === "All" || c.quotaStatus === selectedProgressStatus;
      const matchesRebateStatus = selectedRebateStatus === "All" || c.rebate === selectedRebateStatus;
      const matchesMinAmount = minRebateAmount === "" || (c.rebateAmount || 0) >= parseFloat(minRebateAmount);
      const matchesMaxAmount = maxRebateAmount === "" || (c.rebateAmount || 0) <= parseFloat(maxRebateAmount);
      const matchesDateFrom = !statusSummaryPeriodFrom || new Date(c.enrollment) >= new Date(statusSummaryPeriodFrom);
      const matchesDateTo = !statusSummaryPeriodTo || new Date(c.enrollment) <= new Date(statusSummaryPeriodTo);
      const matchesSearch = !searchTerm.trim() || 
        c.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.rebateType.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesAgent && 
            matchesRebateType && 
            matchesProgressStatus && 
            matchesRebateStatus && 
            matchesMinAmount && 
            matchesMaxAmount && 
            matchesDateFrom && 
            matchesDateTo && 
            matchesSearch;
    })
    .sort((a, b) => new Date(b.enrollment) - new Date(a.enrollment));

  const filteredRebates = (rebates || []).filter(rebate => {
    if (!rebate) return false;
    
    const matchesSearch = 
      (rebate.code?.toLowerCase() || '').includes(rebateSearchTerm.toLowerCase()) ||
      (rebate.type?.toLowerCase() || '').includes(rebateSearchTerm.toLowerCase()) ||
      (rebate.active ? 'active' : 'inactive').includes(rebateSearchTerm.toLowerCase()) ||
      (rebate.from || '').includes(rebateSearchTerm) ||
      (rebate.to || '').includes(rebateSearchTerm);
    
    const matchesActive = 
      activeFilter === 'all' ? true :
      activeFilter === 'active' ? rebate.active :
      activeFilter === 'inactive' ? !rebate.active : true;
    
    const matchesRebateType = 
      selectedRebateTypeFilter === "All" || 
      rebate.type === selectedRebateTypeFilter;
    
    const matchesRebateStatus = 
      selectedRebateStatusFilter === "All" || 
      (selectedRebateStatusFilter === "Active" && rebate.active) ||
      (selectedRebateStatusFilter === "Inactive" && !rebate.active);
    
    const matchesDateFrom = !rebateDateFrom || (rebate.from && rebate.from >= rebateDateFrom);
    const matchesDateTo = !rebateDateTo || (rebate.to && rebate.to <= rebateDateTo);

    return matchesSearch && 
          matchesActive && 
          matchesRebateType && 
          matchesRebateStatus && 
          matchesDateFrom && 
          matchesDateTo;
  });

  const getAutoDateParams = (customerData) => {
    const params = new URLSearchParams({
      db: 'VAN',
      rebateCode: customerData.rebateCode,
      rebateType: customerData.rebateType
    });
    
    params.append('useRebatePeriod', 'true');
    
    return params;
  };

  const fetchCustomerQuotas = async (customerCode, rebateCode, rebateType) => {
  try {
    const response = await fetch(
      `http://192.168.100.193:3009/api/van/dashboard/customer/${customerCode}/quotas?` +
      `db=VAN&rebateCode=${rebateCode}&rebateType=${rebateType}`
    );
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        return result.data.quotas || [];
      }
    }
  } catch (error) {
    console.error('Error fetching quotas:', error);
  }
  return [];
};


const getFilteredMonthlyQuotas = () => {
  if (!modalCustomer) return [];

  const isMonthly = modalCustomer.frequency === 'Monthly' || 
                    modalCustomer.details?.rebateDetails?.frequency === 'Monthly';
  
  console.log('📊 Generating monthly quotas from data:', {
    customer: modalCustomer.customer,
    rebateType: modalCustomer.rebateType,
    hasRanges: !!modalCustomer.details?.rebateDetails?.ranges,
    ranges: modalCustomer.details?.rebateDetails?.ranges,
    hasMonthlyQuotas: !!modalCustomer.details?.monthlyQuotas?.length,
    monthlyQuotas: modalCustomer.details?.monthlyQuotas,
    frequency: modalCustomer.frequency,
    isMonthly: isMonthly
  });

  // Define handleMonthlyFixedQuotas function BEFORE using it
const handleMonthlyFixedQuotas = () => {
  // Return simplified monthly quota data
  return modalCustomer.details?.monthlyQuotas?.map((quota, index) => ({ // Changed from 'i' to 'index'
    ...quota,
    monthName: quota.monthName || quota.month || quota.label || `Month ${index + 1}`, // Using 'index' instead of 'i'
    displayTarget: `Monthly Target: ${formatDecimal(quota.target || 0)}`,
    displayAchieved: `Monthly Achieved: ${formatDecimal(quota.achieved || 0)}`,
    rebateType: 'Fixed',
    frequency: 'Monthly',
  })) || [];
};
  
  if (isMonthly && modalCustomer.rebateType === 'Fixed') {
    // For monthly Fixed rebates, we might want to show different data
    // or handle it differently
    return handleMonthlyFixedQuotas();
  }
  
  // For incremental rebates, generate monthly quotas if not provided by API
  if (modalCustomer.rebateType === 'Incremental') {
    // Try to get ranges from multiple sources
    let ranges = [];
    
    // Source 1: From rebateDetails
    if (modalCustomer.details?.rebateDetails?.ranges?.length > 0) {
      ranges = modalCustomer.details.rebateDetails.ranges;
    }
    // Source 2: From customer data (if ranges are stored there)
    else if (modalCustomer.ranges?.length > 0) {
      ranges = modalCustomer.ranges;
    }
    // Source 3: From item details
    else if (modalCustomer.details?.itemDetails?.length > 0) {
      // Extract ranges from item details
      const itemRanges = modalCustomer.details.itemDetails
        .filter(item => item.ranges && item.ranges.length > 0)
        .flatMap(item => item.ranges);
      
      if (itemRanges.length > 0) {
        ranges = itemRanges;
      }
    }
    
    console.log('🎯 Found incremental ranges:', ranges);
    
    if (ranges.length > 0) {
      // Sort ranges by rangeNo
      const sortedRanges = [...ranges].sort((a, b) => a.minQty - b.minQty);
      
      // CRITICAL FIX: ALWAYS use Range 1 minQty for the bar graph target
      const range1 = sortedRanges.find(r => r.rangeNo === 1);
      const range1MinQty = range1?.minQty || 0;
      
      console.log('📊 Using Range 1 minQty for bar graph:', {
        range1,
        range1MinQty,
        allRanges: sortedRanges.map(r => ({ rangeNo: r.rangeNo, minQty: r.minQty }))
      });
      
      // Try to get date range from multiple sources
      let startDate, endDate;
      
      // Try from rebate details first
      if (modalCustomer.details?.rebateDetails?.dateFrom && modalCustomer.details?.rebateDetails?.dateTo) {
        startDate = new Date(modalCustomer.details.rebateDetails.dateFrom);
        endDate = new Date(modalCustomer.details.rebateDetails.dateTo);
      }
      // Try from customer data
      else if (modalCustomer.dateFrom && modalCustomer.dateTo) {
        startDate = new Date(modalCustomer.dateFrom);
        endDate = new Date(modalCustomer.dateTo);
      }
      // Fallback to current date range
      else {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
      }
      
      const months = [];
      const currentDate = new Date(startDate);
      const finalDate = new Date(endDate);
      let monthIndex = 1;
      
      while (currentDate <= finalDate && monthIndex <= 3) { // Limit to 3 months
        const monthName = currentDate.toLocaleString('default', { month: 'long' });
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        months.push({
          monthIndex: monthIndex,
          monthName: monthName,
          monthKey: monthKey,
          year: year,
          monthNumber: month,
          target: range1MinQty,  // ALWAYS use Range 1 minQty for target
          achieved: 0,
          progress: 0,
          status: 'Starting',
          quota: range1MinQty,  // ALWAYS use Range 1 minQty for quota
          currentRange: null,
          rebatePerBag: range1?.rebatePerBag || 0,
          RangeMin: range1MinQty,  // ALWAYS use Range 1 minQty for RangeMin
          RangeMax: range1?.maxQty || null,
          isEmptyMonth: true,
          rebateType: 'Incremental',
          displayTarget: `Range 1 Min: ${formatDecimal(range1MinQty)}`,
          displayAchieved: 'Achieved: 0',
          displayRange: 'Not in range',
          hasRangeData: true,
          ranges: sortedRanges,
        });
        
        currentDate.setMonth(currentDate.getMonth() + 1);
        monthIndex++;
      }
      
      // CRITICAL FIX: Calculate achieved from ALL available transaction sources
      let allTransactions = [];
      
      // Source 1: detailedTransactions (most current)
      if (detailedTransactions.length > 0) {
        allTransactions = detailedTransactions;
        console.log('📊 Using detailedTransactions for achieved:', allTransactions.length);
      }
      // Source 2: modalCustomer.details.transactions
      else if (modalCustomer.details?.transactions?.length > 0) {
        allTransactions = modalCustomer.details.transactions;
        console.log('📊 Using modalCustomer.details.transactions for achieved:', allTransactions.length);
      }
      // Source 3: Check if we need to load transactions
      else if (modalCustomer.details && (!modalCustomer.details.transactions || modalCustomer.details.transactions.length === 0)) {
        console.log('📊 No transactions found, may need to load them');
        // Trigger transaction load for incremental type
        if (customerModalTab === 'quota') {
          // This will trigger the useEffect that loads transactions
          console.log('📊 Will load transactions for incremental rebate...');
        }
      }
      
      console.log('📊 All transactions available:', {
        total: allTransactions.length,
        sample: allTransactions.slice(0, 3).map(t => ({
          date: t.Date,
          qtyForReb: t.QtyForReb,
          month: t.MonthName
        }))
      });
      
      if (allTransactions.length > 0) {
        // Group transactions by month and calculate achieved
        const transactionsByMonth = {};
        allTransactions.forEach(trans => {
          if (!trans.Date) return;
          
          try {
            const date = new Date(trans.Date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!transactionsByMonth[monthKey]) {
              transactionsByMonth[monthKey] = {
                transactions: [],
                totalQty: 0,
                monthKey: monthKey,
                monthName: date.toLocaleString('default', { month: 'long' })
              };
            }
            
            const qty = parseFloat(trans.QtyForReb) || 0;
            transactionsByMonth[monthKey].transactions.push(trans);
            transactionsByMonth[monthKey].totalQty += qty;
          } catch (error) {
            console.error('Error parsing transaction date:', trans.Date, error);
          }
        });
        
        console.log('📊 Transactions grouped by month:', transactionsByMonth);
        
        // Update each month with achieved values
        months.forEach(month => {
          const monthData = transactionsByMonth[month.monthKey];
          
          if (monthData) {
            const totalAchieved = monthData.totalQty;
            month.achieved = totalAchieved;
            month.isEmptyMonth = false;
            
            // Find current range based on achieved quantity
            let currentRange = null;
            let currentRangeMin = 0;
            let currentRangeMax = 0;
            let rebatePerBag = 0;
            
            for (const range of sortedRanges) {
              if (totalAchieved >= range.minQty && 
                  (totalAchieved <= range.maxQty || !range.maxQty || range.maxQty === 0)) {
                currentRange = range.rangeNo;
                currentRangeMin = range.minQty;
                currentRangeMax = range.maxQty;
                rebatePerBag = range.rebatePerBag || 0;
                break;
              }
            }
            
            // Calculate progress ALWAYS against Range 1 minQty
            month.progress = range1MinQty > 0 ? Math.min((totalAchieved / range1MinQty) * 100, 100) : 0;
            month.status = currentRange ? 'In Range' : totalAchieved > 0 ? 'Progressing' : 'Starting';
            month.currentRange = currentRange;
            month.rebatePerBag = rebatePerBag;
            
            // For display purposes
            month.RangeMin = currentRangeMin;
            month.RangeMax = currentRangeMax;
            
            month.displayAchieved = `Achieved: ${formatDecimal(totalAchieved)}`;
            month.displayRange = currentRange ? 
              `Range ${currentRange} (${currentRangeMin}-${currentRangeMax || '∞'})` : 
              'Not in range';
            
            console.log('📈 Month calculation completed:', {
              month: month.monthName,
              monthKey: month.monthKey,
              totalAchieved: totalAchieved,
              range1MinQty: range1MinQty,
              progress: month.progress,
              currentRange: currentRange,
              transactionsCount: monthData.transactions.length
            });
          } else {
            console.log('📊 No transactions for month:', month.monthName, month.monthKey);
          }
        });
      }
      
      return months;
    }
  }
  
  // For other rebate types, use API data as before
  if (modalCustomer.details?.monthlyQuotas && modalCustomer.details.monthlyQuotas.length > 0) {
    const monthlyQuotas = modalCustomer.details.monthlyQuotas;
    const ranges = modalCustomer.details?.rebateDetails?.ranges || [];
    
    const range1 = ranges.find(r => r.rangeNo === 1);
    const range1MinQty = range1?.minQty || 0;
    
    console.log('Using API monthly quotas with Range 1 min:', {
      range1MinQty,
      range1Details: range1
    });
    
    return monthlyQuotas.map((quota, index) => {
      const isIncremental = modalCustomer.rebateType === 'Incremental';
      const achieved = quota.achieved || 0;
      
      let currentRange = null;
      let rangeMin = 0;
      let rangeMax = 0;
      let rebatePerBag = 0;
      
      if (isIncremental && ranges.length > 0) {
        rangeMin = range1MinQty;
        
        for (const range of ranges) {
          if (achieved >= range.minQty && 
              (achieved <= range.maxQty || !range.maxQty || range.maxQty === 0)) {
            currentRange = range.rangeNo;
            rangeMax = range.maxQty;
            rebatePerBag = range.rebatePerBag;
            break;
          }
        }
      }
      
      return {
        monthIndex: index + 1,
        monthName: quota.month || quota.monthName || quota.label || `Month ${index + 1}`,
        monthKey:  quota.monthKey || (quota.month
          ? `${new Date(Date.parse(quota.month + ' 1')).getFullYear()}-${String(new Date(Date.parse(quota.month + ' 1')).getMonth() + 1).padStart(2, '0')}`
          : `${index + 1}`),
        target: quota.target || quota.quota || 0,
        achieved: achieved,
        progress: quota.progress || 0,
        status: quota.status || 'Starting',
        quota: quota.target || quota.quota || 0,
        currentRange: currentRange || quota.currentRange || null,
        rebatePerBag: rebatePerBag || quota.rebatePerBag || 0,
        RangeMin: rangeMin,
        RangeMax: rangeMax || quota.RangeMax || null,
        isEmptyMonth: quota.isEmptyMonth || (achieved === 0),
        rebateType: modalCustomer.rebateType,
        displayTarget: `Range 1 Min: ${formatDecimal(range1MinQty)}`,
        displayAchieved: `Achieved: ${formatDecimal(achieved)}`,
        displayRange: currentRange ? `Range ${currentRange} (${rangeMin}-${rangeMax || '∞'})` : 'Not in range'
      };
    });
  }
  
  // Fallback if no data
  console.log('⚠️ No monthly quota data, using fallback');
  return [{
    monthIndex: 1,
    monthName: 'No Data',
    monthKey: '1',
    target: 0,
    achieved: 0,
    progress: 0,
    status: 'No Data',
    quota: 0,
    currentRange: null,
    rebatePerBag: 0,
    RangeMin: null,
    RangeMax: null,
    isEmptyMonth: true,
    rebateType: modalCustomer.rebateType || 'Unknown'
  }];
};


  // Add this function to debug percentage data
  const debugPercentageData = () => {
    if (modalCustomer && modalCustomer.rebateType === 'Percentage') {
      console.log('🔍 DEBUG Percentage Data:', {
        customer: modalCustomer.customer,
        rebateCode: modalCustomer.rebateCode,
        rebateType: modalCustomer.rebateType,
        details: modalCustomer.details,
        rebateDetails: modalCustomer.details?.rebateDetails,
        quotas: modalCustomer.details?.rebateDetails?.quotas,
        monthlyQuotas: modalCustomer.details?.monthlyQuotas,
        percentageValue: modalCustomer.details?.rebateDetails?.percentageValue,
        percentageFromItems: modalCustomer.details?.rebateDetails?.items?.[0]?.percentagePerBag,
        hasQuotas: !!modalCustomer.details?.rebateDetails?.quotas,
        hasMonthlyQuotas: !!modalCustomer.details?.monthlyQuotas,
        transactions: detailedTransactions.length,
        filteredMonthlyQuotas: getFilteredMonthlyQuotas()
      });
    }
  };

  // Call this in useEffect when modalCustomer changes for Percentage type
  useEffect(() => {
    if (modalCustomer && modalCustomer.rebateType === 'Percentage') {
      debugPercentageData();
    }
  }, [modalCustomer, detailedTransactions]);

  const getMonthlySummary = () => {
    const summary = {};
    
    filteredTransactions.forEach(transaction => {
      const monthKey = transaction.MonthKey || transaction.MonthName;
      if (!summary[monthKey]) {
        const monthProgress = parseFloat(transaction.MonthProgress) || parseFloat(transaction.Progress) || 0;
        const progressValue = Number.isFinite(monthProgress) ? monthProgress : 0;
        
        summary[monthKey] = {
          monthName: transaction.MonthName,
          totalQtyForReb: 0,
          monthQuota: transaction.MonthQuota || 0,
          monthQtyBal: 0,
          progress: progressValue,
          status: transaction.EligibilityStatus,
          rebateAmount: 0,
          eligibleTransactions: 0,
          totalTransactions: 0,
          currentRange: transaction.CurrentRange || null,
          rebatePerBag: transaction.RebatePerBag || 0
        };
      }
      
      summary[monthKey].totalQtyForReb += transaction.QtyForReb || 0;
      summary[monthKey].monthQtyBal = transaction.MonthQtyBal || 0;
      summary[monthKey].rebateAmount += transaction.RebateAmount || 0;
      summary[monthKey].totalTransactions++;
      
      if (transaction.EligibilityStatus === 'Eligible') {
        summary[monthKey].eligibleTransactions++;
      }
      
      if (transaction.CurrentRange && (!summary[monthKey].currentRange || 
          transaction.CurrentRange > summary[monthKey].currentRange)) {
        summary[monthKey].currentRange = transaction.CurrentRange;
        summary[monthKey].rebatePerBag = transaction.RebatePerBag || 0;
      }
    });
    
    return Object.values(summary);
  };

// loadCustomerStatus FIRST
const loadCustomerStatus = useCallback(async (forceRefresh = false) => {
  try {
    setCustomersLoading(true);
    let url = `http://192.168.100.193:3009/api/van/dashboard/rebates-summary?db=VAN`;
    const params = new URLSearchParams();
    if (statusSummaryPeriodFrom) params.append('periodFrom', statusSummaryPeriodFrom);
    if (statusSummaryPeriodTo)   params.append('periodTo',   statusSummaryPeriodTo);
    if (selectedAgent !== 'All') params.append('agent',      selectedAgent);
    if (params.toString()) url += `&${params.toString()}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        const summaryList = data.data.summary || [];
        if (summaryList.length === 0) {
          setCustomers([]);
          setAgents([]);
          return;
        }
        const processedCustomers = summaryList.map((item) => ({
          customer:      item.customer    || 'Unknown Customer',
          agent:         item.agent       || 'Unknown Agent',
          rebateType:    item.rebateType  || 'Unknown',
          code:          item.code        || `CUST-${Math.random().toString(36).substr(2, 5)}`,
          rebateCode:    item.rebateCode  || 'UNKNOWN-CODE',
          dateFrom:      item.dateFrom    || '',
          dateTo:        item.dateTo      || '',
          frequency:     item.frequency   || 'Quarterly',
          isActive:      item.isActive,
          progress:      item.totalAchieved || 0,
          totalAchieved: item.totalAchieved || 0,
          totalQuota:    item.totalQuota    || 0,
          quotaStatus:   item.quotaStatus   || 'Starting',
          rebate:        item.rebateStatus  || 'Not Eligible',
          rebateAmount:  parseFloat(item.rebateAmount)  || 0,
          paidAmount:    parseFloat(item.paidAmount)    || 0,
          rebateBalance: parseFloat(item.rebateBalance) || 0,
          enrollment:    item.enrollment || new Date().toISOString().split('T')[0],
          color:         item.color      || `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          quotas:        item.quotas     || {},
          ranges:        item.ranges     || [],
          itemDetails:   item.itemDetails || [],
          currentRange:  item.currentRange || null,
          createdDate:   item.createdDate  || new Date().toISOString(),
        }));
        const sortedCustomers = processedCustomers.sort((a, b) => {
          const dateA = new Date(a.createdDate || a.enrollment);
          const dateB = new Date(b.createdDate || b.enrollment);
          return dateB - dateA;
        });
        const uniqueAgents = [
          ...new Set(sortedCustomers.map(c => c.agent))
        ].filter(agent => agent && agent !== 'Unknown Agent');
        setCustomers(sortedCustomers);
        setAgents(uniqueAgents);
      } else {
        setCustomers([]);
        setAgents([]);
      }
    } else {
      setCustomers([]);
      setAgents([]);
    }
  } catch (error) {
    console.error('Error loading customer status:', error);
    setCustomers([]);
    setAgents([]);
  } finally {
    setCustomersLoading(false);
  }
}, [statusSummaryPeriodFrom, statusSummaryPeriodTo, selectedAgent]);

  // ADD this instead:
  useEffect(() => {
    loadCustomerStatus();
  }, [loadCustomerStatus]);

  // loadDashboardData SECOND (can now safely call loadCustomerStatus)
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsResponse, rebatesResponse] = await Promise.all([
        fetch(`http://192.168.100.193:3009/api/van/dashboard/metrics?db=VAN`),
        fetch(`http://192.168.100.193:3009/api/van/dashboard/rebates?db=VAN`)
      ]);
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        if (metricsData.success) {
          const currentData = metricsData.data;
          setDashboardMetrics({
            totalRebatePaid: `₱${currentData.totalRebatePaid.toLocaleString()}`,
            totalUnpaidRebate: `₱${currentData.totalUnpaidRebate.toLocaleString()}`,
            activeCustomers: currentData.activeCustomers.toString(),
            newCustomersThisMonth: `+${currentData.newCustomersThisMonth}`,
            totalRebatePaidValue: currentData.totalRebatePaid,
            totalUnpaidRebateValue: currentData.totalUnpaidRebate,
            paidRebateChange: 0,
            unpaidRebateChange: 0,
            activeCustomersChange: 0,
            previousTotalPaid: 0,
            previousTotalUnpaid: 0,
            previousActiveCustomers: 0
          });
        }
      }
      if (rebatesResponse.ok) {
        const rebatesData = await rebatesResponse.json();
        if (rebatesData.success) {
          setRebates(Array.isArray(rebatesData.data) ? rebatesData.data : []);
        } else {
          setRebates([]);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setRebates([]);
    } finally {
      setLoading(false); // page visible immediately
    }
    loadCustomerStatus(); // now safe — defined above
  };

  const loadCustomerDetails = async (customerCode, rebateCode, rebateType, forceAutoLoad = true) => {
    try {
      console.log('📥 Loading details for:', customerCode, rebateCode, rebateType);
      
      let url = `http://192.168.100.193:3009/api/van/dashboard/customer/${customerCode}/details?db=VAN`;
      
      const params = new URLSearchParams();
      params.append('rebateCode', rebateCode);
      params.append('rebateType', rebateType);
      
      // DO NOT pass frequency to API - let backend determine it
      // Remove this line: if (modalCustomer?.frequency) { params.append('frequency', modalCustomer.frequency); }
      
      params.append('useRebatePeriod', 'true');
      
      url += `&${params.toString()}`;
      console.log('🌐 Calling customer details URL:', url);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('Customer details loaded with frequency:', data.data.frequency);
          
          // Use frequency from backend response
          const frequency = data.data.frequency || 'Quarterly';
          
          // Store frequency in customer data
          data.data.frequency = frequency;
          data.data.isMonthly = frequency === 'Monthly';
          
          return data.data;
        }
      }
    } catch (error) {
      console.error('❌ Network error loading customer details:', error);
    }
    return null;
  };

    const loadRebateDetails = async (rebateCode, customerCode = null) => {
    try {
      console.log('🔍 Loading rebate details for:', rebateCode, customerCode ? `customer: ${customerCode}` : '');
      
      let url = `http://192.168.100.193:3009/api/van/dashboard/rebate/${rebateCode}/details?db=VAN`;
      
      if (customerCode) {
        url += `&customerCode=${customerCode}`;
      }
      
      console.log('🌐 Calling API:', url);
      
      const response = await fetch(url);
      
      console.log('📊 Response status:', response.status);
      console.log('📊 Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📦 API response data:', {
        success: data.success,
        dataKeys: data.data ? Object.keys(data.data) : 'No data',
        customersCount: data.data?.customers?.length || 0,
        ranges: data.data?.ranges,
        rangesLength: data.data?.ranges?.length || 0
      });
      
      if (data.success) {
        console.log('Loaded rebate details:', {
          rebateType: data.data.rebateType,
          ranges: data.data.ranges,
          customers: data.data.customers?.length || 0,
          dateFrom: data.data.dateFrom,
          dateTo: data.data.dateTo,
          name: data.data.Name || data.data.name || ''
        });

        return {
          ...data.data,
          name: data.data.Name || data.data.name || '',
        };
      }else {
        console.error('❌ API returned error:', data.message);
        return null;
      }
    } catch (error) {
      console.error('❌ Network error loading rebate details:', error);
      console.error('❌ Error stack:', error.stack);
      return null;
    }
  };

  const fetchMonthlyQuotaData = async (customerCode, rebateCode, rebateType, useAutoDates = true) => {
    try {
      console.log('📊 Fetching monthly quota data for:', { customerCode, rebateCode, rebateType });
      
      let url = `http://192.168.100.193:3009/api/van/dashboard/customer/${customerCode}/quota-summary?db=VAN&rebateCode=${rebateCode}&rebateType=${rebateType}`;
      
      if (useAutoDates) {
        url += '&useRebatePeriod=true';
      } else {
        if (periodFrom && periodTo) {
          url += `&periodFrom=${periodFrom}&periodTo=${periodTo}`;
        }
      }
      
      console.log('🌐 Calling quota API:', url);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('Monthly quota data loaded:', {
            success: data.success,
            monthlyQuotas: data.data?.monthlyQuotas?.length || 0,
            dataStructure: Object.keys(data.data || {}),
            hasRanges: !!data.data?.ranges,
            rangesCount: data.data?.ranges?.length || 0,
            sampleQuota: data.data?.monthlyQuotas?.[0]
          });
          
          return data.data;
        } else {
          console.error('❌ API returned error:', data.message);
        }
      } else {
        console.error('❌ Failed to fetch quota data:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching monthly quota:', error);
    }
    return null;
  };

  const loadDetailedTransactionsData = async (autoLoad = true) => {
    if (!modalCustomer?.code || !modalCustomer?.rebateCode || !modalCustomer?.rebateType) return;
    
    const loadingKey = `${modalCustomer.code}_transactions`;
    if (loadingTransactions[loadingKey]) return;
    
    try {
      setLoadingTransactions(prev => ({
        ...prev,
        [loadingKey]: true
      }));
      
      console.log('📥 Loading transactions for:', modalCustomer.code);
      
      let url = `http://192.168.100.193:3009/api/van/dashboard/customer/${modalCustomer.code}/transactions`;
      
      const params = new URLSearchParams({
        db: 'VAN',
        rebateCode: modalCustomer.rebateCode,
        rebateType: modalCustomer.rebateType
      });
      
      if (isUsingAutoDates || autoLoad) {
        params.append('useRebatePeriod', 'true');
      } else {
        if (periodFrom && periodTo) {
          params.append('periodFrom', periodFrom);
          params.append('periodTo', periodTo);
        } else {
          params.append('useRebatePeriod', 'true');
        }
      }
      
      const fullUrl = `${url}?${params.toString()}`;
      
      const response = await fetch(fullUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('Transactions loaded:', data.data.transactions?.length || 0);
          

        let processedTransactions = [];
        if (modalCustomer.rebateType === 'Fixed') {
          processedTransactions = processFixedTransactionsMonthly(
            data.data.transactions || [],
            data.data.rebateDetails?.unitPerQty || 1,
            data.data.rebateDetails
          );
        } else if (modalCustomer.rebateType === 'Incremental') {
          processedTransactions = processIncrementalTransactionsMonthly(
            data.data.transactions || [],
            data.data.rebateDetails
          );
        } else if (modalCustomer.rebateType === 'Percentage') {
          processedTransactions = processPercentageTransactionsMonthly(
            data.data.transactions || [],
            data.data.rebateDetails?.unitPerQty || 1,
            data.data.rebateDetails
          );
          processedTransactions = processedTransactions.map(trans => ({
            ...trans,
            RebateType: 'Percentage',
            Percentage: trans.Percentage || 0,
            RebateAmount: trans.RebateAmount || 0
          }));
        }

          
          const sortedTransactions = [...processedTransactions].sort((a, b) => {
            const dateA = new Date(a.Date);
            const dateB = new Date(b.Date);
            return dateA - dateB;
          });
          
          setDetailedTransactions(sortedTransactions);
          
          await fetchMonthlyQuotaData(
            modalCustomer.code, 
            modalCustomer.rebateCode, 
            modalCustomer.rebateType, 
            true
          );
          
          if (data.data.dateRange) {
            setPeriodFrom(data.data.dateRange.periodFrom);
            setPeriodTo(data.data.dateRange.periodTo);
          }
          
          setModalCustomer(prev => {
            if (!prev) return null;
            return {
              ...prev,
              details: {
                ...prev.details,
                transactions: sortedTransactions,
                rebateDetails: data.data.rebateDetails,
                summary: data.data.summary,
                dateRange: data.data.dateRange
              }
            };
          });
        }
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      setDetailedTransactions([]);
    } finally {
      setLoadingTransactions(prev => {
        const newState = { ...prev };
        delete newState[`${modalCustomer?.code}_transactions`];
        return newState;
      });
    }
  };

  const processFixedTransactionsMonthly = (transactions, unitPerQty = 1, rebateDetails) => {
    if (!transactions || transactions.length === 0) {
      const startDate = rebateDetails?.dateFrom;
      const endDate = rebateDetails?.dateTo;
      const quotas = rebateDetails?.quotas || [];
      
      if (startDate && endDate) {
        const allMonths = [];
        const currentDate = new Date(startDate);
        const finalDate = new Date(endDate);
        let monthIndex = 0;
        
        while (currentDate <= finalDate && monthIndex < Math.max(quotas.length, 3)) {
          const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
          const quota = quotas[monthIndex] || 0;
          
          allMonths.push({
            monthIndex: monthIndex + 1,
            monthName: monthName,
            monthKey: monthKey,
            target: quota,
            achieved: 0,
            progress: 0,
            status: 'No Transactions',
            quota: quota,
            currentRange: null,
            rebatePerBag: 0,
            RangeMin: null,
            RangeMax: null,
            isEmptyMonth: true,
            has25kgItems: false,
            unitPerQty: unitPerQty,
            rebateType: 'Fixed',
            rebateAmount: 0,
            percentageValue: rebateDetails?.percentageValue || 0
          });
          
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthIndex++;
        }
        
        return allMonths;
      }
      
      return [];
    }
      
      const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(a.Date) - new Date(b.Date)
      );
      
      const transactionsByMonth = {};
      sortedTransactions.forEach((transaction) => {
        const date = new Date(transaction.Date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        
        if (!transactionsByMonth[monthKey]) {
          transactionsByMonth[monthKey] = {
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            monthName: monthName,
            monthKey: monthKey,
            transactions: [],
            totalQtyForReb: 0,
            totalRebateAmount: 0,
            quota: 0,
            progress: 0,
            status: 'Not Eligible',
            startDate: date,
            endDate: date,
            monthRunningTotal: 0
          };
        }
        
        if (date < transactionsByMonth[monthKey].startDate) {
          transactionsByMonth[monthKey].startDate = date;
        }
        if (date > transactionsByMonth[monthKey].endDate) {
          transactionsByMonth[monthKey].endDate = date;
        }
        
        transactionsByMonth[monthKey].transactions.push(transaction);
        
        const is25kgItem = transaction.Is25kgItem || 
          (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
        const actualSales = parseFloat(transaction.ActualSales) || 0;
        const qtyForRebFromAPI = parseFloat(transaction.QtyForReb) || 0;
        const rebateAmount = parseFloat(transaction.RebateAmount) || 0;
        
        const qtyForReb = is25kgItem ? (actualSales / unitPerQty) : qtyForRebFromAPI;
        
        transactionsByMonth[monthKey].totalQtyForReb += qtyForReb;
        transactionsByMonth[monthKey].totalRebateAmount += rebateAmount;
      });
      
      const startDate = rebateDetails?.dateFrom ? new Date(rebateDetails.dateFrom) : new Date(sortedTransactions[0].Date);
      const endDate = rebateDetails?.dateTo ? new Date(rebateDetails.dateTo) : new Date();
      
      const allMonthsInPeriod = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
        
        if (!allMonthsInPeriod.includes(monthKey)) {
          allMonthsInPeriod.push({
            monthKey,
            monthName,
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear()
          });
        }
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      const monthsToShow = Math.min(allMonthsInPeriod.length, 3);
      const displayedMonths = allMonthsInPeriod.slice(0, monthsToShow);
      
      const monthlyQuotas = rebateDetails?.quotas || [];
      
      const allMonthsData = {};
      displayedMonths.forEach((monthData, index) => {
        const monthKey = monthData.monthKey;
        const existingData = transactionsByMonth[monthKey];
        const quotaIndex = Math.min(index, monthlyQuotas.length - 1);
        const quota = monthlyQuotas[quotaIndex] || 0;
        
        if (existingData) {
          existingData.quota = quota;
          
          if (existingData.quota > 0) {
            existingData.progress = Math.min((existingData.totalQtyForReb / existingData.quota) * 100, 100);
          } else {
            existingData.progress = 0;
          }
          existingData.status = existingData.progress >= 100 ? 'Eligible' : 'Not Eligible';
          allMonthsData[monthKey] = existingData;
        } else {
          allMonthsData[monthKey] = {
            month: monthData.month,
            year: monthData.year,
            monthName: monthData.monthName,
            monthKey: monthKey,
            transactions: [],
            totalQtyForReb: 0,
            totalRebateAmount: 0,
            quota: quota,
            progress: 0,
            status: 'No Transactions',
            startDate: new Date(monthKey + '-01'),
            endDate: new Date(monthKey + '-01'),
            monthRunningTotal: 0,
            isEmptyMonth: true
          };
        }
      });
      
      let processedTransactions = [];
      
      displayedMonths.forEach((monthData) => {
        const monthKey = monthData.monthKey;
        const monthInfo = allMonthsData[monthKey];
        
        if (monthInfo.transactions.length > 0) {
          let monthRunningTotal = 0;
          
          const sortedMonthTransactions = [...monthInfo.transactions].sort((a, b) => 
            new Date(a.Date) - new Date(b.Date)
          );
          
          sortedMonthTransactions.forEach((transaction, idx) => {
            const is25kgItem = transaction.Is25kgItem || 
              (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
            const actualSales = parseFloat(transaction.ActualSales) || 0;
            const qtyForRebFromAPI = parseFloat(transaction.QtyForReb) || 0;
            const rebateAmount = parseFloat(transaction.RebateAmount) || 0;
            const percentage = transaction.Percentage || 0;
            
            const qtyForReb = is25kgItem ? (actualSales / unitPerQty) : qtyForRebFromAPI;
            
            if (idx === 0) {
              monthRunningTotal = 0;
            }
            
            monthRunningTotal += qtyForReb;
            
            const progressPercentage = monthInfo.quota > 0 ? 
              Math.min((monthRunningTotal / monthInfo.quota) * 100, 100) : 0;
            
            const formattedProgress = parseFloat(progressPercentage.toFixed(2));
            
            let calculationNote = null;
            if (is25kgItem) {
              calculationNote = `${actualSales} ÷ ${unitPerQty} = ${qtyForReb.toFixed(2)}`;
            }
            
            processedTransactions.push({
              ...transaction,
              Date: transaction.Date,
              Item: transaction.Item,
              ItemCode: transaction.ItemCode || '',
              ActualSales: actualSales,
              QtyForReb: parseFloat(qtyForReb.toFixed(2)),
              QtyBal: parseFloat(monthRunningTotal.toFixed(2)),
              MonthQtyBal: parseFloat(monthRunningTotal.toFixed(2)),
              MonthQuota: monthInfo.quota,
              Progress: formattedProgress,
              MonthProgress: parseFloat(monthInfo.progress.toFixed(2)),
              EligibilityStatus: monthInfo.status,
              MonthName: monthInfo.monthName,
              MonthKey: monthInfo.monthKey,
              CalculationNote: calculationNote,
              IsNewMonth: idx === 0,
              RebateAmount: rebateAmount,
              RebateType: 'Percentage',
              Is25kgItem: is25kgItem,
              UnitPerQty: unitPerQty,
              Percentage: percentage,
              IsEmptyMonth: false
            });
          });
        }
      });
      
      return processedTransactions;
  };

  const processIncrementalTransactionsMonthly = (transactions, rebateDetails) => {
    if (!transactions || transactions.length === 0) {
      return [];
    }
    
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.Date) - new Date(b.Date)
    );
    
    const ranges = rebateDetails?.ranges || [];
    const sortedRanges = [...ranges].sort((a, b) => a.minQty - b.minQty);
    
    const transactionsByMonth = {};
    sortedTransactions.forEach((transaction) => {
      const date = new Date(transaction.Date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      if (!transactionsByMonth[monthKey]) {
        transactionsByMonth[monthKey] = {
          month: date.getMonth() + 1,
          year: date.getFullYear(),
          monthName: monthName,
          monthKey: monthKey,
          transactions: [],
          totalQtyForReb: 0,
          ranges: sortedRanges,
          currentRange: null,
          rebatePerBag: 0,
          startDate: date,
          endDate: date,
          monthCumulativeQty: 0
        };
      }
      
      transactionsByMonth[monthKey].transactions.push(transaction);
      transactionsByMonth[monthKey].endDate = date;
      
      const is25kgItem = transaction.Is25kgItem || 
        (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
      const actualSales = parseFloat(transaction.ActualSales) || 0;
      
      const qtyForReb = is25kgItem ? (actualSales / 2) : actualSales;
      
      transactionsByMonth[monthKey].totalQtyForReb += qtyForReb;
    });
    
    const startDate = rebateDetails?.dateFrom ? new Date(rebateDetails.dateFrom) : new Date(sortedTransactions[0].Date);
    const endDate = rebateDetails?.dateTo ? new Date(rebateDetails.dateTo) : new Date();
    
    const allMonthsInPeriod = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      
      if (!allMonthsInPeriod.some(m => m.monthKey === monthKey)) {
        allMonthsInPeriod.push({
          monthKey,
          monthName,
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          date: new Date(currentDate)
        });
      }
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    const allMonthsData = {};
    allMonthsInPeriod.forEach((monthData) => {
      const monthKey = monthData.monthKey;
      const existingData = transactionsByMonth[monthKey];
      
      if (existingData) {
        const monthTotal = existingData.totalQtyForReb;
        let currentRange = null;
        let rebatePerBag = 0;
        
        for (const range of sortedRanges) {
          if (monthTotal >= range.minQty && 
              (monthTotal <= range.maxQty || !range.maxQty || range.maxQty === 0)) {
            currentRange = range;
            rebatePerBag = range.rebatePerBag || 0;
            break;
          }
        }
        
        existingData.currentRange = currentRange;
        existingData.rebatePerBag = rebatePerBag;
        allMonthsData[monthKey] = existingData;
      }
    });
    
    let processedTransactions = [];
    let cumulativeQty = 0;
    let currentRange = null;
    let rebatePerBag = 0;
    
    allMonthsInPeriod.forEach((monthData) => {
      const monthKey = monthData.monthKey;
      const monthInfo = allMonthsData[monthKey];
      
      if (monthInfo && monthInfo.transactions.length > 0) {
        const sortedMonthTransactions = [...monthInfo.transactions].sort((a, b) => 
          new Date(a.Date) - new Date(b.Date)
        );
        
        sortedMonthTransactions.forEach((transaction, idx) => {
          const isFirstInMonth = idx === 0;
          
          const is25kgItem = transaction.Is25kgItem || 
            (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
          const itemUnitPerQty = is25kgItem ? 2 : (parseFloat(transaction.UnitPerQty) || 1);
          const actualSales = parseFloat(transaction.ActualSales) || 0;
          
          const rawQtyForReb = parseFloat(transaction.QtyForReb) || 0;
          const qtyForReb = is25kgItem ? (actualSales / 2) : rawQtyForReb;
          
          const monthCumulativeQty = (monthInfo.transactions
            .slice(0, idx + 1)
            .reduce((sum, t) => {
              const is25kg = t.Is25kgItem || (t.Item && t.Item.toLowerCase().includes('25kg'));
              const sales = parseFloat(t.ActualSales) || 0;
              const qty = parseFloat(t.QtyForReb) || 0;
              return sum + (is25kg ? (sales / 2) : qty);
            }, 0));
          
          let newRange = null;
          let newRebatePerBag = 0;
          
          for (const range of sortedRanges) {
            if (monthCumulativeQty >= range.minQty && 
                (monthCumulativeQty <= range.maxQty || !range.maxQty || range.maxQty === 0)) {
              newRange = range;
              newRebatePerBag = range.rebatePerBag || 0;
              break;
            }
          }
          
          if (!currentRange || (newRange && newRange.rangeNo !== currentRange?.rangeNo)) {
            currentRange = newRange;
            rebatePerBag = newRebatePerBag;
          }
          
          let progress = 0;
          if (currentRange) {
            const rangeMin = currentRange.minQty || 0;
            const rangeMax = currentRange.maxQty || monthCumulativeQty * 2;
            const rangeSpan = Math.max(rangeMax - rangeMin, 1);
            
            progress = Math.min(((monthCumulativeQty - rangeMin) / rangeSpan) * 100, 100);
          } else if (sortedRanges.length > 0) {
            const firstRange = sortedRanges[0];
            const firstRangeMin = firstRange.minQty || 1;
            progress = Math.min((monthCumulativeQty / firstRangeMin) * 100, 100);
          }
          
          let eligibilityStatus = 'Not Eligible';
          let statusMessage = 'Not Eligible';
          
          if (currentRange) {
            eligibilityStatus = 'Eligible';
            statusMessage = `Eligible for ₱${rebatePerBag.toFixed(2)}`;
          } else if (monthCumulativeQty > 0) {
            eligibilityStatus = 'Progressing';
            const nextRange = sortedRanges.find(r => r.minQty > monthCumulativeQty);
            if (nextRange) {
              const remaining = nextRange.minQty - monthCumulativeQty;
              statusMessage = `Need ${remaining.toFixed(2)} more for Range ${nextRange.rangeNo}`;
            }
          }
          
          const rebateAmount = currentRange ? (qtyForReb * rebatePerBag) : 0;
          
          let calculationNote = null;
          if (is25kgItem) {
            calculationNote = `${actualSales} ÷ 2 = ${qtyForReb.toFixed(2)}`;
          }
          
          processedTransactions.push({
            ...transaction,
            Date: transaction.Date,
            Item: transaction.Item || 'N/A',
            ItemCode: transaction.ItemCode || '',
            ActualSales: actualSales,
            QtyForReb: parseFloat(qtyForReb.toFixed(2)),
            QtyBal: parseFloat(monthCumulativeQty.toFixed(2)),
            TotalMonthQty: parseFloat(monthCumulativeQty.toFixed(2)),
            Progress: parseFloat(progress.toFixed(1)),
            EligibilityStatus: eligibilityStatus,
            StatusMessage: statusMessage,
            MonthName: monthInfo.monthName,
            MonthKey: monthInfo.monthKey,
            RebateType: 'Incremental',
            IsNewMonth: isFirstInMonth,
            CurrentRange: currentRange?.rangeNo || null,
            RebatePerBag: rebatePerBag,
            RebateAmount: parseFloat(rebateAmount.toFixed(2)),
            RangeMin: currentRange?.minQty || (sortedRanges[0]?.minQty || 0),
            RangeMax: currentRange?.maxQty || (sortedRanges[0]?.maxQty || 0),
            UnitPerQty: itemUnitPerQty,
            Is25kgItem: is25kgItem,
            CalculationNote: calculationNote,
            IsEmptyMonth: false
          });
        });
        
        cumulativeQty = 0;
        currentRange = null;
        rebatePerBag = 0;
      }
    });
    
    return processedTransactions;
  };

  const processPercentageTransactionsMonthly = (transactions, unitPerQty = 1, rebateDetails) => {
    if (!transactions || transactions.length === 0) {
      const startDate = rebateDetails?.dateFrom;
      const endDate = rebateDetails?.dateTo;
      const quotas = rebateDetails?.quotas || [];
      
      if (startDate && endDate) {
        const allMonths = [];
        const currentDate = new Date(startDate);
        const finalDate = new Date(endDate);
        let monthIndex = 0;
        
        while (currentDate <= finalDate && monthIndex < Math.max(quotas.length, 3)) {
          const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
          const quota = quotas[monthIndex] || 0;
          
          allMonths.push({
            monthIndex: monthIndex + 1,
            monthName: monthName,
            monthKey: monthKey,
            target: quota,
            achieved: 0,
            progress: 0,
            status: 'No Transactions',
            quota: quota,
            currentRange: null,
            rebatePerBag: 0,
            RangeMin: null,
            RangeMax: null,
            isEmptyMonth: true,
            has25kgItems: false,
            unitPerQty: unitPerQty,
            rebateType: 'Percentage',
            rebateAmount: 0,
            percentageValue: rebateDetails?.percentageValue || 0
          });
          
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthIndex++;
        }
        
        return allMonths;
      }
      
      return [];
    }
      
      const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(a.Date) - new Date(b.Date)
      );
      
      const transactionsByMonth = {};
      sortedTransactions.forEach((transaction) => {
        const date = new Date(transaction.Date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        
        if (!transactionsByMonth[monthKey]) {
          transactionsByMonth[monthKey] = {
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            monthName: monthName,
            monthKey: monthKey,
            transactions: [],
            totalQtyForReb: 0,
            totalRebateAmount: 0,
            quota: 0,
            progress: 0,
            status: 'Not Eligible',
            startDate: date,
            endDate: date,
            monthRunningTotal: 0
          };
        }
        
        if (date < transactionsByMonth[monthKey].startDate) {
          transactionsByMonth[monthKey].startDate = date;
        }
        if (date > transactionsByMonth[monthKey].endDate) {
          transactionsByMonth[monthKey].endDate = date;
        }
        
        transactionsByMonth[monthKey].transactions.push(transaction);
        
        const is25kgItem = transaction.Is25kgItem || 
          (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
        const actualSales = parseFloat(transaction.ActualSales) || 0;
        const qtyForRebFromAPI = parseFloat(transaction.QtyForReb) || 0;
        const rebateAmount = parseFloat(transaction.RebateAmount) || 0;
        
        const qtyForReb = is25kgItem ? (actualSales / unitPerQty) : qtyForRebFromAPI;
        
        transactionsByMonth[monthKey].totalQtyForReb += qtyForReb;
        transactionsByMonth[monthKey].totalRebateAmount += rebateAmount;
      });
      
      const startDate = rebateDetails?.dateFrom ? new Date(rebateDetails.dateFrom) : new Date(sortedTransactions[0].Date);
      const endDate = rebateDetails?.dateTo ? new Date(rebateDetails.dateTo) : new Date();
      
      const allMonthsInPeriod = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
        
        if (!allMonthsInPeriod.includes(monthKey)) {
          allMonthsInPeriod.push({
            monthKey,
            monthName,
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear()
          });
        }
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      const monthsToShow = Math.min(allMonthsInPeriod.length, 3);
      const displayedMonths = allMonthsInPeriod.slice(0, monthsToShow);
      
      const monthlyQuotas = rebateDetails?.quotas || [];
      
      const allMonthsData = {};
      displayedMonths.forEach((monthData, index) => {
        const monthKey = monthData.monthKey;
        const existingData = transactionsByMonth[monthKey];
        const quotaIndex = Math.min(index, monthlyQuotas.length - 1);
        const quota = monthlyQuotas[quotaIndex] || 0;
        
        if (existingData) {
          existingData.quota = quota;
          
          if (existingData.quota > 0) {
            existingData.progress = Math.min((existingData.totalQtyForReb / existingData.quota) * 100, 100);
          } else {
            existingData.progress = 0;
          }
          existingData.status = existingData.progress >= 100 ? 'Eligible' : 'Not Eligible';
          allMonthsData[monthKey] = existingData;
        } else {
          allMonthsData[monthKey] = {
            month: monthData.month,
            year: monthData.year,
            monthName: monthData.monthName,
            monthKey: monthKey,
            transactions: [],
            totalQtyForReb: 0,
            totalRebateAmount: 0,
            quota: quota,
            progress: 0,
            status: 'No Transactions',
            startDate: new Date(monthKey + '-01'),
            endDate: new Date(monthKey + '-01'),
            monthRunningTotal: 0,
            isEmptyMonth: true
          };
        }
      });
      
      let processedTransactions = [];
      
      displayedMonths.forEach((monthData) => {
        const monthKey = monthData.monthKey;
        const monthInfo = allMonthsData[monthKey];
        
        if (monthInfo.transactions.length > 0) {
          let monthRunningTotal = 0;
          
          const sortedMonthTransactions = [...monthInfo.transactions].sort((a, b) => 
            new Date(a.Date) - new Date(b.Date)
          );
          
          sortedMonthTransactions.forEach((transaction, idx) => {
            const is25kgItem = transaction.Is25kgItem || 
              (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
            const actualSales = parseFloat(transaction.ActualSales) || 0;
            const qtyForRebFromAPI = parseFloat(transaction.QtyForReb) || 0;
            const rebateAmount = parseFloat(transaction.RebateAmount) || 0;
            const percentage = transaction.Percentage || 0;
            
            const qtyForReb = is25kgItem ? (actualSales / unitPerQty) : qtyForRebFromAPI;
            
            if (idx === 0) {
              monthRunningTotal = 0;
            }
            
            monthRunningTotal += qtyForReb;
            
            const progressPercentage = monthInfo.quota > 0 ? 
              Math.min((monthRunningTotal / monthInfo.quota) * 100, 100) : 0;
            
            const formattedProgress = parseFloat(progressPercentage.toFixed(2));
            
            let calculationNote = null;
            if (is25kgItem) {
              calculationNote = `${actualSales} ÷ ${unitPerQty} = ${qtyForReb.toFixed(2)}`;
            }
            
            processedTransactions.push({
              ...transaction,
              Date: transaction.Date,
              Item: transaction.Item,
              ItemCode: transaction.ItemCode || '',
              ActualSales: actualSales,
              QtyForReb: parseFloat(qtyForReb.toFixed(2)),
              QtyBal: parseFloat(monthRunningTotal.toFixed(2)),
              MonthQtyBal: parseFloat(monthRunningTotal.toFixed(2)),
              MonthQuota: monthInfo.quota,
              Progress: formattedProgress,
              MonthProgress: parseFloat(monthInfo.progress.toFixed(2)),
              EligibilityStatus: monthInfo.status,
              MonthName: monthInfo.monthName,
              MonthKey: monthInfo.monthKey,
              CalculationNote: calculationNote,
              IsNewMonth: idx === 0,
              RebateAmount: rebateAmount,
              RebateType: 'Percentage',
              Is25kgItem: is25kgItem,
              UnitPerQty: unitPerQty,
              Percentage: percentage,
              IsEmptyMonth: false
            });
          });
        }
      });
      
      return processedTransactions;
  };

const loadDetailedPayoutsData = async (autoLoad = true) => {
  if (!modalCustomer?.code || !modalCustomer?.rebateCode || !modalCustomer?.rebateType) {
    console.error('❌ Cannot load payouts: Missing customer data');
    return;
  }

  try {
    console.log('💰 Loading payouts for:', {
      customer: modalCustomer.customer,
      code: modalCustomer.code,
      rebateCode: modalCustomer.rebateCode,
      rebateType: modalCustomer.rebateType
    });
    
    // Use the correct URL - check your backend router structure
    const url = `http://192.168.100.193:3009/api/van/payouts/customer/${modalCustomer.code}/payouts`;
    
    const params = new URLSearchParams({
      db: 'VAN',
      rebateCode: modalCustomer.rebateCode,
      rebateType: modalCustomer.rebateType,
      useRebatePeriod: 'true'
    });
    
    const fullUrl = `${url}?${params.toString()}`;
    console.log('🌐 Calling payout API:', fullUrl);
    
    const response = await fetch(fullUrl);
    console.log('📊 Payout API response status:', response.status);
    
    const data = await response.json();
    console.log('📦 Payout API response:', {
      success: data.success,
      message: data.message,
      payoutCount: data.data?.payouts?.length || 0,
      transactionCount: data.data?.transactionCount || 0
    });
    
    if (data.success) {
      if (data.data.payouts && data.data.payouts.length > 0) {
        console.log('Payouts loaded:', data.data.payouts.length);
        
        // Process payouts with carry-over
        const payoutsWithCarryOver = applyBalanceCarryOver(data.data.payouts);
        console.log('🔄 Payouts after carry-over:', payoutsWithCarryOver.length);
        
        setDetailedPayouts(payoutsWithCarryOver);
      } else {
        console.log('⚠️ No payouts created:', data.message || 'No transaction data');
        setDetailedPayouts([]);
      }
    } else {
      console.error('❌ Payout API error:', data.message);
      setDetailedPayouts([]);
    }
  } catch (error) {
    console.error('❌ Error loading payouts:', error);
    setDetailedPayouts([]);
  }
};

const handleTabChange = async (tab) => {
  console.log('📑 Switching to tab:', tab);
  
  if (tab === customerModalTab) return;
  
  setCustomerModalTab(tab);
  
  if (modalCustomer?.code && modalCustomer?.rebateCode) {
    try {
      if (tab === 'transaction') {
        console.log('📊 Loading transactions on tab switch');
        await loadDetailedTransactionsData(true);
      } else if (tab === 'payout') {
        console.log('💰 Loading payouts on tab switch');
        // ADD THIS - Force load payouts when tab opens
        setDetailedPayouts([]); // Clear existing data first
        await loadDetailedPayoutsData(true);
      } else if (tab === 'quota') {
        // Load quota data if needed
        const quotaData = await fetchMonthlyQuotaData(
          modalCustomer.code,
          modalCustomer.rebateCode,
          modalCustomer.rebateType,
          true
        );
        if (quotaData) {
          setModalCustomer(prev => {
            if (!prev) return null;
            return {
              ...prev,
              details: {
                ...prev.details,
                monthlyQuotas: quotaData.monthlyQuotas || [],
                summary: quotaData.summary,
                rebateDetails: quotaData.rebateDetails || prev.details?.rebateDetails,
                dateRange: quotaData.dateRange || prev.details?.dateRange
              }
            };
          });
        }
      }
    } catch (error) {
      console.error('Error loading tab data:', error);
      setSaveMessage(`Error loading ${tab} data`);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }
};

const handleRebateClick = async (rebate) => {
  try {
    setSelectedRebate(rebate);
    
    console.log('🔄 Loading rebate details for:', rebate.code);
    
    const details = await loadRebateDetails(rebate.code);
    
    if (details) {
      console.log(' Successfully loaded rebate details');
      const enrichedDetails = {
        ...details,
        name: details.Name || details.name || '',
      };
      setRebateDetails(enrichedDetails);
      setOriginalRebateDetails(JSON.parse(JSON.stringify(enrichedDetails)));
    } else {
      console.log('⚠️ Could not load rebate details, using fallback data');
      
      // Fallback data structure
      const fallbackData = {
        salesEmployee: rebate.salesEmployee || rebate.agent || "Not specified",
        frequency: rebate.frequency || "Not specified",
        rebateType: rebate.type || "Fixed",
        name: rebate.name || rebate.Name || '',
        customers: [],
        items: [],
        quotas: [0, 0, 0]
      };
      
      setRebateDetails(fallbackData);
      setOriginalRebateDetails(JSON.parse(JSON.stringify(fallbackData)));
      
      // Show error message to user
      showToast("Could not load detailed rebate data. Showing basic information.", "warning");
    }
    
    setActiveTab('customers');
    
  } catch (error) {
    console.error('❌ Error in handleRebateClick:', error);
    
    // Set fallback data
    const fallbackData = {
      salesEmployee: rebate.salesEmployee || rebate.agent || "Not specified",
      frequency: rebate.frequency || "Not specified",
      rebateType: rebate.type || "Fixed",
      name: rebate.name || rebate.Name || '',
      customers: [],
      items: [],
      quotas: [0, 0, 0]
    };
    
    setRebateDetails(fallbackData);
    setOriginalRebateDetails(JSON.parse(JSON.stringify(fallbackData)));
    
    showToast("Error loading rebate details. Please try again.", "error");
  }
};

const loadIncrementalRangeData = async (rebateCode, customerCode) => {
  try {
    console.log('🎯 Specifically loading incremental range data...');
    
    // Method 1: Try to load from rebate details
    const rebateDetails = await loadRebateDetails(rebateCode);
    
    if (rebateDetails?.ranges?.length > 0) {
      console.log('Found ranges in rebate details:', rebateDetails.ranges);
      return rebateDetails.ranges;
    }
    
    // Method 2: Try to load from customer-specific endpoint
    const customerRangeUrl = `http://192.168.100.193:3009/api/van/dashboard/customer/${customerCode}/ranges?db=VAN&rebateCode=${rebateCode}`;
    console.log('🌐 Trying customer-specific range endpoint:', customerRangeUrl);
    
    try {
      const response = await fetch(customerRangeUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.ranges?.length > 0) {
          console.log('Found ranges in customer data:', data.data.ranges);
          return data.data.ranges;
        }
      }
    } catch (error) {
      console.log('⚠️ Customer range endpoint not available');
    }
    
    // Method 3: Check if we have item ranges
    if (rebateDetails?.items?.length > 0) {
      const itemRanges = [];
      rebateDetails.items.forEach(item => {
        if (item.ranges?.length > 0) {
          item.ranges.forEach(range => {
            itemRanges.push({
              ...range,
              source: 'item',
              itemCode: item.code
            });
          });
        }
      });
      
      if (itemRanges.length > 0) {
        console.log('Found ranges in item data:', itemRanges);
        // Deduplicate ranges
        const uniqueRanges = [];
        const seen = new Set();
        itemRanges.forEach(range => {
          const key = `${range.rangeNo}-${range.minQty}-${range.maxQty}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueRanges.push(range);
          }
        });
        return uniqueRanges;
      }
    }
    
    console.log('❌ No range data found');
    return [];
    
  } catch (error) {
    console.error('❌ Error loading incremental range data:', error);
    return [];
  }
};

const handleCustomerClick = async (customer) => {
  if (isLoadingCustomer) return;
  
  try {
    setIsLoadingCustomer(true);
    
    // Reset all states
    setDetailedTransactions([]);
    setDetailedPayouts([]);
    setFilterStatus("");
    setTransactionCurrentPage(1);
    setPayoutCurrentPage(1);
    setCustomerModalTab("quota");

    // Reset loop-prevention guards so the new customer's data loads fresh
    incrementalDataLoadedRef.current = {};
    quotaAutoLoadedRef.current = {};
    
    // Get frequency from customer data (it should already be in the customer object from rebates-summary)
    const frequency = customer.frequency || 'Quarterly';
    const isMonthly = frequency === 'Monthly';
    
    console.log('📊 Customer frequency from summary:', { 
      frequency, 
      isMonthly,
      customerData: customer 
    });
    
    // Load customer details (which will also get frequency from backend)
    const details = await loadCustomerDetails(
      customer.code, 
      customer.rebateCode, 
      customer.rebateType, 
      true
    );
    
    // Build the final customer data
    const updatedCustomerData = {
      ...customer,
      frequency: details?.frequency || frequency, // Use details frequency if available
      details: {
        ...details,
        isMonthly: (details?.frequency || frequency) === 'Monthly'
      }
    };
    
    console.log('Final customer data with frequency:', {
      frequency: updatedCustomerData.frequency,
      isMonthly: updatedCustomerData.frequency === 'Monthly'
    });
    
    setModalCustomer(updatedCustomerData);
    setCurrentCustomerData(updatedCustomerData);
    
  } catch (error) {
    console.error('❌ Error loading customer:', error);
  } finally {
    setIsLoadingCustomer(false);
  }
};

useEffect(() => {
  if (!modalCustomer || modalCustomer.rebateType !== 'Incremental' || customerModalTab !== 'quota') {
    return;
  }

  const loadKey = `${modalCustomer.code}_${modalCustomer.rebateCode}`;
  if (incrementalDataLoadedRef.current[loadKey]) return;
  incrementalDataLoadedRef.current[loadKey] = true;

  const loadIncrementalData = async () => {
    console.log('🎯 Loading incremental range + transaction data for', loadKey);

    const hasRanges = modalCustomer.ranges?.length > 0 ||
                       modalCustomer.details?.rebateDetails?.ranges?.length > 0;

    if (!hasRanges) {
      const ranges = await loadIncrementalRangeData(modalCustomer.rebateCode, modalCustomer.code);
      if (ranges.length > 0) {
        setModalCustomer(prev => {
          if (!prev || prev.code !== modalCustomer.code || prev.rebateCode !== modalCustomer.rebateCode) return prev;
          return {
            ...prev,
            ranges,
            details: {
              ...prev.details,
              rebateDetails: {
                ...prev.details?.rebateDetails,
                ranges
              }
            }
          };
        });
      }
    }

    if (!detailedTransactions.length) {
      await loadDetailedTransactionsData(true);
    }
  };

  loadIncrementalData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [modalCustomer?.code, modalCustomer?.rebateCode, modalCustomer?.rebateType, customerModalTab]);

  const handlePayoutStatusChange = async (payoutId, newStatus) => {
    try {
      const payout = detailedPayouts.find(p => p.Id === payoutId);
      if (!payout) return;
      
      let amountReleased = payout.AmountReleased || 0;
      if (newStatus === 'Paid') {
        amountReleased = payout.Amount || 0;
      } else if (newStatus === 'No Payout') {
        amountReleased = 0;
      }
      
      const payload = {
        db: 'VAN',
        status: newStatus,
        amountReleased: amountReleased
      };
      
      const response = await fetch(`http://192.168.100.193:3009/api/van/payouts/payouts/${payoutId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showToast(`Status updated to ${newStatus}`, "success");
          
          setDetailedPayouts(prev => prev.map(p => 
            p.Id === payoutId ? {
              ...p,
              Status: result.data.status,
              AmountReleased: result.data.amountReleased,
              Balance: result.data.balance
            } : p
          ));
          
          const updatedWithCarryOver = applyBalanceCarryOver(
            detailedPayouts.map(p => 
              p.Id === payoutId ? {
                ...p,
                Status: result.data.status,
                AmountReleased: result.data.amountReleased,
                Balance: result.data.balance
              } : p
            )
          );
          setDetailedPayouts(updatedWithCarryOver);
        }
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
      showToast("Error updating status", "error");
    }
  };

  const handleAmountReleasedChange = async (payoutId, amount) => {
    try {
      const amountNum = parseFloat(amount) || 0;
      const payout = detailedPayouts.find(p => p.Id === payoutId);
      
      if (!payout) {
        console.error('❌ Payout not found:', payoutId);
        return;
      }
      
      const totalAmount = parseFloat(payout.Amount) || 0;
      
      const validatedAmount = Math.min(Math.max(amountNum, 0), totalAmount);
      
      const newBalance = totalAmount - validatedAmount;
      
      let newStatus = payout.Status;
      if (validatedAmount === 0) {
        newStatus = totalAmount > 0 ? 'Pending' : 'No Payout';
      } else if (validatedAmount >= totalAmount) {
        newStatus = 'Paid';
      } else if (validatedAmount > 0) {
        newStatus = 'Partially Paid';
      }
      
      const updatedPayouts = detailedPayouts.map(p => {
        if (p.Id === payoutId) {
          return {
            ...p,
            AmountReleased: validatedAmount,
            Balance: newBalance,
            Status: newStatus
          };
        }
        return p;
      });
      
      setDetailedPayouts(updatedPayouts);
      
      const payload = {
        db: 'VAN',
        status: newStatus,
        amountReleased: validatedAmount
      };
      
      console.log('Saving to database:', { 
        payoutId, 
        amount: totalAmount,
        amountReleased: validatedAmount,
        balance: newBalance,
        calculation: `${totalAmount} - ${validatedAmount} = ${newBalance}`
      });
      
      const response = await fetch(`http://192.168.100.193:3009/api/van/payouts/payouts/${encodeURIComponent(payoutId)}/status`, {
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
        showToast(`Amount released updated to ₱${validatedAmount.toFixed(2)}`, "success");
        
        setDetailedPayouts(prev => prev.map(p => 
          p.Id === payoutId ? {
            ...p,
            Status: result.data.status,
            AmountReleased: result.data.amountReleased,
            Balance: result.data.balance
          } : p
        ));
      } else {
        throw new Error(result.message || 'Save failed');
      }
      
    } catch (error) {
      console.error('❌ Error updating amount released:', error);
      showToast(`Error: ${error.message}`, "error");
      
      await loadDetailedPayoutsData();
    }
  };

  const handleSavePayout = async (payoutId) => {
    try {
      const payoutToSave = detailedPayouts.find(p => p.Id === payoutId);
      if (!payoutToSave) {
        console.error('❌ Payout not found in local state');
        return;
      }

      const totalAmount = parseFloat(payoutToSave.Amount) || 0;
      const amountReleased = parseFloat(payoutToSave.AmountReleased) || 0;
      
      const balance = totalAmount - amountReleased;
      
      let status = payoutToSave.Status || 'Pending';
      if (amountReleased === 0) {
        status = totalAmount > 0 ? 'Pending' : 'No Payout';
      } else if (amountReleased >= totalAmount) {
        status = 'Paid';
      } else if (amountReleased > 0) {
        status = 'Partially Paid';
      }

      const payload = {
        db: 'VAN',
        status: status,
        amountReleased: amountReleased
      };

      console.log('📤 Saving payout to database:', { 
        payoutId, 
        amount: totalAmount,
        amountReleased: amountReleased,
        balance: balance,
        calculation: `${totalAmount} - ${amountReleased} = ${balance}`
      });
      
    const response = await fetch(`http://192.168.100.193:3009/api/van/payouts/payouts/${encodeURIComponent(payoutId)}/status`,{        
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
        showToast("Payout saved to database successfully", "success");
        
        setDetailedPayouts(prev => prev.map(p => 
          p.Id === payoutId ? {
            ...p,
            Status: result.data.status,
            AmountReleased: result.data.amountReleased,
            Balance: result.data.balance
          } : p
        ));
      } else {
        throw new Error(result.message || 'Save failed');
      }
      
    } catch (error) {
      console.error('❌ Save error:', error);
      showToast(`Error: ${error.message}`, "error");
    }
  };

  const handleSaveAmountReleased = (payoutId) => {
    const amount = parseFloat(editedAmountReleased) || 0;
    handleAmountReleasedChange(payoutId, amount.toString());
    
    const payout = paginatedPayouts.find(p => p.Id === payoutId);
    if (payout) {
      const maxAmount = payout.Amount || 0;
      
      if (amount >= maxAmount) {
        handlePayoutStatusChange(payoutId, 'Paid');
      } else if (amount > 0) {
        handlePayoutStatusChange(payoutId, 'Partially Paid');
      } else {
        handlePayoutStatusChange(payoutId, 'Pending');
      }
    }
    
    handleSavePayout(payoutId);
    
    setEditingPayoutId(null);
    setEditedAmountReleased('');
  };

  const applyPeriodFilter = async (tabType) => {
    if (!modalCustomer) return;
    
    showToast("Applying filters...", "info");
    setUseAutoDates(false);
    
    try {
      if (tabType === 'quota') {
        const quotaData = await fetchMonthlyQuotaData(
          modalCustomer.code, 
          modalCustomer.rebateCode, 
          modalCustomer.rebateType,
          false
        );
        
        if (quotaData) {
          setModalCustomer(prev => ({
            ...prev,
            details: {
              ...prev.details,
              ...quotaData,
              monthlyQuotas: quotaData.monthlyQuotas || [],
              summary: quotaData.summary,
              unitPerQty: quotaData.unitPerQty || prev.details.unitPerQty,
              dateRange: {
                ...prev.details?.dateRange,
                periodFrom: periodFrom,
                periodTo: periodTo,
                autoLoaded: false,
                dateSource: 'manual'
              }
            }
          }));
        }
      } else if (tabType === 'transaction') {
        await loadDetailedTransactionsData(false);
      } else if (tabType === 'payout') {
        await loadDetailedPayoutsData(false);
      }
      
      showToast("Period filter applied!", "success");
    } catch (error) {
      showToast("Error applying filter", "error");
    }
  };

  const clearPeriodFilter = () => {
    const currentYear = new Date().getFullYear();
    const firstDay = new Date(currentYear, 0, 1);
    const lastDay = new Date(currentYear, 11, 31);
    
    setPeriodFrom(firstDay.toISOString().split('T')[0]);
    setPeriodTo(lastDay.toISOString().split('T')[0]);
    
    setDetailedTransactions([]);
    setDetailedPayouts([]);
    
    showToast("Showing all data!", "success");
  };

  const handleRefresh = () => {
    loadDashboardData();
    showToast("Data refreshed successfully!", "success");
  };

  const clearRebateFilters = () => {
    setSelectedRebateTypeFilter("All");
    setSelectedRebateStatusFilter("All");
    setRebateDateFrom("");
    setRebateDateTo("");
    setRebateSearchTerm("");
    setActiveFilter("all");
    showToast("All rebate filters cleared!", "success");
  };

  const applyRebateFilters = () => {
    setShowRebateFilters(false);
    showToast("Rebate filters applied successfully!", "success");
  };

  const clearAllFilters = () => {
    setSelectedAgent("All");
    setSelectedRebateType("All");
    setSelectedProgressStatus("All");
    setSelectedRebateStatus("All");
    setMinRebateAmount("");
    setMaxRebateAmount("");
    setStatusSummaryPeriodFrom("");
    setStatusSummaryPeriodTo("");
    setSearchTerm("");
    showToast("All filters cleared!", "success");
  };

  const applyFilters = () => {
    setShowFilters(false);
    showToast("Filters applied successfully!", "success");
  };

  // Customer editing functions
  const handleCustomerQuotaChange = (customerCode, quotaIndex, newValue) => {
    setRebateDetails(prev => {
      const updatedCustomers = prev.customers.map(customer => {
        if (customer.code === customerCode) {
          // Get month names for context
          const months = ['January', 'February', 'March'];
          const monthName = months[quotaIndex];
          
          // Handle based on rebate type
          if (prev.rebateType === 'Fixed') {
            // For Fixed rebates, quotas might be object or array
            let updatedQuotas = { ...customer.quotas };
            if (Array.isArray(customer.quotas)) {
              // If it's an array, update the index
              const newArray = [...customer.quotas];
              newArray[quotaIndex] = parseFloat(newValue) || 0;
              updatedQuotas = newArray;
            } else if (typeof customer.quotas === 'object') {
              // If it's an object, update by month name
              updatedQuotas[monthName] = parseFloat(newValue) || 0;
            } else {
              // Default to array
              updatedQuotas = [0, 0, 0];
              updatedQuotas[quotaIndex] = parseFloat(newValue) || 0;
            }
            
            return {
              ...customer,
              quotas: updatedQuotas
            };
          } else if (prev.rebateType === 'Percentage') {
            // For Percentage rebates, always use array
            let quotasArray = [];
            if (Array.isArray(customer.quotas)) {
              quotasArray = [...customer.quotas];
            } else if (customer.quotas && typeof customer.quotas === 'object') {
              // Convert object to array
              quotasArray = Object.values(customer.quotas);
            }
            
            // Ensure we have at least 3 elements
            while (quotasArray.length < 3) {
              quotasArray.push(0);
            }
            
            quotasArray[quotaIndex] = parseFloat(newValue) || 0;
            
            return {
              ...customer,
              quotas: quotasArray
            };
          }
        }
        return customer;
      });
      
      return {
        ...prev,
        customers: updatedCustomers
      };
    });
  };

  const handleCustomerQtrRebateChange = (customerCode, newValue) => {
    setRebateDetails(prev => ({
      ...prev,
      customers: prev.customers.map(customer => 
        customer.code === customerCode 
          ? { ...customer, qtrRebate: parseFloat(newValue) || 0 }
          : customer
      )
    }));
  };

  const handleCustomerRangeChange = (customerCode, rangeIndex, field, newValue) => {
    setRebateDetails(prev => ({
      ...prev,
      customers: prev.customers.map(customer => 
        customer.code === customerCode 
          ? {
              ...customer,
              ranges: customer.ranges.map((range, idx) => 
                idx === rangeIndex ? { ...range, [field]: parseFloat(newValue) || 0 } : range
              )
            }
          : customer
      )
    }));
  };

  const handleEditCustomer = (customerCode) => {
    setEditingCustomers(prev => ({
      ...prev,
      [customerCode]: true
    }));
  };

  const handleSaveCustomer = async (customerCode) => {
    try {
      const currentDatabase = 'VAN';
      const customerToUpdate = rebateDetails.customers.find(c => c.code === customerCode);
      
      if (!customerToUpdate) {
        showToast("Customer not found!", "error");
        return;
      }

      // Prepare request body based on rebate type
      const requestBody = {
        rebateCode: selectedRebate.code,
        customerCode: customerCode
      };

      // Add data based on rebate type
      if (rebateDetails.rebateType === 'Fixed') {
        requestBody.qtrRebate = parseFloat(customerToUpdate.qtrRebate) || 0;
        // Ensure quotas is an array of numbers
        requestBody.quotas = Array.isArray(customerToUpdate.quotas) 
          ? customerToUpdate.quotas.map(q => parseFloat(q) || 0)
          : [0, 0, 0];
        
        console.log('🔄 Saving Fixed customer data:', {
          ...requestBody,
          quotasType: typeof requestBody.quotas,
          quotasLength: requestBody.quotas.length,
          quotasSample: requestBody.quotas
        });
      } 
      else if (rebateDetails.rebateType === 'Incremental') {
        requestBody.qtrRebate = parseFloat(customerToUpdate.qtrRebate) || 0;
        requestBody.ranges = customerToUpdate.ranges?.map(range => ({
          rangeNo: range.rangeNo,
          minQty: parseFloat(range.minQty) || 0,
          maxQty: parseFloat(range.maxQty) || 0,
          rebatePerBag: parseFloat(range.rebatePerBag) || 0
        })) || [];
      }
      else if (rebateDetails.rebateType === 'Percentage') {
        requestBody.qtrRebate = parseFloat(customerToUpdate.qtrRebate) || 0;
        requestBody.quotas = Array.isArray(customerToUpdate.quotas) 
          ? customerToUpdate.quotas.map(q => parseFloat(q) || 0)
          : [0, 0, 0];
      }

      console.log('📤 Sending request to backend:', {
        url: `http://192.168.100.193:3009/api/van/dashboard/rebate/customer?db=${currentDatabase}`,
        method: 'PUT',
        body: requestBody
      });

      const response = await fetch(`http://192.168.100.193:3009/api/van/dashboard/rebate/customer?db=${currentDatabase}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      console.log('📥 Backend response:', result);
      
      if (response.ok && result.success) {
        setEditingCustomers(prev => ({
          ...prev,
          [customerCode]: false
        }));
        showToast("Customer data updated successfully!", "success");
        
        // Reload rebate details
        console.log('🔄 Reloading rebate details...');
        const updatedDetails = await loadRebateDetails(selectedRebate.code);
        if (updatedDetails) {
          setRebateDetails(updatedDetails);
          setOriginalRebateDetails(JSON.parse(JSON.stringify(updatedDetails)));
        } else {
          console.warn('⚠️ Could not reload rebate details');
        }
      } else {
        showToast(`Failed: ${result.message || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error('❌ Error updating customer data:', error);
      showToast(`Error: ${error.message}`, "error");
    }
  };

  const handleCancelEditCustomer = (customerCode) => {
    setRebateDetails(originalRebateDetails);
    setEditingCustomers(prev => ({
      ...prev,
      [customerCode]: false
    }));
  };

const handleItemChange = (itemCode, field, newValue) => {
  setRebateDetails(prev => ({
    ...prev,
    items: prev.items.map(item => {
      if (item.code === itemCode) {
        // For uom field (string)
        if (field === 'uom') {
          return { ...item, [field]: newValue || '' };
        }
        // For description (string)
        if (field === 'description') {
          return { ...item, [field]: newValue };
        }
        // For unitPerQty (numeric)
        if (field === 'unitPerQty') {
          return { ...item, [field]: parseFloat(newValue) || 1 };
        }
        // For Fixed rebates, when editing 'rebatePerBag' field
        if (prev.rebateType === 'Fixed' && field === 'rebatePerBag') {
          return {
            ...item,
            rebatePerBag: parseFloat(newValue) || 0,
            rebate: parseFloat(newValue) || 0
          };
        }
        // For Percentage rebates, when editing 'percentage' field
        if (prev.rebateType === 'Percentage' && field === 'percentage') {
          return {
            ...item,
            percentage: parseFloat(newValue) || 0,
            rebate: parseFloat(newValue) || 0
          };
        }
        // Default numeric handling
        return { ...item, [field]: parseFloat(newValue) || 0 };
      }
      return item;
    })
  }));
};

  const handleItemRangeChange = (itemCode, rangeIndex, field, newValue) => {
    setRebateDetails(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.code === itemCode 
          ? {
              ...item,
              ranges: item.ranges.map((range, idx) => 
                idx === rangeIndex ? { ...range, [field]: parseFloat(newValue) || 0 } : range
              )
            }
          : item
      )
    }));
  };

  const handleEditItem = (itemCode) => {
    setEditingItems(prev => ({
      ...prev,
      [itemCode]: true
    }));
  };

const handleSaveItem = async (itemCode) => {
  try {
    const currentDatabase = 'VAN';
    const itemToUpdate = rebateDetails.items.find(i => i.code === itemCode);
    
    if (!itemToUpdate) {
      showToast("Item not found!", "error");
      return;
    }

    const requestBody = {
      rebateCode: selectedRebate.code,
      itemCode: itemCode,
      description: itemToUpdate.description || '',
      unitPerQty: parseFloat(itemToUpdate.unitPerQty) || 1,
      uom: itemToUpdate.uom || '',  // ← Make sure this is included
    };

    // Add data based on rebate type
    if (rebateDetails.rebateType === 'Fixed') {
      requestBody.rebate = parseFloat(itemToUpdate.rebate) || 0;
    } 
    else if (rebateDetails.rebateType === 'Incremental') {
      requestBody.ranges = itemToUpdate.ranges?.map(range => ({
        rangeNo: range.rangeNo,
        minQty: parseFloat(range.minQty) || 0,
        maxQty: parseFloat(range.maxQty) || 0,
        rebatePerBag: parseFloat(range.rebatePerBag) || 0
      })) || [];
    }
    else if (rebateDetails.rebateType === 'Percentage') {
      requestBody.rebate = parseFloat(itemToUpdate.percentage) || 0;
    }

    console.log('📤 Saving item with uom:', requestBody.uom);

    const response = await fetch(`http://192.168.100.193:3009/api/van/dashboard/rebate/item?db=${currentDatabase}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    if (response.ok && result.success) {
      setEditingItems(prev => ({ ...prev, [itemCode]: false }));
      showToast("Item data updated successfully!", "success");
      
      const updatedDetails = await loadRebateDetails(selectedRebate.code);
      if (updatedDetails) {
        setRebateDetails(updatedDetails);
        setOriginalRebateDetails(JSON.parse(JSON.stringify(updatedDetails)));
      }
    } else {
      showToast(result.message || "Failed to update item data", "error");
    }
  } catch (error) {
    console.error('❌ Error updating item data:', error);
    showToast("Error updating item data: " + error.message, "error");
  }
};

  const handleCancelEditItem = (itemCode) => {
    setRebateDetails(originalRebateDetails);
    setEditingItems(prev => ({
      ...prev,
      [itemCode]: false
    }));
  };

  

  // In Van_Dashboard.js - ensure this function exists and is connected
  const handleStatusToggle = async (rebateCode, statusValue) => {
    try { 
      const currentDatabase = 'VAN';
      // Ensure statusValue is numeric (1 or 0)
      const numericStatus = typeof statusValue === 'string' 
        ? (statusValue === 'Active' ? 1 : 0)
        : statusValue;

      console.log('🔄 Updating rebate status:', {
        rebateCode,
        statusValue,
        numericStatus,
        type: typeof statusValue
      });

      const response = await fetch(`http://192.168.100.193:3009/api/van/dashboard/rebates?db=${currentDatabase}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rebateCode: rebateCode,
          status: numericStatus
        })
      });

      const result = await response.json();
      console.log('📊 Status update response:', result);
      
      if (response.ok && result.success) {
        // Update the local state immediately
        setRebates(prevRebates => 
          prevRebates.map(rebate => 
            rebate.code === rebateCode 
              ? { ...rebate, active: numericStatus === 1 }
              : rebate
          )
        );
        
        showToast(`Rebate ${rebateCode} status updated to ${numericStatus === 1 ? 'Active' : 'Inactive'}!`, "success");
      } else {
        showToast(`Failed to update status: ${result.message || 'Unknown error'}`, "error");
      }
    } catch (error) {
      console.error('❌ Error updating rebate status:', error);
      showToast(`Error updating status: ${error.message}`, "error");
    }
  };

  const clearStatusSummaryPeriodFilter = () => {
    const currentYear = new Date().getFullYear();
    const firstDay = new Date(currentYear, 0, 1);
    const lastDay = new Date(currentYear, 11, 31);
    
    setStatusSummaryPeriodFrom(firstDay.toISOString().split('T')[0]);
    setStatusSummaryPeriodTo(lastDay.toISOString().split('T')[0]);
    showToast("Showing all data in status summary!", "success");
  };

  const renderMonthlyTransactionTable = () => {
  return (
    <table className="w-full text-xs">
      <thead className={`sticky top-0 ${
        theme === 'dark' 
          ? 'bg-gradient-to-r from-gray-800 to-gray-900' 
          : 'bg-gray-50'
      }`}>
        <tr className={`font-semibold uppercase tracking-wider border-b ${
          theme === 'dark' 
            ? 'border-gray-700 text-gray-300' 
            : 'border-gray-200 text-gray-600'
        }`}>
          <th className="px-6 py-2 text-left w=[12%]">Date</th>
          <th className="px-3 py-2 text-left w=[25%]">Item</th>
          <th className="px-3 py-2 text-center w=[10%]">Act. Sales</th>
          {modalCustomer?.rebateType === 'Percentage' && (
            <th className="px-3 py-2 text-center w=[12%]">Percentage</th>
          )}
          {modalCustomer?.rebateType !== 'Percentage' && (
            <th className="px-3 py-2 text-center w=[12%]">Rebate/Bag</th>
          )}
          <th className="px-3 py-2 text-center w=[15%]">Rebate Amount</th>
        </tr>
      </thead>
      <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'}`}>
        {paginatedTransactions.length > 0 ? (
          paginatedTransactions.map((transaction, index) => {
            const isPercentage = modalCustomer?.rebateType === 'Percentage';
            const rebatePerBag = transaction.RebatePerBag || transaction.rebatePerBag || 0;
            const percentage = transaction.Percentage || 0;
            const actualSales = transaction.ActualSales || 0;
            const rebateAmount = isPercentage 
              ? (actualSales * percentage) / 100
              : actualSales * rebatePerBag;
            
            return (
              <tr key={index} className={`${
                theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
              }`}>
                <td className="px-6 py-2">
                  <div className={`font-medium ${
                    theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    {transaction.Date || 'N/A'}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className={`font-medium truncate ${
                    theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    {transaction.Item || 'N/A'}
                  </div>
                  <div className={`text-[10px] truncate ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {transaction.ItemCode || ''}
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 font-medium rounded border ${
                    theme === 'dark'
                      ? 'bg-blue-900/30 text-blue-300 border-blue-700' 
                      : 'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {formatDecimal(actualSales)}
                  </span>
                </td>
                {isPercentage ? (
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${
                      theme === 'dark'
                        ? 'bg-purple-900/30 text-purple-300 border-purple-700' 
                        : 'bg-purple-50 text-purple-700 border-purple-100'
                    }`}>
                      {percentage}%
                    </span>
                  </td>
                ) : (
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${
                      theme === 'dark'
                        ? 'bg-purple-900/30 text-purple-300 border-purple-700' 
                        : 'bg-purple-50 text-purple-700 border-purple-100'
                    }`}>
                      ₱{formatDecimal(rebatePerBag)}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 font-bold rounded border ${
                    theme === 'dark'
                      ? 'bg-green-900/30 text-green-300 border-green-700' 
                      : 'bg-green-100 text-green-800 border-green-200'
                  }`}>
                    ₱{formatDecimal(rebateAmount)}
                  </span>
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={modalCustomer?.rebateType === 'Percentage' ? 5 : 5} className="px-4 py-6 text-center">
              <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                No transactions found
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

  // ─── MODIFIED: Fixed Customer Table (Actions column removed) ────────────
  const renderFixedCustomerTable = ({ access } = {}) => {
    const isDark = theme === 'dark';
    const isMonthly = rebateDetails?.frequency === 'Monthly';

    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Users size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-slate-300'}`} />
            <h5 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>No Customers Found</h5>
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>No customers are associated with this rebate program.</p>
          </div>
        </div>
      );
    }

    const getQuotaMonthNames = () => {
      const dateFrom = rebateDetails?.dateFrom ||
                       rebateDetails?.rebateDetails?.dateFrom ||
                       selectedRebate?.from;
      const frequency = rebateDetails?.frequency || 'Quarterly';
      const firstCustomer = rebateDetails?.customers?.[0];
      let quotaCount = 0;
      if (Array.isArray(firstCustomer?.quotas)) quotaCount = firstCustomer.quotas.length;
      else if (typeof firstCustomer?.quotas === 'object' && firstCustomer?.quotas) quotaCount = Object.keys(firstCustomer.quotas).length;
      if (quotaCount === 0) quotaCount = frequency === 'Quarterly' ? 3 : 3;
      if (!dateFrom) {
        return Array.from({ length: quotaCount }, (_, i) => ({
          name: frequency === 'Quarterly' ? `Q${i + 1} ${new Date().getFullYear()}` : `Month ${i + 1}`,
          dates: frequency === 'Quarterly' ? `Quarter ${i + 1}` : `Month ${i + 1}`,
          shortLabel: frequency === 'Quarterly' ? `Q${i + 1}` : `M${i + 1}`,
          isMonthly: frequency === 'Monthly',
          isQuarterly: frequency === 'Quarterly'
        }));
      }
      const addMonths = (date, n) => {
        const d = new Date(date);
        const day = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, last));
        return d;
      };
      const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fmtFull = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const start = new Date(dateFrom);
      const labels = [];
      for (let i = 0; i < quotaCount; i++) {
        let sliceStart, sliceEnd;
        if (frequency === 'Quarterly') {
          sliceStart = addMonths(start, i);
          const nextStart = addMonths(start, i + 1);
          sliceEnd = new Date(nextStart);
          sliceEnd.setDate(sliceEnd.getDate() - 1);
        } else {
          sliceStart = addMonths(start, i);
          const nextStart = addMonths(start, i + 1);
          sliceEnd = new Date(nextStart);
          sliceEnd.setDate(sliceEnd.getDate() - 1);
        }
        const dateRange = `${fmtShort(sliceStart)} – ${fmtFull(sliceEnd)}`;
        labels.push({
          name: dateRange,
          dates: dateRange,
          shortLabel: dateRange,
          monthName: sliceStart.toLocaleDateString('en-US', { month: 'long' }),
          year: sliceStart.getFullYear(),
          isMonthly: frequency === 'Monthly',
          isQuarterly: frequency === 'Quarterly',
          index: i,
          startDate: sliceStart,
          endDate: sliceEnd
        });
      }
      return labels;
    };

    const quotaMonths = getQuotaMonthNames();

    const getQuotaValue = (customer, monthIndex) => {
      if (!customer.quotas) return 0;
      const monthName = typeof quotaMonths[monthIndex] === 'object' ? quotaMonths[monthIndex].name : quotaMonths[monthIndex];
      if (Array.isArray(customer.quotas)) return customer.quotas[monthIndex] || 0;
      if (typeof customer.quotas === 'object') {
        if (customer.quotas[monthName] !== undefined) return customer.quotas[monthName] || 0;
        const numericKey = monthIndex + 1;
        if (customer.quotas[numericKey] !== undefined) return customer.quotas[numericKey] || 0;
        const monthKey = `Month${numericKey}`;
        if (customer.quotas[monthKey] !== undefined) return customer.quotas[monthKey] || 0;
      }
      return 0;
    };

    if (isMonthly) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`sticky top-0 border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <tr>
                <th className={`px-3 py-2 text-left text-xs font-bold uppercase tracking-wider min-w-[180px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Customer</th>
                <th className={`px-3 py-2 text-left text-xs font-bold uppercase tracking-wider min-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Code</th>
                {quotaMonths.map((month, index) => (
                  <th key={index} className={`px-3 py-2 text-center text-xs font-bold uppercase tracking-wider min-w-[150px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className="font-bold text-xs whitespace-nowrap">{month.dates || month.name || `Month ${index + 1}`}</div>
                  </th>
                ))}
                <th className={`px-3 py-2 text-center text-xs font-bold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>QTR Rebate</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
              {rebateDetails.customers.map((customer, i) => {
                const customerCode = customer.code || `CUST-${i}`;
                const isEditing = editingCustomers[customerCode] || false;
                return (
                  <tr key={i} className={`transition-colors duration-150 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                          {(customer.name && customer.name.charAt(0)) || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`font-medium text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{customer.name || 'Unknown Customer'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code className={`text-xs px-1.5 py-0.5 rounded font-medium truncate inline-block max-w-full ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{customer.code || 'N/A'}</code>
                    </td>
                    {quotaMonths.map((month, idx) => {
                      const quotaValue = getQuotaValue(customer, idx);
                      return (
                        <td key={idx} className="px-3 py-2 text-center align-top">
                          {isEditing ? (
                            <input type="number" value={quotaValue} onChange={(e) => handleCustomerQuotaChange(customer.code, idx, e.target.value)} className={`w-16 px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} min="0" step="1" />
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${quotaValue > 0 ? (isDark ? 'bg-blue-500/80 text-white' : 'bg-blue-500 text-white') : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>{quotaValue}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center align-top">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>₱</span>
                          <input type="number" value={customer.qtrRebate || 0} onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)} className={`w-16 px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} min="0" step="0.01" />
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${customer.qtrRebate > 0 ? (isDark ? 'bg-emerald-500/80 text-white' : 'bg-emerald-500 text-white') : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>₱{(customer.qtrRebate || 0).toFixed(2)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    // Quarterly table (no Actions column)
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`sticky top-0 border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <tr>
              <th className={`px-3 py-2 text-left text-xs font-bold uppercase tracking-wider min-w-[180px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Customer</th>
              <th className={`px-3 py-2 text-left text-xs font-bold uppercase tracking-wider min-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Code</th>
              {quotaMonths.map((col, index) => (
                <th key={index} className={`px-3 py-2 text-center text-xs font-bold uppercase tracking-wider min-w-[150px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <div className="font-bold text-xs whitespace-nowrap">{col.dates || col.name || `Period ${index + 1}`}</div>
                </th>
              ))}
              <th className={`px-3 py-2 text-center text-xs font-bold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>QTR Rebate</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
            {rebateDetails.customers.map((customer, i) => {
              const customerCode = customer.code || `CUST-${i}`;
              const isEditing = editingCustomers[customerCode] || false;
              return (
                <tr key={i} className={`transition-colors duration-150 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                        {(customer.name && customer.name.charAt(0)) || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{customer.name || 'Unknown Customer'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className={`text-xs px-1.5 py-0.5 rounded font-medium truncate inline-block max-w-full ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{customer.code || 'N/A'}</code>
                  </td>
                  {quotaMonths.map((month, idx) => {
                    const quotaValue = getQuotaValue(customer, idx);
                    return (
                      <td key={idx} className="px-3 py-2 text-center align-top">
                        {isEditing ? (
                          <input type="number" value={quotaValue} onChange={(e) => handleCustomerQuotaChange(customer.code, idx, e.target.value)} className={`w-16 px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} min="0" step="1" />
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${quotaValue > 0 ? (isDark ? 'bg-blue-500/80 text-white' : 'bg-blue-500 text-white') : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>{quotaValue}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center align-top">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>₱</span>
                        <input type="number" value={customer.qtrRebate || 0} onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)} className={`w-16 px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} min="0" step="0.01" />
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${customer.qtrRebate > 0 ? (isDark ? 'bg-emerald-500/80 text-white' : 'bg-emerald-500 text-white') : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>₱{(customer.qtrRebate || 0).toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── MODIFIED: Incremental Customer Table (Actions column removed) ─────
  const renderIncrementalCustomerTable = ({ access } = {}) => {
    const isDark = theme === 'dark';
    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Users size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-slate-300'}`} />
            <h5 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>No Customers Found</h5>
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>No customers are associated with this rebate program.</p>
          </div>
        </div>
      );
    }
    const rangeColors = {
      1: isDark ? { text: 'text-blue-300', badge: 'bg-blue-700 text-white' } : { text: 'text-blue-700', badge: 'bg-blue-500 text-white' },
      2: isDark ? { text: 'text-amber-300', badge: 'bg-amber-700 text-white' } : { text: 'text-amber-700', badge: 'bg-amber-500 text-white' },
      3: isDark ? { text: 'text-emerald-300', badge: 'bg-emerald-700 text-white' } : { text: 'text-emerald-700', badge: 'bg-emerald-500 text-white' },
    };
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`sticky top-0 border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <tr>
              <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest min-w-[180px] max-w-[180px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Customer</th>
              <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest min-w-[100px] max-w-[100px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Code</th>
              <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest min-w-[100px] max-w-[100px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Qtr Rebate</th>
              <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quantity Ranges</th>
              <th className={`px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Rebate Per Unit</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
            {rebateDetails.customers.map((customer) => (
              <tr key={customer.code} className={`transition-colors duration-150 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                <td className="px-4 py-3 align-middle max-w-[180px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md text-white flex items-center justify-center font-semibold text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                      {customer.name?.charAt(0) || '?'}
                    </div>
                    <span className={`font-medium text-xs truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{customer.name || 'Unknown Customer'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle max-w-[100px]">
                  <code className={`text-xs px-2 py-0.5 rounded font-semibold border inline-block ${isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{customer.code || 'N/A'}</code>
                </td>
                <td className="px-4 py-3 text-center align-middle max-w-[100px]">
                  {editingCustomers[customer.code] ? (
                    <input type="number" value={customer.qtrRebate || 0} onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)} className={`w-16 px-2 py-1 border rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`} />
                  ) : (
                    <span className={`text-xs px-3 py-1 rounded-lg font-bold inline-block shadow-sm ${isDark ? 'bg-gradient-to-r from-blue-600/80 to-blue-700/80 text-white' : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'}`}>{customer.qtrRebate || 0}</span>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center justify-center gap-1 flex-nowrap">
                    {customer.ranges?.map((range, rangeIndex) => {
                      const colors = rangeColors[range.rangeNo] || rangeColors[1];
                      return (
                        <div key={`${customer.code}-range-${rangeIndex}`} className="flex items-center gap-0.5 flex-shrink-0">
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0 leading-none ${colors.badge}`}>R{range.rangeNo}</span>
                          {editingCustomers[customer.code] ? (
                            <div className="flex items-center gap-0.5">
                              <input type="number" value={range.minQty || 0} onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'minQty', e.target.value)} className={`w-10 px-1 py-0.5 border rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`} title="Min Qty" />
                              <span className={`text-[9px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>–</span>
                              <input type="number" value={range.maxQty || 0} onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'maxQty', e.target.value)} className={`w-10 px-1 py-0.5 border rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`} title="Max Qty" />
                            </div>
                          ) : (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${colors.text} ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>{range.minQty ?? 0}–{range.maxQty ?? 0}</span>
                          )}
                          {rangeIndex < customer.ranges.length - 1 && (<span className={`text-[9px] mx-0.5 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>·</span>)}
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center justify-center gap-1 flex-nowrap">
                    {customer.ranges?.map((range, rangeIndex) => {
                      const colors = rangeColors[range.rangeNo] || rangeColors[1];
                      return (
                        <div key={`${customer.code}-rebate-${rangeIndex}`} className="flex items-center gap-0.5 flex-shrink-0">
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0 leading-none ${colors.badge}`}>R{range.rangeNo}</span>
                          {editingCustomers[customer.code] ? (
                            <input type="number" value={range.rebatePerBag || 0} onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'rebatePerBag', e.target.value)} className={`w-10 px-1 py-0.5 border rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`} />
                          ) : (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${colors.text} ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>{range.rebatePerBag ?? 0}</span>
                          )}
                          {rangeIndex < customer.ranges.length - 1 && (<span className={`text-[9px] mx-0.5 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>·</span>)}
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── MODIFIED: Percentage Customer Table (Actions column removed) ──────
  const renderPercentageCustomerTable = ({ access } = {}) => {
    const isDark = theme === 'dark';
    const isMonthly = rebateDetails?.frequency === 'Monthly';

    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Users size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-slate-300'}`} />
            <h5 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>No Customers Found</h5>
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>No customers are associated with this Percentage rebate program.</p>
          </div>
        </div>
      );
    }

    const getQuotaMonthNames = () => {
      const dateFrom = rebateDetails?.dateFrom || rebateDetails?.rebateDetails?.dateFrom || selectedRebate?.from;
      const frequency = rebateDetails?.frequency || 'Quarterly';
      const firstCustomer = rebateDetails?.customers?.[0];
      let quotaCount = 0;
      if (Array.isArray(firstCustomer?.quotas)) quotaCount = firstCustomer.quotas.length;
      else if (typeof firstCustomer?.quotas === 'object' && firstCustomer?.quotas) quotaCount = Object.keys(firstCustomer.quotas).length;
      if (quotaCount === 0) quotaCount = 3;
      if (!dateFrom) {
        return Array.from({ length: quotaCount }, (_, i) => ({
          name: `Period ${i + 1}`,
          dates: `Period ${i + 1}`,
          shortLabel: `P${i + 1}`,
          isMonthly: frequency === 'Monthly',
          isQuarterly: frequency === 'Quarterly'
        }));
      }
      const addMonths = (date, n) => {
        const d = new Date(date);
        const day = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, last));
        return d;
      };
      const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fmtFull = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const start = new Date(dateFrom);
      const labels = [];
      for (let i = 0; i < quotaCount; i++) {
        let sliceStart, sliceEnd;
        if (frequency === 'Quarterly') {
          sliceStart = addMonths(start, i);
          const nextStart = addMonths(start, i + 1);
          sliceEnd = new Date(nextStart);
          sliceEnd.setDate(sliceEnd.getDate() - 1);
        } else {
          sliceStart = addMonths(start, i);
          const nextStart = addMonths(start, i + 1);
          sliceEnd = new Date(nextStart);
          sliceEnd.setDate(sliceEnd.getDate() - 1);
        }
        const dateRange = `${fmtShort(sliceStart)} – ${fmtFull(sliceEnd)}`;
        labels.push({
          name: dateRange,
          dates: dateRange,
          shortLabel: dateRange,
          monthName: sliceStart.toLocaleDateString('en-US', { month: 'long' }),
          year: sliceStart.getFullYear(),
          isMonthly: frequency === 'Monthly',
          isQuarterly: frequency === 'Quarterly',
          index: i,
          startDate: sliceStart,
          endDate: sliceEnd
        });
      }
      return labels;
    };

    const quotaMonths = getQuotaMonthNames();

    const getQuotaValue = (customer, monthIndex) => {
      if (!customer.quotas) return 0;
      const monthName = typeof quotaMonths[monthIndex] === 'object' ? quotaMonths[monthIndex].name : quotaMonths[monthIndex];
      if (Array.isArray(customer.quotas)) return customer.quotas[monthIndex] || 0;
      if (typeof customer.quotas === 'object') {
        if (customer.quotas[monthName] !== undefined) return customer.quotas[monthName] || 0;
        const numericKey = monthIndex + 1;
        if (customer.quotas[numericKey] !== undefined) return customer.quotas[numericKey] || 0;
        const monthKey = `Month${numericKey}`;
        if (customer.quotas[monthKey] !== undefined) return customer.quotas[monthKey] || 0;
      }
      return 0;
    };

    if (isMonthly) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`sticky top-0 border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <tr>
                <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider min-w-[180px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Customer</th>
                <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider min-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Code</th>
                {quotaMonths.map((month, index) => (
                  <th key={index} className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[130px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className="font-bold text-sm">{month.dates || month.name || `Month ${index + 1}`}</div>
                  </th>
                ))}
                <th className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>QTR Rebate</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
              {rebateDetails.customers.map((customer, index) => {
                const customerCode = customer.code || `CUST-${index}`;
                const isEditing = editingCustomers[customerCode] || false;
                return (
                  <tr key={index} className={`transition-colors duration-150 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customer.color || '#10b981' }}>
                          {customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`font-medium text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{customer.name || 'Unknown Customer'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code className={`text-xs px-1.5 py-0.5 rounded font-medium truncate inline-block max-w-full ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{customerCode}</code>
                    </td>
                    {quotaMonths.map((month, idx) => {
                      const quotaValue = getQuotaValue(customer, idx);
                      return (
                        <td key={idx} className="px-3 py-2 text-center align-top">
                          {isEditing ? (
                            <input type="number" value={quotaValue} onChange={(e) => handleCustomerQuotaChange(customerCode, idx, e.target.value)} className={`w-16 px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} min="0" step="1" />
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${quotaValue > 0 ? (isDark ? 'bg-emerald-500/80 text-white' : 'bg-emerald-500 text-white') : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>{quotaValue}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center align-top">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>₱</span>
                          <input type="number" value={customer.qtrRebate || 0} onChange={(e) => handleCustomerQtrRebateChange(customerCode, e.target.value)} className={`w-16 px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} min="0" step="0.01" />
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${customer.qtrRebate > 0 ? (isDark ? 'bg-blue-500/80 text-white' : 'bg-blue-500 text-white') : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>₱{parseFloat(customer.qtrRebate || 0).toFixed(2)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    // Quarterly version
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`sticky top-0 border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <tr>
              <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider min-w-[180px] max-w-[180px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Customer</th>
              <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Code</th>
              {quotaMonths.map((month, index) => (
                <th key={index} className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[90px] max-w-[90px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{month}</th>
              ))}
              <th className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>QTR Rebate</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
            {rebateDetails.customers.map((customer, index) => {
              const customerCode = customer.code || `CUST-${index}`;
              const customerName = customer.name || 'Unknown Customer';
              const customerColor = customer.color || '#10b981';
              const qtrRebate = customer.qtrRebate !== undefined ? customer.qtrRebate : 0;
              const isEditing = editingCustomers[customerCode] || false;
              let quotas = [];
              if (Array.isArray(customer.quotas)) quotas = customer.quotas;
              else if (customer.quotas && typeof customer.quotas === 'object') quotas = Object.values(customer.quotas);
              while (quotas.length < 3) quotas.push(0);
              return (
                <tr key={index} className={`transition-colors duration-150 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customerColor }}>
                        {customerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{customerName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className={`text-xs px-1.5 py-0.5 rounded font-medium truncate inline-block max-w-full ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{customerCode}</code>
                  </td>
                  {quotaMonths.map((month, monthIndex) => {
                    const quotaValue = getQuotaValue(customer, monthIndex);
                    return (
                      <td key={monthIndex} className="px-3 py-2 text-center align-top">
                        {isEditing ? (
                          <input type="number" value={quotaValue} onChange={(e) => handleCustomerQuotaChange(customerCode, monthIndex, e.target.value)} className={`w-16 px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} min="0" step="1" />
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${quotaValue > 0 ? (isDark ? 'bg-emerald-500/80 text-white' : 'bg-emerald-500 text-white') : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>{quotaValue}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center align-top">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>₱</span>
                        <input type="number" value={qtrRebate} onChange={(e) => handleCustomerQtrRebateChange(customerCode, e.target.value)} className={`w-16 px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} min="0" step="0.01" />
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${qtrRebate > 0 ? (isDark ? 'bg-blue-500/80 text-white' : 'bg-blue-500 text-white') : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>₱{parseFloat(qtrRebate).toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── MODIFIED: Fixed Items Table (Actions column removed) ──────────────
  const renderFixedItemsTable = ({ access } = {}) => {
    const isDark = theme === 'dark';
    if (!rebateDetails?.items || rebateDetails.items.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Blocks size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-slate-300'}`} />
            <h5 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>No Items Found</h5>
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>No items are associated with this Fixed rebate program.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`sticky top-0 border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <tr>
              <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider min-w-[180px] max-w-[180px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Item</th>
              <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Code</th>
              <th className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Qty Per Unit</th>
              <th className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Unit of Measure</th>
              <th className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Rebate Per Unit</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
            {rebateDetails.items.map((item, idx) => {
              const rebatePerBagValue = item.rebatePerBag || item.rebate || 0;
              return (
                <tr key={idx} className={`transition-colors duration-150 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2 w-full">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 ${isDark ? 'bg-gradient-to-br from-blue-900/30 to-blue-900/30' : 'bg-gradient-to-br from-blue-100 to-blue-200'}`}>
                        <Blocks size={10} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingItems[item.code] ? (
                          <input type="text" value={item.description} onChange={(e) => handleItemChange(item.code, 'description', e.target.value)} className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`} />
                        ) : (
                          <div className={`font-medium text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className={`text-xs px-1.5 py-0.5 rounded font-medium truncate inline-block max-w-full ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{item.code}</code>
                  </td>
                  <td className="px-3 py-2 text-center align-top">
                    {editingItems[item.code] ? (
                      <input type="number" value={item.unitPerQty} onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)} className={`w-12 px-1 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} />
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900'}`}>{item.unitPerQty}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center align-top">
                    {editingItems[item.code] ? (
                      <input type="text" value={item.uom || ''} onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)} className={`w-20 px-1 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} />
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900'}`}>{item.uom || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center align-top">
                    {editingItems[item.code] ? (
                      <div className="flex items-center gap-0.5 justify-center">
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>₱</span>
                        <input type="number" step="0.01" value={rebatePerBagValue} onChange={(e) => handleItemChange(item.code, 'rebatePerBag', e.target.value)} className={`w-12 px-1 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} />
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${isDark ? 'bg-emerald-500/80 text-white' : 'bg-emerald-500 text-white'}`}>₱{rebatePerBagValue.toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── MODIFIED: Incremental Items Table (Actions column removed) ────────
  const renderIncrementalItemsTable = ({ access } = {}) => {
    const isDark = theme === 'dark';
    if (!rebateDetails?.items || rebateDetails.items.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Blocks size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-slate-300'}`} />
            <h5 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>No Items Found</h5>
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>No items are associated with this rebate program.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="h-full overflow-x-auto">
        <table className="w-full">
          <thead className={`sticky top-0 border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <tr>
              <th className={`px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest min-w-[120px] max-w-[140px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Item</th>
              <th className={`px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest min-w-[60px] max-w-[80px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Code</th>
              <th className={`px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest min-w-[60px] max-w-[80px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Qty Per Unit</th>
              <th className={`px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest min-w-[60px] max-w-[80px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Unit of Measure</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
            {rebateDetails.items.map((item) => (
              <tr key={item.code} className={`transition-colors duration-150 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                <td className="px-3 py-3 align-middle max-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 shadow-sm ${isDark ? 'bg-violet-900/40' : 'bg-violet-50'}`}>
                      <Blocks size={11} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
                    </div>
                    <span className={`font-medium text-[11px] truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.description}</span>
                  </div>
                </td>
                <td className="px-3 py-3 align-middle max-w-[80px]">
                  <code className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border inline-block ${isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{item.code}</code>
                </td>
                <td className="px-3 py-3 text-center align-middle max-w-[80px]">
                  {editingItems[item.code] ? (
                    <input type="number" value={item.unitPerQty} onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)} className={`w-10 px-1 py-0.5 border rounded text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`} />
                  ) : (
                    <span className={`text-[11px] px-2 py-0.5 rounded-lg font-bold inline-block shadow-sm ${isDark ? 'bg-gradient-to-r from-violet-600/80 to-violet-700/80 text-white' : 'bg-gradient-to-r from-violet-500 to-violet-600 text-white'}`}>{item.unitPerQty}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center align-middle max-w-[80px]">
                  {editingItems[item.code] ? (
                    <input type="text" value={item.uom || ''} onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)} className={`w-12 px-1 py-0.5 border rounded text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} />
                  ) : (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium inline-block text-center min-w-8 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900'}`}>{item.uom || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── MODIFIED: Percentage Items Table (Actions column removed) ─────────
  const renderPercentageItemsTable = ({ access } = {}) => {
    const isDark = theme === 'dark';
    if (!rebateDetails?.items || rebateDetails.items.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Blocks size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-slate-300'}`} />
            <h5 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>No Items Found</h5>
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>No items are associated with this Percentage rebate program.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`sticky top-0 border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <tr>
              <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider min-w-[180px] max-w-[180px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Item</th>
              <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Code</th>
              <th className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Qty Per Unit</th>
              <th className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Unit of Measure</th>
              <th className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider min-w-[100px] max-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Percentage</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
            {rebateDetails.items.map((item, idx) => (
              <tr key={idx} className={`transition-colors duration-150 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-2 w-full">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 ${isDark ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/30' : 'bg-gradient-to-br from-green-100 to-emerald-200'}`}>
                      <Blocks size={10} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <code className={`text-xs px-1.5 py-0.5 rounded font-medium truncate inline-block max-w-full ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{item.code}</code>
                </td>
                <td className="px-3 py-2 text-center align-top">
                  {editingItems[item.code] ? (
                    <input type="number" value={item.unitPerQty || 1} onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)} className={`w-12 px-1 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} />
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900'}`}>{item.unitPerQty || 1}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center align-top">
                  {editingItems[item.code] ? (
                    <input type="text" value={item.uom || ''} onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)} className={`w-20 px-1 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} />
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900'}`}>{item.uom || '—'}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center align-top">
                  {editingItems[item.code] ? (
                    <div className="flex items-center gap-0.5 justify-center">
                      <input type="number" value={item.percentage || 0} onChange={(e) => handleItemChange(item.code, 'percentage', e.target.value)} className={`w-12 px-1 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} />
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>%</span>
                    </div>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${isDark ? 'bg-emerald-500/80 text-white' : 'bg-emerald-500 text-white'}`}>{item.percentage || 0}%</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ---------- The rest of the functions (transaction tables etc.) remain unchanged ----------
  const renderTransactionTable = () => {
    if (!modalCustomer || !modalCustomer.rebateType) {
      return (
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          No customer data available
        </div>
      );
    }
    const isMonthly = modalCustomer.frequency === 'Monthly' || modalCustomer.details?.rebateDetails?.frequency === 'Monthly';
    if (isMonthly) {
      return null;
    }
    if (detailedTransactions.length > 0 && detailedTransactions[0]?.RebateType !== modalCustomer.rebateType) {
      console.warn('Data type mismatch, resetting...');
      setDetailedTransactions([]);
      return (
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading data...
        </div>
      );
    }
    const isIncremental = modalCustomer.rebateType === 'Incremental';
    const isPercentage = modalCustomer.rebateType === 'Percentage';
    const isFixed = modalCustomer.rebateType === 'Fixed';
    if (loadingTransactions[`${modalCustomer.code}_transactions`]) {
      return (
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading transaction data...
        </div>
      );
    }
    if (isIncremental) {
      return renderIncrementalTransactionTable();
    } else if (isPercentage) {
      return renderPercentageTransactionTable();
    } else if (isFixed) {
      return renderFixedTransactionTable();
    } else {
      return (
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Unknown rebate type: {modalCustomer.rebateType}
        </div>
      );
    }
  };

  const renderIncrementalTransactionTable = ({ access } = {}) => {
    return (
      <table className="w-full text-xs">
        <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gray-50'}`}>
          <tr className={`font-semibold uppercase tracking-wider border-b ${theme === 'dark' ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
            <th className="px-6 py-2 text-left w=[12%]">Date</th>
            <th className="px-3 py-2 text-left w=[25%]">Item</th>
            <th className="px-3 py-2 text-center w=[10%]">Act. Sales</th>
            <th className="px-3 py-2 text-center w=[12%]">Qty REB</th>
            <th className="px-3 py-2 text-center w=[12%]">Qty Bal</th>
            <th className="px-3 py-2 text-center w=[16%]">Progress</th>
            <th className="px-3 py-2 text-center w=[15%]">Status</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'}`}>
          {paginatedTransactions.length > 0 ? (
            paginatedTransactions.map((transaction, index) => {
              const prevTransaction = index > 0 ? paginatedTransactions[index - 1] : null;
              const isNewMonth = transaction.IsNewMonth || (prevTransaction && prevTransaction.MonthKey !== transaction.MonthKey);
              const itemName = transaction.Item || transaction.ItemName || transaction.item || transaction.description || transaction.Description || 'N/A';
              return (
                <tr key={index} className={`${theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} ${isNewMonth ? theme === 'dark' ? 'border-t-2 border-gray-600' : 'border-t-2 border-gray-300' : ''}`}>
                  <td className="px-6 py-2">
                    <div className={`font-medium ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{transaction.Date || 'N/A'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className={`font-medium truncate ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{itemName}</div>
                    <div className={`text-[10px] truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{transaction.ItemCode || ''}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{formatDecimal(transaction.ActualSales)}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${theme === 'dark' ? 'bg-purple-900/30 text-purple-300 border-purple-700' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>{formatDecimal(transaction.QtyForReb)}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-bold rounded border ${transaction.QtyBal > 0 ? (theme === 'dark' ? 'bg-orange-900/30 text-orange-300 border-orange-700' : 'bg-orange-50 text-orange-700 border-orange-100') : (theme === 'dark' ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-50 text-gray-600 border-gray-200')}`}>{formatDecimal(transaction.QtyBal)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <div className={`flex-1 rounded-full h-1.5 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div className={`h-1.5 rounded-full ${(parseFloat(transaction.Progress) || 0) >= 100 ? 'bg-green-500' : (parseFloat(transaction.Progress) || 0) > 0 ? 'bg-yellow-500' : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} style={{ width: `${Math.min(parseFloat(transaction.Progress) || 0, 100)}%` }}></div>
                        </div>
                        <span className={`font-bold min-w-[30px] text-right text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{(parseFloat(transaction.Progress) || 0).toFixed(0)}%</span>
                      </div>
                      {transaction.CurrentRange && (
                        <div className={`text-[10px] text-center font-medium ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>Range {transaction.CurrentRange}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-xs ${transaction.EligibilityStatus === 'Eligible' ? (theme === 'dark' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-green-100 text-green-800') : transaction.EligibilityStatus === 'Progressing' ? (theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30' : 'bg-yellow-100 text-yellow-800') : (theme === 'dark' ? 'bg-red-900/30 text-red-300 border border-red-700/30' : 'bg-red-100 text-red-800')}`}>{transaction.StatusMessage}</span>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center">
                <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>No transactions found</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  const renderFixedTransactionTable = ({ access } = {}) => {
    return (
      <table className="w-full text-xs">
        <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gray-50'}`}>
          <tr className={`font-semibold uppercase tracking-wider border-b ${theme === 'dark' ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
            <th className="px-6 py-2 text-left w=[12%]">Date</th>
            <th className="px-3 py-2 text-left w=[25%]">Item</th>
            <th className="px-3 py-2 text-center w=[10%]">Act. Sales</th>
            <th className="px-3 py-2 text-center w=[12%]">Qty REB</th>
            <th className="px-3 py-2 text-center w=[12%]">Qty Bal</th>
            <th className="px-3 py-2 text-center w=[16%]">Progress</th>
            <th className="px-3 py-2 text-center w=[15%]">Status</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'}`}>
          {paginatedTransactions.length > 0 ? (
            paginatedTransactions.map((transaction, index) => {
              const prevTransaction = index > 0 ? paginatedTransactions[index - 1] : null;
              const isNewMonth = transaction.IsNewMonth || (prevTransaction && prevTransaction.MonthKey !== transaction.MonthKey);
              const progressPercentage = transaction.MonthQuota > 0 ? Math.min((transaction.QtyBal / transaction.MonthQuota) * 100, 100) : 0;
              const formattedProgress = parseFloat(progressPercentage.toFixed(2));
              const itemName = transaction.Item || 'N/A';
              const displayItemName = transaction.Is25kgItem ? `${itemName} (25kg)` : itemName;
              return (
                <tr key={index} className={`${theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} ${isNewMonth ? theme === 'dark' ? 'border-t-2 border-gray-600' : 'border-t-2 border-gray-300' : ''}`}>
                  <td className="px-6 py-2">
                    <div className={`font-medium ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{transaction.Date || 'N/A'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className={`font-medium truncate ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{displayItemName}</div>
                    <div className={`text-[10px] truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{transaction.ItemCode || ''}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{formatDecimal(transaction.ActualSales)}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${transaction.QtyForReb > 0 ? (theme === 'dark' ? 'bg-purple-900/30 text-purple-300 border-purple-700' : 'bg-purple-50 text-purple-700 border-purple-100') : (theme === 'dark' ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-50 text-gray-600 border-gray-200')}`}>{formatDecimal(transaction.QtyForReb)}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-bold rounded border ${transaction.QtyBal > 0 ? (transaction.QtyBal >= transaction.MonthQuota ? (theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300') : (theme === 'dark' ? 'bg-orange-900/30 text-orange-300 border-orange-700' : 'bg-orange-50 text-orange-700 border-orange-100')) : (theme === 'dark' ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-50 text-gray-600 border-gray-200')}`}>{formatDecimal(transaction.QtyBal)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <div className={`flex-1 rounded-full h-1.5 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div className={`h-1.5 rounded-full ${progressPercentage >= 100 ? 'bg-green-500' : progressPercentage > 0 ? 'bg-yellow-500' : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} style={{ width: `${progressPercentage}%` }}></div>
                        </div>
                        <span className={`font-bold min-w-[30px] text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formattedProgress}%</span>
                      </div>
                      <div className={`text-[10px] text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{formatDecimal(transaction.QtyBal)} / {transaction.MonthQuota}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-xs ${formattedProgress >= 100 ? (theme === 'dark' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-green-100 text-green-800') : formattedProgress >= 70 ? (theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30' : 'bg-yellow-100 text-yellow-800') : (theme === 'dark' ? 'bg-red-900/30 text-red-300 border border-red-700/30' : 'bg-red-100 text-red-800')}`}>{formattedProgress >= 100 ? 'Eligible' : formattedProgress >= 70 ? 'On Track' : 'Not Eligible'}</span>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center">
                <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>No transactions found</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  const renderPercentageTransactionTable = ({ access } = {}) => {
    if (detailedTransactions.length === 0 || detailedTransactions.every(t => t.Item === 'No Transactions' || t.IsEmptyData || !t.ItemCode)) {
      return (
        <table className="w-full text-xs">
          <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gray-50'}`}>
            <tr className={`font-semibold uppercase tracking-wider border-b ${theme === 'dark' ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
              <th className="px-6 py-2 text-left w=[12%]">Date</th>
              <th className="px-3 py-2 text-left w=[25%]">Item</th>
              <th className="px-3 py-2 text-center w=[10%]">Act. Sales</th>
              <th className="px-3 py-2 text-center w=[12%]">Qty REB</th>
              <th className="px-3 py-2 text-center w=[12%]">Qty Bal</th>
              <th className="px-3 py-2 text-center w=[16%]">Progress</th>
              <th className="px-3 py-2 text-center w=[15%]">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center">
                <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>No transactions found</div>
              </td>
            </tr>
          </tbody>
        </table>
      );
    }
    const monthlyQuotas = getFilteredMonthlyQuotas();
    const transactionsByMonth = {};
    detailedTransactions.forEach(transaction => {
      const monthKey = transaction.MonthKey || transaction.monthIndex || 1;
      const monthName = transaction.MonthName || `Month ${monthKey}`;
      if (!transactionsByMonth[monthKey]) {
        const monthQuotaData = monthlyQuotas.find(q => q.monthKey === monthKey || q.monthIndex === monthKey || q.monthName === monthName);
        const quota = monthQuotaData?.quota || monthQuotaData?.target || 0;
        transactionsByMonth[monthKey] = { monthKey, monthName, quota, totalQtyForReb: 0, transactions: [], cumulativeQty: 0, progress: 0 };
      }
      transactionsByMonth[monthKey].transactions.push(transaction);
      transactionsByMonth[monthKey].totalQtyForReb += transaction.QtyForReb || 0;
    });
    Object.keys(transactionsByMonth).forEach(monthKey => {
      const monthData = transactionsByMonth[monthKey];
      monthData.cumulativeQty = monthData.totalQtyForReb;
      if (monthData.quota > 0) {
        monthData.progress = Math.min((monthData.cumulativeQty / monthData.quota) * 100, 100);
        if (monthData.cumulativeQty >= monthData.quota) monthData.progress = 100;
      } else monthData.progress = 0;
    });
    const flattenedTransactions = [];
    Object.keys(transactionsByMonth).sort().forEach(monthKey => {
      const monthData = transactionsByMonth[monthKey];
      monthData.transactions.sort((a, b) => new Date(a.Date) - new Date(b.Date));
      let monthRunningTotal = 0;
      monthData.transactions.forEach((transaction, index) => {
        const isFirstInMonth = index === 0;
        const qtyForReb = transaction.QtyForReb || 0;
        monthRunningTotal += qtyForReb;
        let rowProgress = 0;
        if (monthData.quota > 0) {
          rowProgress = Math.min((monthRunningTotal / monthData.quota) * 100, 100);
          if (monthRunningTotal >= monthData.quota) rowProgress = 100;
        }
        let eligibilityStatus = 'Not Eligible';
        if (rowProgress >= 100) eligibilityStatus = 'Eligible';
        else if (rowProgress >= 70) eligibilityStatus = 'On Track';
        else if (rowProgress > 0) eligibilityStatus = 'Not Eligible';
        const actualSales = transaction.ActualSales || 0;
        const percentage = transaction.Percentage || modalCustomer?.details?.rebateDetails?.percentageValue || 0;
        const rebateAmount = (actualSales * percentage) / 100;
        flattenedTransactions.push({
          ...transaction,
          Date: transaction.Date,
          Item: transaction.Item || 'N/A',
          ItemCode: transaction.ItemCode || '',
          ActualSales: actualSales,
          QtyForReb: parseFloat(qtyForReb.toFixed(2)),
          QtyBal: parseFloat(monthRunningTotal.toFixed(2)),
          MonthQtyBal: parseFloat(monthRunningTotal.toFixed(2)),
          MonthQuota: monthData.quota,
          Progress: parseFloat(rowProgress.toFixed(1)),
          MonthProgress: parseFloat(monthData.progress.toFixed(1)),
          EligibilityStatus: eligibilityStatus,
          MonthName: monthData.monthName,
          MonthKey: monthKey,
          IsNewMonth: isFirstInMonth,
          RebateAmount: parseFloat(rebateAmount.toFixed(2)),
          RebateType: 'Percentage',
          Is25kgItem: transaction.Is25kgItem || false,
          UnitPerQty: transaction.UnitPerQty || 1,
          Percentage: percentage
        });
      });
    });
    const paginatedData = flattenedTransactions.slice((transactionCurrentPage - 1) * transactionRowsPerPage, transactionCurrentPage * transactionRowsPerPage);
    return (
      <table className="w-full text-xs">
        <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gray-50'}`}>
          <tr className={`font-semibold uppercase tracking-wider border-b ${theme === 'dark' ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
            <th className="px-6 py-2 text-left w=[12%]">Date</th>
            <th className="px-3 py-2 text-left w=[25%]">Item</th>
            <th className="px-3 py-2 text-center w=[10%]">Act. Sales</th>
            <th className="px-3 py-2 text-center w=[12%]">Qty REB</th>
            <th className="px-3 py-2 text-center w=[12%]">Qty Bal</th>
            <th className="px-3 py-2 text-center w=[16%]">Progress</th>
            <th className="px-3 py-2 text-center w=[15%]">Status</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'}`}>
          {paginatedData.length > 0 ? (
            paginatedData.map((transaction, index) => {
              const prevTransaction = index > 0 ? paginatedData[index - 1] : null;
              const isNewMonth = prevTransaction && prevTransaction.MonthKey !== transaction.MonthKey;
              const itemName = transaction.Item || 'N/A';
              const displayItemName = transaction.Is25kgItem ? `${itemName} (25kg)` : itemName;
              return (
                <tr key={index} className={`${theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} ${isNewMonth ? theme === 'dark' ? 'border-t-2 border-gray-600' : 'border-t-2 border-gray-300' : ''}`}>
                  <td className="px-6 py-2">
                    <div className={`font-medium ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{transaction.Date || 'N/A'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className={`font-medium truncate ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{displayItemName}</div>
                    <div className={`text-[10px] truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{transaction.ItemCode || ''}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{formatDecimal(transaction.ActualSales)}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-medium rounded border ${theme === 'dark' ? 'bg-purple-900/30 text-purple-300 border-purple-700' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>{formatDecimal(transaction.QtyForReb)}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 font-bold rounded border ${transaction.QtyBal > 0 ? (transaction.QtyBal >= transaction.MonthQuota ? (theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300') : (theme === 'dark' ? 'bg-orange-900/30 text-orange-300 border-orange-700' : 'bg-orange-50 text-orange-700 border-orange-100')) : (theme === 'dark' ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-50 text-gray-600 border-gray-200')}`}>{formatDecimal(transaction.QtyBal)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <div className={`flex-1 rounded-full h-1.5 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div className={`h-1.5 rounded-full ${transaction.Progress >= 100 ? 'bg-green-500' : transaction.Progress > 0 ? 'bg-yellow-500' : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} style={{ width: `${Math.min(transaction.Progress, 100)}%` }}></div>
                        </div>
                        <span className={`font-bold min-w-[30px] text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{transaction.Progress.toFixed(1)}%</span>
                      </div>
                      <div className={`text-[10px] text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{formatDecimal(transaction.QtyBal)} / {formatDecimal(transaction.MonthQuota)}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-xs ${transaction.EligibilityStatus === 'Eligible' ? (theme === 'dark' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-green-100 text-green-800') : transaction.EligibilityStatus === 'On Track' ? (theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30' : 'bg-yellow-100 text-yellow-800') : (theme === 'dark' ? 'bg-red-900/30 text-red-300 border border-red-700/30' : 'bg-red-100 text-red-800')}`}>{transaction.EligibilityStatus}</span>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center">
                <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>No transactions found</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  // The JSX return statement (unchanged)
  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 font-poppins text-slate-900">
      <ToastContainer toasts={toasts} removeToast={removeToast} isDark={theme === 'dark'} />

      {loading && <Loading theme={theme} />}

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}
        setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown}
        setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}
        setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${collapsed ? "ml-20" : "ml-64"}`}>
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={vanLogo}
          theme={theme}
        />

        <div className={`pt-16 flex-1 p-8 overflow-auto ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
          <div className={`p-8 w-full max-w-[1600px] mx-auto mt-6 `}>
            <DashboardHeader
              title="Rebate Analytics Dashboard"
              userName={userName}
              userCode={userCode}
              onRefresh={handleRefresh}
              showRefresh={true}
              theme={theme}
            />

<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  <MetricCard
    title="Total Rebate Paid"
    value={dashboardMetrics.totalRebatePaidValue}
    icon={BanknoteArrowUp}
    variant="christmas"
    isCurrency={true}
    subtitle="Total amount disbursed"
    theme={theme}
  />
  <MetricCard
    title="Total Unpaid Rebate"
    value={dashboardMetrics.totalUnpaidRebateValue}
    icon={BanknoteArrowDown}
    variant="christmas"
    isCurrency={true}
    subtitle="Total rebate outstanding"
    theme={theme}
  />
  <MetricCard
    title="Active Customers"
    value={parseInt(dashboardMetrics.activeCustomers) || 0}
    icon={UserCheck}
    variant="christmas"
    subtitle="Engaged customers"
    theme={theme}
    noDecimals={true}
  />
</div>

            <RebateProgramList
              rebates={rebates}
              filteredRebates={filteredRebates}
              rebateSearchTerm={rebateSearchTerm}
              setRebateSearchTerm={setRebateSearchTerm}
              selectedRebateTypeFilter={selectedRebateTypeFilter}
              setSelectedRebateTypeFilter={setSelectedRebateTypeFilter}
              selectedRebateStatusFilter={selectedRebateStatusFilter}
              setSelectedRebateStatusFilter={setSelectedRebateStatusFilter}
              rebateDateFrom={rebateDateFrom}
              setRebateDateFrom={setRebateDateFrom}
              rebateDateTo={rebateDateTo}
              setRebateDateTo={setRebateDateTo}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              theme={theme}
              onRebateClick={handleRebateClick}
              onStatusToggle={handleStatusToggle}
              onClearFilters={clearRebateFilters}
              onApplyFilters={() => {}}
              onLoadRebates={loadDashboardData}
            />

            <StatusSummary
              customers={customers}
              filteredCustomers={filteredCustomers}
              agents={agents}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedAgent={selectedAgent}
              setSelectedAgent={setSelectedAgent}
              selectedRebateType={selectedRebateType}
              setSelectedRebateType={setSelectedRebateType}
              selectedProgressStatus={selectedProgressStatus}
              setSelectedProgressStatus={setSelectedProgressStatus}
              minRebateAmount={minRebateAmount}
              setMinRebateAmount={setMinRebateAmount}
              maxRebateAmount={maxRebateAmount}
              setMaxRebateAmount={setMaxRebateAmount}
              statusSummaryPeriodFrom={statusSummaryPeriodFrom}
              setStatusSummaryPeriodFrom={setStatusSummaryPeriodFrom}
              statusSummaryPeriodTo={statusSummaryPeriodTo}
              setStatusSummaryPeriodTo={setStatusSummaryPeriodTo}
              currentCustomerPage={currentCustomerPage}
              setCurrentCustomerPage={setCurrentCustomerPage}
              itemsPerCustomerPage={itemsPerCustomerPage}
              theme={theme}
              onCustomerClick={handleCustomerClick}
              onClearFilters={clearAllFilters}
              onApplyFilters={applyFilters}
              onFetchData={() => loadCustomerStatus(true)}
              fetchIntervalMs={3000}
              autoFetchEnabled={!selectedRebate && !modalCustomer}
              isLoading={customersLoading}
              selectedProgramStatus={selectedProgramStatus}
              setSelectedProgramStatus={setSelectedProgramStatus}
              showStatus={dbType === "VAN"}
            />
          </div>
        </div>
      </main>

      <RebateDetailsModal
        selectedRebate={selectedRebate}
        setSelectedRebate={setSelectedRebate}
        rebateDetails={rebateDetails}
        setRebateDetails={setRebateDetails}
        originalRebateDetails={originalRebateDetails}
        setOriginalRebateDetails={setOriginalRebateDetails}
        editingCustomers={editingCustomers}
        setEditingCustomers={setEditingCustomers}
        editingItems={editingItems}
        setEditingItems={setEditingItems}
        theme={theme}
        routePath="/Van_Dashboard" 
        renderFixedCustomerTable={renderFixedCustomerTable}
        renderIncrementalCustomerTable={renderIncrementalCustomerTable}
        renderPercentageCustomerTable={renderPercentageCustomerTable}
        renderFixedItemsTable={renderFixedItemsTable}
        renderIncrementalItemsTable={renderIncrementalItemsTable}
        renderPercentageItemsTable={renderPercentageItemsTable}
      />

      {modalCustomer && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm transition-all duration-300 ${theme === 'dark' ? 'bg-black/75' : 'bg-black/60'}`} onClick={() => setModalCustomer(null)}>
          <div className={`flex flex-col rounded-2xl border shadow-2xl w-[88%] max-w-[1400px] h-[92vh] overflow-hidden relative font-sans ${theme === 'dark' ? 'bg-slate-900 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`} onClick={(e) => e.stopPropagation()}>
            {isLoadingCustomer && (
              <div className="absolute inset-0 z-50">
                <Loading theme={theme} />
              </div>
            )}
            <button onClick={() => setModalCustomer(null)} className={`absolute right-4 top-4 z-20 w-8 h-8 flex items-center justify-center rounded-lg border transition-all shadow-sm ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-slate-200' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
              <X size={16} />
            </button>
            <div className={`flex-shrink-0 border-b px-6 py-4 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 shadow">
                  <User size={17} className="text-white" />
                </div>
                <div>
                  <h2 className={`text-sm font-bold leading-none ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Customer Details</h2>
                  <p className={`text-[11px] mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>View and manage customer monthly quotas, transactions, and earned rebates</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-rose-900/20 border-rose-700/30' : 'bg-rose-50 border-rose-200'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-rose-500 to-red-600 shadow-sm">
                    <User size={14} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Customer</p>
                    <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{modalCustomer.customer}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-blue-900/20 border-blue-700/30' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                    <FileText size={14} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Rebate Type</p>
                    <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{modalCustomer.rebateType}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-amber-900/20 border-amber-700/30' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm">
                    <UserCheck size={14} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Sales Employee</p>
                    <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{modalCustomer.agent}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-violet-900/20 border-violet-700/30' : 'bg-violet-50 border-violet-200'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                    <Clock size={14} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Frequency</p>
                    <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{modalCustomer.frequency || 'Quarterly'}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                    <Calendar size={14} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Period</p>
                    <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                      {formatDateRange(modalCustomer.dateFrom, modalCustomer.dateTo) || formatDateRange(modalCustomer.details?.rebateDetails?.dateFrom, modalCustomer.details?.rebateDetails?.dateTo) || 'Not specified'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className={`flex-shrink-0 border-b px-6 py-2.5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center gap-1 rounded-lg p-1 w-fit ${theme === 'dark' ? 'bg-slate-700/60' : 'bg-slate-100'}`}>
                  {[
                    { icon: TrendingUp, label: 'Analytics', value: 'quota' },
                    { icon: FileText, label: 'Transaction Log', value: 'transaction' },
                    { icon: CreditCard, label: 'Payout History', value: 'payout' },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => {
                        if (customerModalTab !== tab.value) {
                          setCustomerModalTab(tab.value);
                          if ((tab.value === 'transaction' && detailedTransactions.length === 0) || (tab.value === 'payout' && detailedPayouts.length === 0)) {
                            handleTabChange(tab.value);
                          }
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${customerModalTab === tab.value ? 'bg-blue-600 text-white shadow' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`flex-1 overflow-auto ${theme === 'dark' ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                {customerModalTab === 'quota' && (
                  <VanQuotaPerformance
                    theme={theme}
                    onCustomerClick={handleCustomerClick}
                    customerModalTab={customerModalTab}
                    modalCustomer={modalCustomer}
                    isLoadingCustomer={isLoadingCustomer}
                    getFilteredMonthlyQuotas={getFilteredMonthlyQuotas}
                    formatDecimal={formatDecimal}
                    periodFrom={periodFrom}
                    periodTo={periodTo}
                    setPeriodFrom={setPeriodFrom}
                    setPeriodTo={setPeriodTo}
                    handleApplyPeriodFilter={() => applyPeriodFilter('quota')}
                    isAutoLoading={isAutoLoading}
                  />
                )}
                {customerModalTab === 'transaction' && (
                  <VanTransactionRecords
                    theme={theme}
                    modalCustomer={modalCustomer}
                    filteredTransactions={filteredTransactions}
                    transactionCurrentPage={transactionCurrentPage}
                    setTransactionCurrentPage={setTransactionCurrentPage}
                    transactionRowsPerPage={transactionRowsPerPage}
                    setTransactionRowsPerPage={setTransactionRowsPerPage}
                    isLoading={loadingTransactions[`${modalCustomer?.code}_transactions`] || false}
                    renderTransactionTable={renderTransactionTable}
                    periodFrom={periodFrom}
                    periodTo={periodTo}
                    setPeriodFrom={setPeriodFrom}
                    setPeriodTo={setPeriodTo}
                    handleApplyPeriodFilter={() => applyPeriodFilter('quota')}
                    isAutoLoading={isAutoLoading}
                  />
                )}
                {customerModalTab === 'payout' && (
                  <VanPayoutHistory
                    theme={theme}
                    customerModalTab={customerModalTab}
                    modalCustomer={modalCustomer}
                    paginatedPayouts={paginatedPayouts}
                    filteredPayouts={filteredPayouts}
                    payoutCurrentPage={payoutCurrentPage}
                    setPayoutCurrentPage={setPayoutCurrentPage}
                    payoutRowsPerPage={payoutRowsPerPage}
                    setPayoutRowsPerPage={setPayoutRowsPerPage}
                    editingPayoutId={editingPayoutId}
                    setEditingPayoutId={setEditingPayoutId}
                    editedAmountReleased={editedAmountReleased}
                    setEditedAmountReleased={setEditedAmountReleased}
                    handlePayoutStatusChange={handlePayoutStatusChange}
                    handleSaveAmountReleased={handleSaveAmountReleased}
                    loadDetailedPayoutsData={loadDetailedPayoutsData}
                    formatCurrency={formatCurrency}
                    periodFrom={periodFrom}
                    periodTo={periodTo}
                    setPeriodFrom={setPeriodFrom}
                    setPeriodTo={setPeriodTo}
                    handleApplyPeriodFilter={() => applyPeriodFilter('quota')}
                    isAutoLoading={isAutoLoading}
                    setFilteredPayouts={() => {}}
                    setPaginatedPayouts={() => {}}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Van_Dashboard;