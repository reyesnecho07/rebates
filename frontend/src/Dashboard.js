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
  Activity
} from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "./Logo";

function Dashboard() {
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

  // State for editing
  const [editingCustomers, setEditingCustomers] = useState({});
  const [editingItems, setEditingItems] = useState({});
  const [rebateDetails, setRebateDetails] = useState(null);
  const [originalRebateDetails, setOriginalRebateDetails] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);

  // State for payout history
  const [payoutHistoryData, setPayoutHistoryData] = useState([
    { date: "2025-01-31", period: "Jan 2025", amount: "₱8,500", status: "Paid" },
    { date: "2025-02-28", period: "Feb 2025", amount: "₱9,200", status: "Paid" },
    { date: "2025-03-31", period: "Mar 2025", amount: "₱7,800", status: "Paid" },
    { date: "2025-04-30", period: "Apr 2025", amount: "₱11,000", status: "Pending" }
  ]);

  // Fixed customer data with consistent values
  const realCustomers = [
    { name: "John Smith", code: "CUST1001", color: "#4a90e2" },
    { name: "Maria Garcia", code: "CUST1002", color: "#50bfa0" },
    { name: "David Johnson", code: "CUST1003", color: "#d95f5f" },
    { name: "Lisa Chen", code: "CUST1004", color: "#f5a623" },
    { name: "Robert Brown", code: "CUST1005", color: "#9b59b6" },
    { name: "Sarah Wilson", code: "CUST1006", color: "#e67e22" },
    { name: "Michael Davis", code: "CUST1007", color: "#1abc9c" },
    { name: "Emily Taylor", code: "CUST1008", color: "#2ecc71" },
    { name: "James Miller", code: "CUST1009", color: "#e74c3c" },
    { name: "Jennifer Lee", code: "CUST1010", color: "#3498db" },
    { name: "Christopher Martin", code: "CUST1011", color: "#4a90e2" },
    { name: "Amanda Clark", code: "CUST1012", color: "#50bfa0" },
    { name: "Daniel Rodriguez", code: "CUST1013", color: "#d95f5f" },
    { name: "Jessica Martinez", code: "CUST1014", color: "#f5a623" },
    { name: "Matthew Hernandez", code: "CUST1015", color: "#9b59b6" },
    { name: "Ashley Gonzalez", code: "CUST1016", color: "#e67e22" },
    { name: "Andrew Perez", code: "CUST1017", color: "#1abc9c" },
    { name: "Samantha Moore", code: "CUST1018", color: "#2ecc71" },
    { name: "Joshua Jackson", code: "CUST1019", color: "#e74c3c" },
    { name: "Nicole White", code: "CUST1020", color: "#3498db" }
  ];

  const agents = ["John Smith", "Maria Garcia", "David Johnson", "Lisa Chen", "Robert Brown"];
  
  // Fixed customer data with consistent progress and status
  const customers = [
    { customer: "John Smith", code: "CUST1001", agent: "John Smith", enrollment: "2025-01-01", progress: 8, quotaStatus: "Met Quota", rebate: "Eligible", color: "#4a90e2" },
    { customer: "Maria Garcia", code: "CUST1002", agent: "Maria Garcia", enrollment: "2025-02-01", progress: 6, quotaStatus: "On Track", rebate: "Eligible", color: "#50bfa0" },
    { customer: "David Johnson", code: "CUST1003", agent: "David Johnson", enrollment: "2025-03-01", progress: 4, quotaStatus: "Starting", rebate: "Not Eligible", color: "#d95f5f" },
    { customer: "Lisa Chen", code: "CUST1004", agent: "Lisa Chen", enrollment: "2025-04-01", progress: 9, quotaStatus: "Met Quota", rebate: "Eligible", color: "#f5a623" },
    { customer: "Robert Brown", code: "CUST1005", agent: "Robert Brown", enrollment: "2025-05-01", progress: 7, quotaStatus: "On Track", rebate: "Eligible", color: "#9b59b6" },
    { customer: "Sarah Wilson", code: "CUST1006", agent: "John Smith", enrollment: "2025-06-01", progress: 5, quotaStatus: "Starting", rebate: "Not Eligible", color: "#e67e22" },
    { customer: "Michael Davis", code: "CUST1007", agent: "Maria Garcia", enrollment: "2025-07-01", progress: 10, quotaStatus: "Met Quota", rebate: "Eligible", color: "#1abc9c" },
    { customer: "Emily Taylor", code: "CUST1008", agent: "David Johnson", enrollment: "2025-08-01", progress: 8, quotaStatus: "Met Quota", rebate: "Eligible", color: "#2ecc71" },
    { customer: "James Miller", code: "CUST1009", agent: "Lisa Chen", enrollment: "2025-09-01", progress: 6, quotaStatus: "On Track", rebate: "Eligible", color: "#e74c3c" },
    { customer: "Jennifer Lee", code: "CUST1010", agent: "Robert Brown", enrollment: "2025-10-01", progress: 3, quotaStatus: "Starting", rebate: "Not Eligible", color: "#3498db" },
    { customer: "Christopher Martin", code: "CUST1011", agent: "John Smith", enrollment: "2025-11-01", progress: 9, quotaStatus: "Met Quota", rebate: "Eligible", color: "#4a90e2" },
    { customer: "Amanda Clark", code: "CUST1012", agent: "Maria Garcia", enrollment: "2025-12-01", progress: 7, quotaStatus: "On Track", rebate: "Eligible", color: "#50bfa0" },
    { customer: "Daniel Rodriguez", code: "CUST1013", agent: "David Johnson", enrollment: "2025-01-15", progress: 5, quotaStatus: "Starting", rebate: "Not Eligible", color: "#d95f5f" },
    { customer: "Jessica Martinez", code: "CUST1014", agent: "Lisa Chen", enrollment: "2025-02-15", progress: 8, quotaStatus: "Met Quota", rebate: "Eligible", color: "#f5a623" },
    { customer: "Matthew Hernandez", code: "CUST1015", agent: "Robert Brown", enrollment: "2025-03-15", progress: 6, quotaStatus: "On Track", rebate: "Eligible", color: "#9b59b6" },
    { customer: "Ashley Gonzalez", code: "CUST1016", agent: "John Smith", enrollment: "2025-04-15", progress: 4, quotaStatus: "Starting", rebate: "Not Eligible", color: "#e67e22" },
    { customer: "Andrew Perez", code: "CUST1017", agent: "Maria Garcia", enrollment: "2025-05-15", progress: 10, quotaStatus: "Met Quota", rebate: "Eligible", color: "#1abc9c" },
    { customer: "Samantha Moore", code: "CUST1018", agent: "David Johnson", enrollment: "2025-06-15", progress: 7, quotaStatus: "On Track", rebate: "Eligible", color: "#2ecc71" },
    { customer: "Joshua Jackson", code: "CUST1019", agent: "Lisa Chen", enrollment: "2025-07-15", progress: 9, quotaStatus: "Met Quota", rebate: "Eligible", color: "#e74c3c" },
    { customer: "Nicole White", code: "CUST1020", agent: "Robert Brown", enrollment: "2025-08-15", progress: 5, quotaStatus: "Starting", rebate: "Not Eligible", color: "#3498db" }
  ];

  // Fixed items data
  const items = [
    { name: "Red Cement", qty: 120, color: "#4a90e2", code: "ITEM001" },
    { name: "White Cement", qty: 85, color: "#50bfa0", code: "ITEM002" },
    { name: "Steel Rods", qty: 60, color: "#d95f5f", code: "ITEM003" },
    { name: "Sand Bags", qty: 200, color: "#f5a623", code: "ITEM004" },
    { name: "Gravel", qty: 150, color: "#9b59b6", code: "ITEM005" },
    { name: "Bricks", qty: 300, color: "#e67e22", code: "ITEM006" },
    { name: "Paint (White)", qty: 45, color: "#1abc9c", code: "ITEM007" },
    { name: "Paint (Blue)", qty: 50, color: "#2ecc71", code: "ITEM008" },
    { name: "Wood Planks", qty: 90, color: "#e74c3c", code: "ITEM009" },
    { name: "Glass Panels", qty: 30, color: "#3498db", code: "ITEM010" },
  ];

  // Fixed rebates data
  const rebates = [
    { code: "REBATE001", active: true, from: "2025-01-01", to: "2025-03-31" },
    { code: "REBATE003", active: true, from: "2025-03-01", to: "2025-05-31" },
    { code: "REBATE004", active: true, from: "2025-04-01", to: "2025-06-30" },
    { code: "REBATE006", active: true, from: "2025-06-01", to: "2025-08-31" },
    { code: "REBATE007", active: true, from: "2025-07-01", to: "2025-09-30" },
    { code: "REBATE009", active: true, from: "2025-09-01", to: "2025-11-30" },
    { code: "REBATE010", active: true, from: "2025-10-01", to: "2025-12-31" },
    { code: "REBATE002", active: false, from: "2025-02-01", to: "2025-04-30" },
    { code: "REBATE005", active: false, from: "2025-05-01", to: "2025-07-31" },
    { code: "REBATE008", active: false, from: "2025-08-01", to: "2025-10-31" }
  ];

  // Fixed data for customer modal
  const monthlyQuotaData = [
    { month: "Jan", quota: 100, achieved: 85 },
    { month: "Feb", quota: 100, achieved: 92 },
    { month: "Mar", quota: 100, achieved: 78 },
    { month: "Apr", quota: 100, achieved: 65 },
    { month: "May", quota: 100, achieved: 95 },
    { month: "Jun", quota: 100, achieved: 88 },
    { month: "Jul", quota: 100, achieved: 72 },
    { month: "Aug", quota: 100, achieved: 98 },
    { month: "Sep", quota: 100, achieved: 85 },
    { month: "Oct", quota: 100, achieved: 91 },
    { month: "Nov", quota: 100, achieved: 79 },
    { month: "Dec", quota: 100, achieved: 96 }
  ];

  const transactionLogData = [
    { date: "2025-01-15", item: "Red Cement", quantity: 50, amount: "₱25,000" },
    { date: "2025-01-20", item: "White Cement", quantity: 30, amount: "₱15,000" },
    { date: "2025-02-05", item: "Steel Rods", quantity: 25, amount: "₱12,500" },
    { date: "2025-02-18", item: "Bricks", quantity: 100, amount: "₱8,000" },
    { date: "2025-03-10", item: "Paint (White)", quantity: 20, amount: "₱6,000" }
  ];

  // Fixed rebate details data
  const fixedRebateDetails = {
    salesEmployee: "John Smith",
    frequency: "Monthly",
    customers: [
      { code: "CUST1002", name: "Maria Garcia", color: "#50bfa0", quotas: [650, 720, 810] },
      { code: "CUST1003", name: "David Johnson", color: "#d95f5f", quotas: [450, 520, 590] },
      { code: "CUST1004", name: "Lisa Chen", color: "#f5a623", quotas: [950, 880, 910] },
      { code: "CUST1005", name: "Robert Brown", color: "#9b59b6", quotas: [750, 820, 790] },
      { code: "CUST1006", name: "Sarah Wilson", color: "#e67e22", quotas: [550, 620, 580] },
      { code: "CUST1007", name: "Michael Davis", color: "#1abc9c", quotas: [1000, 950, 980] },
      { code: "CUST1008", name: "Emily Taylor", color: "#2ecc71", quotas: [800, 870, 920] },
      { code: "CUST1009", name: "James Miller", color: "#e74c3c", quotas: [600, 670, 730] },
      { code: "CUST1010", name: "Jennifer Lee", color: "#3498db", quotas: [300, 450, 520] }
    ],
    items: [
      { code: "ITEM001", description: "Red Cement", color: "#4a90e2", unitPerQty: "50", rebate: 150 },
      { code: "ITEM002", description: "White Cement", color: "#50bfa0", unitPerQty: "50", rebate: 120 },
      { code: "ITEM003", description: "Steel Rods", color: "#d95f5f", unitPerQty: "60", rebate: 200 },
      { code: "ITEM004", description: "Sand Bags", color: "#f5a623", unitPerQty: "40", rebate: 80 },
      { code: "ITEM005", description: "Gravel", color: "#9b59b6", unitPerQty: "50", rebate: 60 },
      { code: "ITEM006", description: "Bricks", color: "#e67e22", unitPerQty: "100", rebate: 250 },
      { code: "ITEM007", description: "Paint (White)", color: "#1abc9c", unitPerQty: "40", rebate: 180 },
      { code: "ITEM008", description: "Paint (Blue)", color: "#2ecc71", unitPerQty: "40", rebate: 190 },
      { code: "ITEM009", description: "Wood Planks", color: "#e74c3c", unitPerQty: "20", rebate: 220 },
      { code: "ITEM010", description: "Glass Panels", color: "#3498db", unitPerQty: "10", rebate: 300 }
    ]
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
      const detailsCopy = JSON.parse(JSON.stringify(fixedRebateDetails));
      setRebateDetails(detailsCopy);
      setOriginalRebateDetails(JSON.parse(JSON.stringify(fixedRebateDetails)));
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
  const handleStatusChange = (index, newStatus) => {
    const updatedData = payoutHistoryData.map((payout, i) => 
      i === index ? { ...payout, status: newStatus } : payout
    );
    setPayoutHistoryData(updatedData);
    
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

  const filteredCustomers = customers.filter((c) => {
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
      c.enrollment.includes(`-${searchTerm.padStart(2, '0')}-`) ||
      (searchLower.includes('met') && c.quotaStatus === 'Met Quota') ||
      (searchLower.includes('track') && c.quotaStatus === 'On Track') ||
      (searchLower.includes('start') && c.quotaStatus === 'Starting') ||
      (searchLower.includes('eligible') && c.rebate === 'Eligible') ||
      (searchLower.includes('not eligible') && c.rebate === 'Not Eligible');

    return matchesAgent && matchesMonth && matchesSearch;
  });

  const filteredRebates = rebates.filter(rebate => {
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
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500  rounded-xl flex items-center justify-center shadow-lg">
                <img src="url_logo.png" alt="Logo" className="w-5 h-5" />
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
              { icon: Home, label: "Dashboard", path: "/dashboard" },
              { icon: FileText, label: "Rebate Setup", path: "/rebatesetup" },
              { icon: BarChart2, label: "Reports", path: "/nexchemreports" },
              { icon: Users, label: "Customer", path: "/customer" },
              { icon: Package, label: "Items", path: "/items" },
              { icon: IdCardLanyard, label: "Sales Employee", path: "/salesemployee" },
            ].map((item) => (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`flex items-center text-slate-300 px-4 py-3 rounded-xl transition-all duration-300 group hover:bg-slate-700/50 hover:text-white hover:scale-105 ${
                    activeNav === item.path
                      ? "bg-blue-500/20 text-white border-r-2 border-blue-400 shadow-lg"
                      : ""
                  }`}
                  onClick={() => setActiveNav(item.path)}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />
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
              { icon: Settings, label: "Settings", path: "/settings" },
              { icon: User, label: "Account Setup", path: "/accountsetup" },
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
                  value: "₱112,500", 
                  change: "+12% from last month", 
                  icon: PhilippinePeso, 
                  gradient: "from-blue-500 to-blue-600",
                  bgGradient: "from-blue-50 to-blue-100",
                  border: "border-blue-200"
                },
                { 
                title: "Total Unpaid Rebate",
                value: "12,450",
                change: "+8% from last month",
                icon: BanknoteArrowDown,
                gradient: "from-emerald-500 to-green-600",
                bgGradient: "from-emerald-50 to-green-100",
                border: "border-emerald-200"
                },
                { 
                  title: "Active Customers", 
                  value: "185", 
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
                      <div className="text-slate-600 font-medium">{r.from}</div>
                      <div className="text-slate-600 font-medium">{r.to}</div>
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
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)} 
                    className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-w-36 font-poppins shadow-sm"
                  >
                    <option value="All">All Months</option>
                    {[...Array(12).keys()].map((m) => (
                      <option key={m} value={String(m + 1).padStart(2, "0")}>
                        Month {m + 1}
                      </option>
                    ))}
                  </select>
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
                <div className="grid grid-cols-4 px-6 py-4 items-center text-sm font-semibold text-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <div>Customer</div>
                  <div>Sales Agent</div>
                  <div>Progress</div>
                  <div className="ml-6">Rebate Status</div>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {filteredCustomers.length > 0 ? filteredCustomers.map((row, index) => (
                    <div 
                      key={index} 
                      className="grid grid-cols-4 px-6 py-4 items-center text-sm border-b border-slate-100 transition-all duration-300 hover:bg-blue-50 group hover:scale-[1.01]"
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
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${
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
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${
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

                <div className="flex-1 p-6 overflow-hidden min-h-19">
                  {activeTab === 'customers' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg h-full flex flex-col">
                      <div className="p-4 border-b border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900">Customer Quotas</h4>
                      </div>
                      <div className="flex-1 overflow-auto min-h-0">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Customer</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Code</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Quota 1</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Quota 2</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Quota 3</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
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
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Item</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Code</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Qty per unit</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Rebate</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
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

                <div className="px-6 pt-6 bg-white">
                  <div className="flex gap-1 bg-slate-100 rounded-2xl p-1.5 w-fit">
                    {[
                      { icon: TrendingUp, label: "Monthly Quota History", value: "quota" },
                      { icon: FileText, label: "Transaction Log", value: "transaction", count: transactionLogData.length },
                      { icon: CreditCard, label: "Payout History", value: "payout", count: payoutHistoryData.length }
                    ].map((tab) => (
                      <button 
                        key={tab.value}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${
                          customerModalTab === tab.value 
                            ? 'bg-white shadow-lg text-blue-600 font-semibold scale-105' 
                            : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                        }`}
                        onClick={() => setCustomerModalTab(tab.value)}
                      >
                        <tab.icon size={16} />
                        {tab.label}
                        {tab.count && (
                          <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full font-semibold">
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-hidden">
                  {/* Quota History Tab */}
                  {customerModalTab === 'quota' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg h-full flex flex-col">
                      <div className="p-6 border-b border-slate-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900">Monthly Quota Performance</h4>
                          </div>
                          <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm"></div>
                              <span className="text-xs text-slate-600 font-medium">Quota Target</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm"></div>
                              <span className="text-xs text-slate-600 font-medium">Actual Achieved</span>
                            </div>
                          </div>
                        </div>
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
                                  d={generateAreaPath(monthlyQuotaData)}
                                  fill="url(#areaGradient)"
                                  stroke="none"
                                />
                                
                                <path
                                  d={generateTargetLinePath(monthlyQuotaData)}
                                  fill="none"
                                  stroke="url(#targetLineGradient)"
                                  strokeWidth="1"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeDasharray="2,3"
                                />
                                
                                <path
                                  d={generateLinePath(monthlyQuotaData)}
                                  fill="none"
                                  stroke="url(#lineGradient)"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              
                              <div className="absolute inset-0 flex justify-between items-end px-2">
                                {monthlyQuotaData.map((data, index) => (
                                  <div key={index} className="flex flex-col items-center relative" style={{ width: `${100 / monthlyQuotaData.length}%` }}>
                                    <div 
                                      className="w-2 h-2 rounded-full bg-blue-500 border-2 border-white shadow-lg absolute transition-all duration-300 hover:scale-150 cursor-pointer z-5"
                                      style={{ bottom: `${data.quota}%` }}
                                      title={`${data.month} Target: ${data.quota}%`}
                                    >
                                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                                        Target: {data.quota}%
                                      </div>
                                    </div>
                                    
                                    <div 
                                      className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-lg absolute transition-all duration-300 hover:scale-150 cursor-pointer z-10"
                                      style={{ bottom: `${data.achieved}%` }}
                                      title={`${data.month}: ${data.achieved}%`}
                                    >
                                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                                        Achieved: {data.achieved}%
                                      </div>
                                    </div>
                                    
                                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                                      <span className="text-sm font-semibold text-slate-700 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-200">
                                        {data.month}
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
                        <h4 className="text-lg font-semibold text-slate-900">Transaction Log</h4>
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
                            {transactionLogData.map((transaction, index) => (
                              <tr key={index} className="hover:bg-slate-50/80 transition-colors duration-150">
                                <td className="px-6 py-4 text-center">
                                  <div className="text-sm font-medium text-slate-900">{transaction.date}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="text-sm text-slate-700">{transaction.item}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-semibold">
                                    {transaction.quantity}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1 rounded-lg font-bold">
                                    {transaction.amount}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Payout History Tab */}
                  {customerModalTab === 'payout' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg h-full flex flex-col">
                      <div className="p-4 border-b border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900">Rebates Payout History</h4>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Period</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Amount</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {payoutHistoryData.map((payout, index) => (
                              <tr key={index} className="hover:bg-slate-50/80 transition-colors duration-150">
                                <td className="px-6 py-4 text-center">
                                  <div className="text-sm font-medium text-slate-900">{payout.date}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="text-sm text-slate-700">{payout.period}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1 rounded-lg font-bold">
                                    {payout.amount}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="relative inline-block">
                                    <select 
                                      value={payout.status}
                                      onChange={(e) => handleStatusChange(index, e.target.value)}
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
      </main>
    </div>
  );
}

export default Dashboard;