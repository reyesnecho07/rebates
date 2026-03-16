import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Search, CheckSquare, Square, Check, Package, Filter } from 'lucide-react';
import Loading from "../../components/common/Loading";

const ItemSelectionModal = ({ 
  isOpen, 
  onClose, 
  items = [], 
  selectedItems = [], 
  onConfirm,
  theme 
}) => {
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
  
  // New filter state for Item Group
  const [selectedItemGroup, setSelectedItemGroup] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Cache item IDs and names for faster access
  const itemMap = useMemo(() => {
    const map = new Map();
    items.forEach(item => {
      const id = item.ItemCode || item.code || item.value;
      const name = item.ItemName || item.name || item.label;
      const itemGroup = item.ItmsGrpNam || item.itemGroup || item.groupName || '';
      if (id) {
        map.set(id, { 
          ...item, 
          _id: id, 
          _name: name,
          _itemGroup: itemGroup
        });
      }
    });
    return map;
  }, [items]);

  // Memoize item array with cached IDs
  const itemsWithIds = useMemo(() => {
    return Array.from(itemMap.values());
  }, [itemMap]);

  // Get unique item groups for filter dropdown
  const uniqueItemGroups = useMemo(() => {
    const groups = new Set();
    itemsWithIds.forEach(item => {
      if (item._itemGroup) groups.add(item._itemGroup);
    });
    return Array.from(groups).sort();
  }, [itemsWithIds]);

  // Filtered items - optimized with item group filter
  const filteredItems = useMemo(() => {
    let results = itemsWithIds;
    
    // Apply item group filter
    if (selectedItemGroup) {
      results = results.filter(item => 
        item._itemGroup === selectedItemGroup
      );
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      
      if (term.length < 2 && searchTerm.length > 0) {
        return [];
      }
      
      results = results.filter(item => 
        item._id?.toLowerCase().includes(term) ||
        item._name?.toLowerCase().includes(term)
      );
    }
    
    return results;
  }, [itemsWithIds, searchTerm, selectedItemGroup]);

  // Get displayed items for virtualization
  const displayedItems = useMemo(() => {
    return filteredItems.slice(0, displayCount);
  }, [filteredItems, displayCount]);

  // Check if there are more items to load
  const hasMore = useMemo(() => {
    return filteredItems.length > displayCount;
  }, [filteredItems.length, displayCount]);

  // Initialize selected items when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset display count
      setDisplayCount(50);
      
      // Reset filter
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

  // Click outside handler for filter dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  // Update select all state - CHECK AGAINST ALL FILTERED ITEMS, NOT JUST DISPLAYED
  useEffect(() => {
    if (filteredItems.length === 0) {
      setIsSelectAllChecked(false);
      return;
    }

    // Only check first 100 for performance
    let allSelected = true;
    let checkedCount = 0;
    const maxCheck = Math.min(filteredItems.length, 100);
    
    for (let i = 0; i < maxCheck; i++) {
      const item = filteredItems[i];
      if (!selectedIds.has(item._id)) {
        allSelected = false;
        break;
      }
      checkedCount++;
    }
    
    // If we checked all and all were selected, assume all are selected
    if (allSelected && filteredItems.length > maxCheck) {
      setIsSelectAllChecked(true);
    } else {
      setIsSelectAllChecked(allSelected && filteredItems.length > 0);
    }
  }, [selectedIds, filteredItems]);

  // Debounced search handler
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(value);
      setDisplayCount(50); // Reset display count on new search
    }, 300);
  }, []);

  // Filter change handler for item group
  const handleItemGroupChange = useCallback((e) => {
    setSelectedItemGroup(e.target.value);
    setDisplayCount(50); // Reset display count on filter change
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedItemGroup('');
    setDisplayCount(50);
  }, []);

  const applyFilters = useCallback(() => {
    setIsFilterOpen(false);
  }, []);

  // Infinite scroll implementation
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    requestAnimationFrame(() => {
      setDisplayCount(prev => Math.min(prev + 50, filteredItems.length));
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, hasMore, filteredItems.length]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!isOpen) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    
    if (loadingTriggerRef.current) {
      observerRef.current.observe(loadingTriggerRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isOpen, hasMore, isLoadingMore, loadMore]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Toggle all - TOGGLES ALL FILTERED ITEMS, NOT JUST DISPLAYED
  const toggleSelectAll = useCallback(() => {
    requestAnimationFrame(() => {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        
        if (!isSelectAllChecked) {
          // Add ALL filtered items
          for (const item of filteredItems) {
            newSet.add(item._id);
          }
        } else {
          // Remove ALL filtered items
          for (const item of filteredItems) {
            newSet.delete(item._id);
          }
        }
        
        return newSet;
      });
    });
  }, [filteredItems, isSelectAllChecked]);

  // Toggle single item
  const toggleItem = useCallback((itemId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Selected count memo
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  // Handle confirm
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
      
      setTimeout(() => {
        setIsConfirming(false);
        onClose();
      }, 100);
    }, 0);
  }, [itemMap, selectedIds, selectedCount, onConfirm, onClose]);

  // Render item list with infinite scroll
  const renderItemList = () => {
    if (filteredItems.length === 0) {
      return (
        <div className={`text-center py-8 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-medium">No items found</p>
          <p className="text-xs mt-1">Try adjusting your search term or filters</p>
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
              className={`flex items-center px-4 py-2 border-b cursor-pointer transition-all ${
                isSelected
                  ? theme === 'dark'
                    ? 'bg-purple-900/30 border-purple-700'
                    : 'bg-purple-50 border-purple-200'
                  : theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="w-8 flex-shrink-0">
                {isSelected ? (
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${
                    theme === 'dark' ? 'bg-purple-500' : 'bg-purple-500'
                  }`}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <div className={`w-4 h-4 rounded border ${
                    theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                  }`} />
                )}
              </div>
              <div className={`w-32 text-xs truncate ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {item._id}
              </div>
              <div className={`flex-1 text-xs truncate ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}>
                {item._name}
              </div>
            </div>
          );
        })}
        
        {/* Infinite scroll trigger */}
        {hasMore && (
          <div
            ref={loadingTriggerRef}
            className="py-4 flex justify-center"
          >
            {isLoadingMore ? (
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 border-2 rounded-full animate-spin ${
                  theme === 'dark' 
                    ? 'border-gray-600 border-t-gray-300' 
                    : 'border-gray-300 border-t-gray-600'
                }`}></div>
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Loading more...
                </span>
              </div>
            ) : (
              <span className={`text-xs ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                Scroll for more
              </span>
            )}
          </div>
        )}
        
        <div className={`text-center py-2 text-xs ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        }`}>
          Showing {displayedItems.length.toLocaleString()} of {filteredItems.length.toLocaleString()} results
        </div>
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      {/* Global loading overlay */}
      {isConfirming && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-2xl z-50 flex items-center justify-center">
          <Loading theme={theme} />
        </div>
      )}

      <div className={`bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      } ${isConfirming ? 'opacity-75' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
              }`}>
                Select Items
              </h2>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Search and select items to add to your rebate program
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isConfirming}
            className={`p-1.5 rounded-lg transition-all ${
              isConfirming 
                ? 'opacity-50 cursor-not-allowed'
                : theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            {/* Search Input - Takes full width */}
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Search by item code or name..."
                onChange={handleSearchChange}
                defaultValue={searchTerm}
                disabled={isConfirming}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500 disabled:opacity-50'
                    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 disabled:opacity-50'
                }`}
                autoFocus
              />
            </div>
            
            {/* Filter Button - Positioned on the right */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                disabled={isConfirming}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-xs transition-all ${
                  isFilterOpen || selectedItemGroup
                    ? theme === 'dark'
                      ? 'bg-purple-900/30 border-purple-700 text-purple-400'
                      : 'bg-purple-50 border-purple-300 text-purple-700'
                    : theme === 'dark'
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
                {selectedItemGroup && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    theme === 'dark'
                      ? 'bg-purple-900 text-purple-300'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    1
                  </span>
                )}
              </button>
              
              {/* Filter Dropdown - Positioned to the right */}
              {isFilterOpen && (
                <div className={`absolute right-0 top-full mt-1 w-80 p-4 rounded-lg shadow-xl border z-10 ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="space-y-4">
                    {/* Header with close button */}
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm font-semibold ${
                        theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        Filter Items
                      </h3>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className={`p-1 rounded-lg ${
                          theme === 'dark'
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Item Group Filter */}
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Item Group
                      </label>
                      <select
                        value={selectedItemGroup}
                        onChange={handleItemGroupChange}
                        disabled={isConfirming}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200 disabled:opacity-50'
                            : 'bg-white border-gray-300 text-gray-800 disabled:opacity-50'
                        }`}
                      >
                        <option value="">All Item Groups</option>
                        {uniqueItemGroups.map(group => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Filter Actions */}
                    <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
                      <button
                        onClick={clearFilters}
                        disabled={isConfirming}
                        className={`px-3 py-1 text-xs rounded-lg transition-all ${
                          theme === 'dark'
                            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        Clear
                      </button>
                      <button
                        onClick={applyFilters}
                        className={`px-4 py-1 text-xs rounded-lg ${
                          theme === 'dark'
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Select All Header - SHOWS TOTAL FILTERED COUNT */}
        <div className={`px-4 py-2 flex items-center justify-between border-b ${
          theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              disabled={isConfirming || filteredItems.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              {isSelectAllChecked ? (
                <CheckSquare className={`w-4 h-4 ${
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`} />
              ) : (
                <Square className={`w-4 h-4 ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`} />
              )}
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Select All ({filteredItems.length.toLocaleString()})
              </span>
            </button>
            
            {/* Active Filter Display */}
            {selectedItemGroup && (
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>|</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  Group: {selectedItemGroup}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItemGroup('');
                    }}
                    className="ml-1 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            )}
          </div>
          <div className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {selectedCount.toLocaleString()} selected
          </div>
        </div>

        {/* Table Header */}
        <div className={`px-4 py-2 flex border-b ${
          theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'
        }`}>
          <div className="w-8 flex-shrink-0"></div>
          <div className={`w-32 text-xs font-semibold ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>Item Code</div>
          <div className={`flex-1 text-xs font-semibold ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>Item Name</div>
        </div>

        {/* Item List with Infinite Scroll */}
        <div 
          className="flex-1 overflow-y-auto relative" 
          style={{ maxHeight: '50vh' }}
        >
          {renderItemList()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl">
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className={`px-4 py-1.5 border rounded-lg text-xs font-medium transition-all ${
                theme === 'dark'
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:hover:bg-transparent'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0 || isConfirming}
              className={`px-4 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center ${
                selectedCount === 0 || isConfirming ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <span>Add {selectedCount > 0 ? `${selectedCount.toLocaleString()} item${selectedCount > 1 ? 's' : ''}` : 'Items'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ItemSelectionModal);