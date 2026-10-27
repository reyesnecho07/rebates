// src/components/rebate/CustomerSelectionModal.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, CheckSquare, Square, Check, Users, Filter } from 'lucide-react';
import Loading from "../../components/common/Loading";

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens } from '../../design-system';

const POPUP_WIDTH = 320;
const POPUP_EST_HEIGHT = 380;
const POPUP_GAP = 6;

const CustomerSelectionModal = ({
  isOpen,
  onClose,
  customers = [],
  selectedCustomers = [],
  onConfirm,
}) => {
  const { theme, isDark, K } = useTokens();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [displayCount, setDisplayCount] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filterPopupPos, setFilterPopupPos] = useState({ top: 0, left: 0 });

  const searchTimeoutRef = useRef(null);
  const observerRef = useRef(null);
  const loadingTriggerRef = useRef(null);
  const filterRef = useRef(null);
  const filterPopupRef = useRef(null);
  const modalRef = useRef(null);

  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedSlp, setSelectedSlp] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const customerMap = useMemo(() => {
    const map = new Map();
    customers.forEach(customer => {
      const id = customer.CardCode || customer.code || customer.value;
      const name = customer.CardName || customer.name || customer.label;
      const groupName = customer.GroupName || customer.groupName || '';
      const slpName = customer.SlpName || customer.slpName || '';
      const area = customer.AreaName || customer.Area || customer.area || '';
      if (id) {
        map.set(id, {
          ...customer,
          _id: id,
          _name: name,
          _groupName: groupName,
          _slpName: slpName,
          _area: area,
        });
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

  const uniqueAreas = useMemo(() => {
    const areas = new Set();
    customersWithIds.forEach(customer => { if (customer._area) areas.add(customer._area); });
    return Array.from(areas).sort();
  }, [customersWithIds]);

  const filteredCustomers = useMemo(() => {
    let results = customersWithIds;
    if (selectedGroup) results = results.filter(customer => customer._groupName === selectedGroup);
    if (selectedSlp)   results = results.filter(customer => customer._slpName === selectedSlp);
    if (selectedArea)  results = results.filter(customer => customer._area === selectedArea);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      if (term.length < 2 && searchTerm.length > 0) return [];
      results = results.filter(customer =>
        customer._id?.toLowerCase().includes(term) ||
        customer._name?.toLowerCase().includes(term)
      );
    }
    return results;
  }, [customersWithIds, searchTerm, selectedGroup, selectedSlp, selectedArea]);

  const displayedCustomers = useMemo(() => filteredCustomers.slice(0, displayCount), [filteredCustomers, displayCount]);
  const hasMore = useMemo(() => filteredCustomers.length > displayCount, [filteredCustomers.length, displayCount]);

  useEffect(() => {
    if (isOpen) {
      setDisplayCount(50);
      setSelectedGroup('');
      setSelectedSlp('');
      setSelectedArea('');
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
  const handleAreaChange  = useCallback((e) => { setSelectedArea(e.target.value);  setDisplayCount(50); }, []);
  const clearFilters      = useCallback(() => {
    setSelectedGroup('');
    setSelectedSlp('');
    setSelectedArea('');
    setDisplayCount(50);
  }, []);
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

  /* ─── Filter popup positioning (portal + smart flip) ──────────────── */
  const computeFilterPopupPosition = useCallback(() => {
    if (!filterRef.current) return null;
    const rect = filterRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - POPUP_GAP;
    const spaceAbove = rect.top - POPUP_GAP;

    const modalRect = modalRef.current?.getBoundingClientRect();
    const modalSpaceBelow = modalRect ? modalRect.bottom - rect.bottom - POPUP_GAP : Infinity;

    const openAbove = modalSpaceBelow < POPUP_EST_HEIGHT && spaceAbove > spaceBelow;

    const left = Math.max(8, Math.min(rect.right - POPUP_WIDTH, window.innerWidth - POPUP_WIDTH - 8));
    const top = openAbove
      ? Math.max(8, rect.top - POPUP_GAP - POPUP_EST_HEIGHT)
      : rect.bottom + POPUP_GAP;

    return { top, left };
  }, []);

  const handleFilterToggle = useCallback(() => {
    if (!isFilterOpen) {
      const pos = computeFilterPopupPosition();
      if (pos) setFilterPopupPos(pos);
      setIsFilterOpen(true);
    } else {
      setIsFilterOpen(false);
    }
  }, [isFilterOpen, computeFilterPopupPosition]);

  useEffect(() => {
    if (!isFilterOpen) return;
    const handler = () => {
      const pos = computeFilterPopupPosition();
      if (pos) setFilterPopupPos(pos);
    };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [isFilterOpen, computeFilterPopupPosition]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterRef.current && !filterRef.current.contains(event.target) &&
        filterPopupRef.current && !filterPopupRef.current.contains(event.target)
      ) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

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
                background: isSelected ? `${PALETTE.blue}14` : "transparent",
                borderColor: isSelected ? `${PALETTE.blue}33` : K.hairline,
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = K.chipBg; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              <div className="w-8 flex-shrink-0">
                {isSelected ? (
                  <div className="w-4 h-4 rounded flex items-center justify-center"
                    style={{ background: PALETTE.blue }}>
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
                  style={{ borderColor: `${PALETTE.blue}33`, borderTopColor: PALETTE.blue }} />
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
    <div
      className={`fixed inset-0 flex items-center justify-center z-[9999] p-4 backdrop-blur-2xl ${
        isDark ? 'bg-[rgba(10,10,14,0.65)]' : 'bg-black/40'
      }`}
    >
      {isConfirming && (
        <div className="absolute inset-0 rounded-[28px] z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <Loading theme={theme} />
        </div>
      )}

      <div
        ref={modalRef}
        className="ds-glass ds-pop rounded-[28px] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]"
        style={{ opacity: isConfirming ? 0.75 : 1 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0 border-[var(--ds-hairline)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#0A84FF] to-[#BF5AF2] shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]">
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
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="p-4 border-b flex-shrink-0 border-[var(--ds-hairline)]">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--ds-faint)]" />
              <input
                type="text"
                placeholder="Search by customer code or name…"
                onChange={handleSearchChange}
                defaultValue={searchTerm}
                disabled={isConfirming}
                className="ds-glass w-full pl-10 pr-4 py-2.5 rounded-full text-xs focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] disabled:opacity-50"
                autoFocus
              />
            </div>

            <div className="relative" ref={filterRef}>
              <button
                onClick={handleFilterToggle}
                disabled={isConfirming}
                className={`ds-glass flex items-center gap-2 px-4 py-2.5 rounded-full text-xs transition-all ${
                  isFilterOpen || selectedGroup || selectedSlp || selectedArea
                    ? 'bg-[#0A84FF]/11 border border-[#0A84FF]/33 text-[#0A84FF]'
                    : 'bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] text-[var(--ds-muted)] hover:bg-[var(--ds-hover)]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
                {(selectedGroup || selectedSlp || selectedArea) && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-[#0A84FF]/11 text-[#0A84FF]">
                    {(selectedGroup ? 1 : 0) + (selectedSlp ? 1 : 0) + (selectedArea ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Select All Header */}
        <div className="px-4 py-2 flex items-center justify-between border-b flex-shrink-0 border-[var(--ds-hairline)] bg-[var(--ds-chip-bg)]">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              disabled={isConfirming || filteredCustomers.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              {isSelectAllChecked
                ? <CheckSquare className="w-4 h-4 text-[#0A84FF]" />
                : <Square className="w-4 h-4 text-[var(--ds-faint)]" />}
              <span style={{ color: K.ink }}>
                Select All ({filteredCustomers.length.toLocaleString()})
              </span>
            </button>

            {(selectedGroup || selectedSlp || selectedArea) && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--ds-faint)]">|</span>
                {selectedGroup && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]">
                    Group: {selectedGroup}
                    <button onClick={(e) => { e.stopPropagation(); setSelectedGroup(''); }} className="ml-1 text-[var(--ds-faint)]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedArea && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]">
                    Area: {selectedArea}
                    <button onClick={(e) => { e.stopPropagation(); setSelectedArea(''); }} className="ml-1 text-[var(--ds-faint)]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedSlp && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]">
                    Sales: {selectedSlp}
                    <button onClick={(e) => { e.stopPropagation(); setSelectedSlp(''); }} className="ml-1 text-[var(--ds-faint)]">
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
        <div className="px-4 py-2 flex border-b flex-shrink-0 border-[var(--ds-hairline)] bg-[var(--ds-glass)]">
          <div className="w-8 flex-shrink-0"></div>
          <div className="w-32 text-xs font-semibold text-[var(--ds-muted)]">Customer Code</div>
          <div className="flex-1 text-xs font-semibold text-[var(--ds-muted)]">Customer Name</div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto relative ds-scroll" style={{ maxHeight: '50vh' }}>
          {renderCustomerList()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0 border-[var(--ds-hairline)] bg-[var(--ds-chip-bg)]">
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors border border-[var(--ds-hairline)] text-[var(--ds-muted)] hover:text-[var(--ds-ink)] hover:bg-[var(--ds-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0 || isConfirming}
              className="px-4 py-1.5 text-xs font-medium text-white rounded-full transition-all flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-br from-[#0A84FF] to-[#BF5AF2] shadow-[0_4px_16px_-6px_rgba(10,132,255,0.53)] hover:brightness-110"
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

      {/* ── Filter popup — portaled to document.body to avoid clipping ──── */}
      {isFilterOpen && createPortal(
        <div
          ref={filterPopupRef}
          data-ds-theme={isDark ? 'dark' : 'light'}
          className="ds-page ds-glass ds-pop ds-scroll rounded-2xl p-4"
          style={{
            position: 'fixed',
            top: filterPopupPos.top,
            left: filterPopupPos.left,
            width: POPUP_WIDTH,
            maxHeight: 'calc(100vh - 16px)',
            overflowY: 'auto',
            zIndex: 10000,
            background: K.glassDeep,
            border: `1px solid ${K.rim}`,
            boxShadow: K.shadow,
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: K.ink }}>Filter Customers</h3>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--ds-muted)]">Customer Group</label>
              <select
                value={selectedGroup}
                onChange={handleGroupChange}
                disabled={isConfirming}
                className="ds-glass w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#0A84FF] bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
              >
                <option value="">All Groups</option>
                {uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--ds-muted)]">Area</label>
              <select
                value={selectedArea}
                onChange={handleAreaChange}
                disabled={isConfirming}
                className="ds-glass w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#0A84FF] bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
              >
                <option value="">All Areas</option>
                {uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--ds-muted)]">Sales Person</label>
              <select
                value={selectedSlp}
                onChange={handleSlpChange}
                disabled={isConfirming}
                className="ds-glass w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#0A84FF] bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
              >
                <option value="">All Sales Persons</option>
                {uniqueSlps.map(slp => <option key={slp} value={slp}>{slp}</option>)}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ds-hairline)]">
              <button
                onClick={clearFilters}
                disabled={isConfirming}
                className="px-3 py-1.5 text-xs rounded-full transition-colors text-[var(--ds-muted)] hover:text-[var(--ds-ink)] hover:bg-[var(--ds-chip-bg)]"
              >
                Clear All
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-1.5 text-xs rounded-full text-white font-medium bg-gradient-to-br from-[#0A84FF] to-[#BF5AF2] shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)] hover:brightness-110 transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(CustomerSelectionModal);