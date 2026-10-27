// src/pages/Nexchem_SalesEmployee.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from 'axios';
import { Search, IdCardLanyard, Users, X } from "lucide-react";
import { useLocation } from 'react-router-dom';
import nexchemLogo from "../assets/nexchem.png";
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import AccessDenied from "../components/common/AccessDenied";
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';
import { API_BASE, DB_NAME } from '../config/appConfig';

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens, DesignPage } from '../design-system';

const routePath = '/Nexchem_SalesEmployee';

const componentMetadata = {
  name: 'Nexchem_SalesEmployee', version: '2.0.0',
  description: 'Displays and manages a list of Sales Employee.',
  routePath,
};

function Nexchem_SalesEmployee() {
  const { theme, updateTheme, K } = useTokens();
  useLocation(); // preserve hook order (return value unused)
  const { access, accessLoading, accessError } = useAccessControl(routePath);

  const fontStack = "'Outfit', system-ui, sans-serif";

  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(true);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(false);
  const [userName,  setUserName]  = useState("");
  const [userCode,  setUserCode]  = useState("");
  const [initials,  setInitials]  = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useComponentRegistration(componentMetadata);

  /* ── User init ─────────────────────────────────────────────────── */
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

  /* ── Theme loader ──────────────────────────────────────────────── */
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
  }, []); // eslint-disable-line

  /* ── Fetch employees ───────────────────────────────────────────── */
  useEffect(() => {
    if (!access.canView) return;
    const fetchEmployees = async () => {
      try {
        const res  = await fetch("/api/nexchem/sales-employees?db=NEXCHEM");
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

  /* ── Filtered employees ────────────────────────────────────────── */
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const s = searchTerm.toLowerCase();
    return employees.filter(emp =>
      String(emp.SlpName || "").toLowerCase().includes(s) ||
      String(emp.SlpCode || "").toLowerCase().includes(s)
    );
  }, [employees, searchTerm]);

  /* ── Loading spinner ───────────────────────────────────────────── */
  const renderLoading = () => (
    <div className="flex items-center justify-center min-h-[380px]">
      <div className="flex flex-col items-center gap-3.5">
        <div className="w-9 h-9 rounded-full animate-spin border-[3px] border-[var(--ds-hairline)] border-t-[#0A84FF]" />
        <p className="text-[13px] text-[var(--ds-muted)]">Verifying access…</p>
      </div>
    </div>
  );

  return (
    <DesignPage className="flex w-full h-screen overflow-hidden">

      {/* Aurora wash */}
      <div className="pointer-events-none fixed inset-0 z-0 ds-aurora-blue-purple" />

      <Sidebar
        collapsed={collapsed}          setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}         setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}         setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main
        className={`relative flex-1 flex flex-col h-screen overflow-hidden z-[1] transition-[margin-left] duration-[400ms] ease-[cubic-bezier(.4,0,.2,1)] ${
          collapsed ? 'ml-20' : 'ml-64'
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

        {/* Scroll area */}
        <div className="ds-scroll flex-1 min-h-0 overflow-y-auto flex pt-20 px-8 pb-10">
          <div className="ds-fade-up ds-glass flex flex-col w-full max-w-[1600px] mx-auto overflow-hidden rounded-[22px] bg-[var(--ds-glass)] border border-[var(--ds-hairline)] shadow-[var(--ds-shadow)] mt-[90px] px-8 pt-8 pb-9 h-[calc(97vh-152px)]">

            {/* Access guard */}
            {accessLoading ? (
              renderLoading()
            ) : !access.canView ? (
              <AccessDenied
                useTokens={true}
                tokens={{
                  ...K,
                  accent: PALETTE.blue, accentHover: PALETTE.blue, accentLight: `${PALETTE.blue}14`,
                  text: K.ink, textMuted: K.muted, textSub: K.muted,
                  success: PALETTE.green, error: PALETTE.red, errorBg: `${PALETTE.red}14`,
                  gold: PALETTE.orange, goldLight: `${PALETTE.orange}14`,
                  teal: PALETTE.blue, tealLight: `${PALETTE.blue}14`,
                  cardBg: K.glass, cardBorder: K.hairline,
                  inputBg: K.glass, inputBorder: K.hairline,
                  bg: K.bg, fontStack,
                }}
                accessError={accessError}
                message="You don't have permission to view sales employees."
              />
            ) : (
              <>
                {/* ── Title bar ─────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-7 pb-5 gap-4 flex-wrap border-b border-[var(--ds-hairline)]">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center flex-shrink-0 ds-gradient-primary shadow-[0_4px_16px_-4px_rgba(10,132,255,0.53)]">
                      <IdCardLanyard size={22} className="text-white" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--ds-ink)] m-0">
                        Sales Employees
                      </h1>
                      <p className="text-[12px] text-[var(--ds-muted)] mt-[3px] mb-0 font-normal">
                        Manage and view all sales employee records
                      </p>
                    </div>
                  </div>

                  {/* Search input */}
                  <div className="relative w-[280px] flex-shrink-0">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ds-faint)]"
                    />
                    <input
                      type="text"
                      placeholder="Search by name or code…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className={`w-full py-[9px] rounded-full text-[13px] outline-none transition-colors bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] ${
                        searchTerm ? 'pl-[34px] pr-[34px]' : 'pl-[34px] pr-3'
                      }`}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--ds-muted)] hover:text-[var(--ds-ink)] transition-colors"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Active search chip ────────────────────────────── */}
                {searchTerm && (
                  <div className="flex flex-wrap items-center gap-2 mb-[18px]">
                    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-[3px] rounded-full text-[11px] font-semibold bg-[#0A84FF]/8 text-[#0A84FF] border border-[#0A84FF]/20">
                      &ldquo;{searchTerm}&rdquo;
                      <button
                        onClick={() => setSearchTerm('')}
                        className="p-0.5 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[#0A84FF] hover:bg-[#0A84FF]/13 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>

                    <button
                      onClick={() => setSearchTerm('')}
                      className="ml-auto text-[11px] font-medium bg-transparent border-none cursor-pointer p-0 text-[var(--ds-muted)] hover:text-[var(--ds-ink)] transition-colors"
                    >
                      Clear search
                    </button>
                  </div>
                )}

                {/* ── Table card ────────────────────────────────────── */}
                <div className="ds-glass flex-1 min-h-0 flex flex-col rounded-[18px] overflow-hidden bg-[var(--ds-glass)] border border-[var(--ds-hairline)]">
                  <div className="ds-scroll flex-1 min-h-0 overflow-y-auto">
                    <table className="w-full border-collapse table-fixed text-[13px]">
                      <colgroup>
                        <col className="w-[35%]" />
                        <col className="w-[65%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10">
                        <tr>
                          {['Employee Code', 'Employee Name'].map(label => (
                            <th
                              key={label}
                              className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ds-muted)] bg-[var(--ds-glass-deep)] border-b border-[var(--ds-hairline)] px-[22px] py-3 backdrop-blur-[28px]"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.length > 0 ? (
                          filteredEmployees.map((emp, i) => (
                            <tr
                              key={emp.SlpCode || i}
                              className="border-b border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors"
                            >
                              <td className="px-[22px] py-3">
                                <code className="text-[12px] px-[9px] py-[3px] rounded-[7px] font-semibold bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] text-[var(--ds-muted)] ds-font-mono">
                                  {emp.SlpCode || '—'}
                                </code>
                              </td>
                              <td className="px-[22px] py-3 font-medium text-[var(--ds-ink)]">
                                {emp.SlpName || '—'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2}>
                              <div className="flex flex-col items-center justify-center py-[72px] gap-3.5">
                                <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center bg-[#0A84FF]/11">
                                  <Users size={24} className="text-[#0A84FF]" strokeWidth={1.6} />
                                </div>
                                <div className="text-center">
                                  <p className="text-[14px] font-semibold text-[var(--ds-ink)] m-0 mb-1">
                                    {employees.length === 0 ? 'No Employees' : 'No Results Found'}
                                  </p>
                                  <p className="text-[12px] text-[var(--ds-muted)] m-0">
                                    {employees.length === 0
                                      ? 'No sales employees found in the database.'
                                      : 'No employees match your search criteria.'}
                                  </p>
                                </div>
                                {searchTerm && (
                                  <button
                                    onClick={() => setSearchTerm('')}
                                    className="px-4 py-[7px] rounded-full border-none text-white text-[12px] font-semibold cursor-pointer ds-gradient-primary shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]"
                                  >
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

                  {/* ── Footer ──────────────────────────────────────── */}
                  {filteredEmployees.length > 0 && (
                    <div className="flex items-center justify-between gap-2.5 flex-wrap px-[22px] py-3.5 bg-[var(--ds-chip-bg)] border-t border-[var(--ds-hairline)]">
                      <p className="text-[12px] text-[var(--ds-muted)] m-0">
                        Showing all{' '}
                        <span className="font-bold text-[var(--ds-ink)] ds-font-mono">
                          {filteredEmployees.length.toLocaleString()}
                        </span>{' '}
                        employee{filteredEmployees.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[11px] text-[var(--ds-faint)] m-0 ds-font-mono">
                        {employees.length.toLocaleString()} total in database
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </DesignPage>
  );
}

export default Nexchem_SalesEmployee;