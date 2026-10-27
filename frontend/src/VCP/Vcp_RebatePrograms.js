// src/VCP/Vcp_RebatePrograms.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Users, Blocks } from "lucide-react";
import vcpLogo from "../assets/vcp.png";
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

/* ── QTR rebate presence helper — VCP-specific ──────────────────── */
/* Returns true only when the customer carries a meaningful (non-zero)
   QTR rebate value. Treats null / '' / '0' / numeric 0 as "no value". */
const customerHasQtrRebateValue = (c) => {
  if (!c) return false;
  const v = c.qtrRebate;
  if (v == null) return false;
  if (typeof v === 'string') {
    const t = v.trim();
    return t !== '' && t !== '0' && t !== '0.00' && t !== '0.0';
  }
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0;
  if (typeof v === 'boolean') return v;
  return false;
};

function Vcp_RebatePrograms() {
  const { theme, isDark } = useTokens();
  const { toasts, showToast, removeToast } = useToast();
  const routePath = '/Vcp_RebatePrograms';
  useAccessControl(routePath);

  const componentMetadata = {
    name: 'Vcp_RebatePrograms',
    version: '1.0.0',
    description: 'View and manage VCP rebate programs, customer quotas, item ranges, and rebate per-bag values.',
    routePath: '/Vcp_RebatePrograms'
  };
  useComponentRegistration(componentMetadata);

  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName]   = useState("");
  const [userCode, setUserCode]   = useState("");
  const [initials, setInitials]   = useState("");
  const [loading, setLoading]     = useState(false);

  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(true);

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

  /* ── Auth bootstrap ─────────────────────────────────────────────── */
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

  /* ── Load rebates ───────────────────────────────────────────────── */
  const loadRebates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/vcp/dashboard/rebates?db=VCP`);
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

  /* ── Filtered rebates ───────────────────────────────────────────── */
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

  /* ── Load rebate details ────────────────────────────────────────── */
  const loadRebateDetails = async (rebateCode, customerCode = null) => {
    try {
      let url = `/api/vcp/dashboard/rebate/${rebateCode}/details?db=VCP`;
      if (customerCode) url += `&customerCode=${customerCode}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) {
        return { ...data.data, name: data.data.Name || data.data.name || '' };
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
      const response = await fetch(`/api/vcp/dashboard/rebates?db=VCP`, {
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

  /* ── Customer handlers ──────────────────────────────────────────── */
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

      const response = await fetch(`/api/vcp/dashboard/rebate/customer?db=VCP`, {
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

  /* ── Item handlers ──────────────────────────────────────────────── */
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

      const response = await fetch(`/api/vcp/dashboard/rebate/item?db=VCP`, {
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

  /* ── Shared Tailwind class constants ────────────────────────────── */
  const TH_LEFT         = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--ds-muted)]";
  const TH_CENTER       = "px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--ds-muted)]";
  const TH_LEFT_TIGHT   = "px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--ds-muted)]";
  const TH_CENTER_TIGHT = "px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--ds-muted)]";
  const THEAD_CLASS     = "sticky top-0 border-b bg-[var(--ds-glass-deep)] border-[var(--ds-hairline)] backdrop-blur-[28px]";
  const TBODY_CLASS     = "divide-y divide-[var(--ds-hairline)]";
  const TR_HOVER        = "transition-colors duration-150 hover:bg-[var(--ds-hover)]";
  const CUST_NAME       = "font-medium text-xs truncate text-[var(--ds-ink)]";
  const CODE_BADGE      = "text-xs px-1.5 py-0.5 rounded font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]";
  const INPUT_INLINE    = "px-2 py-1 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#0A84FF] bg-[var(--ds-glass-deep)] text-[var(--ds-ink)] border border-[var(--ds-hairline)]";
  const RANGE_INPUT     = "px-1 py-0.5 border rounded text-[10px] text-center bg-[var(--ds-glass-deep)] border-[var(--ds-hairline)] text-[var(--ds-ink)]";
  const EMPTY_WRAP      = "flex-1 flex items-center justify-center p-8";
  const EMPTY_ICON      = "mx-auto mb-4 text-[var(--ds-faint)]";
  const EMPTY_HEAD      = "text-lg font-semibold mb-2 text-[var(--ds-ink)]";
  const EMPTY_BODY      = "text-[var(--ds-muted)]";

  const renderEmptyCustomers = (message) => (
    <div className={EMPTY_WRAP}>
      <div className="text-center">
        <Users size={48} className={EMPTY_ICON} />
        <h5 className={EMPTY_HEAD}>No Customers Found</h5>
        <p className={EMPTY_BODY}>{message}</p>
      </div>
    </div>
  );

  const renderEmptyItems = (message) => (
    <div className={EMPTY_WRAP}>
      <div className="text-center">
        <Blocks size={48} className={EMPTY_ICON} />
        <h5 className={EMPTY_HEAD}>No Items Found</h5>
        <p className={EMPTY_BODY}>{message}</p>
      </div>
    </div>
  );

  /* ── Range colors (semantic, static) ───────────────────────────── */
  const rangeColors        = {
    1: { text: 'text-blue-600 dark:text-blue-400',       badge: 'bg-blue-500 text-white' },
    2: { text: 'text-amber-600 dark:text-amber-400',     badge: 'bg-amber-500 text-white' },
    3: { text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500 text-white' },
  };
  const rangeColorsIncremental = {
    1: { label: 'text-blue-500 dark:text-blue-400',       badge: 'bg-blue-500 text-white' },
    2: { label: 'text-amber-500 dark:text-amber-400',     badge: 'bg-amber-500 text-white' },
    3: { label: 'text-emerald-500 dark:text-emerald-400', badge: 'bg-emerald-500 text-white' },
  };

  /* ── QTR column visibility helper ─────────────────────────────── */
  const shouldShowQtrColumn = (hasQtrRebate) =>
    hasQtrRebate === true
      || (rebateDetails?.customers || []).some(customerHasQtrRebateValue);

  /* ════════════════════════════════════════════════════════════════
     RENDER: FIXED CUSTOMER TABLE
     ════════════════════════════════════════════════════════════════ */
  const renderFixedCustomerTable = ({ isWithoutQuota, hasQtrRebate } = {}) => {
    const withoutQuota = isWithoutQuota ?? (rebateDetails?.quotaType === 'Without Quota');
    const showQtrRebate = shouldShowQtrColumn(hasQtrRebate);

    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return renderEmptyCustomers('No customers are associated with this rebate program.');
    }

    if (withoutQuota) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={THEAD_CLASS}>
              <tr>
                <th className={`${TH_LEFT} min-w-[250px]`}>Customer</th>
                <th className={`${TH_LEFT} min-w-[150px]`}>Code</th>
                {showQtrRebate && (
                  <th className={`${TH_CENTER} min-w-[100px] max-w-[100px]`}>QTR Rebate</th>
                )}
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
                    {showQtrRebate && (
                      <td className="px-3 py-2 text-center align-top">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-xs text-[var(--ds-muted)]">₱</span>
                            <input type="number" value={customer.qtrRebate || 0}
                              onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)}
                              className={`w-16 ${INPUT_INLINE}`} min="0" step="0.01" />
                          </div>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded font-medium ${customer.qtrRebate > 0 ? 'bg-emerald-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>
                            ₱{(customer.qtrRebate || 0).toFixed(2)}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    /* ── With quota — build month columns ──────────────────────── */
    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const MONTH_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const addMonths = (date, n) => {
      const d = new Date(date); const day = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last)); return d;
    };
    const fmtShort = (d) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    const fmtLong  = (d) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

    const frequency = rebateDetails?.frequency || 'Quarterly';
    const dateFrom  = rebateDetails?.dateFrom || rebateDetails?.rebateDetails?.dateFrom || selectedRebate?.from;
    const dateTo    = rebateDetails?.dateTo   || rebateDetails?.rebateDetails?.dateTo   || selectedRebate?.to;

    let freqMonths = 3;
    if (frequency === 'Monthly') freqMonths = 1;
    else if (frequency === 'Semi-Annual' || frequency === 'SemiAnnual') freqMonths = 6;
    else if (frequency === 'Annual' || frequency === 'Yearly') freqMonths = 12;

    const quotaColumns = [];
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom);
      const end   = new Date(dateTo);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        let cursor = new Date(start);
        while (cursor <= end) {
          const nextStart = addMonths(cursor, 1);
          const isLast = nextStart >= end;
          const actualEnd = isLast ? new Date(end) : (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
          quotaColumns.push({
            key: `m-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
            label: `${fmtShort(cursor)} – ${fmtLong(actualEnd)}`,
            shortLabel: MONTH_SHORT[cursor.getMonth()],
            monthIndex: cursor.getMonth(),
            monthName: MONTH_LONG[cursor.getMonth()],
          });
          if (isLast) break;
          cursor = nextStart;
        }
      }
    } else if (dateFrom) {
      const start = new Date(dateFrom);
      if (!isNaN(start.getTime())) {
        let cursor = new Date(start);
        for (let i = 0; i < freqMonths; i++) {
          const nextStart = addMonths(cursor, 1);
          const actualEnd = (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
          quotaColumns.push({
            key: `m-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
            label: `${fmtShort(cursor)} – ${fmtLong(actualEnd)}`,
            shortLabel: MONTH_SHORT[cursor.getMonth()],
            monthIndex: cursor.getMonth(),
            monthName: MONTH_LONG[cursor.getMonth()],
          });
          cursor = nextStart;
        }
      }
    } else {
      const now = new Date();
      let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
      for (let i = 0; i < freqMonths; i++) {
        const nextStart = addMonths(cursor, 1);
        const actualEnd = (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
        quotaColumns.push({
          key: `m-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
          label: `${fmtShort(cursor)} – ${fmtLong(actualEnd)}`,
          shortLabel: MONTH_SHORT[cursor.getMonth()],
          monthIndex: cursor.getMonth(),
          monthName: MONTH_LONG[cursor.getMonth()],
        });
        cursor = nextStart;
      }
    }

    const getFixedQuotaValue = (customer, column, colIndex) => {
      if (!customer.quotas) return 0;
      if (Array.isArray(customer.quotas)) return Number(customer.quotas[colIndex]) || 0;
      if (typeof customer.quotas === 'object') {
        const byName = customer.quotas[column.monthName];
        if (byName !== undefined) return Number(byName) || 0;
        const numKey = colIndex + 1;
        if (customer.quotas[numKey] !== undefined) return Number(customer.quotas[numKey]) || 0;
        if (customer.quotas[String(numKey)] !== undefined) return Number(customer.quotas[String(numKey)]) || 0;
        if (customer.quotas[`Month${numKey}`] !== undefined) return Number(customer.quotas[`Month${numKey}`]) || 0;
      }
      return 0;
    };

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT} min-w-[180px]`}>Customer</th>
              <th className={`${TH_LEFT} min-w-[100px]`}>Code</th>
              {quotaColumns.map(col => (
                <th key={col.key} className={`${TH_CENTER} min-w-[100px] whitespace-nowrap`}>
                  {col.label}
                </th>
              ))}
              {showQtrRebate && (
                <th className={`${TH_CENTER} min-w-[100px]`}>QTR Rebate</th>
              )}
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.customers.map((customer, i) => {
              const customerCode = customer.code || `CUST-${i}`;
              const isEditing = editingCustomers[customerCode] || false;
              return (
                <tr key={i} className={TR_HOVER}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md text-white flex items-center justify-center font-medium text-xs flex-shrink-0" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                        {(customer.name && customer.name.charAt(0)) || '?'}
                      </div>
                      <span className={CUST_NAME}>{customer.name || 'Unknown Customer'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className={CODE_BADGE}>{customer.code || 'N/A'}</code>
                  </td>
                  {quotaColumns.map((col, colIdx) => {
                    const v = getFixedQuotaValue(customer, col, colIdx);
                    return (
                      <td key={col.key} className="px-3 py-2 text-center align-top">
                        {isEditing ? (
                          <input type="number" value={v}
                            onChange={(e) => handleCustomerQuotaChange(customer.code, colIdx, e.target.value)}
                            className={`w-16 ${INPUT_INLINE}`} min="0" step="1" />
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded font-medium ${v > 0 ? 'bg-blue-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>{v}</span>
                        )}
                      </td>
                    );
                  })}
                  {showQtrRebate && (
                    <td className="px-3 py-2 text-center align-top">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="text-xs text-[var(--ds-muted)]">₱</span>
                          <input type="number" value={customer.qtrRebate || 0}
                            onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)}
                            className={`w-16 ${INPUT_INLINE}`} min="0" step="0.01" />
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${customer.qtrRebate > 0 ? 'bg-emerald-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>
                          ₱{(customer.qtrRebate || 0).toFixed(2)}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER: INCREMENTAL CUSTOMER TABLE (grid-based ranges)
     ════════════════════════════════════════════════════════════════ */
  const renderIncrementalCustomerTable = ({ isWithoutQuota, hasQtrRebate } = {}) => {
    const withoutQuota = isWithoutQuota ?? (rebateDetails?.quotaType === 'Without Quota');
    const showQtrRebate = shouldShowQtrColumn(hasQtrRebate);

    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return renderEmptyCustomers('No customers are associated with this rebate program.');
    }

    if (withoutQuota) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={THEAD_CLASS}>
              <tr>
                <th className={TH_LEFT_TIGHT}>Customer</th>
                <th className={TH_LEFT_TIGHT}>Code</th>
                {showQtrRebate && (
                  <th className={TH_CENTER_TIGHT}>Qtr Rebate</th>
                )}
              </tr>
            </thead>
            <tbody className={TBODY_CLASS}>
              {rebateDetails.customers.map((customer) => (
                <tr key={customer.code} className={TR_HOVER}>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md text-white flex items-center justify-center font-semibold text-xs" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                        {customer.name?.charAt(0) || '?'}
                      </div>
                      <span className={CUST_NAME}>{customer.name || 'Unknown Customer'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className={`text-xs px-2 py-0.5 rounded font-semibold border bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border-[var(--ds-hairline)]`}>{customer.code || 'N/A'}</code>
                  </td>
                  {showQtrRebate && (
                    <td className="px-4 py-3 text-center">
                      {editingCustomers[customer.code] ? (
                        <input type="number" value={customer.qtrRebate || 0}
                          onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)}
                          className={`w-20 ${INPUT_INLINE}`} />
                      ) : (
                        <span className="text-xs px-3 py-1 rounded-lg font-bold inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                          {customer.qtrRebate || 0}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    const getRangeGridCols = (count) => {
      if (!count || count <= 1) return 1;
      if (count <= 4) return count;
      return 3;
    };

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT_TIGHT} min-w-[180px]`}>Customer</th>
              <th className={`${TH_LEFT_TIGHT} min-w-[100px]`}>Code</th>
              {showQtrRebate && (
                <th className={`${TH_CENTER_TIGHT} min-w-[100px]`}>Qtr Rebate</th>
              )}
              <th className={TH_CENTER_TIGHT}>Quantity Ranges</th>
              <th className={TH_CENTER_TIGHT}>Rebate Per Unit</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.customers.map((customer) => {
              const ranges = customer.ranges || [];
              const rangeCols = getRangeGridCols(ranges.length);
              return (
                <tr key={customer.code} className={TR_HOVER}>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md text-white flex items-center justify-center font-semibold text-xs" style={{ backgroundColor: customer.color || '#3b82f6' }}>
                        {customer.name?.charAt(0) || '?'}
                      </div>
                      <span className={CUST_NAME}>{customer.name || 'Unknown Customer'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs px-2 py-0.5 rounded font-semibold border bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border-[var(--ds-hairline)]">{customer.code || 'N/A'}</code>
                  </td>
                  {showQtrRebate && (
                    <td className="px-4 py-3 text-center">
                      {editingCustomers[customer.code] ? (
                        <input type="number" value={customer.qtrRebate || 0}
                          onChange={(e) => handleCustomerQtrRebateChange(customer.code, e.target.value)}
                          className={`w-16 ${INPUT_INLINE}`} />
                      ) : (
                        <span className="text-xs px-3 py-1 rounded-lg font-bold inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                          {customer.qtrRebate || 0}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 align-middle">
                    <div
                      className="grid gap-x-2 gap-y-1.5 justify-items-center"
                      style={{ gridTemplateColumns: `repeat(${rangeCols}, minmax(0, 1fr))` }}
                    >
                      {ranges.map((range, rangeIndex) => {
                        const colors = rangeColorsIncremental[range.rangeNo] || rangeColorsIncremental[1];
                        return (
                          <div key={rangeIndex} className="flex items-center gap-0.5 whitespace-nowrap">
                            <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${colors.badge}`}>R{range.rangeNo}</span>
                            {editingCustomers[customer.code] ? (
                              <>
                                <input type="number" value={range.minQty || 0}
                                  onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'minQty', e.target.value)}
                                  className={`w-10 ${RANGE_INPUT}`} />
                                <span className="text-[9px] text-[var(--ds-faint)]">–</span>
                                <input type="number" value={range.maxQty || 0}
                                  onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'maxQty', e.target.value)}
                                  className={`w-10 ${RANGE_INPUT}`} />
                              </>
                            ) : (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colors.label} bg-[var(--ds-chip-bg)] border-[var(--ds-hairline)]`}>
                                {range.minQty ?? 0}–{range.maxQty ?? 0}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div
                      className="grid gap-x-2 gap-y-1.5 justify-items-center"
                      style={{ gridTemplateColumns: `repeat(${rangeCols}, minmax(0, 1fr))` }}
                    >
                      {ranges.map((range, rangeIndex) => {
                        const colors = rangeColorsIncremental[range.rangeNo] || rangeColorsIncremental[1];
                        return (
                          <div key={rangeIndex} className="flex items-center gap-0.5 whitespace-nowrap">
                            <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${colors.badge}`}>R{range.rangeNo}</span>
                            {editingCustomers[customer.code] ? (
                              <input type="number" value={range.rebatePerBag || 0}
                                onChange={(e) => handleCustomerRangeChange(customer.code, rangeIndex, 'rebatePerBag', e.target.value)}
                                className={`w-10 ${RANGE_INPUT}`} />
                            ) : (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colors.label} bg-[var(--ds-chip-bg)] border-[var(--ds-hairline)]`}>
                                {range.rebatePerBag ?? 0}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
     RENDER: PERCENTAGE CUSTOMER TABLE
     ════════════════════════════════════════════════════════════════ */
  const renderPercentageCustomerTable = ({ isWithoutQuota, hasQtrRebate } = {}) => {
    const withoutQuota = isWithoutQuota ?? (rebateDetails?.quotaType === 'Without Quota');
    const showQtrRebate = shouldShowQtrColumn(hasQtrRebate);

    if (!rebateDetails?.customers || rebateDetails.customers.length === 0) {
      return renderEmptyCustomers('No customers are associated with this Percentage rebate program.');
    }

    const hasQuotas = !withoutQuota && rebateDetails.customers.some((c) => {
      if (Array.isArray(c.quotaDetails) && c.quotaDetails.some(q => Number(q.targetQty) > 0)) return true;
      if (Array.isArray(c.quotas) && c.quotas.some(q => Number(q) > 0)) return true;
      return false;
    });

    const frequency = rebateDetails?.frequency || 'Quarterly';
    const dateFrom = rebateDetails?.dateFrom || rebateDetails?.rebateDetails?.dateFrom || selectedRebate?.from;
    const dateTo   = rebateDetails?.dateTo   || rebateDetails?.rebateDetails?.dateTo   || selectedRebate?.to;

    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const MONTH_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const addMonths = (date, n) => {
      const d = new Date(date); const day = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last)); return d;
    };
    const fmtShort = (d) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    const fmtLong  = (d) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

    let freqMonths = 3;
    if (frequency === 'Monthly') freqMonths = 1;
    else if (frequency === 'Semi-Annual' || frequency === 'SemiAnnual') freqMonths = 6;
    else if (frequency === 'Annual' || frequency === 'Yearly') freqMonths = 12;

    const quotaColumns = [];
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom), end = new Date(dateTo);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        let cursor = new Date(start);
        while (cursor <= end) {
          const nextStart = addMonths(cursor, 1);
          const isLast = nextStart >= end;
          const actualEnd = isLast ? new Date(end) : (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
          quotaColumns.push({
            key: `m-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
            label: `${fmtShort(cursor)} – ${fmtLong(actualEnd)}`,
            shortLabel: MONTH_SHORT[cursor.getMonth()],
            monthIndex: cursor.getMonth(),
          });
          if (isLast) break;
          cursor = nextStart;
        }
      }
    } else if (dateFrom) {
      let cursor = new Date(dateFrom);
      for (let i = 0; i < freqMonths; i++) {
        const nextStart = addMonths(cursor, 1);
        const actualEnd = (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
        quotaColumns.push({
          key: `m-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
          label: `${fmtShort(cursor)} – ${fmtLong(actualEnd)}`,
          shortLabel: MONTH_SHORT[cursor.getMonth()],
          monthIndex: cursor.getMonth(),
        });
        cursor = nextStart;
      }
    } else {
      const now = new Date();
      let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
      for (let i = 0; i < freqMonths; i++) {
        const nextStart = addMonths(cursor, 1);
        const actualEnd = (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
        quotaColumns.push({
          key: `m-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
          label: `${fmtShort(cursor)} – ${fmtLong(actualEnd)}`,
          shortLabel: MONTH_SHORT[cursor.getMonth()],
          monthIndex: cursor.getMonth(),
        });
        cursor = nextStart;
      }
    }

    const getPercentageQuotaValue = (customer, column, colIndex) => {
      if (Array.isArray(customer.quotaDetails) && customer.quotaDetails.length > 0) {
        const match = customer.quotaDetails.find(q => {
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
                {showQtrRebate && (
                  <th className={`${TH_CENTER} min-w-[100px]`}>QTR Rebate</th>
                )}
              </tr>
            </thead>
            <tbody className={TBODY_CLASS}>
              {rebateDetails.customers.map((customer, index) => {
                const customerCode = customer.code || `CUST-${index}`;
                const isEditing = editingCustomers[customerCode] || false;
                return (
                  <tr key={index} className={TR_HOVER}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md text-white flex items-center justify-center text-xs" style={{ backgroundColor: customer.color || '#10b981' }}>
                          {customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className={CUST_NAME}>{customer.name || 'Unknown Customer'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <code className={CODE_BADGE}>{customerCode}</code>
                    </td>
                    {showQtrRebate && (
                      <td className="px-3 py-2 text-center">
                        {isEditing ? (
                          <input type="number" value={customer.qtrRebate || 0}
                            onChange={(e) => handleCustomerQtrRebateChange(customerCode, e.target.value)}
                            className={`w-16 ${INPUT_INLINE}`} />
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded font-medium ${customer.qtrRebate > 0 ? 'bg-blue-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>
                            ₱{parseFloat(customer.qtrRebate || 0).toFixed(2)}
                          </span>
                        )}
                      </td>
                    )}
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
              {quotaColumns.map(col => (
                <th key={col.key} className={`${TH_CENTER} min-w-[150px] whitespace-nowrap`}>
                  {col.label}
                </th>
              ))}
              {showQtrRebate && (
                <th className={`${TH_CENTER} min-w-[100px]`}>QTR Rebate</th>
              )}
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.customers.map((customer, index) => {
              const customerCode = customer.code || `CUST-${index}`;
              const isEditing = editingCustomers[customerCode] || false;
              const qtrRebate = customer.qtrRebate !== undefined ? customer.qtrRebate : 0;
              return (
                <tr key={index} className={TR_HOVER}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md text-white flex items-center justify-center text-xs" style={{ backgroundColor: customer.color || '#10b981' }}>
                        {(customer.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className={CUST_NAME}>{customer.name || 'Unknown Customer'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <code className={CODE_BADGE}>{customerCode}</code>
                  </td>
                  {quotaColumns.map((col, colIdx) => {
                    const v = getPercentageQuotaValue(customer, col, colIdx);
                    return (
                      <td key={col.key} className="px-3 py-2 text-center">
                        {isEditing ? (
                          <input type="number" value={v}
                            onChange={(e) => handleCustomerQuotaChange(customerCode, colIdx, e.target.value)}
                            className={`w-16 ${INPUT_INLINE}`} min="0" />
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded font-medium ${v > 0 ? 'bg-emerald-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>{v}</span>
                        )}
                      </td>
                    );
                  })}
                  {showQtrRebate && (
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <input type="number" value={qtrRebate}
                          onChange={(e) => handleCustomerQtrRebateChange(customerCode, e.target.value)}
                          className={`w-16 ${INPUT_INLINE}`} />
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${qtrRebate > 0 ? 'bg-blue-500 text-white' : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]'}`}>
                          ₱{parseFloat(qtrRebate).toFixed(2)}
                        </span>
                      )}
                    </td>
                  )}
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
              <th className={`${TH_LEFT} min-w-[180px]`}>Item</th>
              <th className={`${TH_LEFT} min-w-[100px]`}>Code</th>
              <th className={`${TH_CENTER} min-w-[100px]`}>Qty Per Unit</th>
              <th className={`${TH_CENTER} min-w-[100px]`}>Unit of Measure</th>
              <th className={`${TH_CENTER} min-w-[100px]`}>Rebate Per Unit</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.items.map((item, idx) => {
              const rebatePerBagValue = item.rebatePerBag || item.rebate || 0;
              return (
                <tr key={idx} className={TR_HOVER}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[#0A84FF]/15">
                        <Blocks size={10} className="text-[#0A84FF]" />
                      </div>
                      <span className={CUST_NAME}>{item.description}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <code className={CODE_BADGE}>{item.code}</code>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {editingItems[item.code] ? (
                      <input type="number" value={item.unitPerQty}
                        onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)}
                        className={`w-12 ${INPUT_INLINE}`} />
                    ) : (
                      <span className="text-xs px-2 py-1 rounded font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.unitPerQty}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {editingItems[item.code] ? (
                      <input type="text" value={item.uom || ''}
                        onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)}
                        className={`w-20 ${INPUT_INLINE}`} />
                    ) : (
                      <span className="text-xs px-2 py-1 rounded font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.uom || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {editingItems[item.code] ? (
                      <div className="flex items-center gap-0.5 justify-center">
                        <span className="text-xs text-[var(--ds-muted)]">₱</span>
                        <input type="number" step="0.01" value={rebatePerBagValue}
                          onChange={(e) => handleItemChange(item.code, 'rebatePerBag', e.target.value)}
                          className={`w-12 ${INPUT_INLINE}`} />
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded font-medium bg-emerald-500 text-white">₱{rebatePerBagValue.toFixed(2)}</span>
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
     RENDER: INCREMENTAL ITEMS TABLE
     VCP: withQuota = quotaType !== 'Without Quota' (ranges shown only when !withQuota)
     ════════════════════════════════════════════════════════════════ */
  const renderIncrementalItemsTable = () => {
    const withQuota = rebateDetails?.quotaType !== 'Without Quota';

    if (!rebateDetails?.items || rebateDetails.items.length === 0) {
      return renderEmptyItems('No items are associated with this rebate program.');
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={THEAD_CLASS}>
            <tr>
              <th className={`${TH_LEFT} min-w-[180px]`}>Item</th>
              <th className={`${TH_LEFT} min-w-[100px]`}>Code</th>
              <th className={`${TH_CENTER} min-w-[100px]`}>Qty Per Unit</th>
              <th className={`${TH_CENTER} min-w-[100px]`}>Unit of Measure</th>
              {!withQuota && (
                <>
                  <th className={TH_CENTER}>Quantity Ranges</th>
                  <th className={TH_CENTER}>Rebates per Range</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.items.map((item) => (
              <tr key={item.code} className={TR_HOVER}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[#BF5AF2]/15">
                      <Blocks size={10} className="text-[#BF5AF2]" />
                    </div>
                    <span className={CUST_NAME}>{item.description}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <code className={CODE_BADGE}>{item.code}</code>
                </td>
                <td className="px-3 py-2 text-center">
                  {editingItems[item.code] ? (
                    <input type="number" value={item.unitPerQty}
                      onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)}
                      className={`w-14 ${INPUT_INLINE}`} />
                  ) : (
                    <span className="text-xs px-2 py-1 rounded font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.unitPerQty}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {editingItems[item.code] ? (
                    <input type="text" value={item.uom || ''}
                      onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)}
                      className={`w-20 ${INPUT_INLINE}`} />
                  ) : (
                    <span className="text-xs px-2 py-1 rounded font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.uom || '—'}</span>
                  )}
                </td>
                {!withQuota && (
                  <>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.ranges && item.ranges.map((range, rangeIndex) => {
                          const colors = rangeColorsIncremental[range.rangeNo] || rangeColorsIncremental[1];
                          return (
                            <div key={rangeIndex} className="flex flex-col items-center p-1">
                              <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium mb-1 ${colors.badge}`}>R{range.rangeNo}</div>
                              <div className="flex items-center gap-0.5">
                                {editingItems[item.code] ? (
                                  <>
                                    <input type="number" value={range.minQty || 0}
                                      onChange={(e) => handleItemRangeChange(item.code, rangeIndex, 'minQty', e.target.value)}
                                      className={`w-10 ${RANGE_INPUT}`} />
                                    <span className={`text-xs ${colors.label} px-0.5`}>–</span>
                                    <input type="number" value={range.maxQty || 0}
                                      onChange={(e) => handleItemRangeChange(item.code, rangeIndex, 'maxQty', e.target.value)}
                                      className={`w-10 ${RANGE_INPUT}`} />
                                  </>
                                ) : (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${colors.label}`}>
                                    {range.minQty || 0}–{range.maxQty || 0}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.ranges && item.ranges.map((range, rangeIndex) => {
                          const colors = rangeColorsIncremental[range.rangeNo] || rangeColorsIncremental[1];
                          return (
                            <div key={rangeIndex} className="flex flex-col items-center p-1">
                              <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium mb-1 ${colors.badge}`}>R{range.rangeNo}</div>
                              {editingItems[item.code] ? (
                                <input type="number" value={range.rebatePerBag || 0}
                                  onChange={(e) => handleItemRangeChange(item.code, rangeIndex, 'rebatePerBag', e.target.value)}
                                  className={`w-12 ${RANGE_INPUT}`} />
                              ) : (
                                <span className={`text-xs px-2 py-0.5 rounded ${colors.label}`}>₱{range.rebatePerBag || 0}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </>
                )}
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
              <th className={`${TH_LEFT} min-w-[180px]`}>Item</th>
              <th className={`${TH_LEFT} min-w-[100px]`}>Code</th>
              <th className={`${TH_CENTER} min-w-[100px]`}>Qty Per Unit</th>
              <th className={`${TH_CENTER} min-w-[100px]`}>Unit of Measure</th>
              <th className={`${TH_CENTER} min-w-[100px]`}>Percentage</th>
            </tr>
          </thead>
          <tbody className={TBODY_CLASS}>
            {rebateDetails.items.map((item, idx) => (
              <tr key={idx} className={TR_HOVER}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[#32D74B]/15">
                      <Blocks size={10} className="text-[#32D74B]" />
                    </div>
                    <span className={CUST_NAME}>{item.description}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <code className={CODE_BADGE}>{item.code}</code>
                </td>
                <td className="px-3 py-2 text-center">
                  {editingItems[item.code] ? (
                    <input type="number" value={item.unitPerQty || 1}
                      onChange={(e) => handleItemChange(item.code, 'unitPerQty', e.target.value)}
                      className={`w-12 ${INPUT_INLINE}`} />
                  ) : (
                    <span className="text-xs px-2 py-1 rounded font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.unitPerQty || 1}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {editingItems[item.code] ? (
                    <input type="text" value={item.uom || ''}
                      onChange={(e) => handleItemChange(item.code, 'uom', e.target.value)}
                      className={`w-20 ${INPUT_INLINE}`} />
                  ) : (
                    <span className="text-xs px-2 py-1 rounded font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-ink)]">{item.uom || '—'}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {editingItems[item.code] ? (
                    <div className="flex items-center gap-0.5 justify-center">
                      <input type="number" value={item.percentage || 0}
                        onChange={(e) => handleItemChange(item.code, 'percentage', e.target.value)}
                        className={`w-12 ${INPUT_INLINE}`} />
                      <span className="text-xs text-[var(--ds-muted)]">%</span>
                    </div>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded font-medium bg-emerald-500 text-white">{item.percentage || 0}%</span>
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
      {/* Aurora wash — blue/green for VCP */}
      <div className="pointer-events-none fixed inset-0 z-0 ds-aurora-blue-green" />

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
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={vcpLogo}
          theme={theme}
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
        routePath="/Vcp_RebatePrograms"
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

export default Vcp_RebatePrograms;