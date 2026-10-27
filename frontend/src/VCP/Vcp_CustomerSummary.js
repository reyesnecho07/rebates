// src/VCP/Vcp_StatusSummary.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronRight } from "lucide-react";
import vcpLogo from "../assets/vcp.png";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import StatusSummary from "../components/Dashboard/StatusSummary/StatusSummary";
import CustomerLedgerModal from "../components/Dashboard/StatusSummary/CustomerLedgerModal";
import VcpTransactionRecords from "../components/Dashboard/StatusSummary/VcpTransactionRecords";
import { ToastContainer, useToast } from "../components/common/Toast";
import useAccessControl from '../hooks/useAccessControl';
import { useComponentRegistration } from '../hooks/useComponentRegistration';

/* ── Design system ──────────────────────────────────────────────── */
import {
  useTokens,
  useSkeletonStyle,
  DesignPage,
} from '../design-system';

const API_BASE = '';

/* ──────────────────────────────────────────────────────────────────────
   Skeleton primitives
   ────────────────────────────────────────────────────────────────────── */
function Skel({ w = '100%', h = 12, radius = 6, style }) {
  const skel = useSkeletonStyle();
  return (
    <span
      className="block"
      style={{
        width:  typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        borderRadius: radius,
        ...skel(),
        ...style,
      }}
    />
  );
}

/* Skeleton matching the StatusSummary table layout */
function StatusSummarySkeleton() {
  const rows = 8;
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">
      <div className="px-6 py-5 flex flex-wrap items-center gap-3 border-b border-[var(--ds-hairline)]">
        <Skel w={220} h={36} radius={10} />
        <Skel w={150} h={36} radius={10} />
        <Skel w={150} h={36} radius={10} />
        <Skel w={150} h={36} radius={10} />
        <div className="flex-1" />
        <Skel w={110} h={36} radius={10} />
      </div>

      <div className="px-6 py-4 flex items-center gap-4 border-b border-[var(--ds-hairline)]">
        <Skel w="24%" h={10} />
        <Skel w="16%" h={10} />
        <Skel w="18%" h={10} />
        <Skel w="14%" h={10} />
        <Skel w="14%" h={10} />
        <Skel w="10%" h={10} />
      </div>

      <div className="px-6 py-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 py-4 ${i < rows - 1 ? 'border-b border-[var(--ds-hairline)]' : ''}`}
          >
            <div className="flex items-center gap-3 w-[24%]">
              <Skel w={34} h={34} radius={10} />
              <div className="flex-1 space-y-2">
                <Skel w="80%" h={11} />
                <Skel w="55%" h={9} />
              </div>
            </div>
            <Skel w="16%" h={11} />
            <Skel w="18%" h={11} />
            <Skel w="14%" h={22} radius={999} />
            <Skel w="14%" h={11} />
            <Skel w="10%" h={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Skeleton matching the VcpTransactionRecords table layout */
function TransactionsSkeleton() {
  const rows = 10;
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-4 px-2">
        {[120, 140, 110, 130, 100, 90].map((w, i) => (
          <Skel key={i} w={w} h={10} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)]"
          >
            <Skel w="18%" h={11} />
            <Skel w="14%" h={11} />
            <Skel w="22%" h={11} />
            <Skel w="12%" h={11} />
            <Skel w="16%" h={11} />
            <Skel w="10%" h={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Vcp_CustomerSummary() {
  const { theme, isDark } = useTokens();
  const { toasts, showToast, removeToast } = useToast();
  const routePath = '/Vcp_CustomerSummary';
  const { access } = useAccessControl(routePath);

  useComponentRegistration({
    name: 'Vcp_CustomerSummary',
    version: '2.1.0',
    description: 'Customer rebate customer summary — merged across all rebate programs.',
    routePath: '/Vcp_CustomerSummary',
  });

  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName]   = useState("");
  const [userCode, setUserCode]   = useState("");
  const [initials, setInitials]   = useState("");

  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(true);

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
  const [itemsPerCustomerPage] = useState(10);

  /* ── Ledger modal ───────────────────────────────────────────────── */
  const [modalCustomer, setModalCustomer] = useState(null);
  const [, setLedgerReturnCustomer] = useState(null);

  /* ── Transaction records view ── */
  const [transactionCustomer, setTransactionCustomer]         = useState(null);
  const [transactionCurrentPage, setTransactionCurrentPage]   = useState(1);
  const [transactionRowsPerPage, setTransactionRowsPerPage]   = useState(10);
  const [periodFrom, setPeriodFrom]                           = useState('');
  const [periodTo, setPeriodTo]                               = useState('');
  const [filteredTransactions, setFilteredTransactions]       = useState([]);
  const [transactionsLoading, setTransactionsLoading]         = useState(false);

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
      let url = `${API_BASE}/api/vcp/dashboard/rebates-summary?db=VCP`;
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
            quotaType:     item.quotaType   || 'N/A',
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

  /* Filters */
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

  const handleCustomerClick = (customer) => setModalCustomer(customer);

  /* Load detailed transactions — VCP merges rebateDetails from the response */
  const loadDetailedTransactionsData = useCallback(async (silent = false) => {
    const cust = transactionCustomerRef.current;
    if (!cust) return;
    if (!silent) setTransactionsLoading(true);
    try {
      const code       = cust.code || cust.customerCode;
      const rebateCode = cust.rebateCode || cust.rebateCodes?.[0] || '';
      const rebateType = cust.rebateType || '';
      const params = new URLSearchParams({ db: 'VCP' });
      if (rebateCode) params.append('rebateCode', rebateCode);
      if (rebateType) params.append('rebateType', rebateType);
      if (periodFrom) params.append('periodFrom', periodFrom);
      if (periodTo)   params.append('periodTo',   periodTo);

      const url = `${API_BASE}/api/vcp/dashboard/customer/${encodeURIComponent(code)}/transactions?${params.toString()}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.success) {
        const rows = json.data?.transactions || json.data || [];
        setFilteredTransactions(Array.isArray(rows) ? rows : []);

        // Hand the rebate program details to the transaction view
        const rd = json.data?.rebateDetails;
        if (rd) {
          setTransactionCustomer((prev) => prev ? {
            ...prev,
            quotaType: rd.quotaType && rd.quotaType !== 'N/A' ? rd.quotaType : prev.quotaType,
            details: {
              ...(prev.details || {}),
              quotaType: rd.quotaType,
              rebateDetails: rd,
            },
          } : prev);
        }
      } else {
        setFilteredTransactions([]);
      }
    } catch (e) {
      console.error('[Vcp_StatusSummary] loadDetailedTransactionsData failed:', e);
      setFilteredTransactions([]);
    } finally {
      if (!silent) setTransactionsLoading(false);
    }
  }, [periodFrom, periodTo]);

  useEffect(() => {
    if (!transactionCustomer) return;
    if (!periodFrom && !periodTo) return;
    loadDetailedTransactionsData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFrom, periodTo]);

  /* Transactions clicked from ledger — ledger stays mounted underneath */
  const handleViewTransactionsFromLedger = (payload) => {
    const {
      customer, customerCode, customerName, customerAgent,
      rebateCodes, fallbackRebateCode, fallbackRebateType,
    } = payload;

    if (customer) setLedgerReturnCustomer(customer);

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

  const closeTransactionView = () => {
    setTransactionCustomer(null);
    transactionCustomerRef.current = null;
    setFilteredTransactions([]);
    setPeriodFrom('');
    setPeriodTo('');
    setTransactionCurrentPage(1);
  };

  const handleBackToLedger = () => { closeTransactionView(); };

  const handleCloseLedger = () => {
    setModalCustomer(null);
    setLedgerReturnCustomer(null);
  };

  const showSummarySkeleton = customersLoading && customers.length === 0;

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
              isLoading={false}
              selectedProgramStatus={selectedProgramStatus}
              setSelectedProgramStatus={setSelectedProgramStatus}
              showStatus={false}
            />

            {showSummarySkeleton && (
              <div
                className="absolute inset-0 p-8 bg-[var(--ds-bg)] z-[5]"
                aria-busy="true"
                aria-live="polite"
              >
                <StatusSummarySkeleton />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Customer Ledger Modal ───────────────────────────────────────── */}
      {modalCustomer && (
        <CustomerLedgerModal
          customer={modalCustomer}
          db="VCP"
          apiBase={API_BASE}
          theme={theme}
          onClose={handleCloseLedger}
          onViewTransactions={handleViewTransactionsFromLedger}
        />
      )}

      {/* ── Transaction Records Modal ───────────────────────────────────── */}
      {transactionCustomer && (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-xl ${
            isDark ? 'bg-[rgba(10,10,14,0.7)]' : 'bg-black/45'
          }`}
          onClick={closeTransactionView}
        >
          <div
            className="w-full max-w-[1500px] h-[92vh] rounded-[24px] overflow-hidden border flex flex-col relative bg-[var(--ds-glass-deep)] border-[var(--ds-rim)] shadow-[var(--ds-shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ">" button — Back to Ledger (closes only the transaction view) */}
            <button
              onClick={handleBackToLedger}
              className="absolute right-4 top-4 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)]"
              title="Back to Customer Ledger"
            >
              <ChevronRight size={16} />
            </button>

            {/* Header strip */}
            <div className="flex-shrink-0 px-6 py-4 border-b flex items-center justify-between gap-4 border-[var(--ds-hairline)] bg-gradient-to-br from-[#0A84FF]/5 to-[#BF5AF2]/5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1 text-[var(--ds-muted)]">
                  Transaction Records
                </p>
                <h2 className="text-lg font-bold truncate leading-tight tracking-[-0.02em] text-[var(--ds-ink)]">
                  {transactionCustomer.customer || transactionCustomer.customerName || 'Unknown Customer'}
                </h2>
                <p className="text-[11px] font-mono mt-0.5 text-[var(--ds-muted)]">
                  {transactionCustomer.code || transactionCustomer.customerCode}
                  {transactionCustomer.agent && transactionCustomer.agent !== 'Unknown Agent' && (
                    <span className="text-[var(--ds-faint)]"> · {transactionCustomer.agent}</span>
                  )}
                  {transactionCustomer.rebateCode && (
                    <span className="text-[var(--ds-faint)]"> · {transactionCustomer.rebateCode}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 relative bg-[var(--ds-bg)]">
              <VcpTransactionRecords
                theme={theme}
                customerModalTab="transaction"
                modalCustomer={transactionCustomer}
                filteredTransactions={filteredTransactions}
                transactionCurrentPage={transactionCurrentPage}
                setTransactionCurrentPage={setTransactionCurrentPage}
                transactionRowsPerPage={transactionRowsPerPage}
                setTransactionRowsPerPage={setTransactionRowsPerPage}
                isLoading={false}
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
                  className="absolute inset-0 overflow-auto ds-scroll bg-[var(--ds-bg)] z-[5]"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <TransactionsSkeleton />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DesignPage>
  );
}

export default Vcp_CustomerSummary;