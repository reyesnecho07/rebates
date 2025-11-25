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
} from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "./Logo";
import nexchemReport from './assets/nexchemreport.png'; 
import html2canvas from "html2canvas";

// Import jsPDF properly
import { jsPDF } from "jspdf";
import JSZip from "jszip";

function Van_Reports() {
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

  // Improved pagination for landscape layout
  const paginateRows = (rows) => {
    const pages = [];
    
    // Conservative row counts for landscape layout
    const ROWS_PER_PAGE = {
      first: 25,  // First page has header
      middle: 30, // Middle pages have more space
      last: 20    // Last page has footer space
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
        const res = await fetch("http://192.168.100.193:5000/api/customer");
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

  // Generate mock data based on the image layout
  const generateMockChequeData = () => {
    const mockData = [
      {
        id: "INV001",
        docDate: "2025-07-15",
        items: [
          { name: "GUIDED TRADING", qty: 500, sales_amt: 13187.50, kitanex: 25, total_kitanex: 13187.50 },
          { name: "MARIA FIE ROSALES", qty: 500, sales_amt: 13187.50, kitanex: 25, total_kitanex: 13187.50 }
        ]
      },
      {
        id: "INV002", 
        docDate: "2025-07-20",
        items: [
          { name: "SERICO CORGONIA", qty: 300, sales_amt: 16500.00, kitanex: 55, total_kitanex: 16500.00 },
          { name: "HARMATIO LONERIA", qty: 300, sales_amt: 25875.00, kitanex: 86.25, total_kitanex: 25875.00 }
        ]
      },
      {
        id: "INV003",
        docDate: "2025-08-05", 
        items: [
          { name: "JAMIE MAHINAY JR.", qty: 300, sales_amt: 35300.00, kitanex: 117.67, total_kitanex: 35300.00 },
          { name: "LEVI STORE", qty: 300, sales_amt: 21700.00, kitanex: 72.33, total_kitanex: 21700.00 }
        ]
      },
      {
        id: "INV004",
        docDate: "2025-08-15",
        items: [
          { name: "NAVA AGRIVET SUPPLY", qty: 300, sales_amt: 61170.00, kitanex: 203.90, total_kitanex: 61170.00 },
          { name: "KEVEN DRINA", qty: 300, sales_amt: 54400.00, kitanex: 181.33, total_kitanex: 54400.00 }
        ]
      },
      {
        id: "INV005",
        docDate: "2025-09-10",
        items: [
          { name: "CARINA EVANGELISTA", qty: 300, sales_amt: 64400.00, kitanex: 214.67, total_kitanex: 64400.00 },
          { name: "REAGE STORE", qty: 300, sales_amt: 7120.00, kitanex: 23.73, total_kitanex: 7120.00 }
        ]
      },
      {
        id: "INV006",
        docDate: "2025-09-25",
        items: [
          { name: "BONY SAND-SAIR STORE", qty: 300, sales_amt: 7120.00, kitanex: 23.73, total_kitanex: 7120.00 },
          { name: "MY AND AAGRUET", qty: 300, sales_amt: 28850.00, kitanex: 96.17, total_kitanex: 28850.00 }
        ]
      }
    ];

    return mockData;
  };

  // FIXED: Generate report data from AR Invoice API with proper date handling
  const generateReport = async () => {
    if (!selectedCustomer) {
      alert("Please select a customer first");
      return;
    }
    
    setLoading(true);
    
    try {
      // Use mock data for demonstration
      console.log("Using mock cheque data for demonstration...");
      const mockData = generateMockChequeData();
      setReportData(mockData);
      processReportData(mockData);
      setLoading(false);
      setShowReport(true);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error generating report:", error);
      
      // Fallback to mock data
      console.log("Using fallback mock data...");
      const mockData = generateMockChequeData();
      setReportData(mockData);
      processReportData(mockData);
      setLoading(false);
      setShowReport(true);
      setCurrentPage(1);
    }
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

  // Get rebate period based on image format
  const getRebatePeriod = () => {
    return "3RD QUARTER (JULY - SEPTEMBER 2025)";
  };

  // Get area based on image
  const getArea = () => {
    return "MORTIRON SAMAR";
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
    return `${customerName}_CHEQUE_REBATES_${date}.${extension}`;
  };

  // UPDATED: PDF Export for landscape
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
        
        // Create PDF in landscape
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'in',
          format: 'letter'
        });

        // Add each canvas as a page
        canvases.forEach((canvas, index) => {
          if (index > 0) {
            doc.addPage();
          }
          
          const imgData = canvas.toDataURL('image/png', 1.0);
          const imgWidth = 11; // Landscape width
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
      ['VIST', '', '', '', '', '', '', '', '', ''],
      ['MCC. RAPH, LEO', '', '', '', '', '', '', '', '', ''],
      [`AREA: ${getArea()}`, '', '', '', '', '', '', '', '', ''],
      [`PERIOD: ${rebatePeriod}`, '', '', '', '', '', '', '', '', ''],
      ['LIST OF APPROVED CHEQUE REBATES - VAN', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      
      // Column headers
      ['CHEQUE NAME', 'DEALERS NAME', 'SALES PROGRAM FOR TARGET', 'PREMIUM', 'TARGET', 'COMPLETE HOODING', 'TRY', 'GRANDE', 'THREE PACE', 'TOTAL AMOUNT'],
      ['', '', 'age/sex (100-199)', '(200-299)', 'SUBAD (300-999 up)', 'ORT @PT0R9s', 'JULY', 'AUG', 'SEP', '']
    ];

    // Add data rows
    reportData.forEach(group => {
      group.items.forEach(item => {
        excelData.push([
          item.name,
          `${item.name}-BRANCH(1-5)`,
          '100',
          '200', 
          '300',
          '300',
          item.sales_amt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
          '',
          '',
          item.total_kitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
        ]);
      });
    });

    // Add totals
    excelData.push(['', '', '', '', '', '', '', '', '', '']);
    excelData.push(['GRAND TOTAL', '', '', '', '', '', 
      totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}), 
      '', '', 
      totalKitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})]);

    // Signature section
    excelData.push(['', '', '', '', '', '', '', '', '', '']);
    excelData.push(['Prepared by:', '', 'Reviewed by:', '', 'Checked by:', '', 'Marketing Associate:', '', 'General Manager:', '']);
    excelData.push([userName, '', 'TESSE CARDIGO', '', 'JUNY MARADELLAS', '', 'JERRALD S.L.O', '', 'LITO C. NUELES', '']);
    excelData.push(['Marketing Associate', '', 'Marketing Head', '', 'District Manager', '', 'Marketing Associate', '', 'District Manager - Head', '']);

    // Create downloadable Excel file
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
    <title>Cheque Rebates Report - ${customerName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0.2in;
            color: #000;
            line-height: 1.2;
            transform: rotate(0deg);
        }
        .header {
            margin-bottom: 10px;
            text-align: center;
        }
        .company-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 2px;
        }
        .report-title {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .report-info {
            font-size: 10px;
            margin-bottom: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            margin-bottom: 15px;
        }
        th, td {
            border: 1px solid #000;
            padding: 3px 4px;
            text-align: center;
        }
        th {
            background-color: #dbeafe;
            font-weight: bold;
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
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
        }
        .signature-box {
            text-align: center;
            width: 18%;
        }
        .signature-line {
            border-top: 1px solid #000;
            margin-top: 20px;
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">VIST</div>
        <div class="company-name">MCC. RAPH, LEO</div>
        <div class="report-info"><strong>AREA:</strong> ${getArea()}</div>
        <div class="report-info"><strong>PERIOD:</strong> ${rebatePeriod}</div>
        <div class="report-title">LIST OF APPROVED CHEQUE REBATES - VAN</div>
    </div>

    <table>
        <thead>
            <tr>
                <th rowspan="2">CHEQUE NAME</th>
                <th rowspan="2">DEALERS NAME</th>
                <th colspan="4">SALES PROGRAM FOR TARGET</th>
                <th colspan="3">ACTUAL SALES</th>
                <th rowspan="2">TOTAL AMOUNT</th>
            </tr>
            <tr>
                <th>age/sex (100-199)</th>
                <th>(200-299)</th>
                <th>SUBAD (300-999 up)</th>
                <th>ORT @PT0R9s</th>
                <th>JULY</th>
                <th>AUG</th>
                <th>SEP</th>
            </tr>
        </thead>
        <tbody>
    `;

    // Add data rows
    reportData.forEach(group => {
      group.items.forEach(item => {
        htmlContent += `
            <tr>
                <td>${item.name}</td>
                <td>${item.name}-BRANCH(1-5)</td>
                <td>100</td>
                <td>200</td>
                <td>300</td>
                <td>300</td>
                <td class="text-right">${item.sales_amt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td></td>
                <td></td>
                <td class="text-right">${item.total_kitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>`;
      });
    });

    // Add totals and signature section
    htmlContent += `
            <tr class="total-row">
                <td colspan="6">GRAND TOTAL</td>
                <td class="text-right">${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td></td>
                <td></td>
                <td class="text-right">${totalKitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
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
            <div><strong>Reviewed by:</strong></div>
            <div class="signature-line"></div>
            <div>TESSE CARDIGO</div>
            <div>Marketing Head</div>
        </div>
        <div class="signature-box">
            <div><strong>Checked by:</strong></div>
            <div class="signature-line"></div>
            <div>JUNY MARADELLAS</div>
            <div>District Manager</div>
        </div>
        <div class="signature-box">
            <div><strong>Marketing Associate:</strong></div>
            <div class="signature-line"></div>
            <div>JERRALD S.L.O</div>
            <div>Marketing Associate</div>
        </div>
        <div class="signature-box">
            <div><strong>General Manager:</strong></div>
            <div class="signature-line"></div>
            <div>LITO C. NUELES</div>
            <div>District Manager - Head</div>
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

  // Enhanced PNG export for landscape
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

  // Enhanced JPG export for landscape
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

  // Render table row based on type - Updated for landscape layout
  const renderTableRow = (row, index) => {
    switch (row.type) {
      case 'date':
        return (
          <tr key={`date-${row.groupId}-${index}`} className="bg-gray-100">
            <td colSpan="10" className="p-1 font-semibold text-gray-800 border border-black text-xs text-center">
              <div className="font-bold">{row.content}</div>
            </td>
          </tr>
        );
      
      case 'invoice':
        return (
          <tr key={`invoice-${row.groupId}-${index}`} className="bg-gray-50">
            <td colSpan="10" className="text-xs border font-semibold text-gray-800 border-black py-1 px-5">
              {row.content}
            </td>
          </tr>
        )
      
      case 'item':
        return (
          <tr key={`item-${row.groupId}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td className="p-1 border border-black text-xs text-center">{row.content.name}</td>
            <td className="p-1 border border-black text-xs text-center">{row.content.name}-BRANCH(1-5)</td>
            <td className="p-1 border border-black text-center text-xs">100</td>
            <td className="p-1 border border-black text-center text-xs">200</td>
            <td className="p-1 border border-black text-center text-xs">300</td>
            <td className="p-1 border border-black text-center text-xs">300</td>
            <td className="p-1 border border-black text-right text-xs">₱{row.content.sales_amt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td className="p-1 border border-black text-center text-xs"></td>
            <td className="p-1 border border-black text-center text-xs"></td>
            <td className="p-1 border border-black text-right text-xs">₱{row.content.total_kitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white font-poppins text-black overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-300 flex flex-col transition-all duration-300 z-50 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header with Toggle */}
        <div className="flex items-center justify-between p-4 border-gray-200 relative">
          {!collapsed && (
            <h2 className="font-bold text-gray-800 whitespace-nowrap">
              Rebate Management
            </h2>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors ${
              collapsed ? "absolute top-4 left-5" : ""
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            <li>
              <Link 
                to="/dashboard" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/dashboard"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/dashboard")}
              >
                <Home className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Dashboard
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/rebatesetup" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/rebatesetup"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/rebatesetup")}
              >
                <FileText className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Rebate Setup
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/nexchemreports" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/reports"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/reports")}
              >
                <BarChart2 className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Reports
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/customer" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/customer"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/customer")}
              >
                <Users className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Customer
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/items" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/items"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/items")}
              >
                <Package className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Items
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/salesemployee" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/salesemployee"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/salesemployee")}
              >
                <IdCardLanyard className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Sales Employee
                </span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="mt-auto p-3">
          <ul className="space-y-1">
            <li>
              <Link 
                to="/settings" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/settings"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/settings")}
              >
                <Settings className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Settings
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/accountsetup" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/accountsetup"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/accountsetup")}
              >
                <User className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Account Setup
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/login" 
                className="flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all hover:bg-gray-50 hover:text-blue-500"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Logout
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header */}
        <header className="fixed top-0 right-0 h-16 flex items-center px-6 bg-white border-b border-gray-300 z-40 transition-all duration-300"
          style={{ 
            left: collapsed ? '80px' : '256px',
            width: collapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
          }}
        >
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Logo size={90} />
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-4 ml-auto mr-8">
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white font-semibold text-sm flex items-center justify-center uppercase shadow-sm">
              {getInitials(userName)}
            </div>
            <div className="flex flex-col text-right">
              <p className="text-base font-semibold text-gray-800 whitespace-nowrap max-w-[150px] overflow-hidden">
                {userName}
              </p>
              <p className="text-xs text-gray-600 text-left">
                {userCode}
              </p>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="pt-16 flex-1 p-6 overflow-y-auto">
          {/* Main Content Card */}
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl border border-blue-100 shadow-lg p-8 w-full max-w-[1600px] mx-auto mt-6">
            {/* Page Header with Icon */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-blue-200">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <BarChart2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Cheque Rebates Reports</h1>
                <p className="text-sm text-gray-600">Generate and export detailed cheque rebates reports</p>
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
                      We are currently compiling your cheque rebates report. This process may take a few moments to complete.
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

                {/* Report Paper Landscape size */}
                <div className="flex justify-center">
                  <div 
                    id="report-content" 
                    className="bg-white shadow-lg border p-6 relative"
                    style={{
                      width: '11in',
                      height: '8.5in',
                      minHeight: '8.5in'
                    }}
                  >
                    {/* Report Header - Always show */}
                    <div className="text-center mb-4">
                      <div className="text-sm font-bold mb-1">VIST</div>
                      <div className="text-sm font-bold mb-1">MCC. RAPH, LEO</div>
                      <div className="text-xs mb-1">
                        <strong>AREA:</strong> {getArea()}
                      </div>
                      <div className="text-xs mb-2">
                        <strong>PERIOD:</strong> {getRebatePeriod()}
                      </div>
                      <div className="text-sm font-bold mb-2">
                        LIST OF APPROVED CHEQUE REBATES - VAN
                      </div>
                    </div>

                    {/* Report Table with proper spacing */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs border border-black">
                        {/* Table Header - Always show */}
                        <thead>
                          <tr>
                            <th rowSpan={2} className="bg-blue-100 text-center border border-black align-middle py-1 px-1 leading-tight font-semibold" style={{width: '12%'}}>
                              CHEQUE NAME
                            </th>
                            <th rowSpan={2} className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '15%'}}>
                              DEALERS NAME
                            </th>
                            <th colSpan={4} className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight">
                              SALES PROGRAM FOR TARGET
                            </th>
                            <th colSpan={3} className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight">
                              ACTUAL SALES
                            </th>
                            <th rowSpan={2} className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '10%'}}>
                              TOTAL AMOUNT
                            </th>
                          </tr>
                          <tr>
                            <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '8%'}}>
                              age/sex (100-199)
                            </th>
                            <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '8%'}}>
                              (200-299)
                            </th>
                            <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '8%'}}>
                              SUBAD (300-999 up)
                            </th>
                            <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '8%'}}>
                              ORT @PT0R9s
                            </th>
                            <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '8%'}}>
                              JULY
                            </th>
                            <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '8%'}}>
                              AUG
                            </th>
                            <th className="bg-blue-100 text-center font-semibold border border-black align-middle py-1 px-1 leading-tight" style={{width: '8%'}}>
                              SEP
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPageRows.map((row, index) => renderTableRow(row, index))}
                        </tbody>
                        
                        {/* Grand Total - Only on last page */}
                        {isLastPage && (
                          <tfoot>
                            <tr className="bg-blue-50">
                              <td colSpan={6} className="p-1 font-semibold border border-black text-xs align-middle text-center">
                                GRAND TOTAL
                              </td>
                              <td className="p-1 font-semibold border border-black text-right text-xs align-middle">
                                ₱{totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </td>
                              <td className="p-1 font-semibold border border-black text-xs align-middle"></td>
                              <td className="p-1 font-semibold border border-black text-xs align-middle"></td>
                              <td className="p-1 font-semibold border border-black text-right text-xs align-middle">
                                ₱{totalKitanex.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Report Footer with Signatories - Only on last page */}
                    {isLastPage && (
                      <div className="mt-4 pt-2">
                        <div className="grid grid-cols-5 gap-2 text-center">
                          <div className="text-xs">
                            <p className="font-medium text-gray-800 mb-4">Prepared by:</p>
                            <div className="mt-6">
                              <div className="pt-1">
                                <p className="font-semibold text-gray-800 text-xs">{userName}</p>
                                <p className="text-gray-600 text-xs">Marketing Associate</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-xs">
                            <p className="font-medium text-gray-800 mb-4">Reviewed by:</p>
                            <div className="mt-6">
                              <div className="pt-1">
                                <p className="font-semibold text-gray-800 text-xs">TESSE CARDIGO</p>
                                <p className="text-gray-600 text-xs">Marketing Head</p>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs">
                            <p className="font-medium text-gray-800 mb-4">Checked by:</p>
                            <div className="mt-6">
                              <div className="pt-1">
                                <p className="font-semibold text-gray-800 text-xs">JUNY MARADELLAS</p>
                                <p className="text-gray-600 text-xs">District Manager</p>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs">
                            <p className="font-medium text-gray-800 mb-4">Marketing Associate:</p>
                            <div className="mt-6">
                              <div className="pt-1">
                                <p className="font-semibold text-gray-800 text-xs">JERRALD S.L.O</p>
                                <p className="text-gray-600 text-xs">Marketing Associate</p>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs">
                            <p className="font-medium text-gray-800 mb-4">General Manager:</p>
                            <div className="mt-6">
                              <div className="pt-1">
                                <p className="font-semibold text-gray-800 text-xs">LITO C. NUELES</p>
                                <p className="text-gray-600 text-xs">District Manager - Head</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Page Number - Always at bottom */}
                    <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-gray-500">
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
                    width: '11in',
                    height: '8.5in'
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

export default Van_Reports;