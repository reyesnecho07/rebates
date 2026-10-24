import React, { useState, useEffect, useMemo } from "react";
import axios from 'axios';
import { Search, IdCardLanyard, Lock, Users, X } from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import vanLogo from "../assets/van.png";
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import AccessDenied from "../components/common/AccessDenied";
import { useTheme } from '../context/ThemeContext';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';

/* ─── Apple system colour language (Nexchem / VAN / VCP) ─────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const dashTokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"  : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const DASH_FONT = `
  .dash-page, .dash-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .dash-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .dash-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.4); border-radius: 999px; }
  .dash-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes dash-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dash-pop { animation: dash-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
  @keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse-ring { 0% { box-shadow:0 0 0 0 rgba(10,132,255,0.35); } 70% { box-shadow:0 0 0 10px rgba(10,132,255,0); } 100%{ box-shadow:0 0 0 0 rgba(10,132,255,0); } }
  .nx-card { animation: fadeSlideUp 0.3s ease both; }
  .nx-btn-secondary:hover:not(:disabled) { transform: translateY(-1px); }
  .nx-input:focus { border-color: #0A84FF !important; box-shadow: 0 0 0 3px rgba(10,132,255,0.15); }
`;

const injectFonts = () => {
  if (document.getElementById('van-sales-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'van-sales-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

function Van_SalesEmployee() {
  useEffect(() => { injectFonts(); }, []);

  const { theme, updateTheme } = useTheme();
  const location  = useLocation();
  const routePath = '/Van_SalesEmployee';
  const { access, accessLoading, accessError } = useAccessControl(routePath);

  const isDark = theme === 'dark';
  const K = dashTokens(isDark);
  const fontStack = "'Outfit', system-ui, sans-serif";
  const monoStack = "'DM Mono', monospace";

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
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!access.canView) return;
    const fetchEmployees = async () => {
      try {
        const res  = await fetch("http://192.168.100.193:3009/api/van/sales-employees?db=VAN");
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

  /* ── Shared styles ─────────────────────────────────────────────────────── */
  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: K.glass,
    border: `1px solid ${K.hairline}`,
    borderRadius: 12, fontSize: 13,
    color: K.ink, fontFamily: fontStack,
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  /* ── Loading spinner ───────────────────────────────────────────────────── */
  const renderLoading = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 380, fontFamily: fontStack }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${K.hairline}`, borderTopColor: APPLE.blue,
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 13, color: K.muted }}>Verifying access…</p>
      </div>
    </div>
  );

  return (
    <div className="dash-page" style={{ display: 'flex', height: '100vh', width: '100%', background: K.bg, fontFamily: fontStack, color: K.ink, overflow: 'hidden' }}>
      <style>{DASH_FONT}</style>

      {/* Aurora wash */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            radial-gradient(700px circle at 8% 0%, ${APPLE.blue}${isDark ? "26" : "30"}, transparent 55%),
            radial-gradient(650px circle at 92% 10%, ${APPLE.purple}${isDark ? "1a" : "20"}, transparent 55%)
          `,
          zIndex: 0,
        }}
      />

      <Sidebar
        collapsed={collapsed}          setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}         setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}         setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main style={{
        position: 'relative', flex: 1, display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden',
        marginLeft: collapsed ? 80 : 256,
        transition: 'margin-left 0.4s cubic-bezier(.4,0,.2,1)', zIndex: 1,
      }}>
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={vanLogo}
          theme={theme}
        />

        {/* ── Scrollable area — becomes the flex parent for the card ── */}
        <div
          className="dash-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            padding: '80px 32px 40px',
            overflowY: 'auto',
            display: 'flex',
          }}
        >
          <div
            className="nx-card dash-glass"
            style={{
              marginTop: 90,
              background: K.glass,
              border: `1px solid ${K.hairline}`,
              borderRadius: 22,
              boxShadow: K.shadow,
              padding: '32px 32px 36px',
              maxWidth: 1600,
              width: '100%',
              margin: '0 auto',
              height: 'calc(97vh - 152px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {accessLoading ? (
              renderLoading()
            ) : !access.canView ? (
              <AccessDenied
                useTokens={true}
                tokens={{...K, accent: APPLE.blue, accentHover: APPLE.blue, accentLight: `${APPLE.blue}14`, text: K.ink, textMuted: K.muted, textSub: K.muted, success: APPLE.green, error: APPLE.red, errorBg: `${APPLE.red}14`, gold: APPLE.orange, goldLight: `${APPLE.orange}14`, teal: APPLE.blue, tealLight: `${APPLE.blue}14`, cardBg: K.glass, cardBorder: K.hairline, inputBg: K.glass, inputBorder: K.hairline, bg: K.bg, fontStack }}
                accessError={accessError}
                message="You don't have permission to view sales employees."
              />
            ) : (
              <>
                {/* ── Title bar ────────────────────────────────────────── */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${K.hairline}`,
                  gap: 16, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 14,
                      background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 4px 16px -4px ${APPLE.blue}88`, flexShrink: 0,
                    }}>
                      <IdCardLanyard size={22} color="#fff" strokeWidth={1.8} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h1 style={{ fontSize: 17, fontWeight: 700, color: K.ink, margin: 0, letterSpacing: '-0.01em' }}>
                        Sales Employees
                      </h1>
                      <p style={{ fontSize: 12, color: K.muted, margin: '3px 0 0', fontWeight: 400 }}>
                        Manage and view all sales employee records
                      </p>
                    </div>
                  </div>

                  {/* ── Search input ──────────────────────────────────────── */}
                  <div style={{ position: 'relative', width: 280, flexShrink: 0 }}>
                    <Search size={13} color={K.faint} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Search by name or code…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 34, paddingRight: searchTerm ? 34 : 12, borderRadius: 999 }}
                      onFocus={(e) => { e.target.style.borderColor = APPLE.blue; e.target.style.boxShadow = `0 0 0 3px ${APPLE.blue}22`; }}
                      onBlur={(e) => { e.target.style.borderColor = K.hairline; e.target.style.boxShadow = 'none'; }}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        style={{
                          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                          padding: 3, borderRadius: 999, border: 'none',
                          background: 'transparent', color: K.muted, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = K.ink}
                        onMouseLeave={(e) => e.currentTarget.style.color = K.muted}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Sub-header: active search chip ────────────────────── */}
                {searchTerm && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
                    marginBottom: 18,
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      paddingLeft: 10, paddingRight: 4, paddingTop: 3, paddingBottom: 3,
                      borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: `${APPLE.blue}14`, color: APPLE.blue,
                      border: `1px solid ${APPLE.blue}33`,
                    }}>
                      “{searchTerm}”
                      <button
                        onClick={() => setSearchTerm('')}
                        style={{
                          padding: 2, borderRadius: 999, border: 'none',
                          background: 'transparent', color: APPLE.blue, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = `${APPLE.blue}22`}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <X size={10} />
                      </button>
                    </span>

                    <button
                      onClick={() => setSearchTerm('')}
                      style={{
                        marginLeft: 'auto', fontSize: 11, fontWeight: 500,
                        color: K.muted, background: 'transparent', border: 'none',
                        cursor: 'pointer', fontFamily: fontStack, padding: 0,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = K.ink}
                      onMouseLeave={(e) => e.currentTarget.style.color = K.muted}
                    >
                      Clear search
                    </button>
                  </div>
                )}

                {/* ── Table card ───────────────────────────────────────── */}
                <div className="dash-glass" style={{
                  background: K.glass,
                  border: `1px solid ${K.hairline}`,
                  borderRadius: 18,
                  overflow: 'hidden',
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div className="dash-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    <table style={{
                      width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed',
                      fontSize: 13, fontFamily: fontStack,
                    }}>
                      <colgroup>
                        <col style={{ width: '35%' }} />
                        <col style={{ width: '65%' }} />
                      </colgroup>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          {['Employee Code', 'Employee Name'].map(label => (
                            <th key={label} style={{
                              padding: '12px 22px', textAlign: 'left',
                              fontSize: 10, fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '0.08em',
                              color: K.muted,
                              background: K.glassDeep,
                              backdropFilter: 'blur(28px) saturate(180%)',
                              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                              borderBottom: `1px solid ${K.hairline}`,
                            }}>
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
                              style={{ borderBottom: `1px solid ${K.hairline}` }}
                              onMouseEnter={(e) => e.currentTarget.style.background = K.hover}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '12px 22px' }}>
                                <code style={{
                                  fontSize: 12, padding: '3px 9px', borderRadius: 7,
                                  border: `1px solid ${K.hairline}`,
                                  background: K.chipBg,
                                  color: K.muted,
                                  fontWeight: 600,
                                  fontFamily: monoStack,
                                }}>
                                  {emp.SlpCode || '—'}
                                </code>
                              </td>
                              <td style={{ padding: '12px 22px', fontWeight: 500, color: K.ink }}>
                                {emp.SlpName || '—'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2}>
                              <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                justifyContent: 'center', padding: '72px 0', gap: 14,
                              }}>
                                <div style={{
                                  width: 52, height: 52, borderRadius: 14,
                                  background: `${APPLE.blue}1c`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <Users size={24} color={APPLE.blue} strokeWidth={1.6} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <p style={{ fontSize: 14, fontWeight: 600, color: K.ink, margin: '0 0 4px' }}>
                                    {employees.length === 0 ? 'No Employees' : 'No Results Found'}
                                  </p>
                                  <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                                    {employees.length === 0
                                      ? 'No sales employees found in the database.'
                                      : 'No employees match your search criteria.'}
                                  </p>
                                </div>
                                {searchTerm && (
                                  <button
                                    onClick={() => setSearchTerm('')}
                                    style={{
                                      padding: '7px 16px', borderRadius: 999, border: 'none',
                                      background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                                      color: '#fff', fontSize: 12, fontWeight: 600,
                                      cursor: 'pointer', fontFamily: fontStack,
                                      boxShadow: `0 4px 12px -4px ${APPLE.blue}88`,
                                    }}
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

                  {/* ── Footer ─────────────────────────────────────────── */}
                  {filteredEmployees.length > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 22px', borderTop: `1px solid ${K.hairline}`,
                      background: K.chipBg,
                      gap: 10, flexWrap: 'wrap',
                    }}>
                      <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                        Showing all{' '}
                        <span style={{ fontWeight: 700, color: K.ink, fontFamily: monoStack }}>
                          {filteredEmployees.length.toLocaleString()}
                        </span>{' '}
                        employee{filteredEmployees.length !== 1 ? 's' : ''}
                      </p>
                      <p style={{ fontSize: 11, color: K.faint, margin: 0, fontFamily: monoStack }}>
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
    </div>
  );
}

export default Van_SalesEmployee;