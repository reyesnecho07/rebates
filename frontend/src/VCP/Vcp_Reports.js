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
  Image,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import Logo from "../Logo";
import nexchemReport from '../assets/nexchemreport.png'; 
import html2canvas from "html2canvas";

// Import jsPDF properly
import { jsPDF } from "jspdf";
import JSZip from "jszip";

function Vcp_Reports() {

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

  // Load saved report data from localStorage on component mount
  useEffect(() => {
    const savedReportData = localStorage.getItem("savedReportData");
    const savedReportParams = localStorage.getItem("savedReportParams");
    const savedShowReport = localStorage.getItem("savedShowReport");

    if (savedReportData) {
      const data = JSON.parse(savedReportData);
      setReportData(data);
      processReportData(data);
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
  }, []);

  // Process report data into flattened rows and paginate properly
  const processReportData = (data) => {
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
    paginateRows(rows);
  };

  // Improved pagination that ensures all rows are visible and fits short paper
  const paginateRows = (rows) => {
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
    setCurrentPage(1);
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
        const res = await fetch("http://192.168.100.193:5000/api/vcp/customer");
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

  // Function to generate random KITANEX value (between 5-40)
  const generateRandomKitanex = () => {
    return Math.floor(Math.random() * 36) + 5;
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

  // FIXED: Generate report data from AR Invoice API with proper date handling
  const generateReport = async () => {
    if (!selectedCustomer) {
      alert("Please select a customer first");
      return;
    }
    
    setLoading(true);
    
    try {
      // Fetch invoice data from API
      const response = await fetch("http://192.168.100.193:5000/api/vcp/invoice");
      const invoiceData = await response.json();

      // Get the selected customer's name
      const selectedCustomerName = getSelectedCustomerName();
      
      console.log("Selected customer:", selectedCustomerName);
      console.log("Total invoices fetched:", invoiceData.length);
      
      // Filter data based on selected customer and date range using Docdate
      let filteredData = invoiceData.filter(invoice => {
        // Match by customer name
        const customerMatch = invoice.CardName === selectedCustomerName;
        if (!customerMatch) return false;

        // Apply date filter if dates are selected - USING Docdate from API
        if (dateFrom && dateTo) {
          try {
            // Parse dates properly
            const invoiceDate = new Date(invoice.Docdate);
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            
            // Set to end of day for toDate to include the entire day
            toDate.setHours(23, 59, 59, 999);
            
            // Check if invoice date is within range
            const isInRange = invoiceDate >= fromDate && invoiceDate <= toDate;
            
            if (!isInRange) {
              console.log(`Date out of range: ${invoice.Docdate} not between ${dateFrom} and ${dateTo}`);
            }
            
            return isInRange;
          } catch (error) {
            console.error("Error parsing dates:", error);
            return true; // Include if date parsing fails
          }
        }
        
        return true; // Include all if no date filter
      });

      console.log("Filtered invoices:", filteredData.length);

      // Group data by DocNum (AR Invoice number)
      const groupedData = filteredData.reduce((acc, invoice) => {
        const docNum = invoice.DocNum.toString();
        if (!acc[docNum]) {
          acc[docNum] = {
            id: docNum,
            docDate: invoice.Docdate, // Using Docdate from API
            items: []
          };
        }
        
        // Generate random KITANEX value for each item
        const kitanex = generateRandomKitanex();
        
        acc[docNum].items.push({
          name: invoice.Dscription,
          qty: invoice.Quantity,
          sales_amt: invoice.LineTotal,
          kitanex: kitanex,
          total_kitanex: kitanex * invoice.Quantity
        });
        
        return acc;
      }, {});

      // Convert grouped data to array format and sort by DocDate
      const reportDataArray = Object.values(groupedData).sort((a, b) => {
        return new Date(a.docDate) - new Date(b.docDate);
      });

      console.log("Final report data:", reportDataArray);

      setReportData(reportDataArray);
      processReportData(reportDataArray);
      setLoading(false);
      setShowReport(true);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error generating report:", error);
      
      // Fallback to mock data if API fails
      console.log("Using fallback mock data...");
      const mockData = generateMockData();
      setReportData(mockData);
      processReportData(mockData);
      setLoading(false);
      setShowReport(true);
      setCurrentPage(1);
    }
  };

  // Generate mock data for testing
  const generateMockData = () => {
    const customerName = getSelectedCustomerName();
    const mockInvoices = [];
    
    const invoiceCount = Math.floor(Math.random() * 3) + 3;
    
    let startDate, endDate;
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      endDate = new Date(dateTo);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
    
    for (let i = 0; i < invoiceCount; i++) {
      const invoiceNum = `INV${1000 + i}`;
      
      const timeDiff = endDate.getTime() - startDate.getTime();
      const randomTime = startDate.getTime() + Math.random() * timeDiff;
      const docDate = new Date(randomTime);
      
      const invoice = {
        id: invoiceNum,
        docDate: docDate.toISOString(),
        items: []
      };
      
      const itemCount = Math.floor(Math.random() * 3) + 2;
      for (let j = 0; j < itemCount; j++) {
        const kitanex = generateRandomKitanex();
        const qty = Math.floor(Math.random() * 100) + 10;
        const salesAmt = (Math.random() * 1000 + 100).toFixed(2);
        
        invoice.items.push({
          name: `Product ${String.fromCharCode(65 + j)}`,
          qty: qty,
          sales_amt: parseFloat(salesAmt),
          kitanex: kitanex,
          total_kitanex: kitanex * qty
        });
      }
      
      mockInvoices.push(invoice);
    }
    
    return mockInvoices.sort((a, b) => new Date(a.docDate) - new Date(b.docDate));
  };

  // Clear report function
  const clearReport = () => {
    setReportData([]);
    setFlattenedRows([]);
    setPagesData([]);
    setShowReport(false);
    setSelectedCustomer("");
    setDateFrom("");
    setDateTo("");
    localStorage.removeItem("savedReportData");
    localStorage.removeItem("savedReportParams");
    localStorage.removeItem("savedShowReport");
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

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
        setCurrentPage(1);
      }).catch(error => {
        console.error('Error capturing pages:', error);
        reportElement.style.background = originalBackground;
        reportElement.style.overflow = originalOverflow;
        setCurrentPage(1);
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



  // Enhanced PNG export that captures all pages
  const exportToPNG = () => {
    const reportElement = document.getElementById('report-content');
    if (reportElement && typeof html2canvas !== 'undefined') {
      
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
        setCurrentPage(1);
      }).catch(error => {
        console.error('Error capturing PNG pages:', error);
        setCurrentPage(1);
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
        setCurrentPage(1);
      }).catch(error => {
        console.error('Error capturing JPG pages:', error);
        setCurrentPage(1);
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
                <h1 className="text-2xl font-bold text-gray-800">Sales Reports</h1>
                <p className="text-sm text-gray-600">Generate and export detailed sales reports with rebate calculations</p>
              </div>
            </div>

            {/* Action Buttons - Right aligned */}
            <div className="flex justify-end gap-3 mb-6">
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={generateReport}
                disabled={loading || !selectedCustomer}
              >
                <Eye size={16} />
                {loading ? "Generating Reports..." : "Generate Report"}
              </button>
              
              {showReport && reportData.length > 0 && (
                <button 
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                  onClick={clearReport}
                >
                  Clear Report
                </button>
              )}
              
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

            {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center min-h-[500px] bg-gray-50/50">
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-16 w-full max-w-2xl flex flex-col items-center justify-center text-center">
                    {/* Spinner */}
                    <div className="relative mb-8">
                      <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                      <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    </div>
                    
                    {/* Title */}
                    <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                      Report Generation in Progress
                    </h3>
                    
                    {/* Description */}
                    <p className="text-gray-600 text-lg mb-2 max-w-md leading-relaxed">
                      We are currently compiling your sales report. This process may take a few moments to complete.
                    </p>
                    
                    {/* Customer Info */}
                    <div className="mt-6 px-4 py-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm font-medium text-blue-800">
                        Processing data for: <span className="font-semibold">{getSelectedCustomerName()}</span>
                      </p>
                    </div>
                    
                    {/* Additional Info */}
                    <div className="mt-4 text-sm text-gray-500">
                      Please do not refresh or navigate away from this page
                    </div>
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
            {!loading && !showReport && (
              <div className="flex justify-center">
                <div 
                  className="bg-white border-2 border-dashed border-gray-300 flex items-center justify-center"
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
        </div>
      </main>
    </div>
  );
}

export default Vcp_Reports;