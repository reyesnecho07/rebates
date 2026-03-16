import React, { useState, useRef, useEffect } from "react";
import {
  LayoutList,
  Search,
  Filter,
  X,
  FileText,
  Tag,
  Activity,
  Percent,
  ChevronDown,
  HandCoins
} from "lucide-react";

const RebateProgramList = ({ 
  rebates = [],
  filteredRebates = [],
  rebateSearchTerm = "",
  setRebateSearchTerm = () => {},
  selectedRebateTypeFilter = "All",
  setSelectedRebateTypeFilter = () => {},
  selectedRebateStatusFilter = "All",
  setSelectedRebateStatusFilter = () => {},
  rebateDateFrom = "",
  setRebateDateFrom = () => {},
  rebateDateTo = "",
  setRebateDateTo = () => {},
  currentPage = 1,
  setCurrentPage = () => {},
  itemsPerPage = 10,
  theme = "light",
  // Callback functions
  onRebateClick = () => {},
  onStatusToggle = () => {},
  onClearFilters = () => {},
  onApplyFilters = () => {},
  onLoadRebates = () => {}
}) => {
  const [showRebateFilters, setShowRebateFilters] = useState(false);
  const rebateFilterRef = useRef(null);
  const rebateFilterButtonRef = useRef(null);
  
  // Clear individual filters
  const clearTypeFilter = () => setSelectedRebateTypeFilter("All");
  const clearStatusFilter = () => setSelectedRebateStatusFilter("All");
  const clearDateFromFilter = () => setRebateDateFrom("");
  const clearDateToFilter = () => setRebateDateTo("");
  
  // Check if any filters are active
  const hasActiveFilters = 
    selectedRebateTypeFilter !== "All" || 
    selectedRebateStatusFilter !== "All" || 
    rebateDateFrom || 
    rebateDateTo;

// In the frontend component, replace this part:
// Sort filtered rebates by date (newest first) - MODIFIED THIS PART
const sortedRebates = [...filteredRebates].sort((a, b) => {
  return new Date(b.createdDate) - new Date(a.createdDate);
});

  // Calculate pagination using sorted rebates
  const totalPages = Math.ceil(sortedRebates.length / itemsPerPage);
  const paginatedRebates = sortedRebates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Theme-based styling
  const isDark = theme === 'dark';
  
  const containerClasses = `rounded-lg border shadow-sm mb-4 ${
    isDark 
      ? 'bg-gray-800 border-gray-700' 
      : 'bg-white border-gray-200'
  }`;
  
  const headerClasses = `flex justify-between items-center p-3 border-b ${
    isDark 
      ? 'border-gray-700' 
      : 'border-gray-100'
  }`;
  
  const searchInputClasses = `pl-7 pr-2.5 py-1.5 border rounded text-xs w-56 outline-none transition-all duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 font-medium ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:ring-blue-900'
      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
  }`;
  
  const filterButtonClasses = `px-2.5 py-1.5 rounded border transition-all duration-150 flex items-center gap-1.5 font-medium text-xs ${
    showRebateFilters 
      ? 'bg-blue-50 border-blue-300 text-blue-700' 
      : isDark
        ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
  }`;
  
  const filterPopupClasses = `absolute top-full right-0 mt-1 w-64 rounded border shadow-lg z-50 p-3 animate-in slide-in-from-top-5 duration-150 ${
    isDark
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-200'
  }`;
  
  const filterSelectClasses = `w-full px-2.5 py-1.5 border rounded text-xs outline-none transition-all duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 font-medium ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-blue-900'
      : 'bg-white border-gray-300'
  }`;
  
  const filterInputClasses = `w-full px-2 py-1 border rounded text-xs outline-none transition-all duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-blue-900'
      : 'bg-white border-gray-300'
  }`;
  
  const tableHeaderClasses = `grid grid-cols-5 px-3 py-2 items-center text-xs font-semibold border-b ${
    isDark
      ? 'bg-gray-900 border-gray-700 text-gray-300'
      : 'bg-gray-50 border-gray-200 text-gray-700'
  }`;
  
  const tableRowClasses = `grid grid-cols-5 px-3 py-2 items-center text-xs transition-colors duration-100 ${
    isDark
      ? 'hover:bg-gray-700/50 border-gray-700'
      : 'hover:bg-gray-50 border-gray-100'
  }`;
  
  const textPrimaryClasses = isDark ? 'text-gray-100' : 'text-gray-900';
  const textSecondaryClasses = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMutedClasses = isDark ? 'text-gray-500' : 'text-gray-500';


  useEffect(() => {
    const handleClickOutside = (event) => {
      // If dropdown is open AND click is outside both dropdown and button
      if (
        showRebateFilters && 
        rebateFilterRef.current && 
        !rebateFilterRef.current.contains(event.target) &&
        rebateFilterButtonRef.current &&
        !rebateFilterButtonRef.current.contains(event.target)
      ) {
        setShowRebateFilters(false);
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRebateFilters]);

  return (
    <div className={containerClasses}>
      <div className={headerClasses}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
            <LayoutList size={14} className="text-white" />
          </div>
          <div>
            <h2 className={`text-sm font-semibold ${textPrimaryClasses}`}>Rebate Programs</h2>
            <p className={`text-xs ${textSecondaryClasses}`}>Manage all rebate programs</p>
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search 
              size={12} 
              className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} 
            />
            <input 
              type="text" 
              placeholder="Search rebates..." 
              value={rebateSearchTerm} 
              onChange={(e) => setRebateSearchTerm(e.target.value)} 
              className={searchInputClasses}
            />
          </div>

          <div className="relative">
            <button
              ref={rebateFilterButtonRef}
              onClick={() => setShowRebateFilters(!showRebateFilters)}
              className={filterButtonClasses}
            >
              <Filter size={12} />
              Filters
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              )}
            </button>
              {showRebateFilters && (
                <div 
                  ref={rebateFilterRef}
                  className={`${filterPopupClasses} z-50`}
                >
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-xs font-semibold ${textPrimaryClasses}`}>Filter Rebates</h3>
                  <button
                    onClick={() => setShowRebateFilters(false)}
                    className={`p-0.5 rounded transition-colors ${
                      isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    <X size={14} className={textSecondaryClasses} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>
                      Rebate Type
                    </label>
                    <select 
                      value={selectedRebateTypeFilter} 
                      onChange={(e) => setSelectedRebateTypeFilter(e.target.value)} 
                      className={filterSelectClasses}
                    >
                      <option value="All">All Types</option>
                      <option value="Fixed">Fixed</option>
                      <option value="Incremental">Incremental</option>
                      <option value="Percentage">Percentage</option>
                    </select>
                  </div>

                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>
                      Status
                    </label>
                    <select 
                      value={selectedRebateStatusFilter} 
                      onChange={(e) => setSelectedRebateStatusFilter(e.target.value)} 
                      className={filterSelectClasses}
                    >
                      <option value="All">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>
                      Date Range
                    </label>
                    <div className="space-y-1.5">
                      <div>
                        <label className={`text-xs ${textSecondaryClasses} mb-1 block`}>From</label>
                        <input 
                          type="date"
                          value={rebateDateFrom}
                          onChange={(e) => setRebateDateFrom(e.target.value)}
                          className={filterInputClasses}
                        />
                      </div>
                      <div>
                        <label className={`text-xs ${textSecondaryClasses} mb-1 block`}>To</label>
                        <input 
                          type="date"
                          value={rebateDateTo}
                          onChange={(e) => setRebateDateTo(e.target.value)}
                          className={filterInputClasses}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 pt-2 border-t border-gray-200">
                    <button
                      onClick={onClearFilters}
                      className={`flex-1 px-2.5 py-1.5 rounded transition-colors text-xs font-medium border ${
                        isDark
                          ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      Clear All
                    </button>
                    <button
                      onClick={onApplyFilters}
                      className="flex-1 px-2.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
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

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className={`px-3 py-1.5 border-b ${
          isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-gray-50'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium ${textSecondaryClasses}`}>Filters:</span>
            <div className="flex flex-wrap gap-1">
              {selectedRebateTypeFilter !== "All" && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  isDark 
                    ? 'bg-blue-900/30 text-blue-300 border-blue-700'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  Type: {selectedRebateTypeFilter}
                  <button 
                    onClick={clearTypeFilter}
                    className={`ml-0.5 ${isDark ? 'hover:text-blue-200' : 'hover:text-blue-800'}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
              {selectedRebateStatusFilter !== "All" && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  isDark 
                    ? 'bg-green-900/30 text-green-300 border-green-700'
                    : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  Status: {selectedRebateStatusFilter}
                  <button 
                    onClick={clearStatusFilter}
                    className={`ml-0.5 ${isDark ? 'hover:text-green-200' : 'hover:text-green-800'}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
              {rebateDateFrom && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  isDark 
                    ? 'bg-purple-900/30 text-purple-300 border-purple-700'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}>
                  From: {new Date(rebateDateFrom).toLocaleDateString()}
                  <button 
                    onClick={clearDateFromFilter}
                    className={`ml-0.5 ${isDark ? 'hover:text-purple-200' : 'hover:text-purple-800'}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
              {rebateDateTo && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  isDark 
                    ? 'bg-purple-900/30 text-purple-300 border-purple-700'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}>
                  To: {new Date(rebateDateTo).toLocaleDateString()}
                  <button 
                    onClick={clearDateToFilter}
                    className={`ml-0.5 ${isDark ? 'hover:text-purple-200' : 'hover:text-purple-800'}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Table Header */}
          <div className={tableHeaderClasses}>
            <div className="min-w-[120px] flex items-center gap-1">
              <FileText size={11} className={textMutedClasses} />
              <span>Rebate Code</span>
            </div>
            <div className="min-w-[80px] flex items-center gap-1">
              <Tag size={11} className={textMutedClasses} />
              <span>Type</span>
            </div>
            <div className="min-w-[80px] flex items-center gap-1">
              <Activity size={11} className={textMutedClasses} />
              <span>Status</span>
            </div>
            <div className="min-w-[80px]">Start Date</div>
            <div className="min-w-[80px]">End Date</div>
          </div>
          
          {/* Table Body */}
          <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
            {paginatedRebates.length > 0 ? (
              paginatedRebates.map((r, i) => (
                <div 
                  key={i} 
                  className={tableRowClasses}
                >
                  {/* Rebate Code */}
                  <div 
                    className="min-w-[120px] flex items-center gap-1.5 cursor-pointer"
                    onClick={() => onRebateClick(r)}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                    }`}>
                      <Percent size={10} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold text-xs ${textPrimaryClasses}`}>{r.code}</div>
                    </div>
                  </div>
                  
                  {/* Rebate Type */}
                  <div className="min-w-[80px]">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                      isDark
                        ? 'bg-blue-900/30 text-blue-300 border-blue-700'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {r.type}
                    </span>
                  </div>
                  
                  {/* Status Dropdown */}
                  <div className="min-w-[80px]">
                    <div className="relative inline-block">
                      <select 
                        value={r.active ? 'Active' : 'Inactive'}
                        onChange={(e) => {
                          const newStatusValue = e.target.value;
                          const numericStatus = newStatusValue === 'Active' ? 1 : 0;
                          onStatusToggle(r.code, numericStatus);
                        }}
                        className={`px-2 py-0.5 rounded text-[9px] font-semibold border appearance-none focus:outline-none focus:ring-1 cursor-pointer transition-all duration-150 w-20 ${
                          r.active === true 
                            ? isDark
                              ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50' 
                              : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                            : isDark
                              ? 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        <option value="Active" className={isDark ? 'bg-gray-800 text-gray-100 text-xs' : 'bg-white text-gray-900 text-xs'}>Active</option>
                        <option value="Inactive" className={isDark ? 'bg-gray-800 text-gray-100 text-xs' : 'bg-white text-gray-900 text-xs'}>Inactive</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center">
                        <ChevronDown size={9} className={r.active ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-gray-500' : 'text-gray-500')} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Start Date */}
                  <div className={`min-w-[80px] font-medium text-xs ${textPrimaryClasses}`}>
                    {new Date(r.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  
                  {/* End Date */}
                  <div className={`min-w-[80px] font-medium text-xs ${textPrimaryClasses}`}>
                    {new Date(r.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              ))
            ) : (
              <div className={`py-8 px-3 text-center ${
                isDark ? 'bg-gray-800' : 'bg-white'
              }`}>
                <div className={`w-12 h-12 mx-auto rounded flex items-center justify-center mb-3 ${
                  isDark ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <HandCoins size={20} className={textMutedClasses} />
                </div>
                <h3 className={`text-sm font-semibold mb-1 ${textPrimaryClasses}`}>
                  {rebates.length === 0 ? 'No Rebate Programs' : 'No Results Found'}
                </h3>
                <p className={`text-xs max-w-xs mx-auto mb-3 ${textSecondaryClasses}`}>
                  {rebates.length === 0 
                    ? 'No rebate programs found. Get started by adding your first rebate program.'
                    : 'Try adjusting your search or filters.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {sortedRebates.length > 0 && (
        <div className={`px-3 py-2 border-t rounded-b-lg flex justify-between items-center ${
          isDark 
            ? 'border-gray-700 bg-gray-800' 
            : 'border-gray-200 bg-white'
        }`}>
          <div className={`text-xs ${textSecondaryClasses}`}>
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, sortedRebates.length)} of{" "}
            {sortedRebates.length} entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-1.5 py-0.5 rounded border text-xs font-medium transition-colors ${
                currentPage === 1
                  ? isDark
                    ? 'text-gray-600 border-gray-700 cursor-not-allowed'
                    : 'text-gray-400 border-gray-200 cursor-not-allowed'
                  : isDark
                    ? 'text-gray-300 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                    : 'text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              Prev
            </button>
            
            <div className="flex items-center gap-0.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => 
                  page === 1 || 
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                )
                .map((page, index, array) => {
                  if (index > 0 && page - array[index - 1] > 1) {
                    return ( 
                      <span key={`ellipsis-${page}`} className={`px-1 py-0.5 text-xs ${textMutedClasses}`}>
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-5 h-5 rounded text-xs font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : isDark
                            ? 'text-gray-300 hover:bg-gray-700'
                            : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-1.5 py-0.5 rounded border text-xs font-medium transition-colors ${
                currentPage === totalPages
                  ? isDark
                    ? 'text-gray-600 border-gray-700 cursor-not-allowed'
                    : 'text-gray-400 border-gray-200 cursor-not-allowed'
                  : isDark
                    ? 'text-gray-300 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                    : 'text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(RebateProgramList);