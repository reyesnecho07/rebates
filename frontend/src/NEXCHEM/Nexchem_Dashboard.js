// src/pages/Nexchem_Dashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from 'axios';
import {
  BanknoteArrowDown,
  UserCheck,
  BanknoteArrowUp,
  HandCoins,
} from "lucide-react";
import DashboardHeader from '../components/Dashboard/DashboardHeader';
import { useLocation, useNavigate } from 'react-router-dom';
import nexchemLogo from "../assets/nexchem.png";
import Sidebar from "../components/Sidebar";
import MetricCard from '../components/Dashboard/MetricCard';
import Header from '../components/Header';
import { ToastContainer, useToast } from "../components/common/Toast";
import useAccessControl from '../hooks/useAccessControl';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import { API_BASE, DB_NAME } from '../config/appConfig';

/* ── Design system ──────────────────────────────────────────────── */
import {
  useTokens,
  useSkeletonStyle,
  DesignPage,
} from '../design-system';

/* ── Skeleton placeholder that mirrors a MetricCard ─────────────── */
function MetricCardSkeleton() {
  const skel = useSkeletonStyle();
  return (
    <div className="relative overflow-hidden rounded-xl p-6 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] shadow-[var(--ds-shadow)]">
      {/* Top row — icon + chip */}
      <div className="flex items-start justify-between mb-5">
        <div style={skel({ width: 46, height: 46, borderRadius: 10 })} />
        <div style={skel({ width: 54, height: 12, borderRadius: 6 })} />
      </div>
      {/* Title */}
      <div style={skel({ width: "55%", height: 14, borderRadius: 4, marginBottom: 12 })} />
      {/* Value */}
      <div style={skel({ width: "72%", height: 30, borderRadius: 6, marginBottom: 12 })} />
      {/* Subtitle */}
      <div style={skel({ width: "45%", height: 12, borderRadius: 4 })} />
    </div>
  );
}

function Nexchem_Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, updateTheme } = useTokens();
  const { toasts, showToast, removeToast } = useToast();
  const routePath = '/Nexchem_Dashboard';
  const { access } = useAccessControl(routePath);

  /* ── Dynamic DB context — derived from URL prefix ───────────────── */
  const dbSlug   = location.pathname.split('_')[0].replace(/^\//, '') || 'Nexchem';
  const dbParam  = dbSlug.toUpperCase();

  const rebateProgramsPath  = `/${dbSlug}_RebatePrograms`;
  const customerSummaryPath = `/${dbSlug}_CustomerSummary`;

  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(true);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");
  const [loading, setLoading]   = useState(true);

  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalRebatePaid: "₱0",
    totalUnpaidRebate: "₱0",
    totalOverReleasedRebate: "₱0",
    activeCustomers: "0",
    activePrograms: "0",
    newCustomersThisMonth: "+0",
    totalRebatePaidValue: 0,
    totalUnpaidRebateValue: 0,
    totalOverReleasedRebateValue: 0,
  });

  const componentMetadata = {
    name: 'Nexchem_Dashboard',
    version: '2.1.0',
    description: 'Centralized dashboard providing an overall view and summary of rebate programs, balances, and performance.',
    routePath: '/Nexchem_Dashboard'
  };
  useComponentRegistration(componentMetadata);

  /* ── Auth bootstrap ─────────────────────────────────────────────── */
  useEffect(() => {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) { window.location.href = "/login"; return; }
    try {
      const user = JSON.parse(userStr);
      if (!user || (!user.User_ID && !user.Username && !user.id)) {
        window.location.href = "/login"; return;
      }
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
    } catch {
      window.location.href = "/login";
    }
  }, []);

  /* ── Theme load ─────────────────────────────────────────────────── */
  useEffect(() => {
    const loadThemeFromDatabase = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
        const userId = storedUser.UserID || storedUser.User_ID;
        if (!userId) return;
        const response = await axios.get(`${API_BASE}/user/preferences/${userId}/theme?db=${DB_NAME}`);
        if (response.data.success && response.data.value) {
          const dbTheme = response.data.value.toLowerCase();
          if (dbTheme !== theme) updateTheme(dbTheme);
        }
      } catch {
        const localTheme = localStorage.getItem('userTheme');
        if (localTheme && localTheme !== theme) updateTheme(localTheme);
      }
    };
    loadThemeFromDatabase();
  }, []); // eslint-disable-line

  /* ── Load metrics + active program count ────────────────────────── */
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [metricsRes, rebatesRes] = await Promise.all([
        fetch(`/api/${dbSlug.toLowerCase()}/dashboard/metrics?db=${dbParam}`),
        fetch(`/api/${dbSlug.toLowerCase()}/dashboard/rebates?db=${dbParam}`),
      ]);

      let metricsData = null;
      if (metricsRes.ok) {
        const json = await metricsRes.json();
        if (json.success) metricsData = json.data;
      }

      let activePrograms = 0;
      if (rebatesRes.ok) {
        const json = await rebatesRes.json();
        if (json.success && Array.isArray(json.data)) {
          activePrograms = json.data.filter(r => r.active === true).length;
        }
      }

      if (metricsData) {
        const d = metricsData;
        setDashboardMetrics({
          totalRebatePaid:  `₱${(d.totalRebatePaid || 0).toLocaleString()}`,
          totalUnpaidRebate:`₱${(d.totalUnpaidRebate || 0).toLocaleString()}`,
          totalOverReleasedRebate: `₱${(d.totalOverReleasedRebate || 0).toLocaleString()}`,
          activeCustomers: String(d.activeCustomers || 0),
          activePrograms:  String(activePrograms),
          newCustomersThisMonth: `+${d.newCustomersThisMonth || 0}`,
          totalRebatePaidValue: d.totalRebatePaid || 0,
          totalUnpaidRebateValue: d.totalUnpaidRebate || 0,
          totalOverReleasedRebateValue: d.totalOverReleasedRebate || 0,
        });
      } else {
        setDashboardMetrics(prev => ({ ...prev, activePrograms: String(activePrograms) }));
      }
    } catch (e) {
      console.error('Error loading dashboard metrics:', e);
    } finally {
      setLoading(false);
    }
  }, [dbSlug, dbParam]);

  useEffect(() => {
    if (!userName || userName === "Unknown User") return;
    loadDashboardData();
  }, [userName, loadDashboardData]);

  const handleRefresh = () => {
    loadDashboardData();
    showToast("Data refreshed successfully!", "success");
  };

  /* ── Card click handlers — dynamic, DB-aware ────────────────────── */
  const goToRebatePrograms  = () => { navigate(rebateProgramsPath); };
  const goToCustomerSummary = () => { navigate(customerSummaryPath); };

  return (
    <DesignPage className="flex w-full">

      {/* Aurora wash */}
      <div className="pointer-events-none fixed inset-0 z-0 ds-aurora-blue-purple" />

      <ToastContainer toasts={toasts} removeToast={removeToast} isDark={theme === 'dark'} />

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}
        setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown}
        setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}
        setShowVcpDropdown={setShowVcpDropdown}
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
          logo={nexchemLogo}
          theme={theme}
        />

        <div className="pt-16 flex-1 p-8 overflow-auto ds-scroll">
          <div className="p-8 w-full max-w-[1600px] mx-auto mt-6">
            <DashboardHeader
              title="Rebate Analytics Dashboard"
              userName={userName}
              userCode={userCode}
              onRefresh={handleRefresh}
              showRefresh={true}
              theme={theme}
            />

            {/* ── 4 Metric cards (skeleton while loading) ──────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
              {loading ? (
                <>
                  <MetricCardSkeleton />
                  <MetricCardSkeleton />
                  <MetricCardSkeleton />
                  <MetricCardSkeleton />
                </>
              ) : (
                <>
                  {/* Active Programs — clickable → Rebate Programs page */}
                  <MetricCard
                    title="Active Programs"
                    value={parseInt(dashboardMetrics.activePrograms) || 0}
                    icon={HandCoins}
                    variant="emerald"
                    subtitle="Running rebate programs"
                    theme={theme}
                    noDecimals={true}
                    onClick={goToRebatePrograms}
                    clickHint="View programs"
                  />

                  {/* Active Customers — clickable → Customer Summary page */}
                  <MetricCard
                    title="Active Customers"
                    value={parseInt(dashboardMetrics.activeCustomers) || 0}
                    icon={UserCheck}
                    variant="amber"
                    subtitle="Engaged customers"
                    theme={theme}
                    noDecimals={true}
                    onClick={goToCustomerSummary}
                    clickHint="View customers"
                  />

                  {/* Total Rebate Paid — display only */}
                  <MetricCard
                    title="Total Rebate Paid"
                    value={dashboardMetrics.totalRebatePaidValue}
                    icon={BanknoteArrowUp}
                    variant="blue"
                    isCurrency={true}
                    subtitle="Total amount disbursed"
                    theme={theme}
                  />

                  {/* Total Unpaid Rebate — display only */}
                  <MetricCard
                    title="Total Unpaid Rebate"
                    value={dashboardMetrics.totalUnpaidRebateValue}
                    icon={BanknoteArrowDown}
                    variant="red"
                    isCurrency={true}
                    subtitle="Total rebate outstanding"
                    theme={theme}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </DesignPage>
  );
}

export default Nexchem_Dashboard;