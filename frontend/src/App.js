// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, Home, Compass } from "lucide-react";

// Import components
import AuthPage from "./components/AuthPage";
import HomePage from "./HomePage";
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { DatabaseAccessProvider } from './context/DatabaseAccessContext';

// Import NEXCHEM components
import Nexchem_Dashboard        from "./NEXCHEM/Nexchem_Dashboard";
import Nexchem_ItemRecords      from "./NEXCHEM/Nexchem_ItemRecords";
import Nexchem_SalesEmployee    from "./NEXCHEM/Nexchem_SalesEmployee";
import Nexchem_CustomerRecords  from "./NEXCHEM/Nexchem_CustomerRecords";
import Nexchem_RebatePrograms   from "./NEXCHEM/Nexchem_RebatePrograms";
import Nexchem_CustomerSummary    from "./NEXCHEM/Nexchem_CustomerSummary";
import Nexchem_RebateSetup      from "./NEXCHEM/Nexchem_RebateSetup";
import Nexchem_Reports          from "./NEXCHEM/Nexchem_Reports";

// Import VAN components
import Van_Dashboard            from "./VAN/Van_Dashboard";
import Van_ItemRecords          from "./VAN/Van_ItemRecords";
import Van_SalesEmployee        from "./VAN/Van_SalesEmployee";
import Van_CustomerRecords      from "./VAN/Van_CustomerRecords";
import Van_RebatePrograms       from "./VAN/Van_RebatePrograms";        // ← NEW
import Van_CustomerSummary       from "./VAN/Van_CustomerSummary";         // ← NEW
import Van_RebateSetup          from "./VAN/Van_RebateSetup";
import Van_Reports              from "./VAN/Van_Reports";

// Import VCP components
import Vcp_Dashboard            from "./VCP/Vcp_Dashboard";
import Vcp_ItemRecords          from "./VCP/Vcp_ItemRecords";
import Vcp_SalesEmployee        from "./VCP/Vcp_SalesEmployee";
import Vcp_CustomerRecords      from "./VCP/Vcp_CustomerRecords";
import Vcp_RebatePrograms       from "./VCP/Vcp_RebatePrograms";        // ← NEW
import Vcp_CustomerSummary        from "./VCP/Vcp_CustomerSummary";         // ← NEW
import Vcp_RebateSetup          from "./VCP/Vcp_RebateSetup";
import Vcp_Reports              from "./VCP/Vcp_Reports";

// Common components
import Settings from "./Settings";
import AccountSetup from "./AccountSetup";

import { AccessControlProvider } from './context/AccessControlContext';

/* ─── Apple system colour language ──────────────────────────────────────── */
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

const APP_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes dash-pop { from { opacity: 0; transform: scale(.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes floatOrb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(20px, -20px) scale(1.05); }
  }
  .nx-app, .nx-app * { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .nx-app .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
`;

const injectFonts = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('app-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'app-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

function PrivateRoute({ isAuthenticated, children }) {
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/* ─── Professional 404 Page ─────────────────────────────────────────────── */
function NotFoundPage() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    injectFonts();
    const t = localStorage.getItem('userTheme') || localStorage.getItem('lastActiveTheme') || 'light';
    setIsDark(t === 'dark');
  }, []);

  const K = dashTokens(isDark);

  return (
    <div
      className="nx-app"
      style={{
        minHeight: '100vh', width: '100%', background: K.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px', overflow: 'hidden', position: 'relative',
      }}
    >
      <style>{APP_STYLES}</style>

      <div className="pointer-events-none fixed inset-0" style={{
        backgroundImage: `
          radial-gradient(700px circle at 8% 0%, ${APPLE.blue}${isDark ? "26" : "30"}, transparent 55%),
          radial-gradient(650px circle at 92% 10%, ${APPLE.purple}${isDark ? "1a" : "20"}, transparent 55%),
          radial-gradient(900px circle at 50% 100%, ${APPLE.blue}${isDark ? "14" : "1a"}, transparent 60%)
        `,
        zIndex: 0,
      }} />

      <div className="dash-glass" style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 560,
        padding: '48px 40px 44px', borderRadius: 22,
        background: K.glass, border: `1px solid ${K.hairline}`, boxShadow: K.shadow,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: 26,
        animation: 'dash-pop 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ position: 'relative', width: 180, height: 180 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle, ${APPLE.blue}1c 0%, transparent 70%)`,
            animation: 'floatOrb 6s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
            background: `conic-gradient(from 0deg, ${APPLE.blue}00 0deg, ${APPLE.blue}b3 90deg, ${APPLE.blue}66 160deg, ${APPLE.blue}00 200deg, ${APPLE.blue}00 360deg)`,
            filter: 'blur(2.5px)', animation: 'spinSlow 6s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 18, borderRadius: '50%',
            background: `conic-gradient(from 140deg, ${APPLE.purple}00 0deg, ${APPLE.purple}99 80deg, ${APPLE.purple}55 150deg, ${APPLE.purple}00 200deg, ${APPLE.purple}00 360deg)`,
            filter: 'blur(3px)', animation: 'spinSlow 8s linear infinite reverse' }} />
          <div style={{
            position: 'absolute', inset: 42, borderRadius: '50%',
            background: isDark ? 'rgba(13,16,26,.92)' : 'rgba(255,255,255,.96)',
            border: `1px solid ${K.rim}`,
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            boxShadow: isDark ? '0 12px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06)'
                              : '0 12px 40px rgba(30,41,79,.18), inset 0 1px 0 rgba(255,255,255,.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={22} color={APPLE.red} strokeWidth={2} />
              <span style={{
                fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em',
                background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                color: 'transparent', lineHeight: 1,
              }}>404</span>
            </div>
            <div style={{ width: 44, height: 3, borderRadius: 999,
              background: `linear-gradient(90deg, ${APPLE.blue}, ${APPLE.purple})`, marginTop: 4 }} />
          </div>
          <div style={{ position: 'absolute', top: 6, right: 10, width: 10, height: 10, borderRadius: '50%',
            background: APPLE.orange, boxShadow: `0 0 12px ${APPLE.orange}aa`,
            animation: 'floatOrb 4s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: 6, left: 10, width: 8, height: 8, borderRadius: '50%',
            background: APPLE.green, boxShadow: `0 0 10px ${APPLE.green}aa`,
            animation: 'floatOrb 5s ease-in-out infinite', animationDelay: '1s' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 440 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: K.ink, margin: 0, letterSpacing: '-0.02em' }}>
            Page Not Found
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: K.muted, margin: 0 }}>
            Oops! The page you're looking for seems to have wandered off into the digital wilderness.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => navigate(-1)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 999,
            border: `1px solid ${K.hairline}`, background: 'transparent',
            color: K.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.2s', fontFamily: 'inherit',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <ArrowLeft size={14} /> Go Back
          </button>

          <button onClick={() => navigate('/HomePage')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 999, border: 'none',
            background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s', boxShadow: `0 6px 20px -6px ${APPLE.blue}88`, fontFamily: 'inherit',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'brightness(1)'; }}
          >
            <Home size={14} /> Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("currentUser");
    return !!(token || userStr);
  });

  const [loading, setLoading] = useState(true);
  const lastAuthCheckRef = useRef({ token: null, user: null });
  const authCheckTimeoutRef = useRef(null);
  const handleLogoutRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("currentUser");
    console.log('🔍 App mount - Checking auth:', {
      hasToken: !!token, hasUser: !!userStr,
      user: userStr ? JSON.parse(userStr)?.User_ID : null
    });
    if (token || userStr) setIsAuthenticated(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleAuthStateChange = () => {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("currentUser");
      const authDataChanged =
        token !== lastAuthCheckRef.current.token ||
        userStr !== lastAuthCheckRef.current.user;
      if (!authDataChanged) return;

      lastAuthCheckRef.current = { token, user: userStr };
      const shouldBeAuthenticated = !!(token || userStr);

      if (isAuthenticated !== shouldBeAuthenticated) {
        setIsAuthenticated(shouldBeAuthenticated);
      }
    };

    const interval = setInterval(handleAuthStateChange, 2000);
    const handleFocus = () => {
      if (authCheckTimeoutRef.current) clearTimeout(authCheckTimeoutRef.current);
      authCheckTimeoutRef.current = setTimeout(handleAuthStateChange, 100);
    };
    window.addEventListener('focus', handleFocus);

    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'currentUser') handleAuthStateChange();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      if (authCheckTimeoutRef.current) clearTimeout(authCheckTimeoutRef.current);
    };
  }, [isAuthenticated]);

  const handleAuthSuccess = (userData) => {
    console.log('🎯 Auth success called from AuthPage:', userData?.User_ID);
    localStorage.setItem("currentUser", JSON.stringify(userData));
    lastAuthCheckRef.current = {
      token: localStorage.getItem("token"),
      user: localStorage.getItem("currentUser")
    };
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    console.log('👋 Logging out...');
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("rememberedUser");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("selectedDB");
    lastAuthCheckRef.current = { token: null, user: null };
    setIsAuthenticated(false);
    window.location.href = "/login";
  };

  handleLogoutRef.current = handleLogout;

  const handlePasswordChangeSuccess = (userData) => {
    handleAuthSuccess(userData);
  };

  if (loading) {
    return (
      <div className="nx-app" style={{
        minHeight: '100vh', width: '100%', background: dashTokens(false).bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 18,
      }}>
        <style>{APP_STYLES}</style>
        <div className="pointer-events-none fixed inset-0" style={{
          backgroundImage: `
            radial-gradient(700px circle at 8% 0%, ${APPLE.blue}30, transparent 55%),
            radial-gradient(650px circle at 92% 10%, ${APPLE.purple}20, transparent 55%)
          `, zIndex: 0,
        }} />
        <div style={{ position: 'relative', width: 56, height: 56, zIndex: 1 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%',
            border: `4px solid ${dashTokens(false).hairline}`, position: 'absolute' }} />
          <div style={{ width: 56, height: 56, borderRadius: '50%',
            border: `4px solid ${APPLE.blue}`, borderTopColor: 'transparent',
            animation: 'spinSlow 0.75s linear infinite', position: 'absolute' }} />
        </div>
        <p style={{ position: 'relative', zIndex: 1, fontSize: 13, fontWeight: 500,
          color: dashTokens(false).muted, margin: 0 }}>
          Loading application…
        </p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={
          isAuthenticated ? <Navigate to="/HomePage" replace /> : <Navigate to="/login" replace />
        } />

        {/* Public Routes */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/HomePage" replace /> :
          <AuthPage onAuthSuccess={handleAuthSuccess} onPasswordChangeSuccess={handlePasswordChangeSuccess} />
        } />

        {/* Home Page */}
        <Route path="/HomePage" element={
          <PrivateRoute isAuthenticated={isAuthenticated}>
            <HomePage onLogout={handleLogout} />
          </PrivateRoute>
        } />

        {/* ========== NEXCHEM ROUTES ========== */}
        <Route path="/Nexchem_Dashboard"        element={<PrivateRoute isAuthenticated={isAuthenticated}><Nexchem_Dashboard        onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Nexchem_ItemRecords"      element={<PrivateRoute isAuthenticated={isAuthenticated}><Nexchem_ItemRecords      onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Nexchem_SalesEmployee"    element={<PrivateRoute isAuthenticated={isAuthenticated}><Nexchem_SalesEmployee    onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Nexchem_CustomerRecords"  element={<PrivateRoute isAuthenticated={isAuthenticated}><Nexchem_CustomerRecords  onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Nexchem_RebateSetup"      element={<PrivateRoute isAuthenticated={isAuthenticated}><Nexchem_RebateSetup      onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Nexchem_RebatePrograms"   element={<PrivateRoute isAuthenticated={isAuthenticated}><Nexchem_RebatePrograms   onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Nexchem_CustomerSummary"    element={<PrivateRoute isAuthenticated={isAuthenticated}><Nexchem_CustomerSummary    onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Nexchem_Reports"          element={<PrivateRoute isAuthenticated={isAuthenticated}><Nexchem_Reports          onLogout={handleLogout} /></PrivateRoute>} />

        {/* ========== VAN ROUTES ========== */}
        <Route path="/Van_Dashboard"       element={<PrivateRoute isAuthenticated={isAuthenticated}><Van_Dashboard       onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Van_ItemRecords"     element={<PrivateRoute isAuthenticated={isAuthenticated}><Van_ItemRecords     onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Van_SalesEmployee"   element={<PrivateRoute isAuthenticated={isAuthenticated}><Van_SalesEmployee   onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Van_CustomerRecords" element={<PrivateRoute isAuthenticated={isAuthenticated}><Van_CustomerRecords onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Van_RebateSetup"     element={<PrivateRoute isAuthenticated={isAuthenticated}><Van_RebateSetup     onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Van_RebatePrograms"  element={<PrivateRoute isAuthenticated={isAuthenticated}><Van_RebatePrograms  onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Van_CustomerSummary"   element={<PrivateRoute isAuthenticated={isAuthenticated}><Van_CustomerSummary   onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Van_Reports"         element={<PrivateRoute isAuthenticated={isAuthenticated}><Van_Reports         onLogout={handleLogout} /></PrivateRoute>} />

        {/* ========== VCP ROUTES ========== */}
        <Route path="/Vcp_Dashboard"       element={<PrivateRoute isAuthenticated={isAuthenticated}><Vcp_Dashboard       onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Vcp_ItemRecords"     element={<PrivateRoute isAuthenticated={isAuthenticated}><Vcp_ItemRecords     onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Vcp_SalesEmployee"   element={<PrivateRoute isAuthenticated={isAuthenticated}><Vcp_SalesEmployee   onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Vcp_CustomerRecords" element={<PrivateRoute isAuthenticated={isAuthenticated}><Vcp_CustomerRecords onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Vcp_RebateSetup"     element={<PrivateRoute isAuthenticated={isAuthenticated}><Vcp_RebateSetup     onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Vcp_RebatePrograms"  element={<PrivateRoute isAuthenticated={isAuthenticated}><Vcp_RebatePrograms  onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Vcp_CustomerSummary"   element={<PrivateRoute isAuthenticated={isAuthenticated}><Vcp_CustomerSummary   onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/Vcp_Reports"         element={<PrivateRoute isAuthenticated={isAuthenticated}><Vcp_Reports         onLogout={handleLogout} /></PrivateRoute>} />

        {/* Common Routes */}
        <Route path="/settings"     element={<PrivateRoute isAuthenticated={isAuthenticated}><Settings     onLogout={handleLogout} /></PrivateRoute>} />
        <Route path="/accountsetup" element={<PrivateRoute isAuthenticated={isAuthenticated}><AccountSetup onLogout={handleLogout} /></PrivateRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AccessControlProvider>
          <DatabaseAccessProvider>
            <AppContent />
          </DatabaseAccessProvider>
        </AccessControlProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;