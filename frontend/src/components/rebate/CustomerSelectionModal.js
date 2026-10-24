// src/components/rebate/CustomerSelectionModal.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Search, CheckSquare, Square, Check, Users, Filter } from 'lucide-react';
import Loading from "../../components/common/Loading";

/* ─── Apple system colour language ───────────────────────────────────────── */
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
  @keyframes dash-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dash-pop { animation: dash-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
`;

const CustomerSelectionModal = ({
  isOpen,
  onClose,
  customers = [],
  selectedCustomers = [],
  onConfirm,
  theme
}) => {
  const isDark = theme === 'dark';
  const K = dashTokens(isDark);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [displayCount, setDisplayCount] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const searchTimeoutRef = useRef(null);
  const observerRef = useRef(null);
  const loadingTriggerRef = useRef(null);
  const filterRef = useRef(null);

  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedSlp, setSelectedSlp] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const customerMap = useMemo(() => {
    const map = new Map();
    customers.forEach(customer => {
      const id = customer.CardCode || customer.code || customer.value;
      const name = customer.CardName || customer.name || customer.label;
      const groupName = customer.GroupName || customer.groupName || '';
      const slpName = customer.SlpName || customer.slpName || '';
      if (id) {
        map.set(id, { ...customer, _id: id, _name: name, _groupName: groupName, _slpName: slpName });
      }
    });
    return map;
  }, [customers]);

  const customersWithIds = useMemo(() => Array.from(customerMap.values()), [customerMap]);

  const uniqueGroups = useMemo(() => {
    const groups = new Set();
    customersWithIds.forEach(customer => { if (customer._groupName) groups.add(customer._groupName); });
    return Array.from(groups).sort();
  }, [customersWithIds]);

  const uniqueSlps = useMemo(() => {
    const slps = new Set();
    customersWithIds.forEach(customer => { if (customer._slpName) slps.add(customer._slpName); });
    return Array.from(slps).sort();
  }, [customersWithIds]);

  const filteredCustomers = useMemo(() => {
    let results = customersWithIds;
    if (selectedGroup) results = results.filter(customer => customer._groupName === selectedGroup);
    if (selectedSlp)   results = results.filter(customer => customer._slpName === selectedSlp);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      if (term.length < 2 && searchTerm.length > 0) return [];
      results = results.filter(customer =>
        customer._id?.toLowerCase().includes(term) ||
        customer._name?.toLowerCase().includes(term)
      );
    }
    return results;
  }, [customersWithIds, searchTerm, selectedGroup, selectedSlp]);

  const displayedCustomers = useMemo(() => filteredCustomers.slice(0, displayCount), [filteredCustomers, displayCount]);
  const hasMore = useMemo(() => filteredCustomers.length > displayCount, [filteredCustomers.length, displayCount]);

  useEffect(() => {
    if (isOpen) {
      setDisplayCount(50);
      setSelectedGroup('');
      setSelectedSlp('');
      setIsFilterOpen(false);
      setTimeout(() => {
        const initialSelected = new Set();
        for (const customer of selectedCustomers) {
          const id = customer.CardCode || customer.code || customer.value;
          if (id) initialSelected.add(id);
        }
        setSelectedIds(initialSelected);
        setSearchTerm('');
        setIsSelectAllChecked(false);
      }, 0);
    }
  }, [isOpen, selectedCustomers]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setIsFilterOpen(false);
    };
    if (isFilterOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  useEffect(() => {
    if (filteredCustomers.length === 0) { setIsSelectAllChecked(false); return; }
    let allSelected = true;
    const maxCheck = Math.min(filteredCustomers.length, 100);
    for (let i = 0; i < maxCheck; i++) {
      const customer = filteredCustomers[i];
      if (!selectedIds.has(customer._id)) { allSelected = false; break; }
    }
    if (allSelected && filteredCustomers.length > maxCheck) setIsSelectAllChecked(true);
    else setIsSelectAllChecked(allSelected && filteredCustomers.length > 0);
  }, [selectedIds, filteredCustomers]);

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(value);
      setDisplayCount(50);
    }, 300);
  }, []);

  const handleGroupChange = useCallback((e) => { setSelectedGroup(e.target.value); setDisplayCount(50); }, []);
  const handleSlpChange   = useCallback((e) => { setSelectedSlp(e.target.value);   setDisplayCount(50); }, []);
  const clearFilters      = useCallback(() => { setSelectedGroup(''); setSelectedSlp(''); setDisplayCount(50); }, []);
  const applyFilters      = useCallback(() => { setIsFilterOpen(false); }, []);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    requestAnimationFrame(() => {
      setDisplayCount(prev => Math.min(prev + 50, filteredCustomers.length));
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, hasMore, filteredCustomers.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMore && !isLoadingMore) loadMore();
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    if (loadingTriggerRef.current) observerRef.current.observe(loadingTriggerRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [isOpen, hasMore, isLoadingMore, loadMore]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const toggleSelectAll = useCallback(() => {
    requestAnimationFrame(() => {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (!isSelectAllChecked) {
          for (const customer of filteredCustomers) newSet.add(customer._id);
        } else {
          for (const customer of filteredCustomers) newSet.delete(customer._id);
        }
        return newSet;
      });
    });
  }, [filteredCustomers, isSelectAllChecked]);

  const toggleCustomer = useCallback((customerId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) newSet.delete(customerId);
      else newSet.add(customerId);
      return newSet;
    });
  }, []);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  const handleConfirm = useCallback(() => {
    if (selectedCount === 0) return;
    setIsConfirming(true);
    setTimeout(() => {
      const selectedData = [];
      for (const id of selectedIds) {
        const customer = customerMap.get(id);
        if (customer) selectedData.push(customer);
        if (selectedData.length >= selectedIds.size) break;
      }
      onConfirm(selectedData);
      setTimeout(() => { setIsConfirming(false); onClose(); }, 100);
    }, 0);
  }, [customerMap, selectedIds, selectedCount, onConfirm, onClose]);

  const renderCustomerList = () => {
    if (filteredCustomers.length === 0) {
      return (
        <div className="text-center py-8" style={{ color: K.muted }}>
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-medium">No customers found</p>
          <p className="text-xs mt-1" style={{ color: K.faint }}>Try adjusting your search term or filters</p>
        </div>
      );
    }
    return (
      <>
        {displayedCustomers.map((customer) => {
          const isSelected = selectedIds.has(customer._id);
          return (
            <div
              key={customer._id}
              onClick={() => toggleCustomer(customer._id)}
              className="flex items-center px-4 py-2 border-b cursor-pointer transition-all"
              style={{
                background: isSelected ? `${APPLE.blue}14` : "transparent",
                borderColor: isSelected ? `${APPLE.blue}33` : K.hairline,
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = K.chipBg; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              <div className="w-8 flex-shrink-0">
                {isSelected ? (
                  <div className="w-4 h-4 rounded flex items-center justify-center"
                    style={{ background: APPLE.blue }}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded border" style={{ borderColor: K.hairline }} />
                )}
              </div>
              <div className="w-32 text-xs truncate font-mono" style={{ color: K.muted }}>
                {customer._id}
              </div>
              <div className="flex-1 text-xs truncate" style={{ color: K.ink }}>
                {customer._name}
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div ref={loadingTriggerRef} className="py-4 flex justify-center">
            {isLoadingMore ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: `${APPLE.blue}33`, borderTopColor: APPLE.blue }} />
                <span className="text-xs" style={{ color: K.muted }}>Loading more…</span>
              </div>
            ) : (
              <span className="text-xs" style={{ color: K.faint }}>Scroll for more</span>
            )}
          </div>
        )}

        <div className="text-center py-2 text-xs" style={{ color: K.faint }}>
          Showing {displayedCustomers.length} of {filteredCustomers.length} results
        </div>
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="dash-page fixed inset-0 flex items-center justify-center z-[9999] p-4"
      style={{ backgroundColor: isDark ? "rgba(10,10,14,0.65)" : "rgba(0,0,0,0.4)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      <style>{DASH_FONT}</style>

      {isConfirming && (
        <div className="absolute inset-0 rounded-[28px] z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(6px)" }}>
          <Loading theme={theme} />
        </div>
      )}

      <div
        className="dash-glass dash-pop rounded-[28px] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          background: K.glassDeep,
          border: `1px solid ${K.rim}`,
          boxShadow: K.shadow,
          opacity: isConfirming ? 0.75 : 1,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: K.hairline }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`, boxShadow: `0 4px 12px -4px ${APPLE.blue}88` }}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: K.ink }}>Select Customers</h2>
              <p className="text-xs" style={{ color: K.muted }}>Search and select customers to add to your rebate program</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: K.chipBg,
              color: K.muted,
              opacity: isConfirming ? 0.5 : 1,
              cursor: isConfirming ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!isConfirming) { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; } }}
            onMouseLeave={(e) => { if (!isConfirming) { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; } }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="p-4 border-b flex-shrink-0" style={{ borderColor: K.hairline }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: K.faint }} />
              <input
                type="text"
                placeholder="Search by customer code or name…"
                onChange={handleSearchChange}
                defaultValue={searchTerm}
                disabled={isConfirming}
                className="w-full pl-10 pr-4 py-2.5 rounded-full text-xs focus:outline-none transition-all dash-glass"
                style={{
                  background: K.glass,
                  border: `1px solid ${K.hairline}`,
                  color: K.ink,
                  opacity: isConfirming ? 0.5 : 1,
                }}
                autoFocus
              />
            </div>

            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                disabled={isConfirming}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs transition-all dash-glass"
                style={isFilterOpen || selectedGroup || selectedSlp
                  ? { background: `${APPLE.blue}1c`, border: `1px solid ${APPLE.blue}55`, color: APPLE.blue }
                  : { background: K.chipBg, border: `1px solid ${K.hairline}`, color: K.muted }
                }
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
                {(selectedGroup || selectedSlp) && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${APPLE.blue}1c`, color: APPLE.blue }}>
                    {(selectedGroup ? 1 : 0) + (selectedSlp ? 1 : 0)}
                  </span>
                )}
              </button>

              {isFilterOpen && (
                <div
                  className="dash-glass dash-pop absolute right-0 top-full mt-1 w-80 p-4 rounded-2xl z-10"
                  style={{ background: K.glassDeep, border: `1px solid ${K.rim}`, boxShadow: K.shadow }}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" style={{ color: K.ink }}>Filter Customers</h3>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                        style={{ background: K.chipBg, color: K.muted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: K.muted }}>Customer Group</label>
                      <select
                        value={selectedGroup}
                        onChange={handleGroupChange}
                        disabled={isConfirming}
                        className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none dash-glass"
                        style={{ background: K.glass, border: `1px solid ${K.hairline}`, color: K.ink }}
                      >
                        <option value="">All Groups</option>
                        {uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: K.muted }}>Sales Person</label>
                      <select
                        value={selectedSlp}
                        onChange={handleSlpChange}
                        disabled={isConfirming}
                        className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none dash-glass"
                        style={{ background: K.glass, border: `1px solid ${K.hairline}`, color: K.ink }}
                      >
                        <option value="">All Sales Persons</option>
                        {uniqueSlps.map(slp => <option key={slp} value={slp}>{slp}</option>)}
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: K.hairline }}>
                      <button
                        onClick={clearFilters}
                        disabled={isConfirming}
                        className="px-3 py-1.5 text-xs rounded-full transition-all"
                        style={{ color: K.muted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.chipBg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = 'transparent'; }}
                      >
                        Clear All
                      </button>
                      <button
                        onClick={applyFilters}
                        className="px-4 py-1.5 text-xs rounded-full text-white font-medium transition-all"
                        style={{ background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`, boxShadow: `0 4px 12px -4px ${APPLE.blue}88` }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Select All Header */}
        <div
          className="px-4 py-2 flex items-center justify-between border-b flex-shrink-0"
          style={{ borderColor: K.hairline, background: K.chipBg }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              disabled={isConfirming || filteredCustomers.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              {isSelectAllChecked
                ? <CheckSquare className="w-4 h-4" style={{ color: APPLE.blue }} />
                : <Square className="w-4 h-4" style={{ color: K.faint }} />}
              <span style={{ color: K.ink }}>
                Select All ({filteredCustomers.length.toLocaleString()})
              </span>
            </button>

            {(selectedGroup || selectedSlp) && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: K.faint }}>|</span>
                {selectedGroup && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                    style={{ background: K.chipBg, color: K.muted }}>
                    Group: {selectedGroup}
                    <button onClick={(e) => { e.stopPropagation(); setSelectedGroup(''); }} className="ml-1" style={{ color: K.faint }}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedSlp && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                    style={{ background: K.chipBg, color: K.muted }}>
                    Sales: {selectedSlp}
                    <button onClick={(e) => { e.stopPropagation(); setSelectedSlp(''); }} className="ml-1" style={{ color: K.faint }}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-xs" style={{ color: K.muted }}>
            {selectedCount.toLocaleString()} selected
          </div>
        </div>

        {/* Table Header */}
        <div className="px-4 py-2 flex border-b flex-shrink-0" style={{ borderColor: K.hairline, background: K.glass }}>
          <div className="w-8 flex-shrink-0"></div>
          <div className="w-32 text-xs font-semibold" style={{ color: K.muted }}>Customer Code</div>
          <div className="flex-1 text-xs font-semibold" style={{ color: K.muted }}>Customer Name</div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto relative dash-scroll" style={{ maxHeight: '50vh' }}>
          {renderCustomerList()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0" style={{ borderColor: K.hairline, background: K.chipBg }}>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{ border: `1px solid ${K.hairline}`, color: K.muted }}
              onMouseEnter={(e) => { if (!isConfirming) { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; } }}
              onMouseLeave={(e) => { if (!isConfirming) { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = 'transparent'; } }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0 || isConfirming}
              className="px-4 py-1.5 text-xs font-medium text-white rounded-full transition-all flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                boxShadow: `0 4px 16px -6px ${APPLE.blue}88`,
              }}
              onMouseEnter={(e) => { if (selectedCount > 0 && !isConfirming) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Adding…</span>
                </>
              ) : (
                <span>Add {selectedCount > 0 ? `${selectedCount.toLocaleString()} customer${selectedCount > 1 ? 's' : ''}` : 'Customers'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CustomerSelectionModal);