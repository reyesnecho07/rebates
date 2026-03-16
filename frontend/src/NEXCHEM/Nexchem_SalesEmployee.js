import React, { useState, useEffect } from "react";
import axios from 'axios';
import {
  Search,
  IdCardLanyard,
  ChevronLeft,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import nexchemLogo from "../assets/nexchem.png";
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import { useTheme } from '../context/ThemeContext';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl'; // Import the access control hook

function Nexchem_SalesEmployee() {
  const { theme, updateTheme } = useTheme();
  const location = useLocation();
  
  // Route path for this component - used for access control
  const routePath = '/Nexchem_SalesEmployee';
  
  // Access control hook
  const { access, accessLoading, accessError } = useAccessControl(routePath);

  const [showVanDropdown, setShowVanDropdown] = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(true);
  const [showVcpDropdown, setShowVcpDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");

  const [collapsed, setCollapsed] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const API_BASE = 'http://192.168.100.193:3006/api';
  const DB_NAME = 'USER';

  const componentMetadata = {
    name: 'Nexchem_SalesEmployee',
    version: '2.0.0',
    description: 'Displays and manages a list of Sales Employee.',
    routePath: routePath
  };

  useComponentRegistration(componentMetadata);

useEffect(() => {
  const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
  const username = storedUser.DisplayName || storedUser.UserName || storedUser.Username || "Unknown User";
  const userCode = storedUser.UserCode || storedUser.User_ID || storedUser.userCode || "Unknown ID";
  
  setUserName(username);
  setUserCode(userCode);

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

  useEffect(() => {
    const loadThemeFromDatabase = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
        const userId = storedUser.UserID || storedUser.User_ID;
        
        if (userId) {
          const response = await axios.get(`${API_BASE}/user/preferences/${userId}/theme?db=${DB_NAME}`);
          
          if (response.data.success && response.data.value) {
            const dbTheme = response.data.value.toLowerCase();
            if (dbTheme !== theme) {
              console.log('Loading theme from database:', dbTheme);
              updateTheme(dbTheme);
            }
          }
        }
      } catch (error) {
        console.error('Error loading theme from database:', error);
        const localTheme = localStorage.getItem('userTheme');
        if (localTheme && localTheme !== theme) {
          updateTheme(localTheme);
        }
      }
    };
    
    loadThemeFromDatabase();
  }, []);

  // ✅ Fetch Sales Employees from local NEXCHEM_OWN database
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("http://192.168.100.193:3006/api/sync/local/sales-employees?db=NEXCHEM_OWN");
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        
        let employeesData = [];
        if (Array.isArray(data)) {
          employeesData = data;
        } else if (data && Array.isArray(data.data)) {
          employeesData = data.data;
        } else if (data && data.success && Array.isArray(data.data)) {
          employeesData = data.data;
        } else if (data && data.data) {
          employeesData = Array.isArray(data.data) ? data.data : [data.data];
        } else {
          console.error("Unexpected response format:", data);
          employeesData = [];
        }
        
        setEmployees(employeesData);
        console.log(`Loaded ${employeesData.length} sales employees from NEXCHEM_OWN database`);
      } catch (err) {
        console.error("Error fetching sales employees:", err);
        setEmployees([]);
      }
    };

    // Only fetch employees if user has view access
    if (access.canView) {
      fetchEmployees();
    }
  }, [access.canView]); // Re-fetch when access changes

  // ✅ Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const name = String(emp.SlpName || "").toLowerCase();
    const code = String(emp.SlpCode || "").toLowerCase();
    return (
      name.includes(searchTerm.toLowerCase()) ||
      code.includes(searchTerm.toLowerCase())
    );
  });

  // ✅ Pagination logic
  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const getPaginationRange = () => {
    const maxPages = 5;
    let start = Math.max(2, currentPage - Math.floor(maxPages / 2));
    let end = start + maxPages - 1;

    if (end >= totalPages) {
      end = totalPages - 1;
      start = Math.max(2, end - maxPages + 1);
    }

    const range = [];
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  };

  const getFirstChar = (value) => {
    if (value === null || value === undefined) return "E";
    const stringValue = String(value);
    return stringValue.charAt(0).toUpperCase();
  };

  // Render access denied message if user doesn't have view permission
  const renderAccessDenied = () => (
    <div className={`flex flex-col items-center justify-center min-h-[400px] p-8 text-center`}>
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4
        ${theme === 'dark' 
          ? 'bg-red-900/30 border border-red-700/40' 
          : 'bg-red-50 border border-red-200'}`}
      >
        <Lock size={36} className={theme === 'dark' ? 'text-red-400' : 'text-red-500'} />
      </div>
      <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
        Access Restricted
      </h2>
      <p className={`max-w-md text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        You don't have permission to view sales employees.
        {accessError && <span className="block mt-2 text-xs opacity-75">Error: {accessError}</span>}
      </p>
      <div className="flex gap-3">
        <Link
          to="/HomePage"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${theme === 'dark'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
        >
          Go to HomePage
        </Link>
      </div>
    </div>
  );

  // Render loading state
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mb-4
        ${theme === 'dark' ? 'border-blue-400' : 'border-blue-500'}`} />
      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        Checking permissions...
      </p>
    </div>
  );

  // Render the main content
  const renderContent = () => (
    <>
      {/* Modern Header */}
      <div className={`flex items-center gap-3 mb-6 pb-4 border-b ${
        theme === 'dark' ? 'border-blue-700' : 'border-blue-100'
      }`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow">
          <IdCardLanyard className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-lg font-bold ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
              }`}>Sales Employees</h1>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>Manage and view all sales employee information from NEXCHEM_OWN database</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
        <div className={`text-xs ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Total <span className={`font-semibold ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`}>{filteredEmployees.length}</span> employees found
        </div>

        <div className="relative flex-1 max-w-sm">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            } w-3.5 h-3.5`} />
            <input
              type="text"
              placeholder="Search employees by name or code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full pl-9 pr-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-300 transition-all duration-200 font-poppins shadow-sm ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Modern Table Container */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead className={`sticky top-0 z-10 ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-gray-800 to-gray-900'
                : 'bg-gradient-to-r from-gray-50 to-gray-100'
            }`}>
              <tr>
                <th className={`px-4 py-3 text-left font-semibold uppercase tracking-wider border-b ${
                  theme === 'dark'
                    ? 'text-gray-300 border-gray-700'
                    : 'text-gray-700 border-gray-200'
                }`}>
                  Employee Code
                </th>
                <th className={`px-4 py-3 text-left font-semibold uppercase tracking-wider border-b ${
                  theme === 'dark'
                    ? 'text-gray-300 border-gray-700'
                    : 'text-gray-700 border-gray-200'
                }`}>
                  Employee Name
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length > 0 ? (
                paginatedEmployees.map((emp, index) => (
                  <tr
                    key={emp.SlpCode || index}
                    className={`group transition-all duration-150 border-b last:border-b-0 ${
                      theme === 'dark'
                        ? 'hover:bg-gray-700/50 border-gray-700'
                        : 'hover:bg-blue-50 border-gray-100'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-xs ${
                          theme === 'dark'
                            ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/30 text-blue-300'
                            : 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600'
                        }`}>
                          {emp.SlpCode ? getFirstChar(emp.SlpCode) : "E"}
                        </div>
                        <span className={`font-mono text-xs px-2 py-1 rounded ${
                          theme === 'dark'
                            ? 'bg-blue-900/20 text-blue-300'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {emp.SlpCode || "-"}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {emp.SlpName || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="px-4 py-12">
                    <div className={`text-center py-6 px-4 rounded-xl border shadow-sm ${
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800/50 to-blue-900/20 border-gray-700'
                        : 'bg-gradient-to-br from-gray-50 to-blue-50 border-gray-200'
                    }`}>
                      <div className="relative mb-4">
                        <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center shadow animate-pulse ${
                          theme === 'dark'
                            ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/30'
                            : 'bg-gradient-to-br from-blue-100 to-blue-200'
                        }`}>
                          <IdCardLanyard size={28} className={`${
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                          } animate-bounce`} />
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <h3 className={`text-lg font-bold ${
                          theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                        }`}>
                          {employees.length === 0 ? "No Employees" : "No Employees Found"}
                        </h3>
                        <p className={`max-w-md mx-auto leading-relaxed text-xs ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {employees.length === 0 
                            ? "No sales employees found in the database." 
                            : "No employees matching your search criteria."}
                        </p>
                      </div>

                      <button 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-2 rounded-lg font-semibold text-sm shadow hover:shadow-md transition-all duration-300 hover:from-blue-600 hover:to-blue-700 active:scale-95"
                        onClick={() => {
                          setSearchTerm("");
                          setCurrentPage(1);
                        }}
                      >
                        Clear Search
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Pagination */}
      {filteredEmployees.length > 0 && (
        <div className="flex justify-between items-center mt-4 flex-wrap gap-3">
          <div className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Showing <span className={`font-semibold ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>{((currentPage - 1) * rowsPerPage) + 1}</span> to <span className={`font-semibold ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>{Math.min(currentPage * rowsPerPage, filteredEmployees.length)}</span> of <span className={`font-semibold ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>{filteredEmployees.length}</span> employees
          </div>
          
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className={`px-3 py-2 text-xs border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center gap-1 ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-blue-900/30 hover:border-blue-700 hover:text-blue-300'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600'
              }`}
            >
              <ChevronLeft size={14} />
              Prev
            </button>

            <div className="flex items-center gap-1">
              {totalPages > 0 && (
                <button
                  className={`px-2.5 py-2 text-xs border rounded-lg min-w-[36px] transition-all duration-200 font-medium ${
                    currentPage === 1
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow"
                      : theme === 'dark'
                      ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-blue-900/30 hover:border-blue-700 hover:text-blue-300"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600"
                  }`}
                  onClick={() => setCurrentPage(1)}
                >
                  1
                </button>
              )}

              {getPaginationRange()[0] > 2 && (
                <span className={`px-1 text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>...</span>
              )}

              {getPaginationRange().map((page) => (
                <button
                  key={page}
                  className={`px-2.5 py-2 text-xs border rounded-lg min-w-[36px] transition-all duration-200 font-medium ${
                    currentPage === page
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow"
                      : theme === 'dark'
                      ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-blue-900/30 hover:border-blue-700 hover:text-blue-300"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600"
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}

              {getPaginationRange()[getPaginationRange().length - 1] < totalPages - 1 && (
                <span className={`px-1 text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>...</span>
              )}

              {totalPages > 1 && (
                <button
                  className={`px-2.5 py-2 text-xs border rounded-lg min-w-[36px] transition-all duration-200 font-medium ${
                    currentPage === totalPages
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow"
                      : theme === 'dark'
                      ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-blue-900/30 hover:border-blue-700 hover:text-blue-300"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600"
                  }`}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </button>
              )}
            </div>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className={`px-3 py-2 text-xs border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center gap-1 ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-blue-900/30 hover:border-blue-700 hover:text-blue-300'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600'
              }`}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={`flex min-h-screen w-full bg-gradient-to-br ${
      theme === 'dark' 
        ? 'from-gray-900 to-gray-800' 
        : 'from-slate-50 to-blue-50'
    } font-poppins ${theme === 'dark' ? 'text-gray-100' : 'text-slate-900'}`}>

      {/* Use the Sidebar component */}
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

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={nexchemLogo}
          theme={theme}
        />

        {/* Enhanced Content Area */}
        <div className="pt-16 flex-1 p-8 overflow-auto">
          <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border ${
            theme === 'dark' 
              ? 'border-gray-700/50' 
              : 'border-white/50'
          } shadow-2xl p-8 w-full max-w-[1600px] mx-auto mt-6`}>
            
            {/* Conditional rendering based on access control */}
            {accessLoading ? renderLoading() : !access.canView ? renderAccessDenied() : renderContent()}
            
          </div>
        </div>
      </main>
    </div>
  );
}

export default Nexchem_SalesEmployee;