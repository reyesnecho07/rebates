// src/pages/Van_RebatePrograms.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Users, Blocks } from "lucide-react";
import vanLogo from "../assets/van.png";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import RebateProgramList from "../components/Dashboard/RebateProgram/RebateProgramList";
import RebateDetailsModal from '../components/Dashboard/RebateProgram/RebateDetailsModal';
import { ToastContainer, useToast } from "../components/common/Toast";
import useAccessControl from '../hooks/useAccessControl';
import { useComponentRegistration } from '../hooks/useComponentRegistration';

/* ── Design system ──────────────────────────────────────────────── */
import { useTokens, useSkeletonStyle, DesignPage } from '../design-system';

/* ── Skeleton primitives ─────────────────────────────────────────── */
function Skel({ w = '100%', h = 12, radius = 6, style }) {
  const skel = useSkeletonStyle();
  return (
    <span
      className="block"
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        borderRadius: radius,
        ...skel(),
        ...style,
      }}
    />
  );
}

function RebateProgramListSkeleton() {
  const rows = 8;
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">
      <div className="px-6 py-5 flex flex-wrap items-center gap-3 border-b border-[var(--ds-hairline)]">
        <Skel w={240} h={38} radius={10} />
        <Skel w={150} h={38} radius={10} />
        <Skel w={150} h={38} radius={10} />
        <Skel w={140} h={38} radius={10} />
        <Skel w={140} h={38} radius={10} />
        <div className="flex-1" />
        <Skel w={100} h={38} radius={10} />
      </div>

      <div className="px-6 py-4 flex items-center gap-4 border-b border-[var(--ds-hairline)]">
        <Skel w="10%" h={10} />
        <Skel w="24%" h={10} />
        <Skel w="12%" h={10} />
        <Skel w="16%" h={10} />
        <Skel w="18%" h={10} />
        <Skel w="10%" h={10} />
      </div>

      <div className="px-6 py-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 py-4 ${i < rows - 1 ? 'border-b border-[var(--ds-hairline)]' : ''}`}
          >
            <Skel w="10%" h={22} radius={999} />
            <div className="flex items-center gap-3 w-[24%]">
              <Skel w={32} h={32} radius={8} />
              <div className="flex-1 space-y-2">
                <Skel w="80%" h={11} />
                <Skel w="55%" h={9} />
              </div>
            </div>
            <Skel w="12%" h={11} />
            <Skel w="16%" h={11} />
            <Skel w="18%" h={11} />
            <Skel w="10%" h={22} radius={999} />
          </div>
        ))}
      </div>

      <div className="px-6 py-4 flex items-center justify-between border-t border-[var(--ds-hairline)]">
        <Skel w={160} h={11} />
        <div className="flex items-center gap-2">
          <Skel w={32} h={32} radius={8} />
          <Skel w={32} h={32} radius={8} />
          <Skel w={32} h={32} radius={8} />
          <Skel w={32} h={32} radius={8} />
        </div>
      </div>
    </div>
  );
}

/* ── Date helpers ───────────────────────────────────────────────── */
const __toStartOfDay = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const __toEndOfDay = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};
const overlapsDateRange = (rebateFrom, rebateTo, filterFrom, filterTo) => {
  const fStart = __toStartOfDay(filterFrom);
  const fEnd   = __toEndOfDay(filterTo);
  if (fStart === null && fEnd === null) return true;
  const rStart = __toStartOfDay(rebateFrom);
  const rEnd   = __toEndOfDay(rebateTo);
  const rs = rStart === null ? -Infinity : rStart;
  const re = rEnd   === null ?  Infinity : rEnd;
  const fs = fStart === null ? -Infinity : fStart;
  const fe = fEnd   === null ?  Infinity : fEnd;
  return rs <= fe && re >= fs;
};

const fmtCustDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function Van_RebatePrograms() {
  const { theme, isDark } = useTokens();
  const { toasts, showToast, removeToast } = useToast();
  const routePath = '/Van_RebatePrograms';
  useAccessControl(routePath);

  const componentMetadata = {
    name: 'Van_RebatePrograms',
    version: '1.0.0',
    description: 'View and manage Van rebate programs, customer quotas, item ranges, and rebate per-bag values.',
    routePath: '/Van_RebatePrograms'
  };
  useComponentRegistration(componentMetadata);

  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName]   = useState("");
  const [userCode, setUserCode]   = useState("");
  const [initials, setInitials]   = useState("");
  const [loading, setLoading]     = useState(false);

  const [showVanDropdown,     setShowVanDropdown]     = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(false);

  const [rebates, setRebates] = useState([]);
  const [rebateSearchTerm, setRebateSearchTerm] = useState("");
  const [selectedRebateTypeFilter,   setSelectedRebateTypeFilter]   = useState("All");
  const [selectedRebateStatusFilter, setSelectedRebateStatusFilter] = useState("All");
  const [rebateDateFrom, setRebateDateFrom] = useState("");
  const [rebateDateTo,   setRebateDateTo]   = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [activeFilter, setActiveFilter] = useState('all');

  const [, setActiveTab] = useState("customers");
  const [selectedRebate,        setSelectedRebate]        = useState(null);
  const [rebateDetails,         setRebateDetails]         = useState(null);
  const [originalRebateDetails, setOriginalRebateDetails] = useState(null);
  const [editingCustomers,      setEditingCustomers]      = useState({});
  const [editingItems,          setEditingItems]          = useState({});

  /* Auth bootstrap */
  useEffect(() => {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) { window.location.href = "/login"; return; }
    try {
      const user = JSON.parse(userStr);
      const username = user.DisplayName || user.Username || user.name || "User";
      const uCode    = user.User_ID || user.id || user.employeeId || "N/A";
      setUserName(username);
      setUserCode(uCode);
      const getInitials = (name) => {
        if (!name) return "US";
        const parts = name.trim().split(" ");
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
      };
      setInitials(getInitials(username));
    } catch { window.location.href = "/login"; }
  }, []);

  /* Load rebates */
  const loadRebates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/van/dashboard/rebates?db=VAN`);
      if (res.ok) {
        const data = await res.json();
        setRebates(data.success && Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) {
      console.error(e);
      setRebates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (userName) loadRebates(); }, [userName, loadRebates]);

  /* Filtered rebates */
  const filteredRebates = (rebates || []).filter(rebate => {
    if (!rebate) return false;
    const matchesSearch =
      (rebate.code?.toLowerCase() || '').includes(rebateSearchTerm.toLowerCase()) ||
      (rebate.type?.toLowerCase() || '').includes(rebateSearchTerm.toLowerCase()) ||
      (rebate.active ? 'active' : 'inactive').includes(rebateSearchTerm.toLowerCase()) ||
      (rebate.from || '').includes(rebateSearchTerm) ||
      (rebate.to   || '').includes(rebateSearchTerm);

    const matchesActive =
      activeFilter === 'all' ? true :
      activeFilter === 'active' ? rebate.active :
      activeFilter === 'inactive' ? !rebate.active : true;

    const matchesRebateType =
      selectedRebateTypeFilter === "All" || rebate.type === selectedRebateTypeFilter;

    const matchesRebateStatus =
      selectedRebateStatusFilter === "All" ||
      (selectedRebateStatusFilter === "Active"   &&  rebate.active) ||
      (selectedRebateStatusFilter === "Inactive" && !rebate.active);

    const matchesDateRange = overlapsDateRange(rebate.from, rebate.to, rebateDateFrom, rebateDateTo);

    return matchesSearch && matchesActive && matchesRebateType && matchesRebateStatus && matchesDateRange;
  });

  /* Load rebate details */
  const loadRebateDetails = async (rebateCode, customerCode = null) => {
    try {
      let url = `/api/van/dashboard/rebate/${rebateCode}/details?db=VAN`;
      if (customerCode) url += `&customerCode=${customerCode}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) {
        return {
          ...data.data,
          name: data.data.Name || data.data.name || '',
        };
      }
      return null;
    } catch (e) {
      console.error('Error loading rebate details:', e);
      return null;
    }
  };

  const handleRebateClick = async (rebate) => {
    try {
      setSelectedRebate(rebate);
      const details = await loadRebateDetails(rebate.code);
      if (details) {
        setRebateDetails(details);
        setOriginalRebateDetails(JSON.parse(JSON.stringify(details)));
      } else {
        const fallback = {
          salesEmployee: rebate.salesEmployee || rebate.agent || "Not specified",
          frequency: rebate.frequency || "Not specified",
          rebateType: rebate.type || "Fixed",
          name: rebate.name || rebate.Name || '',
          customers: [], items: [], quotas: [0, 0, 0]
        };
        setRebateDetails(fallback);
        setOriginalRebateDetails(JSON.parse(JSON.stringify(fallback)));
        showToast("Could not load detailed rebate data. Showing basic information.", "warning");
      }
      setActiveTab('customers');
    } catch (e) {
      console.error(e);
      showToast("Error loading rebate details. Please try again.", "error");
    }
  };

  const handleStatusToggle = async (rebateCode, statusValue) => {
    try {
      const numericStatus = typeof statusValue === 'string'
        ? (statusValue === 'Active' ? 1 : 0) : statusValue;
      const response = await fetch(`/api/van/dashboard/rebates?db=VAN`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebateCode, status: numericStatus })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setRebates(prev => prev.map(r =>
          r.code === rebateCode ? { ...r, active: numericStatus === 1 } : r
        ));
        showToast(`Rebate ${rebateCode} status updated to ${numericStatus === 1 ? 'Active' : 'Inactive'}!`, "success");
      } else {
        showToast(`Failed: ${result.message || 'Unknown error'}`, "error");
      }
    } catch (e) {
      showToast(`Error updating status: ${e.message}`, "error");
    }
  };

  /* Customer handlers */
  const handleCustomerQuotaChange = (customerCode, quotaIndex, newValue) => {
    setRebateDetails(prev => {
      const updatedCustomers = prev.customers.map(customer => {
        if (customer.code === customerCode) {
          const months = ['January', 'February', 'March'];
          const monthName = months[quotaIndex];
          if (prev.rebateType === 'Fixed') {
            let updatedQuotas = { ...customer.quotas };
            if (Array.isArray(customer.quotas)) {
              const newArray = [...customer.quotas];
              newArray[quotaIndex] = parseFloat(newValue) || 0;
              updatedQuotas = newArray;
            } else if (typeof customer.quotas === 'object') {
              updatedQuotas[monthName] = parseFloat(newValue) || 0;
            } else {
              updatedQuotas = [0, 0, 0];
              updatedQuotas[quotaIndex] = parseFloat(newValue) || 0;
            }
            return { ...customer, quotas: updatedQuotas };
          } else if (prev.rebateType === 'Percentage') {
            let quotasArray = [];
            if (Array.isArray(customer.quotas)) quotasArray = [...customer.quotas];
            else if (customer.quotas && typeof customer.quotas === 'object') quotasArray = Object.values(customer.quotas);
            while (quotasArray.length < 3) quotasArray.push(0);
            quotasArray[quotaIndex] = parseFloat(newValue) || 0;
            return { ...customer, quotas: quotasArray };
          }
        }
        return customer;
      });
      return { ...prev, customers: updatedCustomers };
    });
  };

  const handleCustomerQtrRebateChange = (customerCode, newValue) => {
    setRebateDetails(prev => ({
      ...prev,
      customers: prev.customers.map(c =>
        c.code === customerCode ? { ...c, qtrRebate: parseFloat(newValue) || 0 } : c
      )
    }));
  };

  const handleCustomerRangeChange = (customerCode, rangeIndex, field, newValue) => {
    setRebateDetails(prev => ({
      ...prev,
      customers: prev.customers.map(c =>
        c.code === customerCode
          ? { ...c, ranges: c.ranges.map((r, i) => i === rangeIndex ? { ...r, [field]: parseFloat(newValue) || 0 } : r) }
          : c
      )
    }));
  };

  const handleSaveCustomer = async (customerCode) => {
    try {
      const customerToUpdate = rebateDetails.customers.find(c => c.code === customerCode);
      if (!customerToUpdate) { showToast("Customer not found!", "error"); return; }

      const requestBody = { rebateCode: selectedRebate.code, customerCode };
      if (rebateDetails.rebateType === 'Fixed') {
        requestBody.qtrRebate = parseFloat(customerToUpdate.qtrRebate) || 0;
        requestBody.quotas = Array.isArray(customerToUpdate.quotas)
          ? customerToUpdate.quotas.map(q => parseFloat(q) || 0) : [0, 0, 0];
      } else if (rebateDetails.rebateType === 'Incremental') {
        requestBody.qtrRebate = parseFloat(customerToUpdate.qtrRebate) || 0;
        requestBody.ranges = customerToUpdate.ranges?.map(r => ({
          rangeNo: r.rangeNo, minQty: parseFloat(r.minQty) || 0,
          maxQty: parseFloat(r.maxQty) || 0, rebatePerBag: parseFloat(r.rebatePerBag) || 0
        })) || [];
      } else if (rebateDetails.rebateType === 'Percentage') {
        requestBody.qtrRebate = parseFloat(customerToUpdate.qtrRebate) || 0;
        requestBody.quotas = Array.isArray(customerToUpdate.quotas)
          ? customerToUpdate.quotas.map(q => parseFloat(q) || 0) : [0, 0, 0];
      }

      const response = await fetch(`/api/van/dashboard/rebate/customer?db=VAN`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setEditingCustomers(prev => ({ ...prev, [customerCode]: false }));
        showToast("Customer data updated successfully!", "success");
        const updatedDetails = await loadRebateDetails(selectedRebate.code);
        if (updatedDetails) {
          setRebateDetails(updatedDetails);
          setOriginalRebateDetails(JSON.parse(JSON.stringify(updatedDetails)));
        }
      } else {
        showToast(`Failed: ${result.message || "Unknown error"}`, "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  };

  const handleCancelEditCustomer = (customerCode) => {
    setRebateDetails(originalRebateDetails);
    setEditingCustomers(prev => ({ ...prev, [customerCode]: false }));
  };

  const handleEditCustomer = (customerCode) => {
    setEditingCustomers(prev => ({ ...prev, [customerCode]: true }));
  };

  /* Item handlers */
  const handleItemChange = (itemCode, field, newValue) => {
    setRebateDetails(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.code === itemCode) {
          if (field === 'uom') return { ...item, [field]: newValue || '' };
          if (field === 'description') return { ...item, [field]: newValue };
          if (field === 'unitPerQty') return { ...item, [field]: parseFloat(newValue) || 1 };
          if (prev.rebateType === 'Fixed' && field === 'rebatePerBag') {
            return { ...item, rebatePerBag: parseFloat(newValue) || 0, rebate: parseFloat(newValue) || 0 };
          }
          if (prev.rebateType === 'Percentage' && field === 'percentage') {
            return { ...item, percentage: parseFloat(newValue) || 0, rebate: parseFloat(newValue) || 0 };
          }
          return { ...item, [field]: parseFloat(newValue) || 0 };
        }
        return item;
      })
    }));
  };

  const handleItemRangeChange = (itemCode, rangeIndex, field, newValue) => {
    setRebateDetails(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.code === itemCode
          ? { ...item, ranges: item.ranges.map((r, i) => i === rangeIndex ? { ...r, [field]: parseFloat(newValue) || 0 } : r) }
          : item
      )
    }));
  };

  const handleSaveItem = async (itemCode) => {
    try {
      const itemToUpdate = rebateDetails.items.find(i => i.code === itemCode);
      if (!itemToUpdate) { showToast("Item not found!", "error"); return; }

      const requestBody = {
        rebateCode: selectedRebate.code, itemCode,
        description: itemToUpdate.description || '',
        unitPerQty: parseFloat(itemToUpdate.unitPerQty) || 1,
        uom: itemToUpdate.uom || '',
      };
      if (rebateDetails.rebateType === 'Fixed') requestBody.rebate = parseFloat(itemToUpdate.rebate) || 0;
      else if (rebateDetails.rebateType === 'Incremental') {
        requestBody.ranges = itemToUpdate.ranges?.map(r => ({
          rangeNo: r.rangeNo, minQty: parseFloat(r.minQty) || 0,
          maxQty: parseFloat(r.maxQty) || 0, rebatePerBag: parseFloat(r.rebatePerBag) || 0
        })) || [];
      } else if (rebateDetails.rebateType === 'Percentage') {
        requestBody.rebate = parseFloat(itemToUpdate.percentage) || 0;
      }

      const response = await fetch(`/api/van/dashboard/rebate/item?db=VAN`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setEditingItems(prev => ({ ...prev, [itemCode]: false }));
        showToast("Item data updated successfully!", "success");
        const updatedDetails = await loadRebateDetails(selectedRebate.code);
        if (updatedDetails) {
          setRebateDetails(updatedDetails);
          setOriginalRebateDetails(JSON.parse(JSON.stringify(updatedDetails)));
        }
      } else {
        showToast(result.message || "Failed to update item data", "error");
      }
    } catch (e) {
      showToast("Error updating item data: " + e.message, "error");
    }
  };

  const handleCancelEditItem = (itemCode) => {
    setRebateDetails(originalRebateDetails);
    setEditingItems(prev => ({ ...prev, [itemCode]: false }));
  };

  const handleEditItem = (itemCode) => {
    setEditingItems(prev => ({ ...prev, [itemCode]: true }));
  };

  const clearRebateFilters = () => {
    setSelectedRebateTypeFilter("All");
    setSelectedRebateStatusFilter("All");
    setRebateDateFrom("");
    setRebateDateTo("");
    setRebateSearchTerm("");
    setActiveFilter("all");
    showToast("All rebate filters cleared!", "success");
  };

  /* ── Shared Tailwind class constants ─────────────────────────── */
  const TH_LEFT  = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--ds-muted)]";
  const TH_CENTER = "px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--ds-muted)]";
  const TH_LEFT_TIGHT  = "px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--ds-muted)]";
  const TH_CENTER_TIGHT = "px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--ds-muted)]";
  const THEAD_CLASS = "sticky top-0 border-b bg-[var(--ds-glass-deep)] border-[var(--ds-hairline)] backdrop-blur-[28px]";
  const TBODY_CLASS = "divide-y divide-[var(--ds-hairline)]";
  const TR_HOVER    = "transition-colors duration-150 hover:bg-[var(--ds-hover)]";
  const CUST_NAME   = "font-medium text-xs truncate text-[var(--ds-ink)]";
  const CODE_BADGE  = "text-xs px-1.5 py-0.5 rounded font-medium truncate inline-block max-w-full bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]";
  const DATE_FILLED = "text-[11px] font-mono px-2 py-1 rounded bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]";
  const DATE_EMPTY  = "text-[11px] font-mono px-2 py-1 rounded bg-[var(--ds-hover)] text-[var(--ds-faint)]";
  const INPUT_INLINE = "px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#0A84FF] bg-[var(--ds-glass-deep)] text-[var(--ds-ink)] border border-[var(--ds-hairline)]";
  const RANGE_INPUT  = "px-1 py-0.5 border rounded text-[10px] text-center bg-[var(--ds-glass-deep)] border-[var(--ds-hairline)] text-[var(--ds-ink)]";
  const EMPTY_STATE_WRAP = "flex-1 flex items-center justify-center p-8";
  const EMPTY_ICON = "mx-auto mb-4 text-[var(--ds-faint)]";
  const EMPTY_HEAD = "text-lg font-semibold mb-2 text-[var(--ds-ink)]";
  const EMPTY_BODY = "text-[var(--ds-muted)]";

  const renderEmptyCustomers = (message) => (
    <div className={EMPTY_STATE_WRAP}>
      <div className="text-center">
        <Users size={48} className={EMPTY_ICON} />
        <h5 className={EMPTY_HEAD}>No Customers Found</h5>
        <p className={EMPTY_BODY}>{message}</p>
      </div>
    </div>
  );

  const renderEmptyItems = (message) => (
    <div className={EMPTY_STATE_WRAP}>
      <div className="text-center">
        <Blocks size={48} className={EMPTY_ICON} />
        <h5 className={EMPTY_HEAD}>No Items Found</h5>
        <p className={EMPTY_BODY}>{message}</p>
      </div>
    </div>
  );

  /* ── Range colors (semantic — static Tailwind) ──────────────── */
  const rangeColors = {
    1: { text: 'text-blue-600 dark:text-blue-400',       badge: 'bg-blue-500 text-white' },
    2: { text: 'text-amber-600 dark:text-amber-400',     badge: 'bg-amber-500 text-white' },
    3: { text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500 text-white' },
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER: FIXED CUSTOMER TABLE (monthly + quarterly variants)
     ════════════════════════════════════════════════════════════════ */
  const renderFixedCustomerTable = () => {
    const isMonthly = rebateDetails?.frequency === 'Monthly';
    const isPerCustomer = (rebateDetails?.dateRangeScope || 'Global') === 'Per Customer';

    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return renderEmptyCustomers('No customers are associated with this rebate program.');
    }

    const getQuotaMonthNames = () => {
      const dateFrom = rebateDetails?.dateFrom || rebateDetails?.rebateDetails?.dateFrom || selectedRebate?.from;
      const dateTo   = rebateDetails?.dateTo   || rebateDetails?.rebateDetails?.dateTo   || selectedRebate?.to;
      const frequency = rebateDetails?.frequency || 'Quarterly';

      const addMonthsLocal = (date, n) => {
        const d   = new Date(date);
        const day = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, last));
        return d;
      };
      const fmtShortL = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fmtFullL  = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const isDynamicFrequency = frequency !== 'Monthly' && frequency !== 'Quarterly';
      const firstCustomer = rebateDetails?.customers?.[0];

      let quotaKeys = [];
      if (Array.isArray(firstCustomer?.quotas)) {
        quotaKeys = firstCustomer.quotas.map((_, i) => i);
      } else if (firstCustomer?.quotas && typeof firstCustomer.quotas === 'object') {
        quotaKeys = Object.keys(firstCustomer.quotas);
      }

      if (isDynamicFrequency) {
        const namedKeys = quotaKeys.filter(k => typeof k === 'string' && isNaN(Number(k)));
        if (namedKeys.length === 0) return [];
        return namedKeys.map((key, i) => ({
          name: key, dates: key, shortLabel: key,
          isMonthly: false, isQuarterly: false, isDynamic: true,
          index: i,
        }));
      }

      if (!dateFrom) {
        const count = quotaKeys.length || (frequency === 'Monthly' ? 1 : 3);
        const now = new Date();
        return Array.from({ length: count }, (_, i) => {
          const monthIdx = (now.getMonth() + i) % 12;
          return {
            name:        frequency === 'Quarterly' ? `Q${i + 1} ${now.getFullYear()}` : `Month ${i + 1}`,
            dates:       frequency === 'Quarterly' ? `Quarter ${i + 1}` : `Month ${i + 1}`,
            shortLabel:  frequency === 'Quarterly' ? `Q${i + 1}` : `M${i + 1}`,
            monthIndex:  monthIdx,
            monthName:   new Date(now.getFullYear(), monthIdx, 1).toLocaleDateString('en-US', { month: 'long' }),
            isMonthly:   frequency === 'Monthly',
            isQuarterly: frequency === 'Quarterly',
            index:       i,
          };
        });
      }

      const start = new Date(dateFrom);
      if (isNaN(start.getTime())) return [];
      const end = dateTo ? new Date(dateTo) : null;

      if (end && !isNaN(end.getTime()) && end >= start) {
        const step = frequency === 'Quarterly' ? 3 : 1;
        const cols = [];
        let cursor = new Date(start);
        while (cursor <= end) {
          const nextStart = addMonthsLocal(cursor, step);
          const isLast    = nextStart >= end;
          const actualEnd = isLast
            ? new Date(end)
            : (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
          const dateRange = `${fmtShortL(cursor)} – ${fmtFullL(actualEnd)}`;
          cols.push({
            name: dateRange, dates: dateRange, shortLabel: dateRange, label: dateRange,
            monthName: cursor.toLocaleDateString('en-US', { month: 'long' }),
            year: cursor.getFullYear(),
            isMonthly: frequency === 'Monthly', isQuarterly: frequency === 'Quarterly',
            index: cols.length,
            startDate: new Date(cursor), endDate: new Date(actualEnd),
          });
          if (isLast) break;
          cursor = nextStart;
        }
        return cols;
      }

      let count = quotaKeys.length || (frequency === 'Monthly' ? 1 : 3);
      const step = frequency === 'Quarterly' ? 3 : 1;
      const cols = [];
      let cursor = new Date(start);
      for (let i = 0; i < count; i++) {
        const nextStart = addMonthsLocal(cursor, step);
        const actualEnd = (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
        const dateRange = `${fmtShortL(cursor)} – ${fmtFullL(actualEnd)}`;
        cols.push({
          name: dateRange, dates: dateRange, shortLabel: dateRange, label: dateRange,
          monthName: cursor.toLocaleDateString('en-US', { month: 'long' }),
          year: cursor.getFullYear(),
          isMonthly: frequency === 'Monthly', isQuarterly: frequency === 'Quarterly',
          index: i,
          startDate: new Date(cursor), endDate: new Date(actualEnd),
        });
        cursor = nextStart;
      }
      return cols;
    };

    const quotaMonths = getQuotaMonthNames();

    const getQuotaValue = (customer, monthIndex) => {
      if (!customer.quotas) return 0;
      const monthName = typeof quotaMonths[monthIndex] === 'object' ? quotaMonths[monthIndex].name : quotaMonths[monthIndex];
      if (Array.isArray(customer.quotas)) return customer.quotas[monthIndex] || 0;
      if (typeof customer.quotas === 'object') {
        if (customer.quotas[monthName] !== undefined) return customer.quotas[monthName] || 0;
        const numericKey = monthIndex + 1;
        if (customer.quotas[numericKey] !== undefined) return customer.quotas[numericKey] || 0;
        const monthKey = `Month${numericKey}`;
        if (customer.quotas[monthKey] !== undefined) return customer.quotas[monthKey] || 0;
      }
      return 0;
    };

    if (isMonthly) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={THEAD_CLASS}>
              <tr>
                <th className={`${TH_LEFT} min-w-[180px]`}>Customer</th>
                <th className={`${TH_LEFT} min-w-[100px]`}>Code</th>
                {isPerCustomer && (
                  <>
                    <th className={`${TH_CENTER} min-w-[110px]`}>Date From</th>
                    <th className={`${TH_CENTER} min-w-[110px]`}>Date To</th>
                  </>
                )}
                {quotaMonths.map((month, index) => (
                  <th key={index} className={`${TH_CENTER} min-w-[150px]`}>
                    <div className="font-bold text-xs whitespace-nowrap">{month.dates || month.name || `Month ${index + 1}`}</div>
                  </th>
                ))}
                <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>QTR Rebate</th>
              </tr>
            </thead>
            <tbody className={TBODY_CLASS}>
              {rebateDetails.customers.map((customer, i) => {
                const customerCode = customer.code || `CUST-${i}`;
                const isEditing = editingCustomers[customerCode] || false;
                return (
                  <tr key={i} className={TR_HOVER}>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                          {(customer.name && customer.name.charAt(0)) || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={CUST_NAME}>{customer.name || 'Unknown Customer'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code className={CODE_BADGE}>{customer.code || 'N/A'}</code>
                    </td>
                    {isPerCustomer && (
                      <>
                        <td className="px-3 py-2 text-center align-top">
                          <span className={customer.dateFrom ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateFrom)}</span>
                        </td>
                        <td className="px-3 py-2 text-center align-top">
                          <span className={customer.dateTo ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateTo)}</span>
                        </td>
                      </>
                    )}
                    {quotaMonths.map((month, idx) => {
                      const quotaValue = getQuotaValue(customer, idx);
                      return (
                        <td key={idx} className="px-3 py-2 text-center align-top">
                          {isEditing ? (
                            <input type="number" value={quotaValue} onChange={(e) => handleCustomerQuotaChange(customer.code, idx, e.target.value)} className={`w-16 ${INPUT_INLINE}`} min="0" step="1" />
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${quotaValue > 0 ? 'bg-blue-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>{quotaValue}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center align-top">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="text-xs text-[var(--ds-muted)]">₱</span>
                          <input type="number" value={customer.qtrRebate || 0} onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)} className={`w-16 ${INPUT_INLINE}`} min="0" step="0.01" />
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${customer.qtrRebate > 0 ? 'bg-emerald-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>₱{(customer.qtrRebate || 0).toFixed(2)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT} min-w-[180px]`}>Customer</th>
              <th className={`${TH_LEFT} min-w-[100px]`}>Code</th>
              {isPerCustomer && (
                <>
                  <th className={`${TH_CENTER} min-w-[110px]`}>Date From</th>
                  <th className={`${TH_CENTER} min-w-[110px]`}>Date To</th>
                </>
              )}
              {quotaMonths.map((col, index) => (
                <th key={index} className={`${TH_CENTER} min-w-[150px]`}>
                  <div className="font-bold text-xs whitespace-nowrap">{col.dates || col.name || `Period ${index + 1}`}</div>
                </th>
              ))}
              <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>QTR Rebate</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.customers.map((customer, i) => {
              const customerCode = customer.code || `CUST-${i}`;
              const isEditing = editingCustomers[customerCode] || false;
              return (
                <tr key={i} className={TR_HOVER}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                        {(customer.name && customer.name.charAt(0)) || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={CUST_NAME}>{customer.name || 'Unknown Customer'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className={CODE_BADGE}>{customer.code || 'N/A'}</code>
                  </td>
                  {isPerCustomer && (
                    <>
                      <td className="px-3 py-2 text-center align-top">
                        <span className={customer.dateFrom ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateFrom)}</span>
                      </td>
                      <td className="px-3 py-2 text-center align-top">
                        <span className={customer.dateTo ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateTo)}</span>
                      </td>
                    </>
                  )}
                  {quotaMonths.map((month, idx) => {
                    const quotaValue = getQuotaValue(customer, idx);
                    return (
                      <td key={idx} className="px-3 py-2 text-center align-top">
                        {isEditing ? (
                          <input type="number" value={quotaValue} onChange={(e) => handleCustomerQuotaChange(customer.code, idx, e.target.value)} className={`w-16 ${INPUT_INLINE}`} min="0" step="1" />
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${quotaValue > 0 ? 'bg-blue-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>{quotaValue}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center align-top">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-xs text-[var(--ds-muted)]">₱</span>
                        <input type="number" value={customer.qtrRebate || 0} onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)} className={`w-16 ${INPUT_INLINE}`} min="0" step="0.01" />
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${customer.qtrRebate > 0 ? 'bg-emerald-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>₱{(customer.qtrRebate || 0).toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER: INCREMENTAL CUSTOMER TABLE
     ════════════════════════════════════════════════════════════════ */
  const renderIncrementalCustomerTable = () => {
    const isPerCustomer = (rebateDetails?.dateRangeScope || 'Global') === 'Per Customer';
    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return renderEmptyCustomers('No customers are associated with this rebate program.');
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT_TIGHT} min-w-[180px] max-w-[180px]`}>Customer</th>
              <th className={`${TH_LEFT_TIGHT} min-w-[100px] max-w-[100px]`}>Code</th>
              {isPerCustomer && (
                <>
                  <th className={`${TH_CENTER_TIGHT} min-w-[110px]`}>Date From</th>
                  <th className={`${TH_CENTER_TIGHT} min-w-[110px]`}>Date To</th>
                </>
              )}
              <th className={`${TH_CENTER_TIGHT} min-w-[100px] max-w-[100px]`}>Qtr Rebate</th>
              <th className={TH_CENTER_TIGHT}>Quantity Ranges</th>
              <th className={TH_CENTER_TIGHT}>Rebate Per Unit</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.customers.map((customer) => (
              <tr key={customer.code} className={TR_HOVER}>
                <td className="px-4 py-3 align-middle max-w-[180px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md text-white flex items-center justify-center font-semibold text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                      {customer.name?.charAt(0) || '?'}
                    </div>
                    <span className={CUST_NAME}>{customer.name || 'Unknown Customer'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle max-w-[100px]">
                  <code className="text-xs px-2 py-0.5 rounded font-semibold border inline-block bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border-[var(--ds-hairline)]">{customer.code || 'N/A'}</code>
                </td>
                {isPerCustomer && (
                  <>
                    <td className="px-4 py-3 text-center align-middle">
                      <span className={customer.dateFrom ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateFrom)}</span>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <span className={customer.dateTo ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateTo)}</span>
                    </td>
                  </>
                )}
                <td className="px-4 py-3 text-center align-middle max-w-[100px]">
                  {editingCustomers[customer.code] ? (
                    <input type="number" value={customer.qtrRebate || 0} onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)} className={`w-16 ${INPUT_INLINE}`} />
                  ) : (
                    <span className="text-xs px-3 py-1 rounded-lg font-bold inline-block shadow-sm bg-[#0A84FF] text-white">{customer.qtrRebate || 0}</span>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center justify-center gap-1 flex-nowrap">
                    {customer.ranges?.map((range, rangeIndex) => {
                      const colors = rangeColors[range.rangeNo] || rangeColors[1];
                      return (
                        <div key={`${customer.code}-range-${rangeIndex}`} className="flex items-center gap-0.5 flex-shrink-0">
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0 leading-none ${colors.badge}`}>R{range.rangeNo}</span>
                          {editingCustomers[customer.code] ? (
                            <div className="flex items-center gap-0.5">
                              <input type="number" value={range.minQty || 0} onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'minQty', e.target.value)} className={`w-10 ${RANGE_INPUT}`} />
                              <span className="text-[9px] text-[var(--ds-faint)]">–</span>
                              <input type="number" value={range.maxQty || 0} onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'maxQty', e.target.value)} className={`w-10 ${RANGE_INPUT}`} />
                            </div>
                          ) : (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${colors.text} bg-[var(--ds-chip-bg)] border-[var(--ds-hairline)]`}>{range.minQty ?? 0}–{range.maxQty ?? 0}</span>
                          )}
                          {rangeIndex < customer.ranges.length - 1 && (<span className="text-[9px] mx-0.5 text-[var(--ds-faint)]">·</span>)}
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center justify-center gap-1 flex-nowrap">
                    {customer.ranges?.map((range, rangeIndex) => {
                      const colors = rangeColors[range.rangeNo] || rangeColors[1];
                      return (
                        <div key={`${customer.code}-rebate-${rangeIndex}`} className="flex items-center gap-0.5 flex-shrink-0">
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0 leading-none ${colors.badge}`}>R{range.rangeNo}</span>
                          {editingCustomers[customer.code] ? (
                            <input type="number" value={range.rebatePerBag || 0} onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'rebatePerBag', e.target.value)} className={`w-10 ${RANGE_INPUT}`} />
                          ) : (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${colors.text} bg-[var(--ds-chip-bg)] border-[var(--ds-hairline)]`}>{range.rebatePerBag ?? 0}</span>
                          )}
                          {rangeIndex < customer.ranges.length - 1 && (<span className="text-[9px] mx-0.5 text-[var(--ds-faint)]">·</span>)}
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER: PERCENTAGE CUSTOMER TABLE
     ════════════════════════════════════════════════════════════════ */
  const renderPercentageCustomerTable = ({ isWithoutQuota } = {}) => {
    const isPerCustomer = (rebateDetails?.dateRangeScope || 'Global') === 'Per Customer';
    const withoutQuota = isWithoutQuota ?? (rebateDetails?.quotaType === 'Without Quota');

    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return renderEmptyCustomers('No customers are associated with this Percentage rebate program.');
    }

    const hasQuotas = !withoutQuota && rebateDetails.customers.some((c) => {
      if (Array.isArray(c.quotaDetails) && c.quotaDetails.some(q => Number(q.targetQty) > 0)) return true;
      if (Array.isArray(c.quotas)       && c.quotas.some(q => Number(q) > 0))                 return true;
      return false;
    });

    const frequency = rebateDetails?.frequency || 'Quarterly';
    const dateFrom  = rebateDetails?.dateFrom || rebateDetails?.rebateDetails?.dateFrom || selectedRebate?.from || rebateDetails?.rebatePeriod?.dateFrom;
    const dateTo    = rebateDetails?.dateTo   || rebateDetails?.rebateDetails?.dateTo   || selectedRebate?.to   || rebateDetails?.rebatePeriod?.dateTo;

    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const MONTH_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const getQuotaMonthNames = () => {
      const addMonthsLocal = (date, n) => {
        const d = new Date(date);
        const day = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, last));
        return d;
      };
      const fmtShortL = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fmtFullL  = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      if (!dateFrom) {
        const firstCustomer = rebateDetails?.customers?.[0];
        let quotaKeys = [];
        if (Array.isArray(firstCustomer?.quotas)) quotaKeys = firstCustomer.quotas.map((_, i) => i);
        else if (firstCustomer?.quotas && typeof firstCustomer.quotas === 'object') quotaKeys = Object.keys(firstCustomer.quotas);
        const count = quotaKeys.length || (frequency === 'Monthly' ? 1 : 3);
        const now = new Date();
        return Array.from({ length: count }, (_, i) => {
          const monthIdx = (now.getMonth() + i) % 12;
          return {
            name: frequency === 'Quarterly' ? `Q${i + 1} ${now.getFullYear()}` : `Month ${i + 1}`,
            dates: frequency === 'Quarterly' ? `Quarter ${i + 1}` : `Month ${i + 1}`,
            label: frequency === 'Quarterly' ? `Q${i + 1} ${now.getFullYear()}` : `Month ${i + 1}`,
            fullLabel: frequency === 'Quarterly' ? `Q${i + 1} ${now.getFullYear()}` : `Month ${i + 1}`,
            shortLabel: MONTH_SHORT[monthIdx],
            monthIndex: monthIdx,
            isMonthly: frequency === 'Monthly',
            isQuarterly: frequency === 'Quarterly',
            index: i,
          };
        });
      }

      const start = new Date(dateFrom);
      if (isNaN(start.getTime())) return [];
      const end = dateTo ? new Date(dateTo) : null;

      if (end && !isNaN(end.getTime()) && end >= start) {
        const step = frequency === 'Quarterly' ? 3 : 1;
        const cols = [];
        let cursor = new Date(start);
        while (cursor <= end) {
          const nextStart = addMonthsLocal(cursor, step);
          const isLast = nextStart >= end;
          const actualEnd = isLast ? new Date(end) : (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
          const dateRange = `${fmtShortL(cursor)} – ${fmtFullL(actualEnd)}`;
          cols.push({
            name: dateRange, dates: dateRange, label: dateRange, fullLabel: dateRange,
            shortLabel: MONTH_SHORT[cursor.getMonth()],
            monthIndex: cursor.getMonth(),
            monthName: cursor.toLocaleDateString('en-US', { month: 'long' }),
            year: cursor.getFullYear(),
            isMonthly: frequency === 'Monthly', isQuarterly: frequency === 'Quarterly',
            index: cols.length, startDate: new Date(cursor), endDate: new Date(actualEnd),
          });
          if (isLast) break;
          cursor = nextStart;
        }
        return cols;
      }

      const firstCustomer = rebateDetails?.customers?.[0];
      let quotaKeys = [];
      if (Array.isArray(firstCustomer?.quotas)) quotaKeys = firstCustomer.quotas.map((_, i) => i);
      else if (firstCustomer?.quotas && typeof firstCustomer.quotas === 'object') quotaKeys = Object.keys(firstCustomer.quotas);
      let count = quotaKeys.length || 3;
      const step = frequency === 'Quarterly' ? 3 : 1;
      const cols = [];
      let cursor = new Date(start);
      for (let i = 0; i < count; i++) {
        const nextStart = addMonthsLocal(cursor, step);
        const actualEnd = (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
        const dateRange = `${fmtShortL(cursor)} – ${fmtFullL(actualEnd)}`;
        cols.push({
          name: dateRange, dates: dateRange, label: dateRange, fullLabel: dateRange,
          shortLabel: MONTH_SHORT[cursor.getMonth()],
          monthIndex: cursor.getMonth(),
          monthName: cursor.toLocaleDateString('en-US', { month: 'long' }),
          year: cursor.getFullYear(),
          isMonthly: frequency === 'Monthly', isQuarterly: frequency === 'Quarterly',
          index: i, startDate: new Date(cursor), endDate: new Date(actualEnd),
        });
        cursor = nextStart;
      }
      return cols;
    };

    const quotaColumns = getQuotaMonthNames();

    const getPercentageQuotaValue = (customer, column, colIndex) => {
      if (Array.isArray(customer.quotaDetails) && customer.quotaDetails.length > 0) {
        const match = customer.quotaDetails.find((q) => {
          if (q.month == null) return false;
          const db = String(q.month).trim().toLowerCase();
          const short = column.shortLabel.toLowerCase();
          const long  = MONTH_LONG[column.monthIndex].toLowerCase();
          const num1  = String(column.monthIndex + 1);
          const num2  = num1.padStart(2, '0');
          return db === short || db === long || db.startsWith(short) || db === num1 || db === num2;
        });
        if (match) return Number(match.targetQty) || 0;
        if (customer.quotaDetails[colIndex]) return Number(customer.quotaDetails[colIndex].targetQty) || 0;
      }
      if (Array.isArray(customer.quotas)) return Number(customer.quotas[colIndex]) || 0;
      return 0;
    };

    if (!hasQuotas || quotaColumns.length === 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={THEAD_CLASS}>
              <tr>
                <th className={`${TH_LEFT} min-w-[250px]`}>Customer</th>
                <th className={`${TH_LEFT} min-w-[150px]`}>Code</th>
                {isPerCustomer && (
                  <>
                    <th className={`${TH_CENTER} min-w-[110px]`}>Date From</th>
                    <th className={`${TH_CENTER} min-w-[110px]`}>Date To</th>
                  </>
                )}
                <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>QTR Rebate</th>
              </tr>
            </thead>
            <tbody className={TBODY_CLASS}>
              {rebateDetails.customers.map((customer, index) => {
                const customerCode = customer.code || `CUST-${index}`;
                const isEditing = editingCustomers[customerCode] || false;
                return (
                  <tr key={index} className={TR_HOVER}>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customer.color || '#10b981' }}>
                          {customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={CUST_NAME}>{customer.name || 'Unknown Customer'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code className={CODE_BADGE}>{customerCode}</code>
                    </td>
                    {isPerCustomer && (
                      <>
                        <td className="px-3 py-2 text-center align-top">
                          <span className={customer.dateFrom ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateFrom)}</span>
                        </td>
                        <td className="px-3 py-2 text-center align-top">
                          <span className={customer.dateTo ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateTo)}</span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-center align-top">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="text-xs text-[var(--ds-muted)]">₱</span>
                          <input type="number" value={customer.qtrRebate || 0} onChange={(e) => handleCustomerQtrRebateChange(customerCode, e.target.value)} className={`w-16 ${INPUT_INLINE}`} min="0" step="0.01" />
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${customer.qtrRebate > 0 ? 'bg-blue-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>₱{parseFloat(customer.qtrRebate || 0).toFixed(2)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT} min-w-[180px] max-w-[180px]`}>Customer</th>
              <th className={`${TH_LEFT} min-w-[100px] max-w-[100px]`}>Code</th>
              {isPerCustomer && (
                <>
                  <th className={`${TH_CENTER} min-w-[110px]`}>Date From</th>
                  <th className={`${TH_CENTER} min-w-[110px]`}>Date To</th>
                </>
              )}
              {quotaColumns.map((col) => (
                <th key={col.key || col.label || col.name} title={col.fullLabel || col.label}
                    className={`${TH_CENTER} min-w-[150px] whitespace-nowrap`}>
                  {col.label || col.dates || col.name}
                </th>
              ))}
              <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>QTR Rebate</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.customers.map((customer, index) => {
              const customerCode  = customer.code || `CUST-${index}`;
              const customerName  = customer.name || 'Unknown Customer';
              const customerColor = customer.color || '#10b981';
              const qtrRebate     = customer.qtrRebate !== undefined ? customer.qtrRebate : 0;
              const isEditing     = editingCustomers[customerCode] || false;
              return (
                <tr key={index} className={TR_HOVER}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0 shadow-sm" style={{ backgroundColor: customerColor }}>
                        {customerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={CUST_NAME}>{customerName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className={CODE_BADGE}>{customerCode}</code>
                  </td>
                  {isPerCustomer && (
                    <>
                      <td className="px-3 py-2 text-center align-top">
                        <span className={customer.dateFrom ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateFrom)}</span>
                      </td>
                      <td className="px-3 py-2 text-center align-top">
                        <span className={customer.dateTo ? DATE_FILLED : DATE_EMPTY}>{fmtCustDate(customer.dateTo)}</span>
                      </td>
                    </>
                  )}
                  {quotaColumns.map((col, colIdx) => {
                    const quotaValue = getPercentageQuotaValue(customer, col, colIdx);
                    return (
                      <td key={col.key || col.label || colIdx} className="px-3 py-2 text-center align-top">
                        {isEditing ? (
                          <input type="number" value={quotaValue} onChange={(e) => handleCustomerQuotaChange(customerCode, colIdx, e.target.value)} className={`w-16 ${INPUT_INLINE}`} min="0" step="1" />
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${quotaValue > 0 ? 'bg-emerald-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>{quotaValue}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center align-top">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-xs text-[var(--ds-muted)]">₱</span>
                        <input type="number" value={qtrRebate} onChange={(e) => handleCustomerQtrRebateChange(customerCode, e.target.value)} className={`w-16 ${INPUT_INLINE}`} min="0" step="0.01" />
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 ${qtrRebate > 0 ? 'bg-blue-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>₱{parseFloat(qtrRebate).toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER: FIXED ITEMS TABLE
     ════════════════════════════════════════════════════════════════ */
  const renderFixedItemsTable = () => {
    if (!rebateDetails?.items || rebateDetails.items.length === 0) {
      return renderEmptyItems('No items are associated with this Fixed rebate program.');
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT} min-w-[180px] max-w-[180px]`}>Item</th>
              <th className={`${TH_LEFT} min-w-[100px] max-w-[100px]`}>Code</th>
              <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>Qty Per Unit</th>
              <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>Unit of Measure</th>
              <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>Rebate Per Unit</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.items.map((item, idx) => {
              const rebatePerBagValue = item.rebatePerBag || item.rebate || 0;
              return (
                <tr key={idx} className={TR_HOVER}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 bg-[#0A84FF]/15">
                        <Blocks size={10} className="text-[#0A84FF]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={CUST_NAME}>{item.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className={CODE_BADGE}>{item.code}</code>
                  </td>
                  <td className="px-3 py-2 text-center align-top">
                    {editingItems[item.code] ? (
                      <input type="number" value={item.unitPerQty} onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)} className={`w-12 ${INPUT_INLINE}`} />
                    ) : (
                      <span className="text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.unitPerQty}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center align-top">
                    {editingItems[item.code] ? (
                      <input type="text" value={item.uom || ''} onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)} className={`w-20 ${INPUT_INLINE}`} />
                    ) : (
                      <span className="text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.uom || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center align-top">
                    {editingItems[item.code] ? (
                      <div className="flex items-center gap-0.5 justify-center">
                        <span className="text-xs text-[var(--ds-muted)]">₱</span>
                        <input type="number" step="0.01" value={rebatePerBagValue} onChange={(e) => handleItemChange(item.code, 'rebatePerBag', e.target.value)} className={`w-12 ${INPUT_INLINE}`} />
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 bg-emerald-500 text-white">₱{rebatePerBagValue.toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER: INCREMENTAL ITEMS TABLE (VAN: 4 cols only — no ranges)
     ════════════════════════════════════════════════════════════════ */
  const renderIncrementalItemsTable = () => {
    if (!rebateDetails?.items || rebateDetails.items.length === 0) {
      return renderEmptyItems('No items are associated with this rebate program.');
    }
    return (
      <div className="h-full overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT_TIGHT} min-w-[120px]`}>Item</th>
              <th className={`${TH_LEFT_TIGHT} min-w-[60px]`}>Code</th>
              <th className={`${TH_CENTER_TIGHT} min-w-[60px]`}>Qty Per Unit</th>
              <th className={`${TH_CENTER_TIGHT} min-w-[60px]`}>Unit of Measure</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.items.map((item) => (
              <tr key={item.code} className={TR_HOVER}>
                <td className="px-3 py-3 align-middle max-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-[#BF5AF2]/15">
                      <Blocks size={11} className="text-[#BF5AF2]" />
                    </div>
                    <span className="font-medium text-[11px] truncate text-[var(--ds-ink)]">{item.description}</span>
                  </div>
                </td>
                <td className="px-3 py-3 align-middle">
                  <code className="text-[10px] px-1.5 py-0.5 rounded font-semibold border inline-block bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border-[var(--ds-hairline)]">{item.code}</code>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  {editingItems[item.code] ? (
                    <input type="number" value={item.unitPerQty} onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)} className="w-10 px-1 py-0.5 rounded text-[11px] text-center bg-[var(--ds-glass-deep)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]" />
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg font-bold inline-block bg-[#BF5AF2] text-white">{item.unitPerQty}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  {editingItems[item.code] ? (
                    <input type="text" value={item.uom || ''} onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)} className="w-12 px-1 py-0.5 rounded text-[11px] text-center bg-[var(--ds-glass-deep)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]" />
                  ) : (
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-medium inline-block text-center min-w-8 bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.uom || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER: PERCENTAGE ITEMS TABLE
     ════════════════════════════════════════════════════════════════ */
  const renderPercentageItemsTable = () => {
    if (!rebateDetails?.items || rebateDetails.items.length === 0) {
      return renderEmptyItems('No items are associated with this Percentage rebate program.');
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT} min-w-[180px] max-w-[180px]`}>Item</th>
              <th className={`${TH_LEFT} min-w-[100px] max-w-[100px]`}>Code</th>
              <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>Qty Per Unit</th>
              <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>Unit of Measure</th>
              <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>Percentage</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.items.map((item, idx) => (
              <tr key={idx} className={TR_HOVER}>
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 bg-[#32D74B]/15">
                      <Blocks size={10} className="text-[#32D74B]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={CUST_NAME}>{item.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <code className={CODE_BADGE}>{item.code}</code>
                </td>
                <td className="px-3 py-2 text-center align-top">
                  {editingItems[item.code] ? (
                    <input type="number" value={item.unitPerQty || 1} onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)} className={`w-12 ${INPUT_INLINE}`} />
                  ) : (
                    <span className="text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.unitPerQty || 1}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center align-top">
                  {editingItems[item.code] ? (
                    <input type="text" value={item.uom || ''} onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)} className={`w-20 ${INPUT_INLINE}`} />
                  ) : (
                    <span className="text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.uom || '—'}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center align-top">
                  {editingItems[item.code] ? (
                    <div className="flex items-center gap-0.5 justify-center">
                      <input type="number" value={item.percentage || 0} onChange={(e) => handleItemChange(item.code, 'percentage', e.target.value)} className={`w-12 ${INPUT_INLINE}`} />
                      <span className="text-xs text-[var(--ds-muted)]">%</span>
                    </div>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded font-medium inline-block text-center min-w-10 bg-emerald-500 text-white">{item.percentage || 0}%</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const showSkeleton = loading && rebates.length === 0;

  return (
    <DesignPage className="flex w-full">
      {/* Aurora wash */}
      <div className="pointer-events-none fixed inset-0 z-0 ds-aurora-blue-purple" />

      <ToastContainer toasts={toasts} removeToast={removeToast} isDark={isDark} />

      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown} setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown} setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main
        className={`relative flex-1 flex flex-col min-h-screen z-[1] transition-all duration-500 ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <Header
          collapsed={collapsed} userName={userName} userCode={userCode}
          initials={initials} logo={vanLogo} theme={theme}
        />

        <div className="pt-16 flex-1 p-8 overflow-auto ds-scroll">
          <div className="p-8 w-full max-w-[1600px] mx-auto mt-6">
            {showSkeleton ? (
              <RebateProgramListSkeleton />
            ) : (
              <RebateProgramList
                rebates={rebates}
                filteredRebates={filteredRebates}
                rebateSearchTerm={rebateSearchTerm}
                setRebateSearchTerm={setRebateSearchTerm}
                selectedRebateTypeFilter={selectedRebateTypeFilter}
                setSelectedRebateTypeFilter={setSelectedRebateTypeFilter}
                selectedRebateStatusFilter={selectedRebateStatusFilter}
                setSelectedRebateStatusFilter={setSelectedRebateStatusFilter}
                rebateDateFrom={rebateDateFrom} setRebateDateFrom={setRebateDateFrom}
                rebateDateTo={rebateDateTo} setRebateDateTo={setRebateDateTo}
                currentPage={currentPage} setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage} theme={theme}
                onRebateClick={handleRebateClick}
                onStatusToggle={handleStatusToggle}
                onClearFilters={clearRebateFilters}
                onApplyFilters={() => {}}
                onLoadRebates={loadRebates}
              />
            )}
          </div>
        </div>
      </main>

      <RebateDetailsModal
        selectedRebate={selectedRebate}
        setSelectedRebate={setSelectedRebate}
        rebateDetails={rebateDetails}
        setRebateDetails={setRebateDetails}
        originalRebateDetails={originalRebateDetails}
        setOriginalRebateDetails={setOriginalRebateDetails}
        editingCustomers={editingCustomers}
        setEditingCustomers={setEditingCustomers}
        editingItems={editingItems}
        setEditingItems={setEditingItems}
        theme={theme}
        routePath="/Van_RebatePrograms"
        renderFixedCustomerTable={renderFixedCustomerTable}
        renderIncrementalCustomerTable={renderIncrementalCustomerTable}
        renderPercentageCustomerTable={renderPercentageCustomerTable}
        renderFixedItemsTable={renderFixedItemsTable}
        renderIncrementalItemsTable={renderIncrementalItemsTable}
        renderPercentageItemsTable={renderPercentageItemsTable}
      />
    </DesignPage>
  );
}

export default Van_RebatePrograms;