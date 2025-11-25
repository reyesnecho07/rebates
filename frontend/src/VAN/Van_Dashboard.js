import React, { useState, useEffect } from "react";
import {
  Home,
  FileText,
  BarChart2,
  Users,
  Settings,
  User,
  IdCardLanyard,
  LogOut,
  PhilippinePeso,
  BanknoteArrowDown,
  UserCheck,
  X,
  HandCoins,
  Search,
  Blocks,
  Calendar,
  TrendingUp,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Package,
  Edit,
  Check,
  LayoutList,
  Activity,
  Filter
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import Logo from "../Logo";

function Van_Dashboard() {
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("/dashboard");
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");
  const [activeTab, setActiveTab] = useState("customers");
  const [selectedAgent, setSelectedAgent] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [modalCustomer, setModalCustomer] = useState(null);
  const [selectedRebate, setSelectedRebate] = useState(null);
  const [rebateSearchTerm, setRebateSearchTerm] = useState("");
  const [customerModalTab, setCustomerModalTab] = useState("quota");
  const [activeFilter, setActiveFilter] = useState('active');
  
  // State for period filters
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [statusSummaryPeriodFrom, setStatusSummaryPeriodFrom] = useState("");
  const [statusSummaryPeriodTo, setStatusSummaryPeriodTo] = useState("");

  // State for editing
  const [editingCustomers, setEditingCustomers] = useState({});
  const [editingItems, setEditingItems] = useState({});
  const [rebateDetails, setRebateDetails] = useState(null);
  const [originalRebateDetails, setOriginalRebateDetails] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);

  // Comprehensive data structure with proper connections
  const [masterData, setMasterData] = useState({
    // Base customer data - 10 samples
    customers: [

    ],

    // Items data - 10 samples
    items: [

    ],

    // Rebates data - 10 samples
    rebates: [
  
    ],

    // Transaction data with connections - Enhanced with proper amounts and periods
    transactions: [

    ],

    // Payout history with connections to transactions
    payouts: [

    ],

    // Monthly quota data - Complete 12 months for each customer
    monthlyQuotas: [
      // Customer 1 - John Smith

    ],

    // Rebate details structure
    rebateDetails: {
      salesEmployee: "John Smith",
      frequency: "Monthly",
      customers: [

      ],
      items: [

      ]
    }
  });

  const agents = ["John Smith", "Maria Garcia", "David Johnson", "Lisa Chen", "Robert Brown"];
  
  // State for payout history
  const [payoutHistoryData, setPayoutHistoryData] = useState(masterData.payouts);

  // Initialize period filters to show all data by default
  useEffect(() => {
    const allTimeFrom = "2025-01-01";
    const allTimeTo = "2025-12-31";
    
    setPeriodFrom(allTimeFrom);
    setPeriodTo(allTimeTo);
    setStatusSummaryPeriodFrom(allTimeFrom);
    setStatusSummaryPeriodTo(allTimeTo);
    
    // Initialize payout amounts based on transactions
    initializePayoutAmounts();
  }, []);

  // Calculate transaction amounts based on item prices and quantities
  const calculateTransactionAmount = (transaction) => {
    const item = masterData.items.find(i => i.id === transaction.itemId);
    return item ? transaction.quantity * item.price : 0;
  };

  // Initialize payout amounts based on transaction totals
  const initializePayoutAmounts = () => {
    const updatedPayouts = masterData.payouts.map(payout => {
      // Calculate total transactions for this customer in the payout period
      const periodTransactions = masterData.transactions.filter(t => 
        t.customerId === payout.customerId && 
        t.period === payout.period
      );
      
      const totalAmount = periodTransactions.reduce((sum, transaction) => {
        return sum + calculateTransactionAmount(transaction);
      }, 0);
      
      return {
        ...payout,
        amount: totalAmount > 0 ? totalAmount : payout.amount
      };
    });
    
    setPayoutHistoryData(updatedPayouts);
    setMasterData(prev => ({
      ...prev,
      payouts: updatedPayouts
    }));
  };

  // Calculate total transaction amount for a customer in a period
  const calculateTotalTransactionAmount = (customerId, fromDate, toDate) => {
    const transactions = masterData.transactions.filter(t => 
      t.customerId === customerId && 
      new Date(t.date) >= new Date(fromDate) && 
      new Date(t.date) <= new Date(toDate)
    );
    
    return transactions.reduce((total, transaction) => {
      return total + calculateTransactionAmount(transaction);
    }, 0);
  };

  // Calculate total payout amount for a customer in a period
  const calculateTotalPayoutAmount = (customerId, fromDate, toDate) => {
    const payouts = masterData.payouts.filter(p => 
      p.customerId === customerId && 
      new Date(p.date) >= new Date(fromDate) && 
      new Date(p.date) <= new Date(toDate)
    );
    
    return payouts.reduce((total, payout) => total + payout.amount, 0);
  };

  // Calculate pending payout amount for a customer in a period
  const calculatePendingPayoutAmount = (customerId, fromDate, toDate) => {
    const payouts = masterData.payouts.filter(p => 
      p.customerId === customerId && 
      new Date(p.date) >= new Date(fromDate) && 
      new Date(p.date) <= new Date(toDate) &&
      p.status === "Pending"
    );
    
    return payouts.reduce((total, payout) => total + payout.amount, 0);
  };

  // Compute customer metrics with proper connections
  const computeCustomerMetrics = () => {
    return masterData.customers.map(customer => {
      // Calculate total rebate amount from payouts within status summary period
      const totalRebateAmount = calculateTotalPayoutAmount(
        customer.id, 
        statusSummaryPeriodFrom, 
        statusSummaryPeriodTo
      );
      
      // Calculate rebate balance (pending payouts)
      const rebateBalance = calculatePendingPayoutAmount(
        customer.id,
        statusSummaryPeriodFrom,
        statusSummaryPeriodTo
      );
      
      // Calculate paid amount
      const paidAmount = totalRebateAmount - rebateBalance;

      return {
        ...customer,
        rebateAmount: `₱${paidAmount.toLocaleString()}`,
        rebateBalance: `₱${rebateBalance.toLocaleString()}`,
        totalRebateAmount, // For calculations
        paidAmount, // For calculations
        rebateBalanceValue: rebateBalance // For calculations
      };
    });
  };

  // Compute dashboard metrics
  const computeDashboardMetrics = () => {
    const allPayouts = masterData.payouts.filter(p => 
      new Date(p.date) >= new Date(statusSummaryPeriodFrom) && 
      new Date(p.date) <= new Date(statusSummaryPeriodTo)
    );
    
    const totalRebatePaid = allPayouts
      .filter(p => p.status === "Paid")
      .reduce((sum, payout) => sum + payout.amount, 0);
    
    const totalUnpaidRebate = allPayouts
      .filter(p => p.status === "Pending")
      .reduce((sum, payout) => sum + payout.amount, 0);
    
    const activeCustomers = masterData.customers.filter(c => c.rebate === "Eligible").length;

    return {
      totalRebatePaid: `₱${totalRebatePaid.toLocaleString()}`,
      totalUnpaidRebate: `₱${totalUnpaidRebate.toLocaleString()}`,
      activeCustomers: activeCustomers.toString(),
      totalRebatePaidValue: totalRebatePaid,
      totalUnpaidRebateValue: totalUnpaidRebate
    };
  };

  const customersWithMetrics = computeCustomerMetrics();
  const dashboardMetrics = computeDashboardMetrics();

  // Filter transactions based on period
  const getFilteredTransactions = (customerId) => {
    let transactions = masterData.transactions.filter(t => t.customerId === customerId);
    
    if (periodFrom && periodTo) {
      transactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        const fromDate = new Date(periodFrom);
        const toDate = new Date(periodTo);
        return transactionDate >= fromDate && transactionDate <= toDate;
      });
    }
    
    return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Filter payouts based on period
  const getFilteredPayouts = (customerId) => {
    let payouts = payoutHistoryData.filter(p => p.customerId === customerId);
    
    if (periodFrom && periodTo) {
      payouts = payouts.filter(p => {
        const payoutDate = new Date(p.date);
        const fromDate = new Date(periodFrom);
        const toDate = new Date(periodTo);
        return payoutDate >= fromDate && payoutDate <= toDate;
      });
    }
    
    return payouts.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Filter monthly quotas based on period
  const getFilteredMonthlyQuotas = (customerId) => {
    let quotas = masterData.monthlyQuotas.filter(q => q.customerId === customerId);
    
    if (periodFrom && periodTo) {
      quotas = quotas.filter(q => {
        const quotaDate = new Date(q.month + '-01');
        const fromDate = new Date(periodFrom);
        const toDate = new Date(periodTo);
        return quotaDate >= fromDate && quotaDate <= toDate;
      });
    }
    
    return quotas.sort((a, b) => a.month.localeCompare(b.month));
  };

  // Generate smooth line path for the chart - ACHIEVED (Green)
  const generateLinePath = (data) => {
    if (data.length === 0) return '';
    
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - item.achieved;
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

  // Generate smooth line path for TARGET QUOTA (Blue)
  const generateTargetLinePath = (data) => {
    if (data.length === 0) return '';
    
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - item.quota;
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

  // Generate area path for gradient fill
  const generateAreaPath = (data) => {
    const linePath = generateLinePath(data);
    if (!linePath) return '';
    
    return `${linePath} L 100 100 L 0 100 Z`;
  };

  // Initialize rebate details when a rebate is selected
  useEffect(() => {
    if (selectedRebate) {
      const detailsCopy = JSON.parse(JSON.stringify(masterData.rebateDetails));
      setRebateDetails(detailsCopy);
      setOriginalRebateDetails(JSON.parse(JSON.stringify(masterData.rebateDetails)));
      setEditingCustomers({});
      setEditingItems({});
    }
  }, [selectedRebate]);

  // Get user from localStorage
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
    const username = storedUser.username || "Unknown User";
    const role = storedUser.role || "Unknown Role";

    setUserName(username);
    setUserCode(role);

    const getInitials = (name) => {
      if (!name) return "??";
      const parts = name.trim().split(" ");
      if (parts.length === 1) {
        return parts[0][0].toUpperCase();
      }
      return (
        parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
      );
    };

    setInitials(getInitials(username));
  }, []);

  // Edit handlers for customers
  const handleEditCustomer = (customerCode) => {
    setEditingCustomers(prev => ({
      ...prev,
      [customerCode]: true
    }));
  };

  const handleCancelEditCustomer = (customerCode) => {
    setEditingCustomers(prev => {
      const newEditing = { ...prev };
      delete newEditing[customerCode];
      return newEditing;
    });
    
    // Restore original data
    if (originalRebateDetails) {
      const originalCustomer = originalRebateDetails.customers.find(c => c.code === customerCode);
      if (originalCustomer) {
        setRebateDetails(prev => ({
          ...prev,
          customers: prev.customers.map(c => 
            c.code === customerCode ? { ...originalCustomer } : c
          )
        }));
      }
    }
  };

  const handleSaveCustomer = (customerCode) => {
    setEditingCustomers(prev => {
      const newEditing = { ...prev };
      delete newEditing[customerCode];
      return newEditing;
    });
    
    // Update original data
    if (rebateDetails) {
      const updatedCustomer = rebateDetails.customers.find(c => c.code === customerCode);
      if (updatedCustomer) {
        setOriginalRebateDetails(prev => ({
          ...prev,
          customers: prev.customers.map(c => 
            c.code === customerCode ? { ...updatedCustomer } : c
          )
        }));
      }
    }
    
    setSaveMessage("Customer quotas updated successfully!");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleCustomerQuotaChange = (customerCode, quotaIndex, value) => {
    const numericValue = parseInt(value) || 0;
    setRebateDetails(prev => ({
      ...prev,
      customers: prev.customers.map(customer => 
        customer.code === customerCode 
          ? {
              ...customer,
              quotas: customer.quotas.map((quota, idx) => 
                idx === quotaIndex ? numericValue : quota
              )
            }
          : customer
      )
    }));
  };

  // Handle status change for payout history
  const handleStatusChange = (payoutId, newStatus) => {
    const updatedData = payoutHistoryData.map(payout => 
      payout.id === payoutId ? { ...payout, status: newStatus } : payout
    );
    setPayoutHistoryData(updatedData);
    
    // Update master data as well
    setMasterData(prev => ({
      ...prev,
      payouts: prev.payouts.map(payout =>
        payout.id === payoutId ? { ...payout, status: newStatus } : payout
      )
    }));
    
    // Show success message
    setSaveMessage(`Status updated to ${newStatus} successfully!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Edit handlers for items
  const handleEditItem = (itemCode) => {
    setEditingItems(prev => ({
      ...prev,
      [itemCode]: true
    }));
  };

  const handleCancelEditItem = (itemCode) => {
    setEditingItems(prev => {
      const newEditing = { ...prev };
      delete newEditing[itemCode];
      return newEditing;
    });
    
    // Restore original data
    if (originalRebateDetails) {
      const originalItem = originalRebateDetails.items.find(i => i.code === itemCode);
      if (originalItem) {
        setRebateDetails(prev => ({
          ...prev,
          items: prev.items.map(i => 
            i.code === itemCode ? { ...originalItem } : i
          )
        }));
      }
    }
  };

  const handleSaveItem = (itemCode) => {
    setEditingItems(prev => {
      const newEditing = { ...prev };
      delete newEditing[itemCode];
      return newEditing;
    });
    
    // Update original data
    if (rebateDetails) {
      const updatedItem = rebateDetails.items.find(i => i.code === itemCode);
      if (updatedItem) {
        setOriginalRebateDetails(prev => ({
          ...prev,
          items: prev.items.map(i => 
            i.code === itemCode ? { ...updatedItem } : i
          )
        }));
      }
    }
    
    setSaveMessage("Item details updated successfully!");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleItemChange = (itemCode, field, value) => {
    setRebateDetails(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.code === itemCode 
          ? {
              ...item,
              [field]: field === 'rebate' ? parseInt(value) || 0 : value
            }
          : item
      )
    }));
  };

  // Close modal and reset everything
  const handleCloseModal = () => {
    setSelectedRebate(null);
    setRebateDetails(null);
    setOriginalRebateDetails(null);
    setEditingCustomers({});
    setEditingItems({});
    setSaveMessage(null);
  };

  // Apply period filter to customer modal data
  const applyPeriodFilter = () => {
    setSaveMessage("Period filter applied!");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  // Clear period filter - show all data
  const clearPeriodFilter = () => {
    const allTimeFrom = "2025-01-01";
    const allTimeTo = "2025-12-31";
    
    setPeriodFrom(allTimeFrom);
    setPeriodTo(allTimeTo);
    setSaveMessage("Showing all data!");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  // Clear status summary period filter
  const clearStatusSummaryPeriodFilter = () => {
    const allTimeFrom = "2025-01-01";
    const allTimeTo = "2025-12-31";
    
    setStatusSummaryPeriodFrom(allTimeFrom);
    setStatusSummaryPeriodTo(allTimeTo);
    setSaveMessage("Showing all data in status summary!");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  // Filter customers for status summary
  const filteredCustomers = customersWithMetrics.filter((c) => {
    const matchesAgent = selectedAgent === "All" || c.agent === selectedAgent;
    const matchesMonth = selectedMonth === "All" || c.enrollment.includes(selectedMonth);
    
    if (!searchTerm.trim()) {
      return matchesAgent && matchesMonth;
    }

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      c.customer.toLowerCase().includes(searchLower) ||
      c.agent.toLowerCase().includes(searchLower) ||
      c.enrollment.includes(searchTerm) ||
      c.quotaStatus.toLowerCase().includes(searchLower) ||
      c.rebate.toLowerCase().includes(searchLower) ||
      c.progress.toString().includes(searchTerm) ||
      (searchLower.includes('met') && c.quotaStatus === 'Met Quota') ||
      (searchLower.includes('track') && c.quotaStatus === 'On Track') ||
      (searchLower.includes('start') && c.quotaStatus === 'Starting') ||
      (searchLower.includes('eligible') && c.rebate === 'Eligible') ||
      (searchLower.includes('not eligible') && c.rebate === 'Not Eligible');

    return matchesAgent && matchesMonth && matchesSearch;
  });

  const filteredRebates = masterData.rebates.filter(rebate => {
    const matchesSearch = rebate.code.toLowerCase().includes(rebateSearchTerm.toLowerCase()) ||
      (rebate.active ? 'yes' : 'no').includes(rebateSearchTerm.toLowerCase()) ||
      rebate.from.includes(rebateSearchTerm) ||
      rebate.to.includes(rebateSearchTerm);
    
    const matchesActive = 
      activeFilter === 'all' ? true :
      activeFilter === 'active' ? rebate.active :
      activeFilter === 'inactive' ? !rebate.active : true;
    
    return matchesSearch && matchesActive;
  });

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 font-poppins text-slate-900">
      {/* Save Message Toast */}
      {saveMessage && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-gradient-to-r from-emerald-500 to-green-500 text-white px-6 py-3 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-3 backdrop-blur-sm">
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <Check size={14} className="text-white" />
            </div>
            <span className="font-semibold">{saveMessage}</span>
          </div>
        </div>
      )}

      {/* Enhanced Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 flex flex-col transition-all duration-500 z-50 shadow-2xl ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header with Enhanced Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 relative">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400  rounded-xl flex items-center justify-center shadow-lg">
                <img src="/url_logo.png" alt="Logo" className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-white text-lg whitespace-nowrap">
                RebateSystem
              </h2>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-xl bg-slate-700 hover:bg-slate-600 transition-all duration-300 hover:scale-110 ${
              collapsed ? "absolute top-4 left-5" : ""
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-300" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-300" />
            )}
          </button>
        </div>

        <nav className="flex-1 py-6">
          <ul className="space-y-2 px-3">
            {[
              { icon: Home, label: "Dashboard", path: "/van/dashboard" },
              { icon: FileText, label: "Rebate Setup", path: "/van/rebatesetup" },
              { icon: BarChart2, label: "Reports", path: "/van/vanreports" },
              { icon: Users, label: "Customer", path: "/van/customer" },
              { icon: Package, label: "Items", path: "/van/items" },
              { icon: IdCardLanyard, label: "Sales Employee", path: "/van/salesemployee" },
            ].map((item) => (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`flex items-center text-slate-300 px-4 py-3 rounded-xl transition-all duration-300 group hover:bg-slate-700/50 hover:text-white hover:scale-105 ${
                    location.pathname === item.path
                      ? "bg-blue-500/20 text-white border-r-2 border-blue-400 shadow-lg"
                      : ""
                  }`}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                    location.pathname === item.path ? "text-blue-400" : ""
                  }`} />
                  <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                    collapsed ? "opacity-0 w-0" : "opacity-100"
                  }`}>
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto p-4 border-t border-slate-700">
          <ul className="space-y-2">
            {[
              { icon: Settings, label: "Settings", path: "/van/settings" },
              { icon: LogOut, label: "Logout", path: "/login" },
            ].map((item) => (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`flex items-center text-slate-300 px-4 py-3 rounded-xl transition-all duration-300 group hover:bg-slate-700/50 hover:text-white ${
                    activeNav === item.path
                      ? "bg-blue-500/20 text-white border-r-2 border-blue-400"
                      : ""
                  }`}
                  onClick={() => setActiveNav(item.path)}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                    collapsed ? "opacity-0 w-0" : "opacity-100"
                  }`}>
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Enhanced Header */}
        <header 
          className="fixed top-0 right-0 h-16 flex items-center px-8 bg-white/80 backdrop-blur-lg border-b border-slate-200/50 z-40 transition-all duration-500 shadow-sm"
          style={{ 
            left: collapsed ? '80px' : '256px',
            width: collapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
          }}
        >
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Logo size={100} />
          </div>

          {/* Enhanced User Profile */}
          <div className="flex items-center gap-4 ml-auto mr-8">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-base flex items-center justify-center uppercase shadow-lg transition-transform duration-300 hover:scale-105">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex flex-col text-right">
              <p className="text-base font-bold text-slate-800 whitespace-nowrap max-w-[150px]">
                {userName}
              </p>
              <p className="text-xs text-slate-600   rounded-full text-left font-medium">
                {userCode}
              </p>
            </div>
          </div>
        </header>

        {/* Enhanced Content Area */}
        <div className="pt-16 flex-1 p-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 shadow-2xl p-8 w-full max-w-[1600px] mx-auto mt-6">
            {/* Enhanced Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Home size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 bg-clip-text text-transparent">
                    Dashboard
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 font-medium">Welcome back, {userName}! Here's your overview.</p>
                </div>
              </div>
            </div>

            {/* Enhanced Metrics Cards with Animations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { 
                  title: "Total Rebate Paid", 
                  value: dashboardMetrics.totalRebatePaid, 
                  change: "+12% from last month", 
                  icon: PhilippinePeso, 
                  gradient: "from-blue-500 to-blue-600",
                  bgGradient: "from-blue-50 to-blue-100",
                  border: "border-blue-200"
                },
                { 
                  title: "Total Unpaid Rebate",
                  value: dashboardMetrics.totalUnpaidRebate,
                  change: "+8% from last month",
                  icon: BanknoteArrowDown,
                  gradient: "from-emerald-500 to-green-600",
                  bgGradient: "from-emerald-50 to-green-100",
                  border: "border-emerald-200"
                },
                { 
                  title: "Active Customers", 
                  value: dashboardMetrics.activeCustomers, 
                  change: "+15 new this month", 
                  icon: UserCheck, 
                  gradient: "from-purple-500 to-purple-600",
                  bgGradient: "from-purple-50 to-purple-100",
                  border: "border-purple-200"
                }
              ].map((metric, index) => (
                <div 
                  key={index}
                  className={`bg-gradient-to-br ${metric.bgGradient} rounded-2xl p-6 flex items-center justify-between transition-all duration-500 hover:scale-105 hover:shadow-2xl border ${metric.border} group`}
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">{metric.title}</h3>
                    <p className="text-2xl font-bold text-slate-900 mb-1">{metric.value}</p>
                    <p className="text-xs text-slate-600 font-medium">{metric.change}</p>
                  </div>
                  <div className={`w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br ${metric.gradient} shadow-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <metric.icon size={28} color="#fff" />
                  </div>
                </div>
              ))}
            </div>

            {/* Enhanced List of Rebates */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg mb-8">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <LayoutList size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">List of Rebates</h2>
                    <p className="text-sm text-slate-600">Manage and track all rebate programs</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Status:</label>
                    <select 
                      value={activeFilter} 
                      onChange={(e) => setActiveFilter(e.target.value)}
                      className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-w-32 font-poppins shadow-sm"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  
                  <div className="relative flex items-center">
                    <Search size={18} className="absolute left-3 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search rebates..." 
                      value={rebateSearchTerm} 
                      onChange={(e) => setRebateSearchTerm(e.target.value)} 
                      className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm w-64 outline-none transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white font-poppins shadow-sm" 
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <div className="grid grid-cols-4 px-6 py-4 items-center text-sm font-semibold text-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileText size={16} />
                    Rebate Code
                  </div>
                  <div>Status</div>
                  <div>Date From</div>
                  <div>Date To</div>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {filteredRebates.length > 0 ? filteredRebates.map((r, i) => (
                    <div 
                      key={i} 
                      className="grid grid-cols-4 px-6 py-4 items-center text-sm border-b border-slate-100 transition-all duration-300 hover:bg-blue-50 cursor-pointer group hover:scale-[1.02]"
                      onClick={() => setSelectedRebate(r)}
                    >
                      <div className="text-blue-600 font-semibold flex items-center gap-2 transition-all duration-300 group-hover:text-blue-700">
                        <div className="w-2 h-2 bg-blue-500 rounded-full group-hover:scale-150 transition-transform duration-300"></div>
                        {r.code}
                      </div>
                      <div>
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 shadow-sm ${
                          r.active 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                            : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white'
                        }`}>
                          {r.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-slate-600 font-medium text-sm">{r.from}</div>
                      <div className="text-slate-600 font-medium text-sm">{r.to}</div>
                    </div>
                  )) : (
                  <div className="text-center py-16 px-6 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-200 m-4">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                        <HandCoins size={36} className="text-blue-500 animate-bounce" />
                      </div>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-300 rounded-full animate-ping opacity-75"></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-75 delay-150"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping opacity-75 delay-300"></div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <h3 className="text-2xl font-bold text-slate-800">
                        No Rebates Found
                      </h3>
                      <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
                        We couldn't find any rebates matching your current search criteria.
                      </p>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Status Summary */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Activity size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Status Summary</h2>
                    <p className="text-sm text-slate-600">Customer performance and rebate eligibility</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <select 
                    value={selectedAgent} 
                    onChange={(e) => setSelectedAgent(e.target.value)} 
                    className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-w-48 font-poppins shadow-sm"
                  >
                    <option value="All">All Sales Agents</option>
                    {agents.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  
                  {/* Date Range Picker for Status Summary */}
                  <div className="flex gap-2 items-center">
                    <div className="relative">
                      <input 
                        type="date"
                        value={statusSummaryPeriodFrom}
                        onChange={(e) => setStatusSummaryPeriodFrom(e.target.value)}
                        className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-40 font-poppins shadow-sm"
                      />
                    </div>
                    <span className="text-slate-400 self-center">to</span>
                    <div className="relative">
                      <input 
                        type="date"
                        value={statusSummaryPeriodTo}
                        onChange={(e) => setStatusSummaryPeriodTo(e.target.value)}
                        className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-40 font-poppins shadow-sm"
                      />
                    </div>
                    <button
                      onClick={clearStatusSummaryPeriodFilter}
                      className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors text-sm font-semibold whitespace-nowrap"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="relative flex items-center">
                    <Search size={18} className="absolute left-3 text-slate-500 pointer-events-none" />
                    <input 
                      type="text" 
                      placeholder="Search customers..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm w-56 outline-none transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white font-poppins shadow-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Enhanced Status Legend */}
              <div className="flex gap-6 mb-4 text-sm text-slate-600 font-medium">
                <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-xl">
                  <span className="w-3 h-3 rounded-full bg-green-400 shadow-sm"></span>
                  Met Quota
                </div>
                <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-xl">
                  <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm"></span>
                  On Track
                </div>
                <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-xl">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></span>
                  Starting
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                {/* Updated Header with 6 columns */}
                <div className="grid grid-cols-6 px-6 py-4 items-center text-sm font-semibold text-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <div>Customer</div>
                  <div>Sales Agent</div>
                  <div>Progress</div>
                  <div className="ml-6">Rebate Status</div>
                  <div>Rebate Amount</div>
                  <div>Rebate Balance</div>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {filteredCustomers.length > 0 ? filteredCustomers.map((row, index) => (
                    <div 
                      key={index} 
                      className="grid grid-cols-6 px-6 py-4 items-center text-sm border-b border-slate-100 transition-all duration-300 hover:bg-blue-50 group hover:scale-[1.01]"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-semibold text-sm flex-shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-110"
                          style={{ backgroundColor: row.color }}
                        >
                          {row.customer.charAt(0)}
                        </div>
                        <div>
                          <div 
                            className="font-semibold text-slate-900 cursor-pointer transition-all duration-300 hover:text-blue-600 hover:scale-105"
                            onClick={() => setModalCustomer(row)}
                          >
                            {row.customer}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">{row.code}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0 shadow-sm">
                          {row.agent.charAt(0)}
                        </div>
                        <span className="text-slate-700 font-medium">{row.agent}</span>
                      </div>
                      <div className="w-full">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  row.quotaStatus === "Met Quota" ? "bg-gradient-to-r from-green-500 to-emerald-600" :
                                  row.quotaStatus === "On Track" ? "bg-gradient-to-r from-yellow-400 to-amber-500" : "bg-gradient-to-r from-red-500 to-pink-600"
                                }`}
                                style={{ width: `${row.progress * 10}%` }}
                              ></div>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-700 min-w-8 text-right bg-slate-100 px-2 py-1 rounded-lg">
                            {row.progress * 10}%
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 capitalize font-medium">{row.quotaStatus.toLowerCase()}</div>
                      </div>
                      <div className="ml-6">
                        <span className={`px-5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 shadow-sm ${
                          row.rebate === "Eligible" 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-500' 
                            : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white border-slate-400'
                        }`}>
                          {row.rebate}
                        </span>
                      </div>
                      {/* New Rebate Amount Column */}
                      <div>
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg inline-block text-center min-w-20 ${
                          row.paidAmount > 0
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {row.rebateAmount}
                        </span>
                      </div>
                      {/* New Rebate Balance Column */}
                      <div>
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg inline-block text-center min-w-20 ${
                          row.rebateBalanceValue > 0
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {row.rebateBalance}
                        </span>
                      </div>
                    </div>
                  )) : (
                  <div className="text-center py-16 px-6 bg-gradient-to-br from-slate-50 to-purple-50 rounded-2xl border border-slate-200 m-4">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                        <Users size={36} className="text-purple-500 animate-bounce" />
                      </div>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-purple-300 rounded-full animate-ping opacity-75"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping opacity-75 delay-150"></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping opacity-75 delay-300"></div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <h3 className="text-2xl font-bold text-slate-800">
                        No Customers Found
                      </h3>
                      <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
                        We couldn't find any customers matching your search criteria.
                      </p>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Rebate Details Modal */}
        {selectedRebate && rebateDetails && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-md transition-all duration-500" 
              onClick={handleCloseModal}>
            <div className="bg-white rounded-3xl w-[95%] max-w-6xl max-h-[90vh] overflow-hidden relative shadow-2xl border-0" 
                onClick={(e) => e.stopPropagation()}>
              
              <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/20 rounded-xl backdrop-blur-sm">
                    <HandCoins size={28} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedRebate.code} Details</h3>
                    <p className="text-gray-600 text-sm">Rebate program overview and performance</p>
                  </div>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-2.5 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 border border-blue-200 hover:border-blue-300"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex flex-col h-[calc(90vh-80px)] bg-slate-50">
                
                <div className="grid grid-cols-4 gap-4 p-6 bg-white border-b border-slate-200 shrink-0">
                  {[
                    { icon: User, label: "Sales Employee", value: rebateDetails.salesEmployee, color: "blue" },
                    { icon: BarChart2, label: "Frequency", value: rebateDetails.frequency, color: "emerald" },
                    { icon: Calendar, label: "Start Date", value: selectedRebate.from, color: "amber" },
                    { icon: Calendar, label: "End Date", value: selectedRebate.to, color: "amber" }
                  ].map((item, index) => (
                    <div key={index} className={`bg-gradient-to-br from-${item.color}-50 to-${item.color}-100 rounded-2xl p-4 border border-${item.color}-200 shadow-sm`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-${item.color}-500 rounded-xl`}>
                          <item.icon size={18} className="text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{item.label}</div>
                          <div className="text-sm font-bold text-slate-900 mt-1">{item.value}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-6 pt-4 bg-white shrink-0">
                  <div className="flex gap-1 bg-slate-100 rounded-2xl p-1.5 w-fit">
                    <button 
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 min-w-[140px] justify-center ${
                        activeTab === 'customers' 
                          ? 'bg-white shadow-lg text-blue-600 font-semibold scale-105' 
                          : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                      }`}
                      onClick={() => setActiveTab('customers')}
                    >
                      <Users size={16} />
                      Customers
                      <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full font-semibold">
                        {rebateDetails.customers.length}
                      </span>
                    </button>
                    <button 
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 min-w-[140px] justify-center ${
                        activeTab === 'items' 
                          ? 'bg-white shadow-lg text-blue-600 font-semibold scale-105' 
                          : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                      }`}
                      onClick={() => setActiveTab('items')}
                    >
                      <Blocks size={16} />
                      Items
                      <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full font-semibold">
                        {rebateDetails.items.length}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-hidden min-h-0">
                  {activeTab === 'customers' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg h-full flex flex-col">
                      <div className="p-4 border-b border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900">Customer Quotas</h4>
                      </div>
                      <div className="flex-1 overflow-auto min-h-0">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[200px]">Customer</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[120px]">Code</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[100px]">Quota 1</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[100px]">Quota 2</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[100px]">Quota 3</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[120px]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rebateDetails.customers.map((customer, i) => (
                              <tr key={i} className="hover:bg-slate-50/80 transition-colors duration-150">
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-semibold text-sm shadow-lg transition-transform duration-300 hover:scale-110"
                                      style={{ backgroundColor: customer.color }}
                                    >
                                      {customer.name.charAt(0)}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-900">{customer.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <code className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-medium">
                                    {customer.code}
                                  </code>
                                </td>
                                {customer.quotas.map((quota, idx) => (
                                  <td key={idx} className="px-4 py-4">
                                    {editingCustomers[customer.code] ? (
                                      <input
                                        type="number"
                                        value={quota}
                                        onChange={(e) => handleCustomerQuotaChange(customer.code, idx, e.target.value)}
                                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                      />
                                    ) : (
                                      <span className="text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-lg font-bold inline-block text-center min-w-16">
                                        {quota}
                                      </span>
                                    )}
                                  </td>
                                ))}
                                <td className="px-4 py-4">
                                  {editingCustomers[customer.code] ? (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleSaveCustomer(customer.code)}
                                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors hover:scale-110"
                                        title="Save"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleCancelEditCustomer(customer.code)}
                                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors hover:scale-110"
                                        title="Cancel"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleEditCustomer(customer.code)}
                                      className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors hover:scale-110"
                                      title="Edit"
                                    >
                                      <Edit size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'items' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg h-full flex flex-col">
                      <div className="p-4 border-b border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900">Rebate Items</h4>
                      </div>
                      <div className="flex-1 overflow-auto min-h-0">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[200px]">Item</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[120px]">Code</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[120px]">Qty per unit</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[120px]">Rebate</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[120px]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rebateDetails.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors duration-150">
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center shadow-sm">
                                      <Blocks size={18} className="text-purple-600" />
                                    </div>
                                    <div>
                                      {editingItems[item.code] ? (
                                        <input
                                          type="text"
                                          value={item.description}
                                          onChange={(e) => handleItemChange(item.code, 'description', e.target.value)}
                                          className="px-2 py-1 border border-slate-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
                                        />
                                      ) : (
                                        <div className="text-sm font-semibold text-slate-900">{item.description}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <code className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-medium">
                                    {item.code}
                                  </code>
                                </td>
                                <td className="px-4 py-4">
                                  {editingItems[item.code] ? (
                                    <input
                                      type="text"
                                      value={item.unitPerQty}
                                      onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)}
                                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-sm bg-slate-100 text-slate-900 px-3 py-2 rounded-lg font-semibold inline-block text-center">
                                      {item.unitPerQty}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  {editingItems[item.code] ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-sm">₱</span>
                                      <input
                                        type="number"
                                        value={item.rebate}
                                        onChange={(e) => handleItemChange(item.code, 'rebate', e.target.value)}
                                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-2 rounded-lg font-bold inline-block text-center min-w-20">
                                      ₱{item.rebate}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  {editingItems[item.code] ? (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleSaveItem(item.code)}
                                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors hover:scale-110"
                                        title="Save"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleCancelEditItem(item.code)}
                                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors hover:scale-110"
                                        title="Cancel"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleEditItem(item.code)}
                                      className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors hover:scale-110"
                                      title="Edit"
                                    >
                                      <Edit size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Customer Details Modal */}
        {modalCustomer && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-md transition-all duration-500" 
              onClick={() => setModalCustomer(null)}>
            <div className="bg-white rounded-3xl w-[95%] max-w-6xl max-h-[85vh] overflow-hidden relative shadow-2xl border-0" 
                onClick={(e) => e.stopPropagation()}>
              
              <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/20 rounded-xl backdrop-blur-sm">
                    <Users size={28} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Customer Details</h3>
                    <p className="text-gray-600 text-sm">Complete customer information and performance</p>
                  </div>
                </div>
                <button 
                  onClick={() => setModalCustomer(null)}
                  className="p-2.5 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 border border-blue-200 hover:border-blue-300"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex flex-col h-[calc(85vh-80px)] bg-slate-50">
                
                <div className="grid grid-cols-4 gap-4 p-6 bg-white border-b border-slate-200">
                  {[
                    { icon: User, label: "Customer Name", value: modalCustomer.customer, color: "blue" },
                    { icon: IdCardLanyard, label: "Customer Code", value: modalCustomer.code, color: "emerald" },
                    { icon: UserCheck, label: "Sales Employee", value: modalCustomer.agent, color: "amber" },
                    { icon: Calendar, label: "Enrollment Date", value: modalCustomer.enrollment, color: "purple" }
                  ].map((item, index) => (
                    <div key={index} className={`bg-gradient-to-br from-${item.color}-50 to-${item.color}-100 rounded-2xl p-4 border border-${item.color}-200 shadow-sm`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-${item.color}-500 rounded-xl`}>
                          <item.icon size={18} className="text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{item.label}</div>
                          <div className="text-sm font-bold text-slate-900 mt-1">{item.value}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Period Filter Section */}
                <div className="px-6 pt-6 bg-white flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-1 bg-slate-100 rounded-2xl p-1.5 w-fit">
                      {[
                        { icon: TrendingUp, label: "Monthly Quota", value: "quota" },
                        { icon: FileText, label: "Transaction Log", value: "transaction" },
                        { icon: CreditCard, label: "Payout History", value: "payout" }
                      ].map((tab) => (
                        <button 
                          key={tab.value}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 min-w-[220px] justify-center ${
                            customerModalTab === tab.value 
                              ? 'bg-white shadow-lg text-blue-600 font-semibold scale-105' 
                              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                          }`}
                          onClick={() => setCustomerModalTab(tab.value)}
                        >
                          <tab.icon size={16} />
                          {tab.label}
                          {tab.value === "transaction" && (
                            <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full font-semibold">
                              {getFilteredTransactions(modalCustomer.id).length}
                            </span>
                          )}
                          {tab.value === "payout" && (
                            <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full font-semibold">
                              {getFilteredPayouts(modalCustomer.id).length}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-hidden">
                  {/* Quota History Tab */}
                  {customerModalTab === 'quota' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg h-full flex flex-col">
                      <div className="p-4 border-b border-slate-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-semibold -mt-6 text-slate-900">Monthly Quota Performance</h4>
                          </div>
                          {/* Period Filter Inside Table Header */}
                          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2">
                              <Filter size={14} className="text-slate-600" />
                              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Period:</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">From:</label>
                              <input
                                type="date"
                                value={periodFrom}
                                onChange={(e) => setPeriodFrom(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
                              />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">To:</label>
                              <input
                                type="date"
                                value={periodTo}
                                onChange={(e) => setPeriodTo(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
                              />
                            </div>
                            
                            <div className="flex gap-1">
                              <button
                                onClick={applyPeriodFilter}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-semibold whitespace-nowrap"
                              >
                                Apply
                              </button>
                              <button
                                onClick={clearPeriodFilter}
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs font-semibold whitespace-nowrap"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm -mt-6 text-slate-600">
                          Period: {new Date(periodFrom).toLocaleDateString()} to {new Date(periodTo).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex-1 p-6 min-h-0 flex flex-col">
                        <div className="relative w-full flex-shrink-0 bg-gradient-to-b from-slate-50 to-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                          <div className="flex h-64">
                            <div className="flex flex-col justify-between mr-4 text-xs text-slate-500 font-medium w-8">
                              <span>100%</span>
                              <span>75%</span>
                              <span>50%</span>
                              <span>25%</span>
                              <span>0%</span>
                            </div>
                            
                            <div className="flex-1 relative">
                              <div className="absolute inset-0 flex flex-col justify-between">
                                {[0, 1, 2, 3, 4].map(i => (
                                  <div key={i} className="border-t border-slate-200/60"></div>
                                ))}
                              </div>
                              
                              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                                  </linearGradient>
                                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#059669" />
                                  </linearGradient>
                                  <linearGradient id="targetLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#3b82f6" />
                                    <stop offset="100%" stopColor="#1d4ed8" />
                                  </linearGradient>
                                </defs>
                                
                                <path
                                  d={generateAreaPath(getFilteredMonthlyQuotas(modalCustomer.id))}
                                  fill="url(#areaGradient)"
                                  stroke="none"
                                />
                                
                                <path
                                  d={generateTargetLinePath(getFilteredMonthlyQuotas(modalCustomer.id))}
                                  fill="none"
                                  stroke="url(#targetLineGradient)"
                                  strokeWidth="1"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeDasharray="2,3"
                                />
                                
                                <path
                                  d={generateLinePath(getFilteredMonthlyQuotas(modalCustomer.id))}
                                  fill="none"
                                  stroke="url(#lineGradient)"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              
                              <div className="absolute inset-0 flex justify-between items-end px-2">
                                {getFilteredMonthlyQuotas(modalCustomer.id).map((data, index) => (
                                  <div key={index} className="flex flex-col items-center relative" style={{ width: `${100 / Math.max(getFilteredMonthlyQuotas(modalCustomer.id).length, 1)}%` }}>
                                    <div 
                                      className="w-2 h-2 rounded-full bg-blue-500 border-2 border-white shadow-lg absolute transition-all duration-300 hover:scale-150 cursor-pointer z-5"
                                      style={{ bottom: `${data.quota}%` }}
                                      title={`${new Date(data.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} Target: ${data.quota}%`}
                                    >
                                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                                        Target: {data.quota}%
                                      </div>
                                    </div>
                                    
                                    <div 
                                      className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-lg absolute transition-all duration-300 hover:scale-150 cursor-pointer z-10"
                                      style={{ bottom: `${data.achieved}%` }}
                                      title={`${new Date(data.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}: ${data.achieved}%`}
                                    >
                                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                                        Achieved: {data.achieved}%
                                      </div>
                                    </div>
                                    
                                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                                      <span className="text-sm font-semibold text-slate-700 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-200 whitespace-nowrap">
                                        {new Date(data.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transaction Log Tab */}
                  {customerModalTab === 'transaction' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg h-full flex flex-col">
                      <div className="p-4 border-b border-slate-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900">Transaction Log</h4>
                          </div>
                          {/* Period Filter Inside Table Header */}
                          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2">
                              <Filter size={14} className="text-slate-600" />
                              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Period:</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">From:</label>
                              <input
                                type="date"
                                value={periodFrom}
                                onChange={(e) => setPeriodFrom(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
                              />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">To:</label>
                              <input
                                type="date"
                                value={periodTo}
                                onChange={(e) => setPeriodTo(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
                              />
                            </div>
                            
                            <div className="flex gap-1">
                              <button
                                onClick={applyPeriodFilter}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-semibold whitespace-nowrap"
                              >
                                Apply
                              </button>
                              <button
                                onClick={clearPeriodFilter}
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs font-semibold whitespace-nowrap"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Item</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Quantity</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {getFilteredTransactions(modalCustomer.id).map((transaction) => {
                              const item = masterData.items.find(i => i.id === transaction.itemId);
                              const amount = calculateTransactionAmount(transaction);
                              
                              return (
                                <tr key={transaction.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                                  <td className="px-6 py-4 text-center">
                                    <div className="text-sm font-medium text-slate-900">{transaction.date}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <div className="text-sm text-slate-700">{item?.name || 'Unknown Item'}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className="text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-semibold">
                                      {transaction.quantity}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className="text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1 rounded-lg font-bold">
                                      ₱{amount.toLocaleString()}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Payout History Tab */}
                  {customerModalTab === 'payout' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg h-full flex flex-col">
                      <div className="p-4 border-b border-slate-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900">Rebates Payout History</h4>
                          </div>
                          {/* Period Filter Inside Table Header */}
                          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2">
                              <Filter size={14} className="text-slate-600" />
                              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Period:</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">From:</label>
                              <input
                                type="date"
                                value={periodFrom}
                                onChange={(e) => setPeriodFrom(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
                              />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">To:</label>
                              <input
                                type="date"
                                value={periodTo}
                                onChange={(e) => setPeriodTo(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
                              />
                            </div>
                            
                            <div className="flex gap-1">
                              <button
                                onClick={applyPeriodFilter}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-semibold whitespace-nowrap"
                              >
                                Apply
                              </button>
                              <button
                                onClick={clearPeriodFilter}
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs font-semibold whitespace-nowrap"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Period</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Amount</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Rebate Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {getFilteredPayouts(modalCustomer.id).map((payout, index) => {
                              // Calculate rebate balance for this customer
                              const customerPayouts = getFilteredPayouts(modalCustomer.id);
                              const currentPayoutIndex = customerPayouts.findIndex(p => p.id === payout.id);
                              const futurePayouts = customerPayouts.slice(currentPayoutIndex).filter(p => p.status === "Pending");
                              const rebateBalance = futurePayouts.reduce((sum, p) => sum + p.amount, 0);
                              
                              return (
                                <tr key={payout.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                                  <td className="px-6 py-4 text-center">
                                    <div className="text-sm font-medium text-slate-900">{payout.date}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <div className="text-sm text-slate-700">{payout.period}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className="text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1 rounded-lg font-bold">
                                      ₱{payout.amount.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <div className="relative inline-block">
                                      <select 
                                        value={payout.status}
                                        onChange={(e) => handleStatusChange(payout.id, e.target.value)}
                                        className={`text-xs font-semibold uppercase px-3 py-1.5 pr-8 rounded-full border appearance-none focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer transition-all duration-300 text-white opacity-100 ${
                                          payout.status === 'Paid' 
                                            ? 'bg-gradient-to-r from-emerald-500 to-green-600 border-emerald-500 focus:ring-emerald-500 hover:scale-105' 
                                            : 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-500 focus:ring-amber-500 hover:scale-105'
                                        }`}
                                      >
                                        <option value="Paid" className="bg-white text-gray-900 py-2 font-semibold hover:bg-gray-100">Paid</option>
                                        <option value="Pending" className="bg-white text-gray-900 py-2 font-semibold hover:bg-gray-100">Pending</option>
                                      </select>
                                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
                                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`text-sm px-3 py-1 rounded-lg font-bold ${
                                      rebateBalance > 0
                                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      ₱{rebateBalance.toLocaleString()}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Van_Dashboard;