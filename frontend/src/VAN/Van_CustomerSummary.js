// src/VAN/Van_StatusSummary.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft } from "lucide-react";
import { useTheme } from '../context/ThemeContext';
import vanLogo from "../assets/van.png";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import StatusSummary from "../components/Dashboard/StatusSummary/StatusSummary";
import CustomerLedgerModal from "../components/Dashboard/StatusSummary/CustomerLedgerModal";
import VcpTransactionRecords from "../components/Dashboard/StatusSummary/VcpTransactionRecords";
import { ToastContainer, useToast } from "../components/common/Toast";
import useAccessControl from '../hooks/useAccessControl';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import { APPLE, dashTokens, DASH_FONT } from "../components/Dashboard/StatusSummary/customerLedgerUtils";

const API_BASE = 'http://192.168.100.193:3009';

/* ──────────────────────────────────────────────────────────────────────
   Skeleton primitives — replace spinner/text "Loading…" states.
   ────────────────────────────────────────────────────────────────────── */
const SKELETON_CSS = `
@keyframes vanSkelShimmer {
  0%   { background-position: -800px 0; }
  100% { background-position:  800px 0; }
}
.van-skel {
  display: block;
  border-radius: 6px;
  background-size: 1600px 100%;
  animation: vanSkelShimmer 1.5s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .van-skel { animation: none; }
}
`;

function useSkeletonPalette(isDark) {
  return {
    base: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.06)',
    hi:   isDark ? 'rgba(255,255,255,0.13)' : 'rgba(17,24,39,0.12)',
  };
}

function Skel({ isDark, w = '100%', h = 12, radius = 6, style }) {
  const { base, hi } = useSkeletonPalette(isDark);
  return (
    <span
      className="van-skel"
      style={{
        width:  typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        borderRadius: radius,
        backgroundImage: `linear-gradient(90deg, ${base} 0%, ${hi} 50%, ${base} 100%)`,
        ...style,
      }}
    />
  );
}

/* Skeleton matching the StatusSummary table layout */
function StatusSummarySkeleton({ isDark, K }) {
  const rows = 8;
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: K.glassDeep, borderColor: K.rim, boxShadow: K.shadow }}
    >
      {/* Filter toolbar */}
      <div
        className="px-6 py-5 border-b flex flex-wrap items-center gap-3"
        style={{ borderColor: K.hairline }}
      >
        <Skel isDark={isDark} w={220} h={36} radius={10} />
        <Skel isDark={isDark} w={150} h={36} radius={10} />
        <Skel isDark={isDark} w={150} h={36} radius={10} />
        <Skel isDark={isDark} w={150} h={36} radius={10} />
        <div className="flex-1" />
        <Skel isDark={isDark} w={110} h={36} radius={10} />
      </div>

      {/* Table head */}
      <div
        className="px-6 py-4 flex items-center gap-4"
        style={{ borderBottom: `1px solid ${K.hairline}` }}
      >
        <Skel isDark={isDark} w="24%" h={10} />
        <Skel isDark={isDark} w="16%" h={10} />
        <Skel isDark={isDark} w="18%" h={10} />
        <Skel isDark={isDark} w="14%" h={10} />
        <Skel isDark={isDark} w="14%" h={10} />
        <Skel isDark={isDark} w="10%" h={10} />
      </div>

      {/* Rows */}
      <div className="px-6 py-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 py-4"
            style={{ borderBottom: i < rows - 1 ? `1px solid ${K.hairline}` : 'none' }}
          >
            <div className="flex items-center gap-3" style={{ width: '24%' }}>
              <Skel isDark={isDark} w={34} h={34} radius={10} />
              <div className="flex-1 space-y-2">
                <Skel isDark={isDark} w="80%" h={11} />
                <Skel isDark={isDark} w="55%" h={9} />
              </div>
            </div>
            <Skel isDark={isDark} w="16%" h={11} />
            <Skel isDark={isDark} w="18%" h={11} />
            <Skel isDark={isDark} w="14%" h={22} radius={999} />
            <Skel isDark={isDark} w="14%" h={11} />
            <Skel isDark={isDark} w="10%" h={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Skeleton matching the VcpTransactionRecords table layout */
function TransactionsSkeleton({ isDark, K }) {
  const rows = 10;
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-4 px-2">
        {[120, 140, 110, 130, 100, 90].map((w, i) => (
          <Skel key={i} isDark={isDark} w={w} h={10} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 rounded-xl"
            style={{ background: K.chipBg, border: `1px solid ${K.hairline}` }}
          >
            <Skel isDark={isDark} w="18%" h={11} />
            <Skel isDark={isDark} w="14%" h={11} />
            <Skel isDark={isDark} w="22%" h={11} />
            <Skel isDark={isDark} w="12%" h={11} />
            <Skel isDark={isDark} w="16%" h={11} />
            <Skel isDark={isDark} w="10%" h={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Van_CustomerSummary() {
  const { theme } = useTheme();
  const { toasts, showToast, removeToast } = useToast();
  const K = dashTokens(theme === 'dark');
  const routePath = '/Van_CustomerSummary';
  const { access } = useAccessControl(routePath);
  const isDark = theme === 'dark';

  useComponentRegistration({
    name: 'Van_CustomerSummary',
    version: '2.2.0',
    description: 'Customer rebate customer summary — ledger + transaction records (VAN).',
    routePath: '/Van_CustomerSummary',
  });

  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName]   = useState("");
  const [userCode, setUserCode]   = useState("");
  const [initials, setInitials]   = useState("");

  const [showVanDropdown,     setShowVanDropdown]     = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(false);

  /* Status summary state */
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("All");
  const [selectedRebateType, setSelectedRebateType] = useState("All");
  const [selectedProgressStatus, setSelectedProgressStatus] = useState("All");
  const [selectedRebateStatus, setSelectedRebateStatus] = useState("All");
  const [minRebateAmount, setMinRebateAmount] = useState("");
  const [maxRebateAmount, setMaxRebateAmount] = useState("");
  const [statusSummaryPeriodFrom, setStatusSummaryPeriodFrom] = useState("");
  const [statusSummaryPeriodTo,   setStatusSummaryPeriodTo]   = useState("");
  const [selectedProgramStatus, setSelectedProgramStatus] = useState("Active");
  const [currentCustomerPage, setCurrentCustomerPage] = useState(1);
  const [itemsPerCustomerPage, setItemsPerCustomerPage] = useState(10);

  /* ── Ledger modal ─────────────────────────────────────────────────────
     ledgerReturnCustomer remembers the customer that opened the ledger
     so the Back button on the transaction view can restore it without a
     refetch (the ledger stays mounted the whole time).                 */
  const [modalCustomer, setModalCustomer] = useState(null);
  const [ledgerReturnCustomer, setLedgerReturnCustomer] = useState(null);

  /* ── Transaction records view state ─────────────────────────────── */
  const [transactionCustomer, setTransactionCustomer]         = useState(null);
  const [transactionCurrentPage, setTransactionCurrentPage]   = useState(1);
  const [transactionRowsPerPage, setTransactionRowsPerPage]   = useState(10);
  const [periodFrom, setPeriodFrom]                           = useState('');
  const [periodTo, setPeriodTo]                               = useState('');
  const [filteredTransactions, setFilteredTransactions]       = useState([]);
  const [transactionsLoading, setTransactionsLoading]         = useState(false);

  /* Keep a ref so loadDetailedTransactionsData always reads fresh customer */
  const transactionCustomerRef = useRef(null);
  useEffect(() => { transactionCustomerRef.current = transactionCustomer; }, [transactionCustomer]);

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

  /* Load customer status */
  const loadCustomerStatus = useCallback(async () => {
    try {
      setCustomersLoading(true);
      let url = `${API_BASE}/api/van/dashboard/rebates-summary?db=VAN`;
      const params = new URLSearchParams();
      if (statusSummaryPeriodFrom) params.append('periodFrom', statusSummaryPeriodFrom);
      if (statusSummaryPeriodTo)   params.append('periodTo',   statusSummaryPeriodTo);
      if (selectedAgent !== 'All') params.append('agent',      selectedAgent);
      if (params.toString()) url += `&${params.toString()}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const summaryList = data.data.summary || [];
          if (summaryList.length === 0) { setCustomers([]); setAgents([]); return; }
          const processed = summaryList.map((item) => ({
            customer:      item.customer    || 'Unknown Customer',
            agent:         item.agent       || 'Unknown Agent',
            rebateType:    item.rebateType  || 'Unknown',
            code:          item.code        || `CUST-${Math.random().toString(36).substr(2, 5)}`,
            rebateCode:    item.rebateCode  || 'UNKNOWN-CODE',
            dateFrom:      item.dateFrom    || '',
            dateTo:        item.dateTo      || '',
            frequency:     item.frequency   || 'Quarterly',
            isActive:      item.isActive,
            progress:      item.totalAchieved || 0,
            totalAchieved: item.totalAchieved || 0,
            totalQuota:    item.totalQuota    || 0,
            quotaStatus:   item.quotaStatus   || 'Starting',
            rebate:        item.rebateStatus  || 'Not Eligible',
            rebateAmount:  parseFloat(item.rebateAmount)  || 0,
            paidAmount:    parseFloat(item.paidAmount)    || 0,
            rebateBalance: parseFloat(item.rebateBalance) || 0,
            enrollment:    item.enrollment || new Date().toISOString().split('T')[0],
            color:         item.color      || `#${Math.floor(Math.random() * 16777215).toString(16)}`,
            quotas:        item.quotas     || {},
            ranges:        item.ranges     || [],
            itemDetails:   item.itemDetails || [],
            currentRange:  item.currentRange || null,
            createdDate:   item.createdDate  || new Date().toISOString(),
          }));
          const sorted = processed.sort((a, b) => {
            const dateA = new Date(a.createdDate || a.enrollment);
            const dateB = new Date(b.createdDate || b.enrollment);
            return dateB - dateA;
          });
          const uniqueAgents = [...new Set(sorted.map(c => c.agent))].filter(a => a && a !== 'Unknown Agent');
          setCustomers(sorted);
          setAgents(uniqueAgents);
        } else { setCustomers([]); setAgents([]); }
      } else { setCustomers([]); setAgents([]); }
    } catch (e) {
      console.error('Error loading customer status:', e);
      setCustomers([]); setAgents([]);
    } finally {
      setCustomersLoading(false);
    }
  }, [statusSummaryPeriodFrom, statusSummaryPeriodTo, selectedAgent]);

  useEffect(() => { if (userName) loadCustomerStatus(); }, [userName, loadCustomerStatus]);

  /* filteredCustomers */
  const filteredCustomers = customers
    .filter((c) => {
      const matchesAgent = selectedAgent === "All" || c.agent === selectedAgent;
      const matchesRebateType = selectedRebateType === "All" || c.rebateType === selectedRebateType;
      const matchesProgressStatus = selectedProgressStatus === "All" || c.quotaStatus === selectedProgressStatus;
      const matchesRebateStatus = selectedRebateStatus === "All" || c.rebate === selectedRebateStatus;
      const matchesMinAmount = minRebateAmount === "" || (c.rebateAmount || 0) >= parseFloat(minRebateAmount);
      const matchesMaxAmount = maxRebateAmount === "" || (c.rebateAmount || 0) <= parseFloat(maxRebateAmount);
      const matchesDateFrom = !statusSummaryPeriodFrom || new Date(c.enrollment) >= new Date(statusSummaryPeriodFrom);
      const matchesDateTo   = !statusSummaryPeriodTo   || new Date(c.enrollment) <= new Date(statusSummaryPeriodTo);
      const matchesSearch = !searchTerm.trim() ||
        c.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.rebateType.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesAgent && matchesRebateType && matchesProgressStatus && matchesRebateStatus &&
        matchesMinAmount && matchesMaxAmount && matchesDateFrom && matchesDateTo && matchesSearch;
    })
    .sort((a, b) => new Date(b.enrollment) - new Date(a.enrollment));

  const clearAllFilters = () => {
    setSelectedAgent("All");
    setSelectedRebateType("All");
    setSelectedProgressStatus("All");
    setSelectedRebateStatus("All");
    setMinRebateAmount(""); setMaxRebateAmount("");
    setStatusSummaryPeriodFrom(""); setStatusSummaryPeriodTo("");
    setSearchTerm("");
    setSelectedProgramStatus("All");
    showToast("All filters cleared!", "success");
  };
  const applyFilters = () => { showToast("Filters applied successfully!", "success"); };

  /* Row click just hands the raw row to the modal */
  const handleCustomerClick = (customer) => setModalCustomer(customer);

  /* ─────────────────────────────────────────────────────────────────────────
     Load the detailed transactions for the active transactionCustomer.
     ───────────────────────────────────────────────────────────────────────── */
  const loadDetailedTransactionsData = useCallback(async (silent = false) => {
    const cust = transactionCustomerRef.current;
    if (!cust) return;
    if (!silent) setTransactionsLoading(true);
    try {
      const code       = cust.code || cust.customerCode;
      const rebateCode = cust.rebateCode || cust.rebateCodes?.[0] || '';
      const rebateType = cust.rebateType || '';
      const params = new URLSearchParams({ db: 'VAN' });
      if (rebateCode) params.append('rebateCode', rebateCode);
      if (rebateType) params.append('rebateType', rebateType);
      if (periodFrom) params.append('periodFrom', periodFrom);
      if (periodTo)   params.append('periodTo',   periodTo);

      const url = `${API_BASE}/api/van/dashboard/customer/${encodeURIComponent(code)}/transactions?${params.toString()}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.success) {
        const rows = json.data?.transactions || json.data || [];
        setFilteredTransactions(Array.isArray(rows) ? rows : []);
      } else {
        setFilteredTransactions([]);
      }
    } catch (e) {
      console.error('[Van_StatusSummary] loadDetailedTransactionsData failed:', e);
      setFilteredTransactions([]);
    } finally {
      if (!silent) setTransactionsLoading(false);
    }
  }, [periodFrom, periodTo]);

  /* Reload whenever the period range changes while the transaction view is open */
  useEffect(() => {
    if (!transactionCustomer) return;
    if (!periodFrom && !periodTo) return;   // wait until dates are set
    loadDetailedTransactionsData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFrom, periodTo]);

  /* ─────────────────────────────────────────────────────────────────────────
     "Transactions" clicked inside the CustomerLedgerModal.

     IMPORTANT: We deliberately DO NOT close the ledger here. It stays
     mounted behind the transaction modal (z-[60] vs. its z-50), so when
     the user clicks "← Ledger" the ledger reappears instantly with all
     of its already-fetched data — no refetch, no year reset, no scroll
     loss.
     ───────────────────────────────────────────────────────────────────────── */
  const handleViewTransactionsFromLedger = (payload) => {
    const {
      customer,
      customerCode,
      customerName,
      customerAgent,
      rebateCodes,
      fallbackRebateCode,
      fallbackRebateType,
    } = payload;

    // Remember the customer so the Back button can restore the ledger view
    if (customer) setLedgerReturnCustomer(customer);

    // ⚠️ Note: we do NOT call setModalCustomer(null) — the ledger stays mounted.

    // Build the customer object the transaction view consumes
    const nextCustomer = {
      ...(customer || {}),
      code:        customerCode || customer?.code,
      customer:    customerName || customer?.customer,
      agent:       customerAgent || customer?.agent,
      rebateCode:  fallbackRebateCode || customer?.rebateCode || rebateCodes?.[0],
      rebateType:  fallbackRebateType || customer?.rebateType,
      rebateCodes: rebateCodes || customer?.rebateCodes || [],
    };

    setTransactionCustomer(nextCustomer);
    transactionCustomerRef.current = nextCustomer;

    // Reset pagination + period, then seed period from the rebate window
    setTransactionCurrentPage(1);
    setFilteredTransactions([]);

    const from =
      nextCustomer.dateFrom ||
      nextCustomer.details?.rebateDetails?.dateFrom ||
      nextCustomer.details?.dateRange?.periodFrom ||
      null;
    const to =
      nextCustomer.dateTo ||
      nextCustomer.details?.rebateDetails?.dateTo ||
      nextCustomer.details?.dateRange?.periodTo ||
      null;

    if (from && to) {
      setPeriodFrom(String(from).split('T')[0]);
      setPeriodTo(String(to).split('T')[0]);
    } else {
      const today  = new Date();
      const qStart = Math.floor(today.getMonth() / 3) * 3;
      const qEnd   = qStart + 2;
      setPeriodFrom(new Date(today.getFullYear(), qStart, 1).toISOString().split('T')[0]);
      setPeriodTo(new Date(today.getFullYear(), qEnd + 1, 0).toISOString().split('T')[0]);
    }
  };

  /* Close ONLY the transaction view. The ledger is still mounted underneath. */
  const closeTransactionView = () => {
    setTransactionCustomer(null);
    transactionCustomerRef.current = null;
    setFilteredTransactions([]);
    setPeriodFrom('');
    setPeriodTo('');
    setTransactionCurrentPage(1);
  };

  /* ← Ledger button → close only the transaction view.
     The ledger reappears instantly with its previous state intact. */
  const handleBackToLedger = () => {
    closeTransactionView();
  };

  /* X button on the transaction modal → close EVERYTHING (transactions + ledger). */
  const handleCloseAll = () => {
    closeTransactionView();
    setModalCustomer(null);
    setLedgerReturnCustomer(null);
  };

  /* Ledger's own X button → close ledger + clear the return reference. */
  const handleCloseLedger = () => {
    setModalCustomer(null);
    setLedgerReturnCustomer(null);
  };

  /* Show the summary skeleton only on the very first load, so the 3 s
     auto-refresh doesn't flash skeletons over already-visible data. */
  const showSummarySkeleton = customersLoading && customers.length === 0;

  return (
    <div className="dash-page flex min-h-screen w-full" style={{ background: K.bg, color: K.ink }}>
      <style>{DASH_FONT}{SKELETON_CSS}</style>

      <div className="pointer-events-none fixed inset-0" style={{
        backgroundImage: `
          radial-gradient(700px circle at 8% 0%, ${APPLE.blue}${theme === 'dark' ? "26" : "30"}, transparent 55%),
          radial-gradient(650px circle at 92% 10%, ${APPLE.green}${theme === 'dark' ? "1a" : "20"}, transparent 55%)
        `, zIndex: 0,
      }} />

      <ToastContainer toasts={toasts} removeToast={removeToast} isDark={theme === 'dark'} />

      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown} setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown} setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main className={`relative flex-1 flex flex-col min-h-screen transition-all duration-500 ${collapsed ? "ml-20" : "ml-64"}`} style={{ zIndex: 1 }}>
        <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={vanLogo} theme={theme} />

        <div className="pt-16 flex-1 p-8 overflow-auto dash-scroll">
          <div className="relative p-8 w-full max-w-[1600px] mx-auto mt-6">
            <StatusSummary
              customers={customers}
              filteredCustomers={filteredCustomers}
              agents={agents}
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
              selectedRebateType={selectedRebateType} setSelectedRebateType={setSelectedRebateType}
              selectedProgressStatus={selectedProgressStatus} setSelectedProgressStatus={setSelectedProgressStatus}
              selectedRebateStatus={selectedRebateStatus} setSelectedRebateStatus={setSelectedRebateStatus}
              minRebateAmount={minRebateAmount} setMinRebateAmount={setMinRebateAmount}
              maxRebateAmount={maxRebateAmount} setMaxRebateAmount={setMaxRebateAmount}
              statusSummaryPeriodFrom={statusSummaryPeriodFrom} setStatusSummaryPeriodFrom={setStatusSummaryPeriodFrom}
              statusSummaryPeriodTo={statusSummaryPeriodTo} setStatusSummaryPeriodTo={setStatusSummaryPeriodTo}
              currentCustomerPage={currentCustomerPage} setCurrentCustomerPage={setCurrentCustomerPage}
              itemsPerCustomerPage={itemsPerCustomerPage}
              theme={theme}
              onCustomerClick={handleCustomerClick}
              onClearFilters={clearAllFilters}
              onApplyFilters={applyFilters}
              onFetchData={loadCustomerStatus}
              fetchIntervalMs={3000}
              autoFetchEnabled={!modalCustomer && !transactionCustomer}
              isLoading={false}                 /* ← child spinner suppressed; skeleton handles it */
              selectedProgramStatus={selectedProgramStatus}
              setSelectedProgramStatus={setSelectedProgramStatus}
              showStatus={true}
            />

            {/* Skeleton overlay on first load (kept as overlay so StatusSummary never unmounts
                and its polling / filter state is preserved) */}
            {showSummarySkeleton && (
              <div
                className="absolute inset-0 p-8"
                style={{ background: K.bg, zIndex: 5 }}
                aria-busy="true"
                aria-live="polite"
              >
                <StatusSummarySkeleton isDark={isDark} K={K} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Customer Ledger Modal ─────────────────────────────────────────
          NOTE: This stays mounted while the transaction view is open on top
          of it, so returning to it never triggers a refetch.            */}
      {modalCustomer && (
        <CustomerLedgerModal
          customer={modalCustomer}
          db="VAN"
          apiBase={API_BASE}
          theme={theme}
          onClose={handleCloseLedger}
          onViewTransactions={handleViewTransactionsFromLedger}
        />
      )}

      {/* ── Transaction Records Modal ───────────────────────────────────── */}
      {transactionCustomer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{
            backgroundColor: isDark ? "rgba(10,10,14,0.7)" : "rgba(0,0,0,0.45)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
          onClick={closeTransactionView}
        >
          <div
            className="w-full max-w-[1500px] h-[92vh] rounded-[24px] overflow-hidden border flex flex-col relative"
            style={{
              background: K.glassDeep,
              borderColor: K.rim,
              boxShadow: K.shadow,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button — closes EVERYTHING (transactions + ledger) */}
            <button
              onClick={handleCloseAll}
              className="absolute right-4 top-4 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all"
              style={{ background: K.chipBg, color: K.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
              title="Close"
            >
              <X size={16} />
            </button>

            {/* Header strip: Back-to-Ledger + identity + period range */}
            <div
              className="flex-shrink-0 px-6 py-4 border-b flex items-center justify-between gap-4"
              style={{
                borderColor: K.hairline,
                background: `linear-gradient(135deg, ${APPLE.blue}0a 0%, ${APPLE.purple}0a 100%)`,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* ← Back to Ledger button */}
                <button
                  onClick={handleBackToLedger}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: K.chipBg,
                    color: K.ink,
                    border: `1px solid ${K.hairline}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = K.hairline;
                    e.currentTarget.style.transform = 'translateX(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = K.chipBg;
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                  title="Back to Customer Ledger"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>

                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: K.muted }}>
                    Transaction Records
                  </p>
                  <h2 className="text-lg font-bold truncate leading-tight" style={{ color: K.ink, letterSpacing: '-0.02em' }}>
                    {transactionCustomer.customer || transactionCustomer.customerName || 'Unknown Customer'}
                  </h2>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: K.muted }}>
                    {transactionCustomer.code || transactionCustomer.customerCode}
                    {transactionCustomer.agent && transactionCustomer.agent !== 'Unknown Agent' && (
                      <span style={{ color: K.faint }}> · {transactionCustomer.agent}</span>
                    )}
                    {transactionCustomer.rebateCode && (
                      <span style={{ color: K.faint }}> · {transactionCustomer.rebateCode}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction records body — VcpTransactionRecords stays mounted so its
                auto-load effect doesn't fire in a loop; skeleton is an overlay. */}
            <div className="flex-1 min-h-0 relative" style={{ background: K.bg }}>
              <VcpTransactionRecords
                theme={theme}
                customerModalTab="transaction"
                modalCustomer={transactionCustomer}
                filteredTransactions={filteredTransactions}
                transactionCurrentPage={transactionCurrentPage}
                setTransactionCurrentPage={setTransactionCurrentPage}
                transactionRowsPerPage={transactionRowsPerPage}
                setTransactionRowsPerPage={setTransactionRowsPerPage}
                isLoading={false}                 /* ← child spinner suppressed; skeleton handles it */
                periodFrom={periodFrom}
                periodTo={periodTo}
                setPeriodFrom={setPeriodFrom}
                setPeriodTo={setPeriodTo}
                loadDetailedTransactionsData={loadDetailedTransactionsData}
                isAutoLoading={false}
                access={access}
              />

              {transactionsLoading && (
                <div
                  className="absolute inset-0 overflow-auto dash-scroll"
                  style={{ background: K.bg, zIndex: 5 }}
                  aria-busy="true"
                  aria-live="polite"
                >
                  <TransactionsSkeleton isDark={isDark} K={K} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Van_CustomerSummary;