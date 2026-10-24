import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from 'axios';
import { Package, Search, Filter, X, Check } from "lucide-react";
import { useLocation } from 'react-router-dom';
import vcpLogo from "../assets/vcp.png";
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
  if (document.getElementById('vcp-items-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'vcp-items-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

function Vcp_ItemRecords() {
  useEffect(() => { injectFonts(); }, []);

  const { theme, updateTheme } = useTheme();
  const location = useLocation();
  const routePath = '/Vcp_ItemRecords';
  const { access, accessLoading, accessError } = useAccessControl(routePath);

  const isDark = theme === 'dark';
  const K = dashTokens(isDark);
  const fontStack = "'Outfit', system-ui, sans-serif";
  const monoStack = "'DM Mono', monospace";

  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(true);
  const [userName,  setUserName]  = useState("");
  const [userCode,  setUserCode]  = useState("");
  const [initials,  setInitials]  = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [items,     setItems]     = useState([]);
  const [search,    setSearch]    = useState("");

  // ── Multi-select filter state ─────────────────────────────────────────────
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [isFilterOpen,   setIsFilterOpen]   = useState(false);
  const [groupSearch,    setGroupSearch]    = useState("");
  const filterRef = useRef(null);

  const API_BASE = 'http://192.168.100.193:3009/api';
  const DB_NAME  = 'USER';

  const componentMetadata = {
    name: 'Vcp_ItemRecords', version: '2.0.0',
    description: 'Displays and manages a list of item records.',
    routePath,
  };
  useComponentRegistration(componentMetadata);

  // ── User init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const username   = storedUser.DisplayName || storedUser.Username || "Unknown User";
    const code       = storedUser.User_ID || "Unknown ID";
    setUserName(username);
    setUserCode(code);
    const getInitials = (name) => {
      if (!name) return "??";
      const parts = name.trim().split(" ");
      return parts.length === 1
        ? parts[0][0].toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };
    setInitials(getInitials(username));
  }, []);

  // ── Theme loader ──────────────────────────────────────────────────────────
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

  // ── Fetch items ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!access.canView) return;
    const fetchItems = async () => {
      try {
        const res  = await fetch("http://192.168.100.193:3009/api/vcp/items?db=VCP");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setItems(list);
      } catch (err) {
        console.error("Error fetching items:", err);
      }
    };
    fetchItems();
  }, [access.canView]);

  // ── Click-outside closes filter panel ────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target))
        setIsFilterOpen(false);
    };
    if (isFilterOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isFilterOpen]);

  // ── Derived: unique item groups ───────────────────────────────────────────
  const uniqueItemGroups = useMemo(() => {
    const s = new Set();
    items.forEach(i => {
      const g = i.ItmsGrpNam || i.itemGroup || i.groupName || '';
      if (g) s.add(g);
    });
    return Array.from(s).sort();
  }, [items]);

  // ── Filtered groups shown inside the dropdown ─────────────────────────────
  const visibleGroups = useMemo(() => {
    if (!groupSearch.trim()) return uniqueItemGroups;
    const t = groupSearch.toLowerCase();
    return uniqueItemGroups.filter(g => g.toLowerCase().includes(t));
  }, [uniqueItemGroups, groupSearch]);

  // ── Main filtered items ───────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedGroups.size > 0) {
      result = result.filter(i => {
        const g = i.ItmsGrpNam || i.itemGroup || i.groupName || '';
        return selectedGroups.has(g);
      });
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(i =>
        i.ItemCode?.toLowerCase().includes(s) ||
        i.ItemName?.toLowerCase().includes(s) ||
        i.FrgnName?.toLowerCase().includes(s)
      );
    }

    return result;
  }, [items, search, selectedGroups]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleGroup = (g) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const clearAllGroups = () => {
    setSelectedGroups(new Set());
    setGroupSearch('');
  };

  const selectAllVisible = () => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      visibleGroups.forEach(g => next.add(g));
      return next;
    });
  };

  const hasFilters       = selectedGroups.size > 0 || search.trim();
  const activeGroupCount = selectedGroups.size;

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: K.glass,
    border: `1px solid ${K.hairline}`,
    borderRadius: 12, fontSize: 13,
    color: K.ink, fontFamily: fontStack,
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  // ── Loading spinner ───────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
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
          logo={vcpLogo}
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
            {/* ── Access guard ─────────────────────────────────────────── */}
            {accessLoading ? (
              renderLoading()
            ) : !access.canView ? (
              <AccessDenied
                useTokens={true}
                tokens={{...K, accent: APPLE.blue, accentHover: APPLE.blue, accentLight: `${APPLE.blue}14`, text: K.ink, textMuted: K.muted, textSub: K.muted, success: APPLE.green, error: APPLE.red, errorBg: `${APPLE.red}14`, gold: APPLE.orange, goldLight: `${APPLE.orange}14`, teal: APPLE.blue, tealLight: `${APPLE.blue}14`, cardBg: K.glass, cardBorder: K.hairline, inputBg: K.glass, inputBorder: K.hairline, bg: K.bg, fontStack }}
                accessError={accessError}
                message="You don't have permission to view item records."
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
                      <Package size={22} color="#fff" strokeWidth={1.8} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h1 style={{ fontSize: 17, fontWeight: 700, color: K.ink, margin: 0, letterSpacing: '-0.01em' }}>
                        Item Records
                      </h1>
                      <p style={{ fontSize: 12, color: K.muted, margin: '3px 0 0', fontWeight: 400 }}>
                        Manage and view all item records
                      </p>
                    </div>
                  </div>

                  {/* Filter + Search */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>

                    {/* ── Filter button + dropdown ──────────────────────── */}
                    <div style={{ position: 'relative' }} ref={filterRef}>
                      <button
                        className="nx-btn-secondary"
                        onClick={() => setIsFilterOpen(o => !o)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '9px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                          border: `1px solid ${(isFilterOpen || activeGroupCount > 0) ? `${APPLE.blue}55` : K.hairline}`,
                          background: (isFilterOpen || activeGroupCount > 0) ? `${APPLE.blue}1c` : K.chipBg,
                          color: (isFilterOpen || activeGroupCount > 0) ? APPLE.blue : K.muted,
                          cursor: 'pointer', transition: 'all 0.2s', fontFamily: fontStack,
                        }}
                      >
                        <Filter size={13} strokeWidth={2} />
                        <span>Filter</span>
                        {activeGroupCount > 0 && (
                          <span style={{
                            minWidth: 18, height: 18, padding: '0 5px',
                            borderRadius: 999, fontSize: 10, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: APPLE.blue, color: '#fff', fontFamily: monoStack,
                          }}>
                            {activeGroupCount}
                          </span>
                        )}
                      </button>

                      {/* ── Filter dropdown ─────────────────────────────── */}
                      {isFilterOpen && (
                        <div
                          className="dash-glass dash-pop"
                          style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                            width: 340, borderRadius: 18, zIndex: 50,
                            background: K.glassDeep,
                            border: `1px solid ${K.rim}`,
                            boxShadow: K.shadow,
                            overflow: 'hidden',
                          }}
                        >
                          {/* Header */}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 16px', borderBottom: `1px solid ${K.hairline}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Filter size={12} color={K.muted} />
                              <span style={{
                                fontSize: 11, fontWeight: 700, color: K.muted,
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                              }}>
                                Item Group
                              </span>
                              {activeGroupCount > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: APPLE.blue, fontFamily: monoStack }}>
                                  {activeGroupCount} selected
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setIsFilterOpen(false)}
                              style={{
                                padding: 4, borderRadius: 8, border: 'none',
                                background: 'transparent', color: K.muted, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = K.muted; }}
                            >
                              <X size={13} />
                            </button>
                          </div>

                          {/* Inner search */}
                          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${K.hairline}` }}>
                            <div style={{ position: 'relative' }}>
                              <Search size={11} color={K.faint} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                              <input
                                type="text"
                                placeholder="Search groups…"
                                value={groupSearch}
                                onChange={e => setGroupSearch(e.target.value)}
                                style={{
                                  width: '100%', padding: '7px 10px 7px 28px',
                                  background: K.chipBg,
                                  border: `1px solid ${K.hairline}`,
                                  borderRadius: 10, fontSize: 12,
                                  color: K.ink, fontFamily: fontStack,
                                  outline: 'none', boxSizing: 'border-box',
                                }}
                                onFocus={(e) => { e.target.style.borderColor = APPLE.blue; e.target.style.boxShadow = `0 0 0 3px ${APPLE.blue}22`; }}
                                onBlur={(e) => { e.target.style.borderColor = K.hairline; e.target.style.boxShadow = 'none'; }}
                              />
                            </div>
                          </div>

                          {/* Select all / clear */}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 14px', borderBottom: `1px solid ${K.hairline}`,
                            background: K.chipBg,
                          }}>
                            <button
                              onClick={selectAllVisible}
                              style={{
                                fontSize: 11, fontWeight: 600, color: APPLE.blue,
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                fontFamily: fontStack, padding: 0,
                              }}
                            >
                              Select all{groupSearch ? ' visible' : ''}
                            </button>
                            {activeGroupCount > 0 && (
                              <button
                                onClick={clearAllGroups}
                                style={{
                                  fontSize: 11, fontWeight: 500, color: K.muted,
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  fontFamily: fontStack, padding: 0,
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = K.ink}
                                onMouseLeave={(e) => e.currentTarget.style.color = K.muted}
                              >
                                Clear all
                              </button>
                            )}
                          </div>

                          {/* Group list */}
                          <div className="dash-scroll" style={{ maxHeight: 224, overflowY: 'auto', padding: '4px 0' }}>
                            {visibleGroups.length === 0 ? (
                              <p style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: K.faint, margin: 0 }}>
                                No groups found
                              </p>
                            ) : (
                              visibleGroups.map(g => {
                                const checked = selectedGroups.has(g);
                                return (
                                  <button
                                    key={g}
                                    onClick={() => toggleGroup(g)}
                                    style={{
                                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                      padding: '8px 14px', textAlign: 'left',
                                      background: checked ? `${APPLE.blue}14` : 'transparent',
                                      border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                                      fontFamily: fontStack,
                                    }}
                                    onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = K.chipBg; }}
                                    onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                                  >
                                    <div style={{
                                      width: 16, height: 16, flexShrink: 0,
                                      border: `1.5px solid ${checked ? APPLE.blue : K.hairline}`,
                                      borderRadius: 5,
                                      background: checked ? APPLE.blue : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                                    </div>
                                    <span style={{
                                      fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                      color: checked ? APPLE.blue : K.ink,
                                      fontWeight: checked ? 600 : 400,
                                    }}>
                                      {g}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>

                          {/* Footer */}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderTop: `1px solid ${K.hairline}`,
                          }}>
                            <span style={{ fontSize: 10, color: K.faint, fontFamily: monoStack }}>
                              {uniqueItemGroups.length} group{uniqueItemGroups.length !== 1 ? 's' : ''} total
                            </span>
                            <button
                              onClick={() => setIsFilterOpen(false)}
                              style={{
                                padding: '6px 16px', borderRadius: 999, border: 'none',
                                background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                                color: '#fff', fontSize: 11, fontWeight: 600,
                                cursor: 'pointer', fontFamily: fontStack,
                                boxShadow: `0 4px 12px -4px ${APPLE.blue}88`,
                              }}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Search input ──────────────────────────────────────── */}
                    <div style={{ position: 'relative', width: 260 }}>
                      <Search size={13} color={K.faint} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search by item name or code…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ ...inputStyle, paddingLeft: 34, paddingRight: search ? 34 : 12, borderRadius: 999 }}
                        onFocus={(e) => { e.target.style.borderColor = APPLE.blue; e.target.style.boxShadow = `0 0 0 3px ${APPLE.blue}22`; }}
                        onBlur={(e) => { e.target.style.borderColor = K.hairline; e.target.style.boxShadow = 'none'; }}
                      />
                      {search && (
                        <button
                          onClick={() => setSearch('')}
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
                </div>

                {/* ── Sub-header: active filter chips ───────────────────── */}
                {hasFilters && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
                    marginBottom: 18,
                  }}>
                    {selectedGroups.size > 0 && Array.from(selectedGroups).map(g => (
                      <span
                        key={g}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          paddingLeft: 10, paddingRight: 4, paddingTop: 3, paddingBottom: 3,
                          borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: `${APPLE.blue}14`, color: APPLE.blue,
                          border: `1px solid ${APPLE.blue}33`,
                        }}
                      >
                        {g}
                        <button
                          onClick={() => toggleGroup(g)}
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
                    ))}

                    <button
                      onClick={() => { setSearch(''); clearAllGroups(); }}
                      style={{
                        marginLeft: 'auto', fontSize: 11, fontWeight: 500,
                        color: K.muted, background: 'transparent', border: 'none',
                        cursor: 'pointer', fontFamily: fontStack, padding: 0,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = K.ink}
                      onMouseLeave={(e) => e.currentTarget.style.color = K.muted}
                    >
                      Clear all
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
                        <col style={{ width: '32%' }} />
                        <col style={{ width: '68%' }} />
                      </colgroup>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          {['Item Code', 'Item Name'].map(label => (
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
                        {filteredItems.length > 0 ? (
                          filteredItems.map((row, i) => (
                            <tr
                              key={row.ItemCode || i}
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
                                  {row.ItemCode || '—'}
                                </code>
                              </td>
                              <td style={{ padding: '12px 22px', fontWeight: 500, color: K.ink }}>
                                {row.ItemName || '—'}
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
                                  <Package size={24} color={APPLE.blue} strokeWidth={1.6} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <p style={{ fontSize: 14, fontWeight: 600, color: K.ink, margin: '0 0 4px' }}>
                                    {items.length === 0 ? 'No Items' : 'No Results Found'}
                                  </p>
                                  <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                                    {items.length === 0
                                      ? 'No items found in the database.'
                                      : 'No items match your current filters.'}
                                  </p>
                                </div>
                                {hasFilters && (
                                  <button
                                    onClick={() => { setSearch(''); clearAllGroups(); }}
                                    style={{
                                      padding: '7px 16px', borderRadius: 999, border: 'none',
                                      background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                                      color: '#fff', fontSize: 12, fontWeight: 600,
                                      cursor: 'pointer', fontFamily: fontStack,
                                      boxShadow: `0 4px 12px -4px ${APPLE.blue}88`,
                                    }}
                                  >
                                    Clear All Filters
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
                  {filteredItems.length > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 22px', borderTop: `1px solid ${K.hairline}`,
                      background: K.chipBg,
                      gap: 10, flexWrap: 'wrap',
                    }}>
                      <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                        Showing all{' '}
                        <span style={{ fontWeight: 700, color: K.ink, fontFamily: monoStack }}>
                          {filteredItems.length.toLocaleString()}
                        </span>{' '}
                        item{filteredItems.length !== 1 ? 's' : ''}
                        {selectedGroups.size > 0 && (
                          <span style={{ color: K.faint }}>
                            {' '}across {selectedGroups.size} group{selectedGroups.size > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: 11, color: K.faint, margin: 0, fontFamily: monoStack }}>
                        {items.length.toLocaleString()} total in database
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

export default Vcp_ItemRecords;