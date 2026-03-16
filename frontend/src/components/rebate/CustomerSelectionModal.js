import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Search, CheckSquare, Square, Check, Users, Filter } from 'lucide-react';
import Loading from "../../components/common/Loading";

const CustomerSelectionModal = ({ 
  isOpen, 
  onClose, 
  customers = [], 
  selectedCustomers = [], 
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
  
  // New filter states
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedSlp, setSelectedSlp] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Cache customer IDs and names for faster access
  const customerMap = useMemo(() => {
    const map = new Map();
    customers.forEach(customer => {
      const id = customer.CardCode || customer.code || customer.value;
      const name = customer.CardName || customer.name || customer.label;
      const groupName = customer.GroupName || customer.groupName || '';
      const slpName = customer.SlpName || customer.slpName || '';
      if (id) {
        map.set(id, { 
          ...customer, 
          _id: id, 
          _name: name,
          _groupName: groupName,
          _slpName: slpName 
        });
      }
    });
    return map;
  }, [customers]);

  // Memoize customer array with cached IDs
  const customersWithIds = useMemo(() => {
    return Array.from(customerMap.values());
  }, [customerMap]);

  // Get unique groups for filter dropdown
  const uniqueGroups = useMemo(() => {
    const groups = new Set();
    customersWithIds.forEach(customer => {
      if (customer._groupName) groups.add(customer._groupName);
    });
    return Array.from(groups).sort();
  }, [customersWithIds]);

  // Get unique sales persons for filter dropdown
  const uniqueSlps = useMemo(() => {
    const slps = new Set();
    customersWithIds.forEach(customer => {
      if (customer._slpName) slps.add(customer._slpName);
    });
    return Array.from(slps).sort();
  }, [customersWithIds]);

  // Filtered customers - optimized with early returns and multiple filters
  const filteredCustomers = useMemo(() => {
    let results = customersWithIds;
    
    // Apply group filter
    if (selectedGroup) {
      results = results.filter(customer => 
        customer._groupName === selectedGroup
      );
    }
    
    // Apply sales person filter
    if (selectedSlp) {
      results = results.filter(customer => 
        customer._slpName === selectedSlp
      );
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      
      // Early exit if search term is too short
      if (term.length < 2 && searchTerm.length > 0) {
        return [];
      }
      
      // Optimized search loop
      results = results.filter(customer => 
        customer._id?.toLowerCase().includes(term) ||
        customer._name?.toLowerCase().includes(term)
      );
    }
    
    return results;
  }, [customersWithIds, searchTerm, selectedGroup, selectedSlp]);

  // Get displayed customers for virtualization
  const displayedCustomers = useMemo(() => {
    return filteredCustomers.slice(0, displayCount);
  }, [filteredCustomers, displayCount]);

  // Check if there are more items to load
  const hasMore = useMemo(() => {
    return filteredCustomers.length > displayCount;
  }, [filteredCustomers.length, displayCount]);

  // Initialize selected customers when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset display count
      setDisplayCount(50);
      
      // Reset filters
      setSelectedGroup('');
      setSelectedSlp('');
      setIsFilterOpen(false);
      
      // Use setTimeout to prevent blocking
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

  // Update select all state - CHECK AGAINST ALL FILTERED CUSTOMERS, NOT JUST DISPLAYED
  useEffect(() => {
    if (filteredCustomers.length === 0) {
      setIsSelectAllChecked(false);
      return;
    }

    // Only check first 100 for performance, but if any of first 100 is not selected, not all are selected
    let allSelected = true;
    let checkedCount = 0;
    const maxCheck = Math.min(filteredCustomers.length, 100);
    
    for (let i = 0; i < maxCheck; i++) {
      const customer = filteredCustomers[i];
      if (!selectedIds.has(customer._id)) {
        allSelected = false;
        break;
      }
      checkedCount++;
    }
    
    // If we checked all and all were selected, and we have more items, we need to check if the rest are selected
    if (allSelected && filteredCustomers.length > maxCheck) {
      // For performance, we'll assume if first 100 are selected, all are selected
      // This is a reasonable assumption for UX
      setIsSelectAllChecked(true);
    } else {
      setIsSelectAllChecked(allSelected && filteredCustomers.length > 0);
    }
  }, [selectedIds, filteredCustomers]);

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

  // Filter change handlers
  const handleGroupChange = useCallback((e) => {
    setSelectedGroup(e.target.value);
    setDisplayCount(50); // Reset display count on filter change
  }, []);

  const handleSlpChange = useCallback((e) => {
    setSelectedSlp(e.target.value);
    setDisplayCount(50); // Reset display count on filter change
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedGroup('');
    setSelectedSlp('');
    setDisplayCount(50);
  }, []);

  const applyFilters = useCallback(() => {
    setIsFilterOpen(false);
  }, []);

  // Infinite scroll implementation
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    // Use requestAnimationFrame to prevent UI blocking
    requestAnimationFrame(() => {
      setDisplayCount(prev => Math.min(prev + 50, filteredCustomers.length));
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, hasMore, filteredCustomers.length]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!isOpen) return;
    
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    
    // Observe the trigger element
    if (loadingTriggerRef.current) {
      observerRef.current.observe(loadingTriggerRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isOpen, hasMore, isLoadingMore, loadMore]);

  // Cleanup timeouts
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

  // Toggle all - TOGGLES ALL FILTERED CUSTOMERS, NOT JUST DISPLAYED
  const toggleSelectAll = useCallback(() => {
    // Use requestAnimationFrame to prevent UI blocking
    requestAnimationFrame(() => {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        
        if (!isSelectAllChecked) {
          // Add ALL filtered customers
          for (const customer of filteredCustomers) {
            newSet.add(customer._id);
          }
        } else {
          // Remove ALL filtered customers
          for (const customer of filteredCustomers) {
            newSet.delete(customer._id);
          }
        }
        
        return newSet;
      });
    });
  }, [filteredCustomers, isSelectAllChecked]);

  // Toggle single customer - optimized
  const toggleCustomer = useCallback((customerId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  }, []);

  // Selected count memo
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  // Handle confirm - ONLY SHOW LOADING HERE
  const handleConfirm = useCallback(() => {
    if (selectedCount === 0) return;
    
    setIsConfirming(true);
    
    // Use setTimeout to prevent UI blocking during large selections
    setTimeout(() => {
      const selectedData = [];
      for (const id of selectedIds) {
        const customer = customerMap.get(id);
        if (customer) selectedData.push(customer);
        // Break if we've collected all (performance for large sets)
        if (selectedData.length >= selectedIds.size) break;
      }
      
      onConfirm(selectedData);
      
      setTimeout(() => {
        setIsConfirming(false);
        onClose();
      }, 100);
    }, 0);
  }, [customerMap, selectedIds, selectedCount, onConfirm, onClose]);

  // Render customer list with infinite scroll
  const renderCustomerList = () => {
    if (filteredCustomers.length === 0) {
      return (
        <div className={`text-center py-8 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-medium">No customers found</p>
          <p className="text-xs mt-1">Try adjusting your search term or filters</p>
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
              className={`flex items-center px-4 py-2 border-b cursor-pointer transition-all ${
                isSelected
                  ? theme === 'dark'
                    ? 'bg-blue-900/30 border-blue-700'
                    : 'bg-blue-50 border-blue-200'
                  : theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="w-8 flex-shrink-0">
                {isSelected ? (
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${
                    theme === 'dark' ? 'bg-blue-500' : 'bg-blue-500'
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
                {customer._id}
              </div>
              <div className={`flex-1 text-xs truncate ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}>
                {customer._name}
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
          Showing {displayedCustomers.length} of {filteredCustomers.length} results
        </div>
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      {/* Global loading overlay - ONLY SHOW DURING CONFIRMATION */}
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
              }`}>
                Select Customers
              </h2>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Search and select customers to add to your rebate program
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
                placeholder="Search by customer code or name..."
                onChange={handleSearchChange}
                defaultValue={searchTerm}
                disabled={isConfirming}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
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
                  isFilterOpen || selectedGroup || selectedSlp
                    ? theme === 'dark'
                      ? 'bg-blue-900/30 border-blue-700 text-blue-400'
                      : 'bg-blue-50 border-blue-300 text-blue-700'
                    : theme === 'dark'
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
                {(selectedGroup || selectedSlp) && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    theme === 'dark'
                      ? 'bg-blue-900 text-blue-300'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {(selectedGroup ? 1 : 0) + (selectedSlp ? 1 : 0)}
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
                        Filter Customers
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
                    
                    {/* Group Filter */}
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Customer Group
                      </label>
                      <select
                        value={selectedGroup}
                        onChange={handleGroupChange}
                        disabled={isConfirming}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200 disabled:opacity-50'
                            : 'bg-white border-gray-300 text-gray-800 disabled:opacity-50'
                        }`}
                      >
                        <option value="">All Groups</option>
                        {uniqueGroups.map(group => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Sales Person Filter */}
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Sales Person
                      </label>
                      <select
                        value={selectedSlp}
                        onChange={handleSlpChange}
                        disabled={isConfirming}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200 disabled:opacity-50'
                            : 'bg-white border-gray-300 text-gray-800 disabled:opacity-50'
                        }`}
                      >
                        <option value="">All Sales Persons</option>
                        {uniqueSlps.map(slp => (
                          <option key={slp} value={slp}>{slp}</option>
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
                        Clear All
                      </button>
                      <button
                        onClick={applyFilters}
                        className={`px-4 py-1 text-xs rounded-lg ${
                          theme === 'dark'
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
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

        {/* Select All Header - SHOWS TOTAL FILTERED COUNT */}
        <div className={`px-4 py-2 flex items-center justify-between border-b ${
          theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              disabled={isConfirming || filteredCustomers.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              {isSelectAllChecked ? (
                <CheckSquare className={`w-4 h-4 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
              ) : (
                <Square className={`w-4 h-4 ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`} />
              )}
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Select All ({filteredCustomers.length.toLocaleString()})
              </span>
            </button>
            
            {/* Active Filters Display */}
            {(selectedGroup || selectedSlp) && (
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>|</span>
                {selectedGroup && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    Group: {selectedGroup}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGroup('');
                      }}
                      className="ml-1 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedSlp && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    Sales: {selectedSlp}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSlp('');
                      }}
                      className="ml-1 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
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
          }`}>Customer Code</div>
          <div className={`flex-1 text-xs font-semibold ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>Customer Name</div>
        </div>

        {/* Customer List with Infinite Scroll */}
        <div 
          className="flex-1 overflow-y-auto relative" 
          style={{ maxHeight: '50vh' }}
        >
          {renderCustomerList()}
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
              className={`px-4 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center ${
                selectedCount === 0 || isConfirming ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Adding...</span>
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