import React, { useState, useEffect, useMemo } from "react";
import axios from 'axios';
import { Search, IdCardLanyard, Lock, Users, X } from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import vanLogo from "../assets/van.png";
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import { useTheme } from '../context/ThemeContext';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';

function Van_SalesEmployee() {
  const { theme, updateTheme } = useTheme();
  const location  = useLocation();
  const routePath = '/Van_SalesEmployee';
  const { access, accessLoading, accessError } = useAccessControl(routePath);
  const isDark = theme === 'dark';

  const [showVanDropdown,     setShowVanDropdown]     = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(false);
  const [userName,  setUserName]  = useState("");
  const [userCode,  setUserCode]  = useState("");
  const [initials,  setInitials]  = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const API_BASE = 'http://192.168.100.193:3009/api';
  const DB_NAME  = 'USER';

  const componentMetadata = {
    name: 'Van_SalesEmployee', version: '2.0.0',
    description: 'Displays and manages a list of Sales Employee.',
    routePath,
  };
  useComponentRegistration(componentMetadata);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const username   = storedUser.DisplayName || storedUser.UserName || storedUser.Username || "Unknown User";
    const code       = storedUser.UserCode || storedUser.User_ID || storedUser.userCode || "Unknown ID";
    setUserName(username);
    setUserCode(code);
    const getInitials = (name) => {
      if (!name) return "??";
      const parts = name.trim().split(" ");
      return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };
    setInitials(getInitials(username));
  }, []);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = JSON.parse(localStorage.getItem("currentUser")) || {};
        const userId = stored.UserID || stored.User_ID;
        if (!userId) return;
        const res = await axios.get(`${API_BASE}/user/preferences/${userId}/theme?db=${DB_NAME}`);
        if (res.data.success && res.data.value) {
          const t = res.data.value.toLowerCase();
          if (t !== theme) updateTheme(t);
        }
      } catch {
        const local = localStorage.getItem('userTheme');
        if (local && local !== theme) updateTheme(local);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    if (!access.canView) return;
    const fetchEmployees = async () => {
      try {
        const res  = await fetch("http://192.168.100.193:3009/api/sync/local/sales-employees?db=VAN_OWN");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setEmployees(list);
      } catch (err) {
        console.error("Error fetching sales employees:", err);
        setEmployees([]);
      }
    };
    fetchEmployees();
  }, [access.canView]);

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const s = searchTerm.toLowerCase();
    return employees.filter(emp =>
      String(emp.SlpName || "").toLowerCase().includes(s) ||
      String(emp.SlpCode || "").toLowerCase().includes(s)
    );
  }, [employees, searchTerm]);

  const T = {
    thead:   isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200',
    row:     isDark ? 'hover:bg-slate-700/40 border-slate-700/50' : 'hover:bg-slate-50/80 border-slate-100',
    divider: isDark ? 'divide-slate-700/60' : 'divide-slate-100',
    input:   isDark
      ? 'bg-slate-700/80 border-slate-600 text-slate-100 placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400',
    tp:  isDark ? 'text-slate-100' : 'text-slate-800',
    ts:  isDark ? 'text-slate-400' : 'text-slate-500',
    tm:  isDark ? 'text-slate-500' : 'text-slate-400',
  };

  const renderAccessDenied = () => (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${
        isDark ? 'bg-red-900/20 border-red-700/30' : 'bg-red-50 border-red-200'
      }`}>
        <Lock size={28} className={isDark ? 'text-red-400' : 'text-red-500'} />
      </div>
      <div className="text-center">
        <h2 className={`text-sm font-bold mb-1 ${T.tp}`}>Access Restricted</h2>
        <p className={`max-w-sm text-xs ${T.ts}`}>
          You don't have permission to view sales employees.
          {accessError && <span className="block mt-1 opacity-70">Error: {accessError}</span>}
        </p>
      </div>
      <Link to="/HomePage"
        className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
        Go to Home
      </Link>
    </div>
  );

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className={`w-8 h-8 rounded-full border-4 border-t-transparent animate-spin ${
        isDark ? 'border-blue-400' : 'border-blue-500'
      }`} />
      <p className={`text-xs ${T.ts}`}>Checking permissions…</p>
    </div>
  );

  return (
    <div className={`flex h-screen w-full font-poppins overflow-hidden ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Sidebar
        collapsed={collapsed}          setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}         setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}         setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-500 ${
        collapsed ? 'ml-20' : 'ml-64'
      }`}>
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={vanLogo}
          theme={theme}
        />
        <div className="pt-16 flex-1 flex flex-col overflow-hidden p-6">
          <div className={`flex-1 flex flex-col rounded-2xl border shadow-sm w-full max-w-[1600px] mx-auto mt-4 overflow-hidden ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}>
            {accessLoading ? renderLoading() : !access.canView ? renderAccessDenied() : (
              <>
                {/* ── Page header ───────────────────────────────────────── */}
                <div className={`flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'
                    }`}>
                      <IdCardLanyard size={17} className={isDark ? 'text-blue-400' : 'text-blue-400'} strokeWidth={1.6} />
                    </div>
                    <div className="min-w-0">
                      <h1 className={`text-sm font-bold leading-none ${T.tp}`}>Sales Employees</h1>
                      <p className={`text-[11px] mt-0.5 ${T.ts}`}>Manage and view all sales employee records</p>
                    </div>
                  </div>
                  <div className="relative w-64 flex-shrink-0">
                    <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${T.tm}`} />
                    <input
                      type="text"
                      placeholder="Search by name or code…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${T.input}`}
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')}
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
                          isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                        }`}>
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Sub-header: count ─────────────────────────────────── */}
                <div className={`flex-shrink-0 flex items-center gap-2 px-6 py-2 ${
                  isDark ? 'border-slate-700 bg-slate-900/20' : 'border-slate-100 bg-slate-50'
                }`}>

                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')}
                      className={`ml-auto text-[11px] font-medium transition-colors ${
                        isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      Clear search
                    </button>
                  )}
                </div>

                {/* ── Scrollable table ──────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-xs table-fixed">
                    <colgroup>
                      <col style={{ width: '35%' }} />
                      <col style={{ width: '65%' }} />
                    </colgroup>
                    <thead className={`sticky top-0 z-10 border-b ${T.thead}`}>
                      <tr>
                        <th className={`px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>Employee Code</th>
                        <th className={`px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>Employee Name</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${T.divider}`}>
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map((emp, i) => (
                          <tr key={emp.SlpCode || i} className={`transition-colors duration-75 ${T.row}`}>
                            <td className="px-6 py-3">
                              <code className={`text-xs px-2 py-0.5 rounded border font-semibold ${
                                isDark ? 'bg-slate-900/50 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>{emp.SlpCode || '—'}</code>
                            </td>
                            <td className={`px-6 py-3 font-medium ${T.tp}`}>{emp.SlpName || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2}>
                            <div className="flex flex-col items-center justify-center py-24 gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                                isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'
                              }`}>
                                <Users size={20} className={isDark ? 'text-blue-400' : 'text-blue-400'} strokeWidth={1.5} />
                              </div>
                              <div className="text-center">
                                <p className={`text-sm font-bold mb-0.5 ${T.tp}`}>
                                  {employees.length === 0 ? 'No Employees' : 'No Results Found'}
                                </p>
                                <p className={`text-xs ${T.ts}`}>
                                  {employees.length === 0
                                    ? 'No sales employees found in the database.'
                                    : 'No employees match your search criteria.'}
                                </p>
                              </div>
                              {searchTerm && (
                                <button onClick={() => setSearchTerm('')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                                  Clear Search
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                {filteredEmployees.length > 0 && (
                  <div className={`flex-shrink-0 flex items-center justify-between px-6 py-2.5 border-t ${
                    isDark ? 'border-slate-700 bg-slate-900/20' : 'border-slate-100 bg-slate-50'
                  }`}>
                    <p className={`text-[11px] ${T.ts}`}>
                      Showing all{' '}
                      <span className={`font-bold ${T.tp}`}>{filteredEmployees.length.toLocaleString()}</span>{' '}
                      employee{filteredEmployees.length !== 1 ? 's' : ''}
                    </p>
                    <p className={`text-[11px] ${T.tm}`}>
                      {employees.length.toLocaleString()} total in database
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Van_SalesEmployee;