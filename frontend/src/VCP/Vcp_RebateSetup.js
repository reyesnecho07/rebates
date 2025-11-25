import React, { useState, useEffect } from "react";
import Select from "react-select";
import {
  Home,
  FileText,
  BarChart2,
  Users,
  Package,
  Settings,
  User,
  Edit,
  Trash2,
  IdCardLanyard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Save,
  Calendar,
  Calculator,
  Target,
  Settings as SettingsIcon,
  AlertTriangle
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import Logo from "../Logo";
import * as XLSX from "xlsx";



// Toast Notification Component
const Toast = ({ message, type, onClose }) => {
  const bgColor = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800"
  };

  const iconColor = {
    success: "text-green-600",
    error: "text-red-600",
    warning: "text-yellow-600",
    info: "text-blue-600"
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <X className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${bgColor[type]} animate-slide-in-right`}>
      <div className={iconColor[type]}>
        {icons[type]}
      </div>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button 
        onClick={onClose}
        className={`ml-2 hover:opacity-70 transition-opacity ${iconColor[type]}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Toast Container Component
const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Loading Spinner Component
const LoadingSpinner = ({ message = "Processing..." }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3 min-w-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  </div>
);

// Confirmation Modal Component
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-auto shadow-xl border border-gray-100">
      
      {/* Compact Header with Icon */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-gray-600 text-sm mt-1">{message}</p>
        </div>
      </div>

      {/* Horizontal Button Alignment */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg transition-all duration-200 font-medium border border-gray-200 hover:border-gray-300 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  </div>
  );
};

// Quota Modal Component - UPDATED with proper import handling
const QuotaModal = ({ isOpen, onClose, customer, onSave, quotaPeriods, importedQuotas = [], quotaType = "withQuota" }) => {
  const [localQuotas, setLocalQuotas] = useState({});

  useEffect(() => {
    if (customer && customer.quotas) {
      const initialQuotas = {};
      
      // First try to use imported quotas if available
      if (importedQuotas.length > 0) {
        importedQuotas.forEach((quota, index) => {
          initialQuotas[index] = quota || "";
        });
      } else {
        // Fall back to existing customer quotas
        customer.quotas.forEach((quota, index) => {
          initialQuotas[index] = quota || "";
        });
      }
      
      setLocalQuotas(initialQuotas);
    }
  }, [customer, importedQuotas]);

  const handleQuotaChange = (periodIndex, value) => {
    // Allow numbers, decimals, and empty values
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
      setLocalQuotas(prev => ({
        ...prev,
        [periodIndex]: value
      }));
    }
  };

  const handleSave = () => {
    const quotasArray = quotaPeriods.map((_, index) => localQuotas[index] || "");
    onSave(quotasArray);
    onClose();
  };

  // Auto-fill all quotas with a specific value
  const handleAutoFill = (value) => {
    const newQuotas = {};
    quotaPeriods.forEach((_, index) => {
      newQuotas[index] = value;
    });
    setLocalQuotas(newQuotas);
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-[95%] max-w-6xl max-h-[90vh] overflow-hidden relative shadow-2xl border-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl backdrop-blur-sm">
              <Calculator className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-900">Manage Quotas</h2>
              <p className="text-gray-600 text-sm">
                {customer.code} • {customer.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 border border-blue-200 hover:border-blue-300"
          >
            <X className="w-5 h-5 text-gray-600 hover:text-gray-800 transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {quotaPeriods.map((period, index) => (
              <div 
                key={index} 
                className="bg-white border border-blue-100 rounded-2xl p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group hover:bg-blue-50/30"
              >
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h3 className="font-bold text-gray-900 text-base">{period.period}</h3>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{period.dates}</p>
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Quota Amount
                  </label>
                  <input
                    type="text"
                    value={localQuotas[index] || ""}
                    onChange={(e) => handleQuotaChange(index, e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-3 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 bg-white transition-all duration-200 font-medium placeholder-gray-400"
                  />
                </div>
              </div>
            ))}
          </div>

          {quotaPeriods.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <Calculator className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Quota Periods</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Configure date ranges and frequency settings to generate quota periods for management.
              </p>
            </div>
          )}
        </div>

        {/* Footer - UPDATED: Show only period count */}
        <div className="flex justify-between items-center p-8 border-t border-blue-100 bg-blue-50/30">
          <div className="text-sm text-gray-600">
            {quotaPeriods.length} period{quotaPeriods.length !== 1 ? 's' : ''} configured
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-700 hover:bg-white rounded-xl transition-all duration-200 font-medium border border-gray-300 hover:border-gray-400 bg-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all duration-200 font-semibold flex items-center gap-2 hover:scale-105 shadow-lg shadow-blue-500/30"
            >
              <Save className="w-4 h-4" />
              Save All Quotas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function Vcp_RebateSetup() {

    const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("/rebatesetup");
  const [activeTab, setActiveTab] = useState("Customer");

  // NEW: With Quota / Without Quota state
  const [quotaType, setQuotaType] = useState("withQuota");

  // Notification states
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, data: null });
  const [quotaModal, setQuotaModal] = useState({ isOpen: false, customer: null, importedQuotas: [] });

  // Edit mode states
  const [editingRows, setEditingRows] = useState({
    customer: { 0: true },
    item: { 0: true }
  });

  // User info states
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");

  // Server dropdown states
  const [salesEmployees, setSalesEmployees] = useState([]);
  const [customersDropdown, setCustomersDropdown] = useState([]);
  const [itemsDropdown, setItemsDropdown] = useState([]);

  // Selected values
  const [rebateCode, setRebateCode] = useState("");
  const [selectedSalesEmployee, setSelectedSalesEmployee] = useState("");
  const [selectedDateFrom, setSelectedDateFrom] = useState("");
  const [selectedDateTo, setSelectedDateTo] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState("");

  // Customer and Item states
  const [customers, setCustomers] = useState([{ code: "", name: "", quotas: [] }]);
  const [items, setItems] = useState([{ code: "", name: "", unitPerQty: "", rebatePerBag: "" }]);
  
  // Enhanced quota states
  const [quotaPeriods, setQuotaPeriods] = useState([]);
  const [quotaCount, setQuotaCount] = useState(0);

  // Track imported quotas for each customer
  const [importedCustomerQuotas, setImportedCustomerQuotas] = useState({});

  // Show toast notification
  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Generate next rebate code
  const generateNextRebateCode = () => {
    const lastCode = localStorage.getItem('lastRebateCode');
    let nextNumber = 1001;
    
    if (lastCode) {
      const lastNumber = parseInt(lastCode.split('-')[1]);
      nextNumber = lastNumber + 1;
    }
    
    const newCode = `REB-${nextNumber}`;
    localStorage.setItem('lastRebateCode', newCode);
    return newCode;
  };

  // Get user from localStorage and set initials
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
    const username = storedUser.username || "Unknown User";
    const role = storedUser.role || "Unknown Role";

    setUserName(username);
    setUserCode(role);

    const getInitials = (name) => {
      if (!name) return "??";
      const parts = name.trim().split(" ");
      if (parts.length === 1) return parts[0][0].toUpperCase();
      return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    };

    setInitials(getInitials(username));
    setRebateCode(generateNextRebateCode());

    // Fetch dropdown data
    fetchSalesEmployees();
    fetchCustomers();
    fetchItems();
  }, []);

  // Enhanced quota calculation based on date range and frequency - Only calculate if with quota
  useEffect(() => {
    if (quotaType === "withQuota" && selectedDateFrom && selectedDateTo && selectedFrequency) {
      calculateQuotaPeriods();
    } else {
      setQuotaPeriods([]);
      setQuotaCount(0);
      // Reset customer quotas when no periods or without quota
      setCustomers(prev => prev.map(c => ({ ...c, quotas: [] })));
    }
  }, [selectedDateFrom, selectedDateTo, selectedFrequency, quotaType]);

  const calculateQuotaPeriods = () => {
    const startDate = new Date(selectedDateFrom);
    const endDate = new Date(selectedDateTo);
    const periods = [];
    
    if (selectedFrequency === "Monthly") {
      let currentDate = new Date(startDate);
      let periodNumber = 1;
      
      while (currentDate <= endDate) {
        const periodStart = new Date(currentDate);
        const periodEnd = new Date(currentDate);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);
        
        // Ensure period end doesn't exceed overall end date
        const actualEnd = periodEnd > endDate ? endDate : periodEnd;
        
        periods.push({
          period: `Quota ${periodNumber}`,
          label: `Quota ${periodNumber}`,
          startDate: new Date(periodStart),
          endDate: new Date(actualEnd),
          dates: `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${actualEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        });
        
        periodNumber++;
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }
    } else if (selectedFrequency === "Quarterly") {
      let quarterStart = new Date(startDate);
      let periodNumber = 1;
      
      while (quarterStart <= endDate) {
        const periodStart = new Date(quarterStart);
        const periodEnd = new Date(quarterStart);
        periodEnd.setMonth(periodEnd.getMonth() + 3);
        periodEnd.setDate(periodEnd.getDate() - 1);
        
        // Ensure period end doesn't exceed overall end date
        const actualEnd = periodEnd > endDate ? endDate : periodEnd;
        
        periods.push({
          period: `Quota ${periodNumber}`,
          label: `Quota ${periodNumber}`,
          startDate: new Date(periodStart),
          endDate: new Date(actualEnd),
          dates: `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${actualEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        });
        
        periodNumber++;
        // Move to next quarter
        quarterStart.setMonth(quarterStart.getMonth() + 3);
      }
    }

    setQuotaPeriods(periods);
    setQuotaCount(periods.length);

    // Update existing customers with new quota structure
    setCustomers(prevCustomers => 
      prevCustomers.map(customer => ({
        ...customer,
        quotas: quotaType === "withQuota" ? Array(periods.length).fill("") : []
      }))
    );
  };

  // Fetch functions
  const fetchSalesEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://192.168.100.193:5000/api/vcp/sales-employees");
      if (!res.ok) throw new Error("Failed to fetch sales employees");
      const data = await res.json();
      setSalesEmployees(data);
    } catch (err) {
      console.error("Error fetching sales employees:", err);
      showToast("Failed to load sales employees", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://192.168.100.193:5000/api/vcp/customer");
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      setCustomersDropdown(data);
    } catch (err) {
      console.error("Error fetching customers:", err);
      showToast("Failed to load customers", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://192.168.100.193:5000/api/vcp/items");
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setItemsDropdown(data);
    } catch (err) {
      console.error("Error fetching items:", err);
      showToast("Failed to load items", "error");
    } finally {
      setLoading(false);
    }
  };

  // ENHANCED Import function with validation for existing customers and items
  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      showToast("Please select a valid Excel file (.xlsx or .xls)", "error");
      return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error("No sheets found in Excel file");
        }

        console.log('Available sheets:', workbook.SheetNames);

        let customerDataImported = false;
        let itemDataImported = false;
        let importedCustomers = [];
        let importedItems = [];
        let importedQuotasMap = {};

        // Process Customer tab (first sheet or sheet with customer-related name)
        const customerSheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('customer') || name.toLowerCase().includes('cust')
        ) || workbook.SheetNames[0];

        if (customerSheetName) {
          const customerWorksheet = workbook.Sheets[customerSheetName];
          const customerJsonData = XLSX.utils.sheet_to_json(customerWorksheet, { header: 1 });
          
          console.log('Customer sheet data:', customerJsonData);
          
          if (customerJsonData.length > 0) {
            const result = processCustomerData(customerJsonData, customerWorksheet);
            importedCustomers = result.importedCustomers;
            importedQuotasMap = result.importedQuotasMap;
            
            if (importedCustomers.length > 0) {
              setCustomers(importedCustomers);
              setImportedCustomerQuotas(importedQuotasMap);
              
              const initialEditingState = {};
              importedCustomers.forEach((_, index) => {
                initialEditingState[index] = false;
              });
              setEditingRows(prev => ({ ...prev, customer: initialEditingState }));
              customerDataImported = true;
            }
          }
        }

        // Process Items tab (second sheet or sheet with item-related name)
        const itemSheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('item') || name.toLowerCase().includes('product')
        ) || (workbook.SheetNames[1] ? workbook.SheetNames[1] : null);

        if (itemSheetName) {
          const itemWorksheet = workbook.Sheets[itemSheetName];
          const itemJsonData = XLSX.utils.sheet_to_json(itemWorksheet, { header: 1 });
          
          console.log('Item sheet data:', itemJsonData);
          
          if (itemJsonData.length > 0) {
            importedItems = processItemData(itemJsonData);
            if (importedItems.length > 0) {
              setItems(importedItems);
              const initialEditingState = {};
              importedItems.forEach((_, index) => {
                initialEditingState[index] = false;
              });
              setEditingRows(prev => ({ ...prev, item: initialEditingState }));
              itemDataImported = true;
            }
          }
        }

        // Extract header information from first sheet for program settings
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const firstSheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        extractHeaderInfo(firstSheetData);

        if (!customerDataImported && !itemDataImported) {
          showToast("No valid customer or item data found in the Excel file", "warning");
        } else {
          const messages = [];
          if (customerDataImported) {
            messages.push(`${importedCustomers.length} customers with ${quotaPeriods.length} periods`);
          }
          if (itemDataImported) messages.push(`${importedItems.length} items`);
          showToast(`Successfully imported ${messages.join(' and ')}`, "success");
        }
        
      } catch (error) {
        console.error('Error importing Excel file:', error);
        showToast(`Import failed: ${error.message}`, "error");
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      setLoading(false);
      showToast("Error reading file. Please try again.", "error");
    };
    
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  // ENHANCED: Process customer data with validation for existing customers
  const processCustomerData = (excelData, worksheet) => {
    try {
      if (excelData.length === 0) {
        showToast("No customer data found in sheet", "warning");
        return { importedCustomers: [], importedQuotasMap: {} };
      }

      console.log('Processing customer data with worksheet:', worksheet);

      // Find the customer data section - look for header row with CustomerCode/CustomerName
      let customerDataStartRow = -1;
      let quotaHeaders = [];
      
      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        if (Array.isArray(row)) {
          const hasCustomerCode = row.some(cell => 
            cell && cell.toString().toLowerCase().includes('customercode')
          );
          const hasCustomerName = row.some(cell => 
            cell && cell.toString().toLowerCase().includes('customername')
          );
          
          if (hasCustomerCode || hasCustomerName) {
            customerDataStartRow = i;
            // Extract quota headers from this row (starting from column C/index 2)
            quotaHeaders = row.slice(2).filter(header => 
              header && header.toString().toLowerCase().includes('quota')
            );
            console.log('Found customer header at row:', i);
            console.log('Quota headers:', quotaHeaders);
            break;
          }
        }
      }

      let dataRows = [];
      if (customerDataStartRow !== -1) {
        // Take rows after the header (starting from row 7 if header is at row 6, etc.)
        dataRows = excelData.slice(customerDataStartRow + 1).filter(row => 
          Array.isArray(row) && row.some(cell => cell && cell.toString().trim() !== '')
        );
      } else {
        // If no specific header found, use all rows with data (skip empty rows)
        dataRows = excelData.filter(row => 
          Array.isArray(row) && row.length >= 2 && 
          row.some(cell => cell && cell.toString().trim() !== '')
        );
      }

      console.log('Customer data rows to process:', dataRows);
      console.log('Quota headers found:', quotaHeaders);

      const importedCustomers = [];
      const importedQuotasMap = {};
      const skippedCustomers = [];

      dataRows.forEach((row, rowIndex) => {
        try {
          // Ensure row is an array
          const rowArray = Array.isArray(row) ? row : [row];
          
          // Find indices for customer data - typically A=0 (Code), B=1 (Name), C=2+ (Quotas)
          let codeIndex = 0, nameIndex = 1, quotaStartIndex = 2;
          
          // Auto-detect column positions based on header if available
          if (customerDataStartRow !== -1) {
            const headerRow = excelData[customerDataStartRow];
            if (Array.isArray(headerRow)) {
              headerRow.forEach((cell, index) => {
                if (cell) {
                  const headerValue = cell.toString().toLowerCase();
                  if (headerValue.includes('code') || headerValue.includes('customer code')) codeIndex = index;
                  if (headerValue.includes('name') || headerValue.includes('customer name')) nameIndex = index;
                }
              });
              quotaStartIndex = Math.max(codeIndex, nameIndex) + 1;
            }
          }

          const codeValue = rowArray[codeIndex] !== undefined ? String(rowArray[codeIndex]).trim() : "";
          const nameValue = rowArray[nameIndex] !== undefined ? String(rowArray[nameIndex]).trim() : "";

          console.log(`Processing customer row ${rowIndex}:`, { 
            codeValue, 
            nameValue, 
            rowLength: rowArray.length,
            quotaStartIndex,
            rowData: rowArray
          });

          // Skip if both code and name are empty
          if (!codeValue && !nameValue) {
            console.log(`Skipping empty customer row ${rowIndex}`);
            return;
          }

          // VALIDATION: Check if customer exists in dropdown
          const customerExists = customersDropdown.some(customer => 
            customer.CardCode === codeValue || customer.CardName === nameValue
          );

          if (!customerExists) {
            console.log(`Skipping customer row ${rowIndex} - not found in system:`, { codeValue, nameValue });
            skippedCustomers.push({ code: codeValue, name: nameValue });
            return;
          }

          // ENHANCED: Read quota data from specific Excel cells (C7, D7, etc.)
          const importedQuotas = [];
          const excelRowNumber = customerDataStartRow + 2 + rowIndex; // +2 because header is at customerDataStartRow, data starts at +1, and Excel is 1-based
          
          console.log(`Reading quotas for customer ${codeValue} from row ${excelRowNumber}`);
          
          // Read quota values from columns C, D, E, etc. (starting from column 3 in 1-based indexing)
          for (let col = 3; col <= 20; col++) { // Read up to column T (20th column)
            const cellAddress = XLSX.utils.encode_cell({ r: excelRowNumber - 1, c: col - 1 }); // Convert to 0-based
            const cellValue = worksheet[cellAddress];
            
            if (cellValue !== undefined) {
              const value = cellValue.v;
              console.log(`Cell ${cellAddress} (Row ${excelRowNumber}, Col ${col}):`, { 
                rawValue: value, 
                type: typeof value 
              });
              
              // Handle different value types properly
              let quotaValue = "";
              
              if (typeof value === 'number') {
                // Direct number from Excel
                quotaValue = value.toString();
              } else if (typeof value === 'string') {
                // String value - extract numbers and decimals
                const cleanedValue = value.trim();
                if (cleanedValue) {
                  // Allow numbers, decimals, and common number formats
                  const numMatch = cleanedValue.match(/-?\d*\.?\d+/);
                  if (numMatch) {
                    quotaValue = numMatch[0];
                  } else {
                    quotaValue = cleanedValue; // Keep as string if no numbers found
                  }
                }
              } else if (value === null || value === undefined) {
                quotaValue = "";
              } else {
                // Other types (boolean, etc.)
                quotaValue = String(value);
              }
              
              console.log(`Quota ${col - 2} processed:`, quotaValue);
              importedQuotas.push(quotaValue);
            } else {
              // No value in this cell, push empty string
              importedQuotas.push("");
            }
            
            // Stop reading if we have enough quotas based on current quota periods
            if (quotaPeriods.length > 0 && importedQuotas.length >= quotaPeriods.length) {
              break;
            }
          }

          // Also try to read from the row array as fallback
          if (importedQuotas.length === 0 || importedQuotas.every(q => !q)) {
            console.log('Falling back to row array quota reading');
            for (let i = quotaStartIndex; i < rowArray.length; i++) {
              if (rowArray[i] !== undefined && rowArray[i] !== null && rowArray[i] !== '') {
                const value = rowArray[i];
                let quotaValue = "";
                
                if (typeof value === 'number') {
                  quotaValue = value.toString();
                } else if (typeof value === 'string') {
                  const cleanedValue = value.trim();
                  if (cleanedValue) {
                    const numMatch = cleanedValue.match(/-?\d*\.?\d+/);
                    if (numMatch) {
                      quotaValue = numMatch[0];
                    } else {
                      quotaValue = cleanedValue;
                    }
                  }
                } else {
                  quotaValue = String(value);
                }
                
                importedQuotas.push(quotaValue);
              } else {
                importedQuotas.push("");
              }
            }
          }

          console.log(`Row ${rowIndex} imported quotas:`, importedQuotas);

          // Align imported quotas with current quota periods
          let alignedQuotas = [];
          if (quotaPeriods.length > 0) {
            // If we have quota periods defined, align the imported quotas
            alignedQuotas = Array(quotaPeriods.length).fill("");
            
            // Map imported quotas to the corresponding periods
            importedQuotas.forEach((quota, index) => {
              if (index < quotaPeriods.length) {
                alignedQuotas[index] = quota;
              }
            });
          } else {
            // If no quota periods defined yet, use the imported quotas as-is
            alignedQuotas = importedQuotas;
          }

          const customer = {
            code: codeValue,
            name: nameValue,
            quotas: quotaType === "withQuota" ? alignedQuotas : []
          };

          importedCustomers.push(customer);
          
          // Store imported quotas separately for this customer
          importedQuotasMap[rowIndex] = alignedQuotas;

        } catch (error) {
          console.error(`Error processing customer row ${rowIndex}:`, error);
        }
      });

      console.log('Final imported customers with quotas:', importedCustomers);
      console.log('Imported quotas map:', importedQuotasMap);
      
      // Show warning for skipped customers
      if (skippedCustomers.length > 0) {
        showToast(`Imported ${importedCustomers.length} customers, skipped ${skippedCustomers.length} not found in system`, "warning");
      }
      
      return { importedCustomers, importedQuotasMap };

    } catch (error) {
      console.error('Error processing customer data:', error);
      showToast(`Error processing customer data: ${error.message}`, "error");
      return { importedCustomers: [], importedQuotasMap: {} };
    }
  };

  // ENHANCED: Process item data with validation for existing items
  const processItemData = (excelData) => {
    try {
      if (excelData.length === 0) {
        showToast("No item data found in sheet", "warning");
        return [];
      }

      // Find the item data section
      let itemDataStartRow = -1;
      
      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        if (Array.isArray(row)) {
          const hasItemCode = row.some(cell => 
            cell && cell.toString().toLowerCase().includes('item')
          );
          if (hasItemCode) {
            itemDataStartRow = i;
            break;
          }
        }
      }

      let dataRows = [];
      if (itemDataStartRow !== -1) {
        dataRows = excelData.slice(itemDataStartRow + 1).filter(row => 
          Array.isArray(row) && row.some(cell => cell && cell.toString().trim() !== '')
        );
      } else {
        dataRows = excelData.filter(row => 
          Array.isArray(row) && row.length >= 2 && 
          row.some(cell => cell && cell.toString().trim() !== '')
        );
      }

      const importedItems = [];
      const skippedItems = [];

      dataRows.forEach((row, rowIndex) => {
        try {
          const rowArray = Array.isArray(row) ? row : [row];
          
          // Find indices for item data
          let codeIndex = 0, nameIndex = 1, unitIndex = 2, rebateIndex = 3;
          
          // Auto-detect column positions
          if (itemDataStartRow !== -1) {
            const headerRow = excelData[itemDataStartRow];
            if (Array.isArray(headerRow)) {
              headerRow.forEach((cell, index) => {
                if (cell) {
                  const headerValue = cell.toString().toLowerCase();
                  if (headerValue.includes('code') || headerValue.includes('item code')) codeIndex = index;
                  if (headerValue.includes('name') || headerValue.includes('item name')) nameIndex = index;
                  if (headerValue.includes('unit') || headerValue.includes('qty')) unitIndex = index;
                  if (headerValue.includes('rebate')) rebateIndex = index;
                }
              });
            }
          }

          const codeValue = rowArray[codeIndex] !== undefined ? String(rowArray[codeIndex]).trim() : "";
          const nameValue = rowArray[nameIndex] !== undefined ? String(rowArray[nameIndex]).trim() : "";
          const unitValue = rowArray[unitIndex] !== undefined ? String(rowArray[unitIndex]).trim() : "";
          const rebateValue = rowArray[rebateIndex] !== undefined ? String(rowArray[rebateIndex]).trim() : "";

          // Skip if both code and name are empty
          if (!codeValue && !nameValue) {
            console.log(`Skipping empty item row ${rowIndex}`);
            return;
          }

          // VALIDATION: Check if item exists in dropdown
          const itemExists = itemsDropdown.some(item => 
            item.ItemCode === codeValue || item.ItemName === nameValue
          );

          if (!itemExists) {
            console.log(`Skipping item row ${rowIndex} - not found in system:`, { codeValue, nameValue });
            skippedItems.push({ code: codeValue, name: nameValue });
            return;
          }

          const item = {
            code: codeValue,
            name: nameValue,
            unitPerQty: unitValue,
            rebatePerBag: rebateValue
          };

          importedItems.push(item);

        } catch (error) {
          console.error(`Error processing item row ${rowIndex}:`, error);
        }
      });

      console.log('Imported items:', importedItems);

      // Show warning for skipped items
      if (skippedItems.length > 0) {
        showToast(`Imported ${importedItems.length} items, skipped ${skippedItems.length} not found in system`, "warning");
      }

      return importedItems;

    } catch (error) {
      console.error('Error processing item data:', error);
      showToast(`Error processing item data: ${error.message}`, "error");
      return [];
    }
  };

  // Extract header information from Excel data
  const extractHeaderInfo = (excelData) => {
    // Look for main header information in first 10 rows
    for (let i = 0; i < Math.min(10, excelData.length); i++) {
      const row = excelData[i];
      if (!Array.isArray(row)) continue;
      
      row.forEach((cell, index) => {
        if (cell && typeof cell === 'string') {
          const headerValue = cell.toLowerCase();
          const dataValue = excelData[i + 1]?.[index];
          
          if (dataValue) {
            if (headerValue.includes('rebate') && headerValue.includes('code')) {
              setRebateCode(dataValue.toString());
            } else if (headerValue.includes('sales') && headerValue.includes('employee')) {
              setSelectedSalesEmployee(dataValue.toString());
            } else if (headerValue.includes('date') && headerValue.includes('from')) {
              setSelectedDateFrom(dataValue.toString());
            } else if (headerValue.includes('date') && headerValue.includes('to')) {
              setSelectedDateTo(dataValue.toString());
            } else if (headerValue.includes('frequency')) {
              setSelectedFrequency(dataValue.toString());
            } else if (headerValue.includes('quota') && headerValue.includes('type')) {
              // NEW: Extract quota type from Excel
              const quotaTypeValue = dataValue.toString().toLowerCase();
              if (quotaTypeValue.includes('without') || quotaTypeValue.includes('no quota')) {
                setQuotaType("withoutQuota");
              } else {
                setQuotaType("withQuota");
              }
            }
          }
        }
      });
    }
  };

  // ENHANCED Export function with proper quota alignment and quota type
  const handleExportExcel = (type) => {
    try {
      const workbook = XLSX.utils.book_new();
      
      if (type === 'customer') {
        // Create header section with quota type
        const headerSection = [
          ["Rebate Program Setup"],
          [],
          [
            "Rebate Code",
            "Sales Employee",
            "Date From",
            "Date To",
            "Frequency",
            "Quota Type"
          ],
          [
            rebateCode,
            selectedSalesEmployee,
            selectedDateFrom,
            selectedDateTo,
            selectedFrequency,
            quotaType === "withQuota" ? "With Quota" : "Without Quota"
          ],
          [],
          // Customer data header - conditionally include quota columns
          [
            "CustomerCode",
            "CustomerName",
            ...(quotaType === "withQuota" ? quotaPeriods.map((_, idx) => `Quota${idx + 1}`) : [])
          ]
        ];

        // Create customer data rows
        const customerData = customers
          .filter(customer => customer.code || customer.name)
          .map(customer => [
            customer.code || '',
            customer.name || '',
            ...(quotaType === "withQuota" ? customer.quotas.map(quota => quota || '') : [])
          ]);

        if (customerData.length === 0) {
          showToast("No customer data to export!", "warning");
          return;
        }

        // Combine all data
        const wsData = [...headerSection, ...customerData];
        
        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(wsData);
        
        // Apply column widths for better readability
        const columnWidths = [
          { wch: 15 }, { wch: 25 }, 
          { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
          { wch: 5 }, // spacer
          { wch: 15 }, { wch: 25 },
          ...(quotaType === "withQuota" ? quotaPeriods.map(() => ({ wch: 12 })) : [])
        ];
        worksheet['!cols'] = columnWidths;

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Rebate Data');
        
        const fileName = `customer_rebate_setup_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        showToast(`Customer data exported successfully${quotaType === "withQuota" ? " with quotas" : ""}!`, "success");

      } else if (type === 'item') {
        // Create header section with quota type
        const headerSection = [
          ["Rebate Program Setup"],
          [],
          [
            "Rebate Code",
            "Sales Employee",
            "Date From",
            "Date To",
            "Frequency",
            "Quota Type"
          ],
          [
            rebateCode,
            selectedSalesEmployee,
            selectedDateFrom,
            selectedDateTo,
            selectedFrequency,
            quotaType === "withQuota" ? "With Quota" : "Without Quota"
          ],
          [],
          // Item data header
          [
            "ItemCode",
            "ItemName",
            "UnitPerQty",
            "RebatePerBag"
          ]
        ];

        // Create item data rows
        const itemData = items
          .filter(item => item.code || item.name)
          .map(item => [
            item.code || '',
            item.name || '',
            item.unitPerQty || '',
            item.rebatePerBag || ''
          ]);

        if (itemData.length === 0) {
          showToast("No item data to export!", "warning");
          return;
        }

        // Combine all data
        const wsData = [...headerSection, ...itemData];
        
        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(wsData);
        
        // Apply column widths
        worksheet['!cols'] = [
          { wch: 15 }, { wch: 25 }, 
          { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
          { wch: 5 }, // spacer
          { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Item Rebate Data');
        
        const fileName = `item_rebate_setup_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        showToast("Item data exported successfully!", "success");
      }
    } catch (error) {
      console.error('Error exporting Excel file:', error);
      showToast('Error exporting data to Excel.', "error");
    }
  };

  const handleDownload = (type) => {
    handleExportExcel(type);
  };

  // ENHANCED Quota modal functions with imported quotas - Only show if with quota
  const openQuotaModal = (customerIndex) => {
    if (quotaType === "withoutQuota") {
      showToast("Quota management is disabled for 'Without Quota' programs", "info");
      return;
    }
    
    const customer = customers[customerIndex];
    const importedQuotas = importedCustomerQuotas[customerIndex] || [];
    
    setQuotaModal({
      isOpen: true,
      customer: { ...customer, index: customerIndex },
      importedQuotas: importedQuotas
    });
  };

  const handleSaveQuotas = (customerIndex, quotas) => {
    const newCustomers = [...customers];
    newCustomers[customerIndex].quotas = quotas;
    setCustomers(newCustomers);
    showToast("Quotas updated successfully", "success");
  };

  const closeQuotaModal = () => {
    setQuotaModal({ isOpen: false, customer: null, importedQuotas: [] });
  };

  // Edit mode functions
  const toggleRowEdit = (type, index) => {
    setEditingRows(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [index]: !prev[type][index]
      }
    }));
  };

  const isRowEditable = (type, index) => {
    return editingRows[type][index];
  };

  // NEW: Handle quota type change
  const handleQuotaTypeChange = (type) => {
    setQuotaType(type);
    
    if (type === "withoutQuota") {
      // Clear all quotas when switching to without quota
      setCustomers(prev => prev.map(customer => ({ ...customer, quotas: [] })));
      setQuotaPeriods([]);
      setQuotaCount(0);
      showToast("Switched to Without Quota mode - all quotas cleared", "info");
    } else {
      showToast("Switched to With Quota mode - configure date range and frequency", "info");
    }
  };

  // Handlers
  const handleAddCustomer = () => {
    const newCustomers = [...customers, { 
      code: "", 
      name: "", 
      quotas: quotaType === "withQuota" ? Array(quotaCount).fill("") : [] 
    }];
    setCustomers(newCustomers);
    
    setEditingRows(prev => ({
      ...prev,
      customer: {
        ...prev.customer,
        [newCustomers.length - 1]: true
      }
    }));
  };

  const handleAddItem = () => {
    const newItems = [...items, { code: "", name: "", unitPerQty: "", rebatePerBag: "" }];
    setItems(newItems);
    
    setEditingRows(prev => ({
      ...prev,
      item: {
        ...prev.item,
        [newItems.length - 1]: true
      }
    }));
  };

  // UPDATED: Customer selection handler - auto-fill code when name is selected
  const handleCustomerNameChange = (index, selectedOption) => {
    const newData = [...customers];
    
    if (selectedOption) {
      const match = customersDropdown.find((c) => c.CardName === selectedOption.value);
      if (match) {
        newData[index].name = match.CardName;
        newData[index].code = match.CardCode; // Auto-fill code
      }
    } else {
      newData[index].name = "";
      newData[index].code = "";
    }
    
    setCustomers(newData);
  };

  // UPDATED: Item selection handler - auto-fill code when name is selected
  const handleItemNameChange = (index, selectedOption) => {
    const newData = [...items];
    
    if (selectedOption) {
      const match = itemsDropdown.find((i) => i.ItemName === selectedOption.value);
      if (match) {
        newData[index].name = match.ItemName;
        newData[index].code = match.ItemCode; // Auto-fill code
      }
    } else {
      newData[index].name = "";
      newData[index].code = "";
    }
    
    setItems(newData);
  };

  const handleDeleteCustomer = (index) => {
    if (customers.length <= 1) {
      showToast("At least one customer is required", "warning");
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      action: 'deleteCustomer',
      data: index,
      title: "Delete Customer",
      message: "Are you sure you want to delete this customer? This action cannot be undone."
    });
  };

  const handleDeleteItem = (index) => {
    if (items.length <= 1) {
      showToast("At least one item is required", "warning");
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      action: 'deleteItem',
      data: index,
      title: "Delete Item",
      message: "Are you sure you want to delete this item? This action cannot be undone."
    });
  };

  const confirmAction = () => {
    const { action, data } = confirmModal;
    
    if (action === 'deleteCustomer') {
      setCustomers(customers.filter((_, i) => i !== data));
      showToast("Customer deleted successfully", "success");
    } else if (action === 'deleteItem') {
      setItems(items.filter((_, i) => i !== data));
      showToast("Item deleted successfully", "success");
    }
    
    setConfirmModal({ isOpen: false, action: null, data: null });
  };

  const handleSave = async () => {
    // Validation
    if (!selectedSalesEmployee) {
      showToast("Please select a sales employee", "error");
      return;
    }

    if (!selectedDateFrom || !selectedDateTo) {
      showToast("Please select date range", "error");
      return;
    }

    if (!selectedFrequency) {
      showToast("Please select frequency", "error");
      return;
    }

    if (customers.some(c => !c.code && !c.name)) {
      showToast("Please fill in all customer codes or names", "error");
      return;
    }

    if (items.some(i => !i.code && !i.name)) {
      showToast("Please fill in all item codes or names", "error");
      return;
    }

    // NEW: Additional validation for With Quota mode
    if (quotaType === "withQuota" && quotaPeriods.length === 0) {
      showToast("Please configure valid date range and frequency for quota periods", "error");
      return;
    }

    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const rebateData = {
        rebateCode,
        salesEmployee: selectedSalesEmployee,
        dateFrom: selectedDateFrom,
        dateTo: selectedDateTo,
        frequency: selectedFrequency,
        quotaType,
        quotaPeriods: quotaType === "withQuota" ? quotaPeriods : [],
        customers: customers.filter(c => c.code || c.name),
        items: items.filter(i => i.code || i.name)
      };

      console.log("Rebate Data:", rebateData);
      showToast(`Rebate setup saved successfully${quotaType === "withQuota" ? " with quotas" : " without quotas"}!`, "success");
      
      setEditingRows({ customer: {}, item: {} });
    } catch (error) {
      console.error("Error saving rebate setup:", error);
      showToast("Failed to save rebate setup", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConfirmModal({
      isOpen: true,
      action: 'reset',
      data: null,
      title: "Reset Form",
      message: "Are you sure you want to reset all data? This action cannot be undone."
    });
  };

  const resetForm = () => {
    setCustomers([{ code: "", name: "", quotas: [] }]);
    setItems([{ code: "", name: "", unitPerQty: "", rebatePerBag: "" }]);
    setSelectedSalesEmployee("");
    setSelectedDateFrom("");
    setSelectedDateTo("");
    setSelectedFrequency("");
    setQuotaType("withQuota");
    setQuotaCount(0);
    setQuotaPeriods([]);
    setImportedCustomerQuotas({});
    setRebateCode(generateNextRebateCode());
    setEditingRows({ 
      customer: { 0: true }, 
      item: { 0: true } 
    });
    showToast("Form reset successfully", "success");
    setConfirmModal({ isOpen: false, action: null, data: null });
  };

  // UPDATED: Calculate summary for quota column - Show period count or "No Quota"
  const getQuotaSummary = (quotas) => {
    if (quotaType === "withoutQuota") {
      return "No Quota";
    }
    return `${quotaPeriods.length}`;
  };

  // NEW: Get quota type display text
  const getQuotaTypeDisplay = () => {
    return quotaType === "withQuota" ? "With Quota" : "Without Quota";
  };

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 font-poppins text-slate-900">
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
              { icon: Home, label: "Dashboard", path: "/vcp/dashboard" },
              { icon: FileText, label: "Rebate Setup", path: "/vcp/rebatesetup" },
              { icon: BarChart2, label: "Reports", path: "/vcp/vcpreports" },
              { icon: Users, label: "Customer", path: "/vcp/customer" },
              { icon: Package, label: "Items", path: "/vcp/items" },
              { icon: IdCardLanyard, label: "Sales Employee", path: "/vcp/salesemployee" },
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
              { icon: Settings, label: "Settings", path: "/vcp/settings" },
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
            {/* NEW: Program Header Section */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-blue-200">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <SettingsIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Rebate Program Setup</h1>
                <p className="text-sm text-gray-600">Configure your rebate program parameters and targets</p>
              </div>
            </div>

            {/* Header Section with Requested Details - UPDATED with Quota Type */}
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 mb-8 pb-8 border-b border-blue-200">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Rebate Code
                </label>
                <div className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 shadow-sm">
                  <span className="text-gray-800 font-medium">{rebateCode}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  Sales Employee
                </label>
                <select 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                  value={selectedSalesEmployee} 
                  onChange={(e) => setSelectedSalesEmployee(e.target.value)}
                >
                  <option value="">Select Sales Employee</option>
                  {salesEmployees.map((emp, idx) => (
                    <option key={idx} value={emp.SlpName}>{emp.SlpName}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Date From
                </label>
                <input 
                  type="date" 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                  value={selectedDateFrom} 
                  onChange={(e) => setSelectedDateFrom(e.target.value)} 
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Date To
                </label>
                <input 
                  type="date" 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                  value={selectedDateTo} 
                  onChange={(e) => setSelectedDateTo(e.target.value)} 
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-500" />
                  Frequency
                </label>
                <select 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                  value={selectedFrequency} 
                  onChange={(e) => setSelectedFrequency(e.target.value)}
                >
                  <option value="">Select Frequency</option>
                  <option value="N/A">N/A</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                </select>
              </div>

              {/* NEW: Quota Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  Quota Type
                </label>
                <select 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                  value={quotaType} 
                  onChange={(e) => handleQuotaTypeChange(e.target.value)}
                >
                  <option value="withQuota">With Quota</option>
                  <option value="withoutQuota">Without Quota</option>
                </select>
              </div>
            </div>

            {/* Quota Type Indicator */}
            <div className={`mb-6 p-4 rounded-xl border ${
              quotaType === "withQuota" 
                ? "bg-blue-50 border-blue-200 text-blue-800" 
                : "bg-gray-50 border-gray-200 text-gray-800"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  quotaType === "withQuota" ? "bg-blue-500" : "bg-gray-500"
                }`}></div>
                <div>
                  <p className="font-semibold text-sm">
                    {quotaType === "withQuota" ? "With Quota Program" : "Without Quota Program"}
                  </p>
                  <p className="text-xs opacity-80">
                    {quotaType === "withQuota" 
                      ? "Customers will have individual quota targets for each period." 
                      : "No quota targets will be assigned to customers; performance will rely on system-generated values."}
                  </p>
                </div>
              </div>
            </div>

            {/* Enhanced Tabs with Import/Export on the right */}
            <div className="flex items-center justify-between mb-8 border-b border-gray-200">
              <div className="flex">
                <button 
                  className={`px-8 py-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-3 ${
                    activeTab === "Customer" 
                      ? "border-blue-600 text-blue-600 bg-blue-50 rounded-t-lg" 
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-t-lg"
                  }`}
                  onClick={() => setActiveTab("Customer")}
                >
                  <Users className="w-5 h-5" />
                  Customer Targets
                </button>
                <button 
                  className={`px-8 py-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-3 ${
                    activeTab === "Items" 
                      ? "border-blue-600 text-blue-600 bg-blue-50 rounded-t-lg" 
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-t-lg"
                  }`}
                  onClick={() => setActiveTab("Items")}
                >
                  <Package className="w-5 h-5" />
                  Product Rebates
                </button>
              </div>

              {/* Import/Export Buttons - Right side of tabs */}
              <div className="flex gap-3">
                {/* Single Import Button for both Customer and Items */}
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer">
                  <Upload size={16} />
                  Import Excel
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleImportExcel}
                    className="hidden"
                  />
                </label>
                
                {activeTab === "Customer" && (
                  <button 
                    onClick={() => handleDownload('customer')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                  >
                    <Download size={16} />
                    Export Data
                  </button>
                )}
                {activeTab === "Items" && (
                  <button 
                    onClick={() => handleDownload('item')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                  >
                    <Download size={16} />
                    Export Data
                  </button>
                )}
              </div>
            </div>

            {/* Enhanced Customer Table with Dropdowns - UPDATED for quota type */}
            {activeTab === "Customer" && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800">Customer Quota Setup</h3>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
                      {customers.length} customer(s)
                    </div>
                    {quotaType === "withQuota" && (
                      <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-medium">
                        {quotaPeriods.length} period{quotaPeriods.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm text-gray-700 min-w-[800px]">
                      <thead className="bg-gradient-to-r from-gray-50 to-blue-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                            Customer Code
                          </th>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                            Customer Name
                          </th>
                          <th className="px-6 py-4 text-center font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200 w-32">
                            {quotaType === "withQuota" ? "Quotas" : "Status"}
                          </th>
                          <th className="px-6 py-4 text-center font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200 w-28">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map((c, idx) => (
                          <tr key={idx} className="even:bg-gray-50 hover:bg-blue-50 transition-colors group border-b border-gray-100 last:border-b-0">
                            <td className="px-6 py-4">
                              {/* UPDATED: Customer Code field is read-only and auto-filled */}
                              <div className="w-full px-3 py-2 border border-transparent rounded-lg text-sm bg-transparent font-medium">
                                {c.code || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {isRowEditable('customer', idx) ? (
                                <Select
                                  options={customersDropdown.map(cust => ({ value: cust.CardName, label: cust.CardName }))}
                                  onChange={(selected) => handleCustomerNameChange(idx, selected)}
                                  value={c.name ? { value: c.name, label: c.name } : null}
                                  placeholder="Select Customer Name"
                                  className="text-sm"
                                  menuPortalTarget={document.body}
                                  styles={{ 
                                    menuPortal: base => ({ ...base, zIndex: 9999 }),
                                    control: base => ({ ...base, fontSize: '14px', minHeight: '40px', border: '1px solid #d1d5db', borderRadius: '10px' })
                                  }}
                                />
                              ) : (
                                <div className="w-full px-3 py-2 border border-transparent rounded-lg text-sm bg-transparent">
                                  {c.name || "-"}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {quotaType === "withQuota" ? (
                                <button
                                  onClick={() => openQuotaModal(idx)}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 rounded-lg transition-all shadow-sm text-sm font-medium"
                                >
                                  <Target className="w-4 h-4" />
                                  {/* UPDATED: Show period count instead of filled quotas */}
                                  Periods ({getQuotaSummary(c.quotas)})
                                </button>
                              ) : (
                                <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg text-sm font-medium">
                                  <CheckCircle className="w-4 h-4" />
                                  No Quota
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2 justify-center">
                                <button 
                                  className={`p-2 rounded-xl transition-all ${
                                    isRowEditable('customer', idx)
                                      ? "bg-green-100 text-green-600 hover:bg-green-200 shadow-sm"
                                      : "bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-sm"
                                  }`}
                                  onClick={() => toggleRowEdit('customer', idx)}
                                >
                                  {isRowEditable('customer', idx) ? <Save size={16} /> : <Edit size={16} />}
                                </button>
                                <button 
                                  className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-all shadow-sm"
                                  onClick={() => handleDeleteCustomer(idx)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Items Table with Dropdowns */}
            {activeTab === "Items" && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Product Rebate Configuration</h3>
                <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm text-gray-700 min-w-[900px]">
                      <thead className="bg-gradient-to-r from-gray-50 to-blue-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                            Item Code
                          </th>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                            Item Name
                          </th>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                            Qty per Unit
                          </th>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                            Rebate (per bag)
                          </th>
                          <th className="px-6 py-4 text-center font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200 w-28">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i, idx) => (
                          <tr key={idx} className="even:bg-gray-50 hover:bg-blue-50 transition-colors group border-b border-gray-100 last:border-b-0">
                            <td className="px-6 py-4">
                              {/* UPDATED: Item Code field is read-only and auto-filled */}
                              <div className="w-full px-3 py-2 border border-transparent rounded-lg text-sm bg-transparent font-medium">
                                {i.code || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {isRowEditable('item', idx) ? (
                                <Select
                                  options={itemsDropdown.map(it => ({ value: it.ItemName, label: it.ItemName }))}
                                  onChange={(selected) => handleItemNameChange(idx, selected)}
                                  value={i.name ? { value: i.name, label: i.name } : null}
                                  placeholder="Select Item Name"
                                  className="text-sm"
                                  menuPortalTarget={document.body}
                                  styles={{ 
                                    menuPortal: base => ({ ...base, zIndex: 9999 }),
                                    control: base => ({ ...base, fontSize: '14px', minHeight: '40px', border: '1px solid #d1d5db', borderRadius: '10px' })
                                  }}
                                />
                              ) : (
                                <div className="w-full px-3 py-2 border border-transparent rounded-lg text-sm bg-transparent">
                                  {i.name || "-"}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isRowEditable('item', idx) ? (
                                <input 
                                  type="text" 
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                                  value={i.unitPerQty} 
                                  onChange={(e) => {
                                    const newData = [...items];
                                    newData[idx].unitPerQty = e.target.value;
                                    setItems(newData);
                                  }} 
                                  placeholder="Enter quantity"
                                />
                              ) : (
                                <div className="w-full px-3 py-2 border border-transparent rounded-lg text-sm bg-transparent">
                                  {i.unitPerQty || "-"}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isRowEditable('item', idx) ? (
                                <input 
                                  type="text" 
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                                  value={i.rebatePerBag} 
                                  onChange={(e) => {
                                    const newData = [...items];
                                    newData[idx].rebatePerBag = e.target.value;
                                    setItems(newData);
                                  }} 
                                  placeholder="Enter rebate"
                                />
                              ) : (
                                <div className="w-full px-3 py-2 border border-transparent rounded-lg text-sm bg-transparent">
                                  {i.rebatePerBag || "-"}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2 justify-center">
                                <button 
                                  className={`p-2 rounded-xl transition-all ${
                                    isRowEditable('item', idx)
                                      ? "bg-green-100 text-green-600 hover:bg-green-200 shadow-sm"
                                      : "bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-sm"
                                  }`}
                                  onClick={() => toggleRowEdit('item', idx)}
                                >
                                  {isRowEditable('item', idx) ? <Save size={16} /> : <Edit size={16} />}
                                </button>
                                <button 
                                  className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-all shadow-sm"
                                  onClick={() => handleDeleteItem(idx)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Action Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-blue-200">
              <div className="flex gap-4">
                {activeTab === "Customer" && (
                  <button 
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-200"
                    onClick={handleAddCustomer}
                  >
                    <Users size={16} />
                    Add Customer
                  </button>
                )}
                {activeTab === "Items" && (
                  <button 
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-200"
                    onClick={handleAddItem}
                  >
                    <Package size={16} />
                    Add Item
                  </button>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                  onClick={handleReset}
                >
                  <X size={16} />
                  Reset
                </button>
                <button 
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-200"
                  onClick={handleSave}
                >
                  <Save size={16} />
                  Save Rebate Setup
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ENHANCED Quota Modal with imported quotas */}
      <QuotaModal
        isOpen={quotaModal.isOpen}
        onClose={closeQuotaModal}
        customer={quotaModal.customer}
        onSave={(quotas) => handleSaveQuotas(quotaModal.customer.index, quotas)}
        quotaPeriods={quotaPeriods}
        importedQuotas={quotaModal.importedQuotas}
        quotaType={quotaType}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Loading Spinner */}
      {loading && <LoadingSpinner />}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null, data: null })}
        onConfirm={confirmModal.action === 'reset' ? resetForm : confirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}

export default Vcp_RebateSetup;