import React, { useState, useEffect } from "react";
import {
  Home,
  FileText,
  BarChart2,
  Users,
  Package,
  Settings,
  User,
  Search,
  IdCardLanyard,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import Logo from "../Logo";

function Vcp_SalesEmployee() {

  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("/salesemployee");
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // ✅ Get user from localStorage
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const username = storedUser.username || "Unknown User";
  const role = storedUser.role || "Unknown Role";

  // ✅ Generate initials
  const getInitials = (name) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
  };
  const initials = getInitials(username);

  // ✅ Fetch Sales Employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("http://192.168.100.193:5000/api/vcp/sales-employees");
        const data = await res.json();
        setEmployees(data || []);
      } catch (err) {
        console.error("Error fetching sales employees:", err);
        setEmployees([]);
      }
    };
    fetchEmployees();
  }, []);

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

  // ✅ Safe function to get first character for avatar
  const getFirstChar = (value) => {
    if (value === null || value === undefined) return "E";
    const stringValue = String(value);
    return stringValue.charAt(0).toUpperCase();
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
                {username}
              </p>
              <p className="text-xs text-slate-600 rounded-full text-left font-medium">
                {role}
              </p>
            </div>
          </div>
        </header>

        {/* Enhanced Content Area */}
        <div className="pt-16 flex-1 p-8 overflow-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 shadow-2xl p-8 w-full max-w-[1600px] mx-auto mt-6">
            {/* Modern Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-blue-200">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <IdCardLanyard className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Sales Employees</h1>
                <p className="text-sm text-gray-600">Manage and view all sales employee information and records</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
              <div className="text-sm text-gray-600">
                Total <span className="font-semibold text-blue-600">{filteredEmployees.length}</span> employees found
              </div>

              <div className="relative flex-1 max-w-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search employees by name or code..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-300 transition-all duration-200 font-poppins bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Modern Table Container */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        Employee Code
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        Employee Name
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEmployees.length > 0 ? (
                      paginatedEmployees.map((emp, index) => (
                        <tr
                          key={emp.SlpCode}
                          className="group hover:bg-blue-50 transition-all duration-200 border-b border-gray-100 last:border-b-0"
                        >
                          <td className="px-6 py-4 font-medium text-gray-900 text-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-600 font-semibold text-xs">
                                {emp.SlpCode ? getFirstChar(emp.SlpCode) : "E"}
                              </div>
                              <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                {emp.SlpCode || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-700 text-sm">
                            {emp.SlpName || "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="px-6 py-16">
                          <div className="text-center py-8 px-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border border-gray-200 shadow-sm">
                            {/* Animated Icon */}
                            <div className="relative mb-6">
                              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                                <IdCardLanyard size={36} className="text-blue-500 animate-bounce" />
                              </div>
                              {/* Floating particles */}
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                                <div className="flex space-x-1">
                                  <div className="w-2 h-2 bg-blue-300 rounded-full animate-ping opacity-75"></div>
                                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-75 delay-150"></div>
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping opacity-75 delay-300"></div>
                                </div>
                              </div>
                            </div>

                            {/* Main Message */}
                            <div className="space-y-3 mb-6">
                              <h3 className="text-2xl font-bold text-gray-800">
                                {employees.length === 0 ? "No Employees Available" : "No Employees Found"}
                              </h3>
                              <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                                {employees.length === 0 
                                  ? "There are currently no sales employees in the system." 
                                  : "We couldn't find any employees matching your search criteria. Try adjusting your search terms."}
                              </p>
                            </div>

                            {/* Action Suggestions */}
                            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8">
                              <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                                <Search size={16} />
                                <span>Try different keywords</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                                <IdCardLanyard size={16} />
                                <span>Check employee codes</span>
                              </div>
                            </div>

                            {/* CTA Button */}
                            <button 
                              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:from-blue-600 hover:to-blue-700 active:scale-95"
                              onClick={() => {
                                setSearchTerm("");
                                setCurrentPage(1);
                              }}
                            >
                              Clear Search
                            </button>

                            {/* Decorative Elements */}
                            <div className="mt-8 flex justify-center space-x-4 opacity-50">
                              <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
                              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                              <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce delay-200"></div>
                            </div>
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
              <div className="flex justify-between items-center mt-6 flex-wrap gap-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-blue-600">{((currentPage - 1) * rowsPerPage) + 1}</span> to <span className="font-semibold text-blue-600">{Math.min(currentPage * rowsPerPage, filteredEmployees.length)}</span> of <span className="font-semibold text-blue-600">{filteredEmployees.length}</span> employees
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="px-4 py-2.5 text-sm border border-gray-300 rounded-xl bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 transition-all duration-200 font-medium flex items-center gap-2"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {totalPages > 0 && (
                      <button
                        className={`px-3.5 py-2.5 text-sm border rounded-xl min-w-[40px] ${
                          currentPage === 1
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg"
                            : "bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600"
                        } transition-all duration-200 font-medium`}
                        onClick={() => setCurrentPage(1)}
                      >
                        1
                      </button>
                    )}

                    {getPaginationRange()[0] > 2 && (
                      <span className="px-2 text-gray-500 text-sm">...</span>
                    )}

                    {getPaginationRange().map((page) => (
                      <button
                        key={page}
                        className={`px-3.5 py-2.5 text-sm border rounded-xl min-w-[40px] ${
                          currentPage === page
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg"
                            : "bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600"
                        } transition-all duration-200 font-medium`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}

                    {getPaginationRange()[getPaginationRange().length - 1] < totalPages - 1 && (
                      <span className="px-2 text-gray-500 text-sm">...</span>
                    )}

                    {totalPages > 1 && (
                      <button
                        className={`px-3.5 py-2.5 text-sm border rounded-xl min-w-[40px] ${
                          currentPage === totalPages
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg"
                            : "bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600"
                        } transition-all duration-200 font-medium`}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    )}
                  </div>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="px-4 py-2.5 text-sm border border-gray-300 rounded-xl bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 transition-all duration-200 font-medium flex items-center gap-2"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Vcp_SalesEmployee;