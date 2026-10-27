// src/pages/Vcp_ItemRecords.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from 'axios';
import { Package, Search, Filter, X, Check } from "lucide-react";
import { useLocation } from 'react-router-dom';
import vcpLogo from "../assets/vcp.png";
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import AccessDenied from "../components/common/AccessDenied";
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';
import { API_BASE, DB_NAME } from '../config/appConfig';

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens, DesignPage } from '../design-system';

const routePath = '/Vcp_ItemRecords';

const componentMetadata = {
  name: 'Vcp_ItemRecords', version: '2.0.0',
  description: 'Displays and manages a list of item records.',
  routePath,
};

function Vcp_ItemRecords() {
  const { theme, updateTheme, K } = useTokens();
  useLocation(); // preserve hook order
  const { access, accessLoading, accessError } = useAccessControl(routePath);

  const fontStack = "'Outfit', system-ui, sans-serif";

  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(true);
  const [userName,  setUserName]  = useState("");
  const [userCode,  setUserCode]  = useState("");
  const [initials,  setInitials]  = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [items,     setItems]     = useState([]);
  const [search,    setSearch]    = useState("");

  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [isFilterOpen,   setIsFilterOpen]   = useState(false);
  const [groupSearch,    setGroupSearch]    = useState("");
  const filterRef = useRef(null);

  useComponentRegistration(componentMetadata);

  /* ── User init ─────────────────────────────────────────────────── */
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

  /* ── Fetch items ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!access.canView) return;
    const fetchItems = async () => {
      try {
        const res  = await fetch("/api/vcp/items?db=VCP");
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

  /* ── Click-outside closes filter ───────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target))
        setIsFilterOpen(false);
    };
    if (isFilterOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isFilterOpen]);

  /* ── Unique item groups ────────────────────────────────────────── */
  const uniqueItemGroups = useMemo(() => {
    const s = new Set();
    items.forEach(i => {
      const g = i.ItmsGrpNam || i.itemGroup || i.groupName || '';
      if (g) s.add(g);
    });
    return Array.from(s).sort();
  }, [items]);

  const visibleGroups = useMemo(() => {
    if (!groupSearch.trim()) return uniqueItemGroups;
    const t = groupSearch.toLowerCase();
    return uniqueItemGroups.filter(g => g.toLowerCase().includes(t));
  }, [uniqueItemGroups, groupSearch]);

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

  /* ── Toggle helpers ────────────────────────────────────────────── */
  const toggleGroup = (g) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };
  const clearAllGroups = () => { setSelectedGroups(new Set()); setGroupSearch(''); };
  const selectAllVisible = () => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      visibleGroups.forEach(g => next.add(g));
      return next;
    });
  };

  const hasFilters = selectedGroups.size > 0 || search.trim();
  const activeGroupCount = selectedGroups.size;
  const filterActive = isFilterOpen || activeGroupCount > 0;

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

      {/* Aurora wash — blue/purple (same as Nexchem/Van); swap to ds-aurora-blue-green for VCP green identity */}
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
          logo={vcpLogo}
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
                message="You don't have permission to view item records."
              />
            ) : (
              <>
                {/* ── Title bar ─────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-7 pb-5 gap-4 flex-wrap border-b border-[var(--ds-hairline)]">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center flex-shrink-0 ds-gradient-primary shadow-[0_4px_16px_-4px_rgba(10,132,255,0.53)]">
                      <Package size={22} className="text-white" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--ds-ink)] m-0">
                        Item Records
                      </h1>
                      <p className="text-[12px] text-[var(--ds-muted)] mt-[3px] mb-0 font-normal">
                        Manage and view all item records
                      </p>
                    </div>
                  </div>

                  {/* Filter + Search */}
                  <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap">

                    {/* Filter button + dropdown */}
                    <div className="relative" ref={filterRef}>
                      <button
                        onClick={() => setIsFilterOpen(o => !o)}
                        className={`ds-btn-lift flex items-center gap-1.5 px-3.5 py-[9px] rounded-full text-[13px] font-medium cursor-pointer transition-all duration-200 border ${
                          filterActive
                            ? 'border-[#0A84FF]/33 bg-[#0A84FF]/11 text-[#0A84FF]'
                            : 'border-[var(--ds-hairline)] bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'
                        }`}
                      >
                        <Filter size={13} strokeWidth={2} />
                        <span>Filter</span>
                        {activeGroupCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-[#0A84FF] text-white ds-font-mono">
                            {activeGroupCount}
                          </span>
                        )}
                      </button>

                      {/* Filter dropdown */}
                      {isFilterOpen && (
                        <div className="ds-glass ds-pop absolute right-0 top-[calc(100%+8px)] w-[340px] rounded-[18px] z-50 overflow-hidden bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--ds-hairline)]">
                            <div className="flex items-center gap-2">
                              <Filter size={12} className="text-[var(--ds-muted)]" />
                              <span className="text-[11px] font-bold text-[var(--ds-muted)] uppercase tracking-[0.06em]">
                                Item Group
                              </span>
                              {activeGroupCount > 0 && (
                                <span className="text-[10px] font-semibold text-[#0A84FF] ds-font-mono">
                                  {activeGroupCount} selected
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setIsFilterOpen(false)}
                              className="p-1 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--ds-muted)] hover:bg-[var(--ds-chip-bg)] hover:text-[var(--ds-ink)] transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </div>

                          {/* Inner search */}
                          <div className="px-3 py-2.5 border-b border-[var(--ds-hairline)]">
                            <div className="relative">
                              <Search
                                size={11}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-faint)]"
                              />
                              <input
                                type="text"
                                placeholder="Search groups…"
                                value={groupSearch}
                                onChange={e => setGroupSearch(e.target.value)}
                                className="w-full pl-7 pr-2.5 py-[7px] rounded-[10px] text-[12px] outline-none bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.13)] transition-colors"
                              />
                            </div>
                          </div>

                          {/* Select all / clear */}
                          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--ds-hairline)] bg-[var(--ds-chip-bg)]">
                            <button
                              onClick={selectAllVisible}
                              className="text-[11px] font-semibold bg-transparent border-none cursor-pointer p-0 text-[#0A84FF]"
                            >
                              Select all{groupSearch ? ' visible' : ''}
                            </button>
                            {activeGroupCount > 0 && (
                              <button
                                onClick={clearAllGroups}
                                className="text-[11px] font-medium bg-transparent border-none cursor-pointer p-0 text-[var(--ds-muted)] hover:text-[var(--ds-ink)] transition-colors"
                              >
                                Clear all
                              </button>
                            )}
                          </div>

                          {/* Group list */}
                          <div className="ds-scroll max-h-[224px] overflow-y-auto py-1">
                            {visibleGroups.length === 0 ? (
                              <p className="text-center py-6 text-[11px] text-[var(--ds-faint)] m-0">
                                No groups found
                              </p>
                            ) : (
                              visibleGroups.map(g => {
                                const checked = selectedGroups.has(g);
                                return (
                                  <button
                                    key={g}
                                    onClick={() => toggleGroup(g)}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2 text-left border-none cursor-pointer transition-colors ${
                                      checked ? 'bg-[#0A84FF]/8' : 'hover:bg-[var(--ds-chip-bg)]'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 flex-shrink-0 rounded-[5px] flex items-center justify-center border-[1.5px] ${
                                      checked ? 'bg-[#0A84FF] border-[#0A84FF]' : 'bg-transparent border-[var(--ds-hairline)]'
                                    }`}>
                                      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <span className={`text-[12px] truncate ${
                                      checked ? 'text-[#0A84FF] font-semibold' : 'text-[var(--ds-ink)]'
                                    }`}>
                                      {g}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[var(--ds-hairline)]">
                            <span className="text-[10px] text-[var(--ds-faint)] ds-font-mono">
                              {uniqueItemGroups.length} group{uniqueItemGroups.length !== 1 ? 's' : ''} total
                            </span>
                            <button
                              onClick={() => setIsFilterOpen(false)}
                              className="px-4 py-1.5 rounded-full border-none text-white text-[11px] font-semibold cursor-pointer ds-gradient-primary shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Search input */}
                    <div className="relative w-[260px]">
                      <Search
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ds-faint)]"
                      />
                      <input
                        type="text"
                        placeholder="Search by item name or code…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={`w-full py-[9px] rounded-full text-[13px] outline-none transition-colors bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] ${
                          search ? 'pl-[34px] pr-[34px]' : 'pl-[34px] pr-3'
                        }`}
                      />
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--ds-muted)] hover:text-[var(--ds-ink)] transition-colors"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active filter chips */}
                {hasFilters && (
                  <div className="flex flex-wrap items-center gap-2 mb-[18px]">
                    {selectedGroups.size > 0 && Array.from(selectedGroups).map(g => (
                      <span
                        key={g}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-[3px] rounded-full text-[11px] font-semibold bg-[#0A84FF]/8 text-[#0A84FF] border border-[#0A84FF]/20"
                      >
                        {g}
                        <button
                          onClick={() => toggleGroup(g)}
                          className="p-0.5 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[#0A84FF] hover:bg-[#0A84FF]/13 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}

                    <button
                      onClick={() => { setSearch(''); clearAllGroups(); }}
                      className="ml-auto text-[11px] font-medium bg-transparent border-none cursor-pointer p-0 text-[var(--ds-muted)] hover:text-[var(--ds-ink)] transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {/* Table card */}
                <div className="ds-glass flex-1 min-h-0 flex flex-col rounded-[18px] overflow-hidden bg-[var(--ds-glass)] border border-[var(--ds-hairline)]">
                  <div className="ds-scroll flex-1 min-h-0 overflow-y-auto">
                    <table className="w-full border-collapse table-fixed text-[13px]">
                      <colgroup>
                        <col className="w-[32%]" />
                        <col className="w-[68%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10">
                        <tr>
                          {['Item Code', 'Item Name'].map(label => (
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
                        {filteredItems.length > 0 ? (
                          filteredItems.map((row, i) => (
                            <tr
                              key={row.ItemCode || i}
                              className="border-b border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors"
                            >
                              <td className="px-[22px] py-3">
                                <code className="text-[12px] px-[9px] py-[3px] rounded-[7px] font-semibold bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] text-[var(--ds-muted)] ds-font-mono">
                                  {row.ItemCode || '—'}
                                </code>
                              </td>
                              <td className="px-[22px] py-3 font-medium text-[var(--ds-ink)]">
                                {row.ItemName || '—'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2}>
                              <div className="flex flex-col items-center justify-center py-[72px] gap-3.5">
                                <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center bg-[#0A84FF]/11">
                                  <Package size={24} className="text-[#0A84FF]" strokeWidth={1.6} />
                                </div>
                                <div className="text-center">
                                  <p className="text-[14px] font-semibold text-[var(--ds-ink)] m-0 mb-1">
                                    {items.length === 0 ? 'No Items' : 'No Results Found'}
                                  </p>
                                  <p className="text-[12px] text-[var(--ds-muted)] m-0">
                                    {items.length === 0
                                      ? 'No items found in the database.'
                                      : 'No items match your current filters.'}
                                  </p>
                                </div>
                                {hasFilters && (
                                  <button
                                    onClick={() => { setSearch(''); clearAllGroups(); }}
                                    className="px-4 py-[7px] rounded-full border-none text-white text-[12px] font-semibold cursor-pointer ds-gradient-primary shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]"
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

                  {/* Footer */}
                  {filteredItems.length > 0 && (
                    <div className="flex items-center justify-between gap-2.5 flex-wrap px-[22px] py-3.5 bg-[var(--ds-chip-bg)] border-t border-[var(--ds-hairline)]">
                      <p className="text-[12px] text-[var(--ds-muted)] m-0">
                        Showing all{' '}
                        <span className="font-bold text-[var(--ds-ink)] ds-font-mono">
                          {filteredItems.length.toLocaleString()}
                        </span>{' '}
                        item{filteredItems.length !== 1 ? 's' : ''}
                        {selectedGroups.size > 0 && (
                          <span className="text-[var(--ds-faint)]">
                            {' '}across {selectedGroups.size} group{selectedGroups.size > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[var(--ds-faint)] m-0 ds-font-mono">
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
    </DesignPage>
  );
}

export default Vcp_ItemRecords;