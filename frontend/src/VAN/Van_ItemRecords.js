import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from 'axios';
import { Package, Search, Filter, X, Check, Lock } from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import vanLogo from "../assets/van.png";
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import AccessDenied from "../components/common/AccessDenied";
import { useTheme } from '../context/ThemeContext';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';

function Van_ItemRecords() {
  const { theme, updateTheme } = useTheme();
  const location = useLocation();
  const routePath = '/Van_ItemRecords';
  const { access, accessLoading, accessError } = useAccessControl(routePath);
  const isDark = theme === 'dark';

  const [showVanDropdown, setShowVanDropdown] = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown] = useState(false);
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  // ── Multi-select filter state ─────────────────────────────────────────────
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const filterRef = useRef(null);

  const API_BASE = 'http://192.168.100.193:3009/api';
  const DB_NAME = 'USER';

  const componentMetadata = {
    name: 'Van_ItemRecords', version: '2.0.0',
    description: 'Displays and manages a list of item records.',
    routePath,
  };
  useComponentRegistration(componentMetadata);

  // ── User init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const username = storedUser.DisplayName || storedUser.Username || "Unknown User";
    const code = storedUser.User_ID || "Unknown ID";
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
  }, []);

  // ── Fetch items ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!access.canView) return;
    const fetchItems = async () => {
      try {
        const res = await fetch("http://192.168.100.193:3009/api/sync/local/items?db=VAN");
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

  // ── Unique item groups ────────────────────────────────────────────────────
  const uniqueItemGroups = useMemo(() => {
    const s = new Set();
    items.forEach(i => {
      const g = i.ItmsGrpNam || i.itemGroup || i.groupName || '';
      if (g) s.add(g);
    });
    return Array.from(s).sort();
  }, [items]);

  // ── Groups visible inside dropdown (respects inner search) ───────────────
  const visibleGroups = useMemo(() => {
    if (!groupSearch.trim()) return uniqueItemGroups;
    const t = groupSearch.toLowerCase();
    return uniqueItemGroups.filter(g => g.toLowerCase().includes(t));
  }, [uniqueItemGroups, groupSearch]);

  // ── Main filtered list ────────────────────────────────────────────────────
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

  const hasFilters = selectedGroups.size > 0 || search.trim();
  const activeGroupCount = selectedGroups.size;

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const T = {
    card: isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200',
    thead: isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200',
    row: isDark ? 'hover:bg-slate-700/40 border-slate-700/50' : 'hover:bg-slate-50/80 border-slate-100',
    divider: isDark ? 'divide-slate-700/60' : 'divide-slate-100',
    input: isDark
      ? 'bg-slate-700/80 border-slate-600 text-slate-100 placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400',
    tp: isDark ? 'text-slate-100' : 'text-slate-800',
    ts: isDark ? 'text-slate-400' : 'text-slate-500',
    tm: isDark ? 'text-slate-500' : 'text-slate-400',
  };

  // ── Loading spinner ───────────────────────────────────────────────────────
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className={`w-8 h-8 rounded-full border-4 border-t-transparent animate-spin ${
        isDark ? 'border-blue-400' : 'border-blue-500'
      }`} />
      <p className={`text-xs ${T.ts}`}>Checking permissions…</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`flex h-screen w-full font-poppins overflow-hidden ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown} setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown} setShowVcpDropdown={setShowVcpDropdown}
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

        {/* ── Full-height scrollable body ───────────────────────────────── */}
        <div className="pt-16 flex-1 flex flex-col overflow-hidden p-6">
          <div className={`flex-1 flex flex-col rounded-2xl border shadow-sm w-full max-w-[1600px] mx-auto mt-4 overflow-hidden ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}>

            {/* ── Access guard ─────────────────────────────────────────── */}
            {accessLoading ? (
              renderLoading()
            ) : !access.canView ? (
              <AccessDenied
                isDark={isDark}
                accessError={accessError}
                message="You don't have permission to view item records."
              />
            ) : (
              <>
                {/* ── Page header ──────────────────────────────────────────── */}
                <div className={`flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}>

                  {/* Title + light colored icon */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isDark
                        ? 'bg-blue-500/10 border border-blue-500/20'
                        : 'bg-blue-50 border border-blue-100'
                    }`}>
                      <Package
                        size={17}
                        className={isDark ? 'text-blue-400' : 'text-blue-400'}
                        strokeWidth={1.6}
                      />
                    </div>
                    <div className="min-w-0">
                      <h1 className={`text-sm font-bold leading-none ${T.tp}`}>Item Records</h1>
                      <p className={`text-[11px] mt-0.5 ${T.ts}`}>Manage and view all item records</p>
                    </div>
                  </div>

                  {/* Filter + Search ─────────────────────────────────────── */}
                  <div className="flex items-center gap-2 flex-shrink-0">

                    {/* ── Filter button + dropdown ──────────────────────── */}
                    <div className="relative" ref={filterRef}>
                      <button
                        onClick={() => setIsFilterOpen(o => !o)}
                        className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium transition-all ${
                          isFilterOpen || activeGroupCount > 0
                            ? isDark
                              ? 'bg-blue-950/60 border-blue-700 text-blue-400'
                              : 'bg-blue-50 border-blue-300 text-blue-700'
                            : isDark
                              ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Filter size={13} strokeWidth={2} />
                        <span>Filter</span>
                        {activeGroupCount > 0 && (
                          <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                            isDark ? 'bg-blue-700 text-blue-100' : 'bg-blue-600 text-white'
                          }`}>
                            {activeGroupCount}
                          </span>
                        )}
                      </button>

                      {/* ── Filter dropdown ─────────────────────────────── */}
                      {isFilterOpen && (
                        <div className={`absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl border z-50 overflow-hidden ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                        }`}>

                          {/* Dropdown header */}
                          <div className={`flex items-center justify-between px-4 py-3 border-b ${
                            isDark ? 'border-slate-700' : 'border-slate-100'
                          }`}>
                            <div className="flex items-center gap-2">
                              <Filter size={12} className={T.ts} />
                              <span className={`text-xs font-bold uppercase tracking-wider ${T.ts}`}>
                                Item Group
                              </span>
                              {activeGroupCount > 0 && (
                                <span className={`text-[10px] font-semibold ${
                                  isDark ? 'text-blue-400' : 'text-blue-600'
                                }`}>
                                  {activeGroupCount} selected
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setIsFilterOpen(false)}
                              className={`p-1 rounded-lg transition-colors ${
                                isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'
                              }`}
                            >
                              <X size={13} />
                            </button>
                          </div>

                          {/* Group search inside dropdown */}
                          <div className={`px-3 py-2.5 border-b ${
                            isDark ? 'border-slate-700' : 'border-slate-100'
                          }`}>
                            <div className="relative">
                              <Search size={11} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${T.tm}`} />
                              <input
                                type="text"
                                placeholder="Search groups…"
                                value={groupSearch}
                                onChange={e => setGroupSearch(e.target.value)}
                                className={`w-full pl-7 pr-3 py-1.5 border rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${T.input}`}
                              />
                            </div>
                          </div>

                          {/* Select all / clear row */}
                          <div className={`flex items-center justify-between px-4 py-2 border-b ${
                            isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-100 bg-slate-50'
                          }`}>
                            <button
                              onClick={selectAllVisible}
                              className={`text-[11px] font-medium transition-colors ${
                                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                              }`}
                            >
                              Select all{groupSearch ? ' visible' : ''}
                            </button>
                            {activeGroupCount > 0 && (
                              <button
                                onClick={clearAllGroups}
                                className={`text-[11px] font-medium transition-colors ${
                                  isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                Clear all
                              </button>
                            )}
                          </div>

                          {/* Scrollable group list */}
                          <div className="max-h-56 overflow-y-auto py-1">
                            {visibleGroups.length === 0 ? (
                              <p className={`text-center py-6 text-[11px] ${T.tm}`}>No groups found</p>
                            ) : (
                              visibleGroups.map(g => {
                                const checked = selectedGroups.has(g);
                                return (
                                  <button
                                    key={g}
                                    onClick={() => toggleGroup(g)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                      checked
                                        ? isDark
                                          ? 'bg-blue-950/40 hover:bg-blue-950/60'
                                          : 'bg-blue-50 hover:bg-blue-100/70'
                                        : isDark
                                          ? 'hover:bg-slate-700/60'
                                          : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
                                      checked
                                        ? 'bg-blue-600 border-blue-600'
                                        : isDark
                                          ? 'border-slate-600 bg-slate-700'
                                          : 'border-slate-300 bg-white'
                                    }`}>
                                      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <span className={`text-xs truncate ${
                                      checked
                                        ? isDark ? 'text-blue-300 font-medium' : 'text-blue-700 font-medium'
                                        : T.tp
                                    }`}>
                                      {g}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>

                          {/* Dropdown footer */}
                          <div className={`flex items-center justify-between px-4 py-2.5 border-t ${
                            isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-100 bg-slate-50'
                          }`}>
                            <span className={`text-[10px] ${T.tm}`}>
                              {uniqueItemGroups.length} group{uniqueItemGroups.length !== 1 ? 's' : ''} total
                            </span>
                            <button
                              onClick={() => setIsFilterOpen(false)}
                              className="px-4 py-1 text-[11px] font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Search input ──────────────────────────────────────── */}
                    <div className="relative w-64">
                      <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${T.tm}`} />
                      <input
                        type="text"
                        placeholder="Search by item name or code…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${T.input}`}
                      />
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
                            isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Sub-header: count + active filter chips ───────────────── */}
                <div className={`flex-shrink-0 flex flex-wrap items-center gap-2 px-6 py-2 ${
                  isDark ? 'border-slate-700 bg-slate-900/20' : 'border-slate-100 bg-slate-50'
                }`}>

                  {/* Active group chips */}
                  {selectedGroups.size > 0 && (
                    <>
                      <span className={`text-[10px] ${T.tm}`}>·</span>
                      {Array.from(selectedGroups).map(g => (
                        <span
                          key={g}
                          className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium border ${
                            isDark
                              ? 'bg-blue-950/50 border-blue-800 text-blue-300'
                              : 'bg-blue-50 border-blue-200 text-blue-700'
                          }`}
                        >
                          {g}
                          <button
                            onClick={() => toggleGroup(g)}
                            className={`p-0.5 rounded-full transition-colors ${
                              isDark ? 'hover:bg-blue-800' : 'hover:bg-blue-200'
                            }`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </>
                  )}

                  {hasFilters && (
                    <button
                      onClick={() => { setSearch(''); clearAllGroups(); }}
                      className={`ml-auto text-[11px] font-medium transition-colors ${
                        isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* ── Scrollable table ──────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-xs table-fixed">
                    <colgroup>
                      <col style={{ width: '32%' }} />
                      <col style={{ width: '68%' }} />
                    </colgroup>
                    <thead className={`sticky top-0 z-10 border-b ${T.thead}`}>
                      <tr>
                        <th className={`px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                          Item Code
                        </th>
                        <th className={`px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest ${T.ts}`}>
                          Item Name
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${T.divider}`}>
                      {filteredItems.length > 0 ? (
                        filteredItems.map((row, i) => (
                          <tr
                            key={row.ItemCode || i}
                            className={`transition-colors duration-75 ${T.row}`}
                          >
                            <td className="px-6 py-3">
                              <code className={`text-xs px-2 py-0.5 rounded border font-semibold ${
                                isDark
                                  ? 'bg-slate-900/50 text-slate-300 border-slate-600'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {row.ItemCode || '—'}
                              </code>
                            </td>
                            <td className={`px-6 py-3 font-medium ${T.tp}`}>
                              {row.ItemName || '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2}>
                            <div className="flex flex-col items-center justify-center py-24 gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                                isDark
                                  ? 'bg-blue-500/10 border-blue-500/20'
                                  : 'bg-blue-50 border-blue-100'
                              }`}>
                                <Package size={20} className={isDark ? 'text-blue-400' : 'text-blue-400'} strokeWidth={1.5} />
                              </div>
                              <div className="text-center">
                                <p className={`text-sm font-bold mb-0.5 ${T.tp}`}>
                                  {items.length === 0 ? 'No Items' : 'No Results Found'}
                                </p>
                                <p className={`text-xs ${T.ts}`}>
                                  {items.length === 0
                                    ? 'No items found in the database.'
                                    : 'No items match your current filters.'}
                                </p>
                              </div>
                              {hasFilters && (
                                <button
                                  onClick={() => { setSearch(''); clearAllGroups(); }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
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

                {/* ── Footer ───────────────────────────────────────────────── */}
                {filteredItems.length > 0 && (
                  <div className={`flex-shrink-0 flex items-center justify-between px-6 py-2.5 border-t ${
                    isDark ? 'border-slate-700 bg-slate-900/20' : 'border-slate-100 bg-slate-50'
                  }`}>
                    <p className={`text-[11px] ${T.ts}`}>
                      Showing all{' '}
                      <span className={`font-bold ${T.tp}`}>
                        {filteredItems.length.toLocaleString()}
                      </span>{' '}
                      item{filteredItems.length !== 1 ? 's' : ''}
                      {selectedGroups.size > 0 && (
                        <span className={T.tm}>
                          {' '}across {selectedGroups.size} group{selectedGroups.size > 1 ? 's' : ''}
                        </span>
                      )}
                    </p>
                    <p className={`text-[11px] ${T.tm}`}>
                      {items.length.toLocaleString()} total in database
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

export default Van_ItemRecords;