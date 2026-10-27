// src/components/rebate/ItemSelectionModal.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, CheckSquare, Square, Check, Package, Filter } from 'lucide-react';
import Loading from "../../components/common/Loading";

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens } from '../../design-system';

const POPUP_WIDTH = 320;
const POPUP_EST_HEIGHT = 300;
const POPUP_GAP = 6;

const ItemSelectionModal = ({
  isOpen,
  onClose,
  items = [],
  selectedItems = [],
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

  const [selectedItemGroup, setSelectedItemGroup] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const itemMap = useMemo(() => {
    const map = new Map();
    items.forEach(item => {
      const id = item.ItemCode || item.code || item.value;
      const name = item.ItemName || item.name || item.label;
      const groupName = item.ItmsGrpNam || item.ItmsGrpName || item.itemGroup || item.groupName;
      const itemGroup = (groupName && groupName.trim() !== '')
        ? groupName
        : (item.ItmsGrpCod != null ? `Group ${item.ItmsGrpCod}` : '');

      if (id) {
        map.set(id, { ...item, _id: id, _name: name, _itemGroup: itemGroup });
      }
    });
    return map;
  }, [items]);

  const itemsWithIds = useMemo(() => Array.from(itemMap.values()), [itemMap]);

  const uniqueItemGroups = useMemo(() => {
    const groups = new Set();
    itemsWithIds.forEach(item => { if (item._itemGroup) groups.add(item._itemGroup); });
    return Array.from(groups).sort();
  }, [itemsWithIds]);

  const filteredItems = useMemo(() => {
    let results = itemsWithIds;
    if (selectedItemGroup) results = results.filter(item => item._itemGroup === selectedItemGroup);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      if (term.length < 2 && searchTerm.length > 0) return [];
      results = results.filter(item =>
        item._id?.toLowerCase().includes(term) ||
        item._name?.toLowerCase().includes(term)
      );
    }
    return results;
  }, [itemsWithIds, searchTerm, selectedItemGroup]);

  const displayedItems = useMemo(() => filteredItems.slice(0, displayCount), [filteredItems, displayCount]);
  const hasMore = useMemo(() => filteredItems.length > displayCount, [filteredItems.length, displayCount]);

  useEffect(() => {
    if (isOpen) {
      setDisplayCount(50);
      setSelectedItemGroup('');
      setIsFilterOpen(false);
      setTimeout(() => {
        const initialSelected = new Set();
        for (const item of selectedItems) {
          const id = item.ItemCode || item.code || item.value;
          if (id) initialSelected.add(id);
        }
        setSelectedIds(initialSelected);
        setSearchTerm('');
        setIsSelectAllChecked(false);
      }, 0);
    }
  }, [isOpen, selectedItems]);

  useEffect(() => {
    if (filteredItems.length === 0) { setIsSelectAllChecked(false); return; }
    let allSelected = true;
    const maxCheck = Math.min(filteredItems.length, 100);
    for (let i = 0; i < maxCheck; i++) {
      const item = filteredItems[i];
      if (!selectedIds.has(item._id)) { allSelected = false; break; }
    }
    if (allSelected && filteredItems.length > maxCheck) setIsSelectAllChecked(true);
    else setIsSelectAllChecked(allSelected && filteredItems.length > 0);
  }, [selectedIds, filteredItems]);

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(value);
      setDisplayCount(50);
    }, 300);
  }, []);

  const handleItemGroupChange = useCallback((e) => { setSelectedItemGroup(e.target.value); setDisplayCount(50); }, []);
  const clearFilters         = useCallback(() => { setSelectedItemGroup(''); setDisplayCount(50); }, []);
  const applyFilters         = useCallback(() => { setIsFilterOpen(false); }, []);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    requestAnimationFrame(() => {
      setDisplayCount(prev => Math.min(prev + 50, filteredItems.length));
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, hasMore, filteredItems.length]);

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
          for (const item of filteredItems) newSet.add(item._id);
        } else {
          for (const item of filteredItems) newSet.delete(item._id);
        }
        return newSet;
      });
    });
  }, [filteredItems, isSelectAllChecked]);

  const toggleItem = useCallback((itemId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
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
        const item = itemMap.get(id);
        if (item) selectedData.push(item);
        if (selectedData.length >= selectedIds.size) break;
      }
      onConfirm(selectedData);
      setTimeout(() => { setIsConfirming(false); onClose(); }, 100);
    }, 0);
  }, [itemMap, selectedIds, selectedCount, onConfirm, onClose]);

  const renderItemList = () => {
    if (filteredItems.length === 0) {
      return (
        <div className="text-center py-8" style={{ color: K.muted }}>
          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-medium">No items found</p>
          <p className="text-xs mt-1" style={{ color: K.faint }}>Try adjusting your search term or filters</p>
        </div>
      );
    }
    return (
      <>
        {displayedItems.map((item) => {
          const isSelected = selectedIds.has(item._id);
          return (
            <div
              key={item._id}
              onClick={() => toggleItem(item._id)}
              className="flex items-center px-4 py-2 border-b cursor-pointer transition-all"
              style={{
                background: isSelected ? `${PALETTE.purple}14` : "transparent",
                borderColor: isSelected ? `${PALETTE.purple}33` : K.hairline,
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = K.chipBg; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              <div className="w-8 flex-shrink-0">
                {isSelected ? (
                  <div className="w-4 h-4 rounded flex items-center justify-center"
                    style={{ background: PALETTE.purple }}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded border" style={{ borderColor: K.hairline }} />
                )}
              </div>
              <div className="w-32 text-xs truncate font-mono" style={{ color: K.muted }}>
                {item._id}
              </div>
              <div className="flex-1 text-xs truncate" style={{ color: K.ink }}>
                {item._name}
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div ref={loadingTriggerRef} className="py-4 flex justify-center">
            {isLoadingMore ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: `${PALETTE.purple}33`, borderTopColor: PALETTE.purple }} />
                <span className="text-xs" style={{ color: K.muted }}>Loading more…</span>
              </div>
            ) : (
              <span className="text-xs" style={{ color: K.faint }}>Scroll for more</span>
            )}
          </div>
        )}

        <div className="text-center py-2 text-xs" style={{ color: K.faint }}>
          Showing {displayedItems.length.toLocaleString()} of {filteredItems.length.toLocaleString()} results
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
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#BF5AF2] to-[#8B3FD1] shadow-[0_4px_12px_-4px_rgba(191,90,242,0.53)]">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: K.ink }}>Select Items</h2>
              <p className="text-xs" style={{ color: K.muted }}>Search and select items to add to your rebate program</p>
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
                placeholder="Search by item code or name…"
                onChange={handleSearchChange}
                defaultValue={searchTerm}
                disabled={isConfirming}
                className="ds-glass w-full pl-10 pr-4 py-2.5 rounded-full text-xs focus:outline-none focus:border-[#BF5AF2] focus:shadow-[0_0_0_3px_rgba(191,90,242,0.15)] transition-all bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] disabled:opacity-50"
                autoFocus
              />
            </div>

            <div className="relative" ref={filterRef}>
              <button
                onClick={handleFilterToggle}
                disabled={isConfirming}
                className={`ds-glass flex items-center gap-2 px-4 py-2.5 rounded-full text-xs transition-all ${
                  isFilterOpen || selectedItemGroup
                    ? 'bg-[#BF5AF2]/11 border border-[#BF5AF2]/33 text-[#BF5AF2]'
                    : 'bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] text-[var(--ds-muted)] hover:bg-[var(--ds-hover)]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
                {selectedItemGroup && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-[#BF5AF2]/11 text-[#BF5AF2]">
                    1
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
              disabled={isConfirming || filteredItems.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              {isSelectAllChecked
                ? <CheckSquare className="w-4 h-4 text-[#BF5AF2]" />
                : <Square className="w-4 h-4 text-[var(--ds-faint)]" />}
              <span style={{ color: K.ink }}>
                Select All ({filteredItems.length.toLocaleString()})
              </span>
            </button>

            {selectedItemGroup && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--ds-faint)]">|</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]">
                  Group: {selectedItemGroup}
                  <button onClick={(e) => { e.stopPropagation(); setSelectedItemGroup(''); }} className="ml-1 text-[var(--ds-faint)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
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
          <div className="w-32 text-xs font-semibold text-[var(--ds-muted)]">Item Code</div>
          <div className="flex-1 text-xs font-semibold text-[var(--ds-muted)]">Item Name</div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto relative ds-scroll" style={{ maxHeight: '50vh' }}>
          {renderItemList()}
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
              className="px-4 py-1.5 text-xs font-medium text-white rounded-full transition-all flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-br from-[#BF5AF2] to-[#8B3FD1] shadow-[0_4px_16px_-6px_rgba(191,90,242,0.53)] hover:brightness-110"
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Adding…</span>
                </>
              ) : (
                <span>Add {selectedCount > 0 ? `${selectedCount.toLocaleString()} item${selectedCount > 1 ? 's' : ''}` : 'Items'}</span>
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
              <h3 className="text-sm font-semibold" style={{ color: K.ink }}>Filter Items</h3>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--ds-muted)]">Item Group</label>
              <select
                value={selectedItemGroup}
                onChange={handleItemGroupChange}
                disabled={isConfirming}
                className="ds-glass w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#BF5AF2] bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
              >
                <option value="">All Item Groups</option>
                {uniqueItemGroups.map(group => <option key={group} value={group}>{group}</option>)}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ds-hairline)]">
              <button
                onClick={clearFilters}
                disabled={isConfirming}
                className="px-3 py-1.5 text-xs rounded-full transition-colors text-[var(--ds-muted)] hover:text-[var(--ds-ink)] hover:bg-[var(--ds-chip-bg)]"
              >
                Clear
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-1.5 text-xs rounded-full text-white font-medium bg-gradient-to-br from-[#BF5AF2] to-[#8B3FD1] shadow-[0_4px_12px_-4px_rgba(191,90,242,0.53)] hover:brightness-110 transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(ItemSelectionModal);