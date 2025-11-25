import React, { useState, useEffect } from "react";
import {
  Home,
  FileText,
  BarChart2,
  Users,
  Package,
  Settings,
  User,
  IdCardLanyard,
  LogOut,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileType,
  Image,
  Calendar,
  User as UserIcon,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import Logo from "../Logo";
import nexchemReport from '../assets/nexchemreport.png'; 
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { reportService } from '../services/reportService';

function Nexchem_Reports() {
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("/reports");
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showReport, setShowReport] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [flattenedRows, setFlattenedRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [pagesData, setPagesData] = useState([]);
  
  // New state for background jobs
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [userJobs, setUserJobs] = useState([]);
  const [pollingInterval, setPollingInterval] = useState(null);

  // Track if we're generating a new report to reset pagination properly
  const [isNewReport, setIsNewReport] = useState(false);
  const [shouldResetPage, setShouldResetPage] = useState(false);

  // Load saved state and initialize jobs
  useEffect(() => {
    initializeComponent();
    
    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, []);

  const initializeComponent = () => {
    // Load saved report data
    const savedReportData = localStorage.getItem("savedReportData");
    const savedReportParams = localStorage.getItem("savedReportParams");
    const savedShowReport = localStorage.getItem("savedShowReport");
    const savedActiveJobId = localStorage.getItem("savedActiveJobId");
    const savedCurrentPage = localStorage.getItem("savedCurrentPage");

    if (savedReportData) {
      const data = JSON.parse(savedReportData);
      setReportData(data);
      processReportData(data, false); // Don't reset page when loading from storage
    }
    if (savedReportParams) {
      const params = JSON.parse(savedReportParams);
      setSelectedCustomer(params.selectedCustomer || "");
      setDateFrom(params.dateFrom || "");
      setDateTo(params.dateTo || "");
    }
    if (savedShowReport) {
      setShowReport(JSON.parse(savedShowReport));
    }
    if (savedActiveJobId) {
      setActiveJobId(savedActiveJobId);
      checkJobStatus(savedActiveJobId);
    }
    if (savedCurrentPage) {
      setCurrentPage(JSON.parse(savedCurrentPage));
    }

    // Load user's job history
    loadUserJobs();
  };

  // Load user's job history
  const loadUserJobs = () => {
    const jobs = reportService.getUserJobs();
    setUserJobs(jobs);
  };

  // Check job status and update UI
  const checkJobStatus = (jobId) => {
    const status = reportService.getJobStatus(jobId);
    setJobStatus(status);

    if (status) {
      switch (status.status) {
        case 'completed':
          // Job completed successfully
          setReportData(status.result);
          processReportData(status.result, true); // Reset to page 1 for new report
          setShowReport(true);
          setLoading(false);
          stopPolling();
          
          // Update form fields with job parameters
          if (status.parameters) {
            setSelectedCustomer(status.parameters.selectedCustomer || "");
            setDateFrom(status.parameters.dateFrom || "");
            setDateTo(status.parameters.dateTo || "");
          }
          break;
        case 'failed':
          // Job failed
          setLoading(false);
          stopPolling();
          alert(`Report generation failed: ${status.error}`);
          break;
        case 'processing':
          // Still processing, continue polling
          break;
      }
    }
  };

  // Start polling for job status
  const startPolling = (jobId) => {
    // Clear any existing interval
    stopPolling();

    // Check immediately
    checkJobStatus(jobId);

    // Set up interval for polling
    const interval = setInterval(() => {
      checkJobStatus(jobId);
    }, 1000); // Poll every 1 second

    setPollingInterval(interval);
  };

  // Stop polling
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  // Save active job ID to localStorage
  useEffect(() => {
    if (activeJobId) {
      localStorage.setItem("savedActiveJobId", activeJobId);
    } else {
      localStorage.removeItem("savedActiveJobId");
    }
  }, [activeJobId]);

  // Save current page to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("savedCurrentPage", JSON.stringify(currentPage));
  }, [currentPage]);

  // UPDATED: Generate report using background job system
  const generateReport = async () => {
    if (!selectedCustomer) {
      alert("Please select a customer first");
      return;
    }
    
    setLoading(true);
    setShouldResetPage(true); // Mark that we should reset to page 1 when the report is ready
    
    try {
      const parameters = {
        selectedCustomer,
        dateFrom,
        dateTo
      };

      // Start background job
      const jobId = await reportService.startReportGeneration(parameters, customers);
      
      // Set active job and start polling
      setActiveJobId(jobId);
      startPolling(jobId);
      
      // Reload job list to show new job
      loadUserJobs();

    } catch (error) {
      console.error("Error starting report generation:", error);
      setLoading(false);
      setShouldResetPage(false);
      alert("Failed to start report generation. Please try again.");
    }
  };

  // Process report data into flattened rows and paginate properly
  const processReportData = (data, resetPage = true) => {
    const rows = [];
    
    data.forEach((group, groupIndex) => {
      // Check if we need to add date header
      const shouldShowDate = groupIndex === 0 || 
        formatDateToDayMonth(group.docDate) !== formatDateToDayMonth(data[groupIndex - 1].docDate);
      
      if (shouldShowDate) {
        rows.push({
          type: 'date',
          content: formatDateToDayMonth(group.docDate),
          groupId: group.id,
          docDate: group.docDate,
          isGroupStart: true
        });
      }
      
      // Add AR Invoice number
      rows.push({
        type: 'invoice',
        content: group.id,
        groupId: group.id,
        docDate: group.docDate,
        isGroupStart: false
      });
      
      // Add items
      group.items.forEach((item, itemIndex) => {
        rows.push({
          type: 'item',
          content: item,
          groupId: group.id,
          docDate: group.docDate,
          isGroupStart: false
        });
      });
    });
    
    setFlattenedRows(rows);
    
    // Only reset page if explicitly requested AND shouldResetPage flag is true
    const shouldActuallyResetPage = resetPage && shouldResetPage;
    paginateRows(rows, shouldActuallyResetPage);
  };

  // Improved pagination that ensures all rows are visible and fits short paper
  const paginateRows = (rows, resetPage = true) => {
    const pages = [];
    
    // Conservative row counts to ensure all content fits on short paper
    const ROWS_PER_PAGE = {
      first: 33,  // First page has header
      middle: 38, // Middle pages have more space
      last: 25    // Last page has footer space
    };

    let currentIndex = 0;
    const totalRows = rows.length;

    while (currentIndex < totalRows) {
      const pageNumber = pages.length + 1;
      let rowsForThisPage;

      if (pageNumber === 1) {
        // First page - account for header
        rowsForThisPage = Math.min(ROWS_PER_PAGE.first, totalRows - currentIndex);
      } else if (currentIndex + ROWS_PER_PAGE.last >= totalRows) {
        // This will be the last page - account for footer
        rowsForThisPage = Math.min(ROWS_PER_PAGE.last, totalRows - currentIndex);
      } else {
        // Middle page
        rowsForThisPage = Math.min(ROWS_PER_PAGE.middle, totalRows - currentIndex);
      }

      const pageRows = rows.slice(currentIndex, currentIndex + rowsForThisPage);
      pages.push(pageRows);
      currentIndex += rowsForThisPage;
    }
    
    setPagesData(pages);
    setTotalPages(pages.length);
    
    // Only reset to page 1 when explicitly requested
    if (resetPage && shouldResetPage) {
      setCurrentPage(1);
      setShouldResetPage(false); // Reset the flag after using it
    }
  };

  // User info from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserName(parsed.username || "Unknown User");
        setUserCode(parsed.role || "Unknown Role");
      } catch (err) {
        console.error("Error parsing user from localStorage:", err);
        setUserName("Unknown User");
        setUserCode("Unknown Role");
      }
    } else {
      setUserName("Unknown User");
      setUserCode("Unknown Role");
    }
  }, []);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch("http://192.168.100.193:5000/api/nexchem/customer");
        const data = await res.json();
        setCustomers(data);
      } catch (err) {
        console.error("Error fetching customers:", err);
        setCustomers([
          { CardCode: "0912", CardName: "Necho Reyes" },
          { CardCode: "CUST001", CardName: "MALABING VALLEY MULTI-PURPOSE COOPERATIVE" },
          { CardCode: "CUST002", CardName: "GREEN VALLEY FARMERS" },
          { CardCode: "CUST003", CardName: "SUNRISE AGRICULTURAL COOP" }
        ]);
      }
    };
    fetchCustomers();
  }, []);

  // Function to generate initials
  const getInitials = (fullName) => {
    if (!fullName) return "??";
    const parts = fullName.trim().split(" ");
    const first = parts[0]?.charAt(0).toUpperCase() || "";
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() || "" : "";
    return first + last;
  };

  // Save report data to localStorage whenever it changes
  useEffect(() => {
    if (reportData.length > 0) {
      localStorage.setItem("savedReportData", JSON.stringify(reportData));
    }
  }, [reportData]);

  // Save report parameters to localStorage whenever they change
  useEffect(() => {
    const params = {
      selectedCustomer,
      dateFrom,
      dateTo
    };
    localStorage.setItem("savedReportParams", JSON.stringify(params));
  }, [selectedCustomer, dateFrom, dateTo]);

  // Save showReport state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("savedShowReport", JSON.stringify(showReport));
  }, [showReport]);

  // FIXED: Function to format date to "21-Aug" format
  const formatDateToDayMonth = (dateString) => {
    if (!dateString) return "Invalid Date";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      return `${day}-${month}`;
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid Date";
    }
  };

  // FIXED: Function to format date for display in table
  const formatDateForTable = (dateString) => {
    if (!dateString) return "Invalid Date";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error("Error formatting date for table:", error, dateString);
      return "Invalid Date";
    }
  };

  // Get selected customer name
  const getSelectedCustomerName = () => {
    const customer = customers.find(c => c.CardCode === selectedCustomer);
    return customer ? customer.CardName : "";
  };

  // Get selected customer code
  const getSelectedCustomerCode = () => {
    return selectedCustomer;
  };

  // UPDATED: Clear report function
  const clearReport = () => {
    setReportData([]);
    setFlattenedRows([]);
    setPagesData([]);
    setShowReport(false);
    setActiveJobId(null);
    setJobStatus(null);
    setSelectedCustomer("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
    setShouldResetPage(false);
    stopPolling();
    
    // Clear storage
    localStorage.removeItem("savedReportData");
    localStorage.removeItem("savedReportParams");
    localStorage.removeItem("savedShowReport");
    localStorage.removeItem("savedActiveJobId");
    localStorage.removeItem("savedCurrentPage");
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalQty = 0;
    let totalSales = 0;
    let totalKitanex = 0;

    reportData.forEach(group => {
      group.items.forEach(item => {
        totalQty += item.qty;
        totalSales += item.sales_amt;
        totalKitanex += item.total_kitanex;
      });
    });

    return { totalQty, totalSales, totalKitanex };
  };

  const { totalQty, totalSales, totalKitanex } = calculateTotals();

  // Get current date for report
  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get current date for filename
  const getCurrentDateForFilename = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  // Get rebate period based on DocDate from report data
  const getRebatePeriod = () => {
    if (reportData.length > 0) {
      const dates = reportData.map(item => new Date(item.docDate));
      const validDates = dates.filter(date => !isNaN(date.getTime()));
      
      if (validDates.length === 0) return "Invalid Dates";
      
      const minDate = new Date(Math.min(...validDates));
      const maxDate = new Date(Math.max(...validDates));
      
      if (minDate.getMonth() === maxDate.getMonth() && 
          minDate.getFullYear() === maxDate.getFullYear()) {
        
        const month = minDate.toLocaleString('en-US', { month: 'long' });
        const fromDay = minDate.getDate();
        const toDay = maxDate.getDate();
        const year = minDate.getFullYear();
        
        return `${month} ${fromDay} - ${toDay}, ${year}`;
      } else {
        const fromFormatted = minDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        const toFormatted = maxDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        return `${fromFormatted} - ${toFormatted}`;
      }
    } else if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      
      if (fromDate.getMonth() === toDate.getMonth() && 
          fromDate.getFullYear() === toDate.getFullYear()) {
        
        const month = fromDate.toLocaleString('en-US', { month: 'long' });
        const fromDay = fromDate.getDate();
        const toDay = toDate.getDate();
        const year = fromDate.getFullYear();
        
        return `${month} ${fromDay} - ${toDay}, ${year}`;
      } else {
        const fromFormatted = fromDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        const toFormatted = toDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        return `${fromFormatted} - ${toFormatted}`;
      }
    }
    return "All Dates";
  };

  // Get current page rows
  const getCurrentPageRows = () => {
    return pagesData[currentPage - 1] || [];
  };

  const currentPageRows = getCurrentPageRows();

  // FIXED: Pagination function - properly handles page changes without resetting
  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const isLastPage = currentPage === totalPages;
  const isFirstPage = currentPage === 1;

  // Generate filename for exports
  const generateFilename = (extension) => {
    const customerName = getSelectedCustomerName().replace(/[^a-zA-Z0-9]/g, '_');
    const date = getCurrentDateForFilename();
    return `${customerName}_KITANEX_REPORT_${date}.${extension}`;
  };

  // UPDATED: PDF Export that captures the preview exactly using html2canvas
  const exportToPDF = () => {
    const reportElement = document.getElementById('report-content');
    if (reportElement && typeof html2canvas !== 'undefined') {
      // Store current page to restore later
      const originalPage = currentPage;
      
      // Add temporary styling for clean capture
      const originalBackground = reportElement.style.background;
      const originalOverflow = reportElement.style.overflow;
      
      reportElement.style.background = 'white';
      reportElement.style.overflow = 'visible';
      
      // Capture each page individually
      const capturePage = (pageIndex) => {
        return new Promise((resolve) => {
          // Show the current page
          setCurrentPage(pageIndex + 1);
          
          // Wait for React to update and render the page
          setTimeout(() => {
            html2canvas(reportElement, {
              backgroundColor: '#ffffff',
              scale: 2,
              useCORS: true,
              logging: false,
              removeContainer: true,
              width: reportElement.scrollWidth,
              height: reportElement.scrollHeight
            }).then(canvas => {
              resolve(canvas);
            });
          }, 500);
        });
      };

      // Capture all pages
      const captureAllPages = async () => {
        const canvases = [];
        
        for (let i = 0; i < totalPages; i++) {
          const canvas = await capturePage(i);
          canvases.push(canvas);
        }
        
        return canvases;
      };

      captureAllPages().then(canvases => {
        // Restore original styling
        reportElement.style.background = originalBackground;
        reportElement.style.overflow = originalOverflow;
        
        // Create PDF
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'in',
          format: 'letter'
        });

        // Add each canvas as a page
        canvases.forEach((canvas, index) => {
          if (index > 0) {
            doc.addPage();
          }
          
          const imgData = canvas.toDataURL('image/png', 1.0);
          const imgWidth = 8.5;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        });

        // Save the PDF with proper filename
        doc.save(generateFilename('pdf'));
        
        // Restore original page
        setCurrentPage(originalPage);
      }).catch(error => {
        console.error('Error capturing pages:', error);
        reportElement.style.background = originalBackground;
        reportElement.style.overflow = originalOverflow;
        setCurrentPage(originalPage);
        alert('Error generating PDF. Please try again.');
      });
    } else {
      alert('PDF export requires html2canvas library. Please ensure it is installed.');
    }
  };

  // Enhanced Excel export with proper formatting and styling
  const exportToExcel = () => {
    const customerName = getSelectedCustomerName();
    const rebatePeriod = getRebatePeriod();
    const currentDate = getCurrentDate();
    
    // Create worksheet data with proper formatting
    const excelData = [
      // Header section
      ['Nexchem Corporation', '', '', '', ''],
      ['Sales Rebate Report - KITANEX', '', '', '', ''],
      ['', '', '', '', ''],
      [`Period: ${rebatePeriod}`, '', '', `Date: ${currentDate}`, ''],
      [`Customer: ${customerName}`, '', '', '', ''],
      ['', '', '', '', ''],
      
      // Column headers with styling indicators
      ['DESCRIPTION', 'QTY', 'SALES AMT', 'KITANEX', 'TOTAL KITANEX'],
      ['', '', '', '', '']
    ];

    // Track current group for formatting
    let currentDateGroup = '';
    
    // Add data rows with proper grouping and styling
    flattenedRows.forEach(row => {
      switch (row.type) {
        case 'date':
          currentDateGroup = row.content;
          excelData.push([row.content, '', '', '', '']); // Date row
          break;
        case 'invoice':
          excelData.push([`  ${row.content}`, '', '', '', '']); // Invoice row
          break;
        case 'item':
          excelData.push([
            `    ${row.content.name}`, // Indented item name
            row.content.qty,
            `₱${row.content.sales_amt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
            row.content.kitanex,
            `₱${row.content.total_kitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
          ]);
          break;
      }
    });

    // Add totals section
    excelData.push(['', '', '', '', '']);
    excelData.push(['GRAND TOTAL', totalQty, `₱${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, '', `₱${totalKitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);
    excelData.push(['', '', '', '', '']);
    excelData.push(['', '', '', '', '']);
    
    // Signature section
    excelData.push(['Prepared by:', '', 'Checked by:', '', '']);
    excelData.push([userName, '', 'Joy O. Sarcia', '', '']);
    excelData.push(['Marketing Associate', '', 'Purchasing Supervisor', '', '']);

    // Create downloadable Excel file with proper formatting
    let csvContent = "data:text/csv;charset=utf-8,";
    excelData.forEach(row => {
      csvContent += row.map(field => `"${field}"`).join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", generateFilename('csv'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Enhanced Word export with improved styling
  const exportToDocs = () => {
    const customerName = getSelectedCustomerName();
    const rebatePeriod = getRebatePeriod();
    const currentDate = getCurrentDate();
    
    // Create a formatted HTML version for Word/document export
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Kitanex Report - ${customerName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0.5in;
            color: #000;
            line-height: 1.4;
        }
        .header {
            margin-bottom: 20px;
        }
        .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .report-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .report-info {
            font-size: 11px;
            margin-bottom: 15px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #000;
            padding: 6px 8px;
            text-align: left;
        }
        th {
            background-color: #dbeafe;
            font-weight: bold;
            text-align: center;
        }
        .date-row {
            background-color: #f3f4f6;
            font-weight: bold;
        }
        .invoice-row {
            background-color: #f9fafb;
            font-weight: bold;
        }
        .item-row {
            background-color: #ffffff;
        }
        .item-row:nth-child(even) {
            background-color: #f8fafc;
        }
        .total-row {
            background-color: #e0f2fe;
            font-weight: bold;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
        }
        .signature-box {
            width: 45%;
        }
        .signature-line {
            border-top: 1px solid #000;
            margin-top: 60px;
            width: 80%;
        }
        .customer-header {
            background-color: #dbeafe;
            text-align: center;
            font-weight: bold;
            padding: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">NEXCHEM CORPORATION</div>
        <div class="report-title">SALES REBATE REPORT - KITANEX</div>
        <div class="report-info">
            <strong>Customer:</strong> ${customerName} | 
            <strong>Period:</strong> ${rebatePeriod} | 
            <strong>Date:</strong> ${currentDate}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th class="customer-header" style="width: 40%">${customerName}</th>
                <th style="width: 8%">QTY</th>
                <th style="width: 15%">SALES AMT</th>
                <th style="width: 8%">KITANEX</th>
                <th style="width: 15%">TOTAL KITANEX</th>
            </tr>
        </thead>
        <tbody>
    `;

    // Add data rows
    flattenedRows.forEach(row => {
      switch (row.type) {
        case 'date':
          htmlContent += `
            <tr class="date-row">
                <td colspan="5">${row.content}</td>
            </tr>`;
          break;
        case 'invoice':
          htmlContent += `
            <tr class="invoice-row">
                <td colspan="5">${row.content}</td>
            </tr>`;
          break;
        case 'item':
          htmlContent += `
            <tr class="item-row">
                <td>&nbsp;&nbsp;&nbsp;&nbsp;${row.content.name}</td>
                <td class="text-center">${row.content.qty.toLocaleString()}</td>
                <td class="text-right">₱${row.content.sales_amt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="text-center">${row.content.kitanex}</td>
                <td class="text-right">₱${row.content.total_kitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>`;
          break;
      }
    });

    // Add totals and signature section
    htmlContent += `
            <tr class="total-row">
                <td>Grand Total</td>
                <td class="text-center">${totalQty.toLocaleString()}</td>
                <td class="text-right">₱${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td></td>
                <td class="text-right">₱${totalKitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>
        </tbody>
    </table>

    <div class="signature-section">
        <div class="signature-box">
            <div><strong>Prepared by:</strong></div>
            <div class="signature-line"></div>
            <div>${userName}</div>
            <div>Marketing Associate</div>
        </div>
        <div class="signature-box">
            <div><strong>Checked by:</strong></div>
            <div class="signature-line"></div>
            <div>Joy O. Sarcia</div>
            <div>Purchasing Supervisor</div>
        </div>
    </div>
</body>
</html>`;

    // Create downloadable HTML file (can be opened in Word)
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateFilename('doc.html');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Enhanced PNG export that captures all pages
  const exportToPNG = () => {
    const reportElement = document.getElementById('report-content');
    if (reportElement && typeof html2canvas !== 'undefined') {
      // Store current page to restore later
      const originalPage = currentPage;
      
      // Capture each page individually
      const capturePage = (pageIndex) => {
        return new Promise((resolve) => {
          // Show the current page
          setCurrentPage(pageIndex + 1);
          
          // Wait for React to update and render the page
          setTimeout(() => {
            // Add temporary styling for clean capture
            const originalBackground = reportElement.style.background;
            reportElement.style.background = 'white';
            
            html2canvas(reportElement, {
              backgroundColor: '#ffffff',
              scale: 2,
              useCORS: true,
              logging: false,
              removeContainer: true,
              width: reportElement.scrollWidth,
              height: reportElement.scrollHeight
            }).then(canvas => {
              // Restore original background
              reportElement.style.background = originalBackground;
              resolve(canvas);
            });
          }, 500);
        });
      };

      // Capture all pages
      const captureAllPages = async () => {
        const canvases = [];
        
        for (let i = 0; i < totalPages; i++) {
          const canvas = await capturePage(i);
          canvases.push(canvas);
        }
        
        return canvases;
      };

      captureAllPages().then(canvases => {
        // Create a zip file containing all pages
        if (typeof JSZip !== 'undefined') {
          const zip = new JSZip();
          
          canvases.forEach((canvas, index) => {
            const imageData = canvas.toDataURL('image/png', 1.0).split(',')[1];
            zip.file(`page_${index + 1}.png`, imageData, {base64: true});
          });
          
          zip.generateAsync({type: 'blob'}).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = generateFilename('zip');
            link.click();
            URL.revokeObjectURL(link.href);
          });
        } else {
          // Fallback: download first page only
          const link = document.createElement('a');
          link.download = generateFilename('png');
          link.href = canvases[0].toDataURL('image/png', 1.0);
          link.click();
        }
        
        // Restore original page
        setCurrentPage(originalPage);
      }).catch(error => {
        console.error('Error capturing PNG pages:', error);
        setCurrentPage(originalPage);
        alert('Error capturing report as PNG. Please try again.');
      });
    } else {
      alert('PNG export requires html2canvas library. Please ensure it is installed.');
    }
  };

  // Enhanced JPG export that captures all pages
  const exportToJPG = () => {
    const reportElement = document.getElementById('report-content');
    if (reportElement && typeof html2canvas !== 'undefined') {
      // Store current page to restore later
      const originalPage = currentPage;
      
      // Capture each page individually
      const capturePage = (pageIndex) => {
        return new Promise((resolve) => {
          // Show the current page
          setCurrentPage(pageIndex + 1);
          
          // Wait for React to update and render the page
          setTimeout(() => {
            // Add temporary styling for clean capture
            const originalBackground = reportElement.style.background;
            reportElement.style.background = 'white';
            
            html2canvas(reportElement, {
              backgroundColor: '#ffffff',
              scale: 2,
              useCORS: true,
              logging: false,
              removeContainer: true,
              width: reportElement.scrollWidth,
              height: reportElement.scrollHeight
            }).then(canvas => {
              // Restore original background
              reportElement.style.background = originalBackground;
              resolve(canvas);
            });
          }, 500);
        });
      };

      // Capture all pages
      const captureAllPages = async () => {
        const canvases = [];
        
        for (let i = 0; i < totalPages; i++) {
          const canvas = await capturePage(i);
          canvases.push(canvas);
        }
        
        return canvases;
      };

      captureAllPages().then(canvases => {
        // Create a zip file containing all pages
        if (typeof JSZip !== 'undefined') {
          const zip = new JSZip();
          
          canvases.forEach((canvas, index) => {
            const imageData = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
            zip.file(`page_${index + 1}.jpg`, imageData, {base64: true});
          });
          
          zip.generateAsync({type: 'blob'}).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = generateFilename('zip');
            link.click();
            URL.revokeObjectURL(link.href);
          });
        } else {
          // Fallback: download first page only
          const link = document.createElement('a');
          link.download = generateFilename('jpg');
          link.href = canvases[0].toDataURL('image/jpeg', 0.95);
          link.click();
        }
        
        // Restore original page
        setCurrentPage(originalPage);
      }).catch(error => {
        console.error('Error capturing JPG pages:', error);
        setCurrentPage(originalPage);
        alert('Error capturing report as JPG. Please try again.');
      });
    } else {
      alert('JPG export requires html2canvas library. Please ensure it is installed.');
    }
  };

  // Render table row based on type
  const renderTableRow = (row, index) => {
    switch (row.type) {
      case 'date':
        return (
          <tr key={`date-${row.groupId}-${index}`} className="bg-gray-100">
            <td colSpan="5" className="p-1 font-semibold text-gray-800 border border-black text-xs">
              <div className="font-bold">{row.content}</div>
            </td>
          </tr>
        );
      
      case 'invoice':
        return (
          <tr key={`invoice-${row.groupId}-${index}`} className="bg-gray-50">
            <td colSpan="5" className="text-xs border font-semibold text-gray-800 border-black py-1 px-5">
              {row.content}
            </td>
          </tr>
        )
      
      case 'item':
        return (
          <tr key={`item-${row.groupId}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td className="p-1 border border-black text-xs pl-8">{row.content.name}</td>
            <td className="p-1 border border-black text-center text-xs">{row.content.qty.toLocaleString()}</td>
            <td className="p-1 border border-black text-right text-xs">₱{row.content.sales_amt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td className="p-1 border border-black text-center text-xs">{row.content.kitanex}</td>
            <td className="p-1 border border-black text-right text-xs">₱{row.content.total_kitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
        );
      
      default:
        return null;
    }
  };

  // FIXED: Load a completed report from job history
  const loadReportFromJob = (job) => {
    if (job.status === 'completed' && job.result) {
      setReportData(job.result);
      
      // Use a flag to prevent automatic page reset
      setShouldResetPage(false);
      
      // Process the data without resetting the page
      const rows = [];
      
      job.result.forEach((group, groupIndex) => {
        // Check if we need to add date header
        const shouldShowDate = groupIndex === 0 || 
          formatDateToDayMonth(group.docDate) !== formatDateToDayMonth(job.result[groupIndex - 1].docDate);
        
        if (shouldShowDate) {
          rows.push({
            type: 'date',
            content: formatDateToDayMonth(group.docDate),
            groupId: group.id,
            docDate: group.docDate,
            isGroupStart: true
          });
        }
        
        // Add AR Invoice number
        rows.push({
          type: 'invoice',
          content: group.id,
          groupId: group.id,
          docDate: group.docDate,
          isGroupStart: false
        });
        
        // Add items
        group.items.forEach((item, itemIndex) => {
          rows.push({
            type: 'item',
            content: item,
            groupId: group.id,
            docDate: group.docDate,
            isGroupStart: false
          });
        });
      });
      
      setFlattenedRows(rows);
      
      // Paginate without resetting to page 1
      const pages = [];
      const ROWS_PER_PAGE = {
        first: 33,
        middle: 38,
        last: 25
      };

      let currentIndex = 0;
      const totalRows = rows.length;

      while (currentIndex < totalRows) {
        const pageNumber = pages.length + 1;
        let rowsForThisPage;

        if (pageNumber === 1) {
          rowsForThisPage = Math.min(ROWS_PER_PAGE.first, totalRows - currentIndex);
        } else if (currentIndex + ROWS_PER_PAGE.last >= totalRows) {
          rowsForThisPage = Math.min(ROWS_PER_PAGE.last, totalRows - currentIndex);
        } else {
          rowsForThisPage = Math.min(ROWS_PER_PAGE.middle, totalRows - currentIndex);
        }

        const pageRows = rows.slice(currentIndex, currentIndex + rowsForThisPage);
        pages.push(pageRows);
        currentIndex += rowsForThisPage;
      }
      
      setPagesData(pages);
      setTotalPages(pages.length);
      
      // Keep the current page as is, don't reset to 1
      // Only set to page 1 if there are fewer pages than current page
      if (currentPage > pages.length) {
        setCurrentPage(1);
      }
      
      setShowReport(true);
      setActiveJobId(job.id);
      setJobStatus(job);
      setLoading(false);
      
      // Set the form fields with the job parameters
      if (job.parameters) {
        setSelectedCustomer(job.parameters.selectedCustomer || "");
        setDateFrom(job.parameters.dateFrom || "");
        setDateTo(job.parameters.dateTo || "");
      }
    }
  };

  // Cancel ongoing job
  const cancelJob = () => {
    if (activeJobId) {
      stopPolling();
      setLoading(false);
      setActiveJobId(null);
      setJobStatus(null);
      setShouldResetPage(false);
      localStorage.removeItem("savedActiveJobId");
    }
  };

  // Get status icon for job
  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get status text for job
  const getStatusText = (status) => {
    switch (status) {
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  // Format date for job list
  const formatJobDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 font-poppins text-slate-900 overflow-hidden">
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
              { icon: Home, label: "Dashboard", path: "/nexchem/dashboard" },
              { icon: FileText, label: "Rebate Setup", path: "/nexchem/rebatesetup" },
              { icon: BarChart2, label: "Reports", path: "/nexchem/nexchemreports" },
              { icon: Users, label: "Customer", path: "/nexchem/customer" },
              { icon: Package, label: "Items", path: "/nexchem/items" },
              { icon: IdCardLanyard, label: "Sales Employee", path: "/nexchem/salesemployee" },
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
              { icon: Settings, label: "Settings", path: "/nexchem/settings" },
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
                {getInitials(userName)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex flex-col text-right">
              <p className="text-base font-bold text-slate-800 whitespace-nowrap max-w-[150px]">
                {userName}
              </p>
              <p className="text-xs text-slate-600 rounded-full text-left font-medium">
                {userCode}
              </p>
            </div>
          </div>
        </header>

        {/* Enhanced Content Area */}
        <div className="pt-16 flex-1 p-8 overflow-y-auto">
          {/* Main Content Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 shadow-2xl p-8 w-full max-w-[1600px] mx-auto mt-6">
            {/* Page Header with Icon */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-blue-200">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <BarChart2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Rebate Reports</h1>
                <p className="text-sm text-gray-600">Generate and export detailed sales reports with rebate calculations</p>
              </div>
            </div>

            {/* Two-column layout for reports and job history */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Main report area - 3/4 width */}
              <div className="xl:col-span-3 space-y-6">
                {/* Action Buttons */}
                <div className="flex justify-between items-center gap-3 mb-6">
                  <div className="flex gap-3">
                    <button 
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={generateReport}
                      disabled={loading || !selectedCustomer}
                    >
                      <Eye size={16} />
                      {loading ? "Generating..." : "Generate Report"}
                    </button>
                    
                    {loading && activeJobId && (
                      <button 
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        onClick={cancelJob}
                      >
                        <XCircle size={16} />
                        Cancel
                      </button>
                    )}
                    
                    {showReport && reportData.length > 0 && (
                      <button 
                        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                        onClick={clearReport}
                      >
                        Clear Report
                      </button>
                    )}
                  </div>
                  
                  {/* Export Dropdown */}
                  <div className="relative">
                    <button 
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setShowExportDropdown(!showExportDropdown)}
                      disabled={!showReport || reportData.length ===  0}
                    >
                      <Download size={16} />
                      Export
                    </button>
                    
                    {showExportDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <div className="border-b border-gray-100 p-3 bg-gray-50">
                          <p className="text-sm font-semibold text-gray-700">Export Report</p>
                        </div>
                        
                        <button 
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                          onClick={() => { exportToPDF(); setShowExportDropdown(false); }}
                        >
                          <FileText className="w-4 h-4 text-red-500" />
                          <span>Export as PDF</span>
                        </button>
                        
                        <button 
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                          onClick={() => { exportToExcel(); setShowExportDropdown(false); }}
                        >
                          <FileSpreadsheet className="w-4 h-4 text-green-500" />
                          <span>Export as Excel</span>
                        </button>
                        
                        <button 
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                          onClick={() => { exportToDocs(); setShowExportDropdown(false); }}
                        >
                          <FileType className="w-4 h-4 text-blue-500" />
                          <span>Export as Word</span>
                        </button>
                        
                        <button 
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                          onClick={() => { exportToPNG(); setShowExportDropdown(false); }}
                        >
                          <Image className="w-4 h-4 text-purple-500" />
                          <span>Export as PNG</span>
                        </button>
                        
                        <button 
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                          onClick={() => { exportToJPG(); setShowExportDropdown(false); }}
                        >
                          <Image className="w-4 h-4 text-orange-500" />
                          <span>Export as JPG</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Report Parameters Card */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-blue-600" />
                        Customer Name
                      </label>
                      <select 
                        value={selectedCustomer} 
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      >
                        <option value="">Select Customer</option>
                        {customers.map(customer => (
                          <option key={customer.CardCode} value={customer.CardCode}>
                            {customer.CardCode}-{customer.CardName}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        Date From
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        Date To
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Job Status Indicator */}
                {loading && jobStatus && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(jobStatus.status)}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">
                          Report Generation in Progress
                        </p>
                        <p className="text-xs text-blue-600">
                          Job ID: {activeJobId} • Started: {formatJobDate(jobStatus.createdAt)}
                        </p>
                      </div>
                      <button 
                        onClick={cancelJob}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading State - enhanced */}
                {loading && (
                  <div className="flex items-center justify-center min-h-[400px] bg-gray-50/50 rounded-xl">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 w-full max-w-md flex flex-col items-center justify-center text-center">
                      <div className="relative mb-6">
                        <div className="w-16 h-16 border-4 border-gray-100 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">
                        Generating Your Report
                      </h3>
                      <p className="text-gray-600 mb-4 max-w-sm leading-relaxed">
                        Your report is being generated in the background. You can navigate to other pages and come back later.
                      </p>
                      {jobStatus && (
                        <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-sm font-medium text-blue-800">
                            Status: {getStatusText(jobStatus.status)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Report Preview Area */}
                {!loading && showReport && reportData.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Report Preview</h3>
                      <div className="text-sm text-gray-600">
                        Showing page {currentPage} of {totalPages} • {currentPageRows.length} rows
                      </div>
                    </div>

                    {/* Report Paper Short size */}
                    <div className="flex justify-center">
                      <div 
                        id="report-content" 
                        className="bg-white shadow-lg border p-8 relative"
                        style={{
                          width: '8.5in',
                          height: '11in',
                          minHeight: '11in'
                        }}
                      >
                        {/* Report Header - Only on first page */}
                        {isFirstPage && (
                        <div className="flex justify-between items-start -mb-5">
                          <img 
                            src={nexchemReport} 
                            alt="Nexchem Report" 
                            className="w-[180px] h-auto -mt-12 -mb-5"
                          />
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-800 mb-1">KITANEX</div>
                            <div className="text-xs text-gray-600 mb-8">
                              {getRebatePeriod()}
                            </div>
                            <div className="text-xs text-gray-500">{getCurrentDate()}</div>
                          </div>
                        </div>
                        )}

                        {/* Report Table with proper spacing */}
                        <div className="overflow-x-auto mt-2">
                          <table className="w-full border-collapse text-xs border border-black">
                            {/* Table Header - Only on first page */}
                            {isFirstPage && (
                              <thead>
                                <tr>
                                  <th className="bg-blue-100 text-center border border-black align-middle py-2 px-1 leading-tight font-semibold" style={{width: '40%'}}>
                                    {getSelectedCustomerName()}
                                  </th>
                                  <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-2 px-1 leading-tight" style={{width: '8%'}}>QTY</th>
                                  <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-2 px-1 leading-tight" style={{width: '15%'}}>SALES AMT</th>
                                  <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-2 px-1 leading-tight" style={{width: '8%'}}>KITANEX</th>
                                  <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-2 px-1 leading-tight" style={{width: '15%'}}>TOTAL KITANEX</th>
                                </tr>
                              </thead>
                            )}
                            <tbody>
                              {currentPageRows.map((row, index) => renderTableRow(row, index))}
                            </tbody>
                            
                            {/* Grand Total - Only on last page */}
                            {isLastPage && (
                              <tfoot>
                                <tr className="bg-blue-50">
                                  <td className="p-1 font-semibold border border-black text-xs align-middle">Grand Total</td>
                                  <td className="p-1 font-semibold border border-black text-center text-xs align-middle">{totalQty.toLocaleString()}</td>
                                  <td className="p-1 font-semibold border border-black text-right text-xs align-middle">₱{totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                  <td className="p-1 font-semibold border border-black text-xs align-middle"></td>
                                  <td className="p-1 font-semibold border border-black text-right text-xs align-middle">₱{totalKitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>

                        {/* Report Footer with Signatories - Only on last page */}
                        {isLastPage && (
                          <div className="mt-8 pt-4">
                            <div className="grid grid-cols-2 gap-8">
                              <div className="text-left">
                                <p className="text-xs font-medium text-gray-800 mb-6">Prepared by:</p>
                                <div className="mt-8">
                                  <div className="pt-2 w-48">
                                    <p className="font-semibold text-gray-800 text-xs">{userName}</p>
                                    <p className="text-gray-600 text-xs">Marketing Associate</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-left">
                                <p className="text-xs font-medium text-gray-800 mb-6">Checked by:</p>
                                <div className="mt-8">
                                  <div className="pt-2 w-48">
                                    <p className="font-semibold text-gray-800 text-xs">Joy O. Sarcia</p>
                                    <p className="text-gray-600 text-xs">Purchasing Supervisor</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Page Number - Always at bottom */}
                        <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-500">
                          Page {currentPage} of {totalPages}
                        </div>
                      </div>
                    </div>

                    {/* Pagination Controls - Show only if multiple pages */}
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-2 py-6 bg-gray-50 border-t border-gray-200 mt-6">
                        <button 
                          onClick={() => paginate(currentPage - 1)} 
                          disabled={currentPage === 1}
                          className="px-4 py-2 border border-gray-300 bg-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-500 transition-colors"
                        >
                          Previous
                        </button>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => paginate(page)}
                            className={`px-3 py-2 border text-sm rounded min-w-[40px] ${
                              currentPage === page 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500'
                            } transition-colors`}
                          >
                            {page}
                          </button>
                        ))}
                        
                        <button 
                          onClick={() => paginate(currentPage + 1)} 
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 border border-gray-300 bg-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-500 transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {!loading && !showReport && !activeJobId && (
                  <div className="flex justify-center">
                    <div 
                      className="bg-white border-2 border-dashed border-gray-300 flex items-center justify-center rounded-xl"
                      style={{
                        width: '8.5in',
                        height: '11in'
                      }}
                    >
                      <div className="text-gray-500 text-lg text-center">
                        Select parameters and click 'Generate Report' to preview
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Job History Sidebar - 1/4 width */}
              <div className="xl:col-span-1">
                <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-800">Recent Reports</h3>
                  </div>
                  
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {userJobs.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No recent reports
                      </p>
                    ) : (
                      userJobs.map((job) => (
                        <div 
                          key={job.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                            activeJobId === job.id 
                              ? 'border-blue-300 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => loadReportFromJob(job)}
                        >
                          <div className="flex items-start gap-2">
                            {getStatusIcon(job.status)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {job.customerName || 'Unknown Customer'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatJobDate(job.createdAt)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  job.status === 'completed' 
                                    ? 'bg-green-100 text-green-800'
                                    : job.status === 'processing'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {getStatusText(job.status)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {userJobs.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button 
                        onClick={loadUserJobs}
                        className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Refresh List
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Nexchem_Reports;