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
import { useTheme } from '../context/ThemeContext';
import nexchemLogo from "../assets/nexchem.png";
import Sidebar from "../components/Sidebar";
import MetricCard from '../components/Dashboard/MetricCard';
import Header from '../components/Header';
import { ToastContainer, useToast } from "../components/common/Toast";
import useAccessControl from '../hooks/useAccessControl';
import { useComponentRegistration } from '../hooks/useComponentRegistration';

/* ─── Apple system colour language ───────────────────────────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const dashTokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"  : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const DASH_FONT = `
  .dash-page, .dash-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .dash-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .dash-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.4); border-radius: 999px; }
  .dash-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes dash-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dash-pop { animation: dash-pop 0.2s cubic-bezier(0.16,1,0.3,1); }

  /* ── Skeleton shimmer ─────────────────────────────────────────────── */
  @keyframes dash-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .dash-skel {
    background: linear-gradient(
      90deg,
      var(--skel-base, rgba(142,142,147,0.12)) 0%,
      var(--skel-hi,   rgba(142,142,147,0.28)) 50%,
      var(--skel-base, rgba(142,142,147,0.12)) 100%
    );
    background-size: 200% 100%;
    animation: dash-shimmer 1.5s ease-in-out infinite;
    border-radius: 6px;
  }
`;

const API_BASE = 'http://192.168.100.193:9/api';
const DB_NAME  = 'USER';

/* ── Skeleton placeholder that mirrors a MetricCard ──────────────────── */
function MetricCardSkeleton({ K }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-6"
      style={{
        background: K.glass,
        border: `1px solid ${K.hairline}`,
        boxShadow: K.shadow,
      }}
    >
      {/* Top row — icon + chip */}
      <div className="flex items-start justify-between mb-5">
        <div className="dash-skel" style={{ width: 46, height: 46, borderRadius: 10 }} />
        <div className="dash-skel" style={{ width: 54, height: 12, borderRadius: 6 }} />
      </div>
      {/* Title */}
      <div className="dash-skel mb-3" style={{ width: "55%", height: 14, borderRadius: 4 }} />
      {/* Value */}
      <div className="dash-skel mb-3" style={{ width: "72%", height: 30, borderRadius: 6 }} />
      {/* Subtitle */}
      <div className="dash-skel" style={{ width: "45%", height: 12, borderRadius: 4 }} />
    </div>
  );
}

function Nexchem_Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, updateTheme } = useTheme();
  const { toasts, showToast, removeToast } = useToast();
  const K = dashTokens(theme === 'dark');
  const routePath = '/Nexchem_Dashboard';
  const { access } = useAccessControl(routePath);

  /* ── Dynamic DB context ─────────────────────────────────────────────
     Derive the current database slug + param from the URL prefix so this
     same file works unchanged as Van_Dashboard.jsx / Vcp_Dashboard.jsx:
       "/Nexchem_Dashboard" → slug: "Nexchem", dbParam: "NEXCHEM"
       "/Van_Dashboard"     → slug: "Van",     dbParam: "VAN"
       "/Vcp_Dashboard"     → slug: "Vcp",     dbParam: "VCP"
     ─────────────────────────────────────────────────────────────────── */
  const dbSlug   = location.pathname.split('_')[0].replace(/^\//, '') || 'Nexchem';
  const dbParam  = dbSlug.toUpperCase();

  // Dynamic target routes — mirrors the sidebar's HARDCODED_PRIMARY_ITEMS
  const rebateProgramsPath  = `/${dbSlug}_RebatePrograms`;
  // ── Customer Summary link ─────────────────────────────────────────────
  const customerSummaryPath = `/${dbSlug}_CustomerSummary`;

  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(true);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");
  // Start loading=true so the skeletons render immediately on mount
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

  /* ── Auth bootstrap ───────────────────────────────────────────────────── */
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

  /* ── Theme load ───────────────────────────────────────────────────────── */
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

  /* ── Load metrics + active program count ──────────────────────────────
     Two parallel fetches:
       1. /dashboard/metrics   → rebate $, active customer count
       2. /dashboard/rebates   → list of all rebates → count where active === true
     ─────────────────────────────────────────────────────────────────── */
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [metricsRes, rebatesRes] = await Promise.all([
        fetch(`http://192.168.100.193:3009/api/${dbSlug.toLowerCase()}/dashboard/metrics?db=${dbParam}`),
        fetch(`http://192.168.100.193:3009/api/${dbSlug.toLowerCase()}/dashboard/rebates?db=${dbParam}`),
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
        // Metrics failed but we may still have gotten a program count
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

  /* ── Card click handlers — dynamic, DB-aware ───────────────────────── */
  const goToRebatePrograms  = () => {
    navigate(rebateProgramsPath);
  };
  const goToCustomerSummary = () => {
    navigate(customerSummaryPath);
  };

  /* Skeleton colour variables — theme aware */
  const skelVars = {
    "--skel-base": theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(60,60,67,0.07)",
    "--skel-hi":   theme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(60,60,67,0.14)",
  };

  return (
    <div className="dash-page flex min-h-screen w-full" style={{ background: K.bg, color: K.ink }}>
      <style>{DASH_FONT}</style>

      {/* Aurora wash */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            radial-gradient(700px circle at 8% 0%, ${APPLE.blue}${theme === 'dark' ? "26" : "30"}, transparent 55%),
            radial-gradient(650px circle at 92% 10%, ${APPLE.purple}${theme === 'dark' ? "1a" : "20"}, transparent 55%)
          `,
          zIndex: 0,
        }}
      />

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
        className={`relative flex-1 flex flex-col min-h-screen transition-all duration-500 ${collapsed ? "ml-20" : "ml-64"}`}
        style={{ zIndex: 1 }}
      >
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={nexchemLogo}
          theme={theme}
        />

        <div className="pt-16 flex-1 p-8 overflow-auto dash-scroll">
          <div className="p-8 w-full max-w-[1600px] mx-auto mt-6">
            <DashboardHeader
              title="Rebate Analytics Dashboard"
              userName={userName}
              userCode={userCode}
              onRefresh={handleRefresh}
              showRefresh={true}
              theme={theme}
            />

            {/* ── 4 Metric cards (skeleton while loading) ──────────────── */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8"
              style={skelVars}
            >
              {loading ? (
                <>
                  <MetricCardSkeleton K={K} />
                  <MetricCardSkeleton K={K} />
                  <MetricCardSkeleton K={K} />
                  <MetricCardSkeleton K={K} />
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
    </div>
  );
}

export default Nexchem_Dashboard;