import React, { useState, useEffect, useRef } from "react";
import {
  Settings as SettingsIcon,
  Database,
  Sun,
  Moon,
  Upload,
  Camera,
  X,
  Loader2,
  CheckCircle,
  User,
  Palette,
  Check
} from "lucide-react";
import { useLocation } from "react-router-dom";
//import userpreference from "./assets/userpreference.png";
import Sidebar from "./components/Sidebar";
import Header from './components/Header';
import { useTheme } from './context/ThemeContext';
import axios from 'axios';
import { API_BASE, DB_NAME } from './config/appConfig';

const USER_DB_ORDER_PREFIX = 'databaseOrder_';

// ── Shared profile-sync constants ────────────────────────────────────────
// These MUST match the ones used in Header.jsx so both components read and
// write the exact same localStorage key and react to the exact same custom
// event. This is what keeps the Settings page avatar and the navbar avatar
// in sync, in the same tab, instantly — no reload, no remount needed.
const PROFILE_UPDATED_EVENT = 'app:profile-updated';
const getProfileImageKey = (userCode) => `userProfileImage_${userCode}`;

/**
 * Always reads directly from localStorage — never depends on React state.
 * This guarantees we never read stale state during async operations.
 */
function getCurrentUserId() {
  try {
    const p = JSON.parse(localStorage.getItem('currentUser') || 'null');
    return p?.UserID || p?.User_ID || null;
  } catch { return null; }
}

/**
 * Broadcasts the current profile snapshot so every part of the app that
 * displays the user (navbar avatar, sidebar, header, etc.) can update
 * instantly, without waiting for a page reload or remount.
 */
function broadcastProfileUpdate(profile) {
  try {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: profile }));
  } catch {}
}

/* ─── Apple system colour language (Nexchem / VAN / VCP) ─────────────────── */
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
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes dash-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dash-pop { animation: dash-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
  @keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse-ring { 0% { box-shadow:0 0 0 0 rgba(10,132,255,0.35); } 70% { box-shadow:0 0 0 10px rgba(10,132,255,0); } 100%{ box-shadow:0 0 0 0 rgba(10,132,255,0); } }
  .nx-card { animation: fadeSlideUp 0.3s ease both; }
  .nx-btn-secondary:hover:not(:disabled) { transform: translateY(-1px); }
  .nx-input:focus { border-color: #0A84FF !important; box-shadow: 0 0 0 3px rgba(10,132,255,0.15); }
`;

const injectFonts = () => {
  if (document.getElementById('settings-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'settings-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

/* ────────────────────────────────────────────────────────────────────────
 * DATABASE ORDER PERSISTENCE — DISABLED
 * ──────────────────────────────────────────────────────────────────────── */
// function persistDbOrder(order) {
//   try {
//     const uid = getCurrentUserId();
//     const key = uid ? `${USER_DB_ORDER_PREFIX}${uid}` : 'databaseOrder';
//     localStorage.setItem(key, JSON.stringify(order));
//   } catch {}
// }
//
// function readDbOrder() {
//   try {
//     const uid = getCurrentUserId();
//     if (uid) {
//       const perUser = localStorage.getItem(`${USER_DB_ORDER_PREFIX}${uid}`);
//       if (perUser) return JSON.parse(perUser);
//     }
//     const legacy = localStorage.getItem('databaseOrder');
//     if (legacy) {
//       const parsed = JSON.parse(legacy);
//       if (uid) {
//         localStorage.setItem(`${USER_DB_ORDER_PREFIX}${uid}`, legacy);
//         localStorage.removeItem('databaseOrder');
//       }
//       return parsed;
//     }
//     return null;
//   } catch { return null; }
// }

const DEFAULT_ORDER = { van: 1, nexchem: 2, vcp: 3 };

function Settings() {
  useEffect(() => { injectFonts(); }, []);

  const location = useLocation();
  const { theme, updateTheme } = useTheme();

  const isDark = theme === 'dark';
  const K = dashTokens(isDark);
  const fontStack = "'Outfit', system-ui, sans-serif";
  const monoStack = "'DM Mono', monospace";

  const [profileImage,      setProfileImage]      = useState(null);
  const [userName,          setUserName]           = useState("");
  const [userCode,          setUserCode]           = useState("");
  const [userId,            setUserId]             = useState("");
  const [initials,          setInitials]           = useState("");
  const [collapsed,         setCollapsed]          = useState(false);
  const [databaseOrder,     setDatabaseOrder]      = useState(DEFAULT_ORDER);
  const [showUploadModal,   setShowUploadModal]    = useState(false);
  const [uploadPreview,     setUploadPreview]      = useState(null);
  const [activeSection,     setActiveSection]      = useState("profile"); // profile | appearance
  const [themeSaveStatus,   setThemeSaveStatus]    = useState({
    saving: false, saved: false, error: false, message: ""
  });

  const getInitials = (name) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
  };

  // ── Init user + load persisted prefs ──────────────────────────────────────
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const username   = storedUser.DisplayName || storedUser.Username || "John Smith";
    const code       = storedUser.User_ID     || storedUser.UserCode  || "USR001";
    const uid        = storedUser.UserID      || storedUser.User_ID   || "";

    setUserName(username);
    setUserCode(code);
    setUserId(uid);
    setInitials(getInitials(username));

    const savedImage = localStorage.getItem(getProfileImageKey(code));
    if (savedImage) setProfileImage(savedImage);
  }, []); // eslint-disable-line

  // ── Keep Settings in sync with profile changes made elsewhere ─────────────
  useEffect(() => {
    if (!userCode) return;

    const handleProfileUpdated = (e) => {
      if (!e.detail) return;
      if (e.detail.userCode !== undefined && e.detail.userCode !== userCode) return;
      setProfileImage(e.detail.profileImage || null);
    };

    const handleExternalProfileChange = (e) => {
      if (e.key === getProfileImageKey(userCode)) {
        setProfileImage(e.newValue || null);
      }
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    window.addEventListener('storage', handleExternalProfileChange);
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
      window.removeEventListener('storage', handleExternalProfileChange);
    };
  }, [userCode]);

  // ── Theme load (runs once after user id is known) ─────────────────────────
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const response = await axios.get(
          `${API_BASE}/user/preferences/${userId}/theme?db=${DB_NAME}`
        );
        if (response.data.success && response.data.value) {
          const dbTheme = response.data.value.toLowerCase();
          if (dbTheme !== theme) updateTheme(dbTheme);
        }
      } catch {
        const localTheme = localStorage.getItem('userTheme');
        if (localTheme && localTheme !== theme) updateTheme(localTheme);
      }
    })();
  }, [userId]); // eslint-disable-line

  const handleThemeChange = async (newTheme) => {
    setThemeSaveStatus({ saving: true, saved: false, error: false, message: "Saving theme preference..." });
    try {
      updateTheme(newTheme);
      const uid = getCurrentUserId();
      if (uid) {
        try {
          const response = await axios.post(`${API_BASE}/user/preferences/save?db=${DB_NAME}`, {
            userId:          uid,
            preferenceKey:   'theme',
            preferenceValue: newTheme.charAt(0).toUpperCase() + newTheme.slice(1),
          });
          if (response.data.success) {
            setThemeSaveStatus({ saving: false, saved: true, error: false, message: "Theme saved to database successfully!" });
          }
        } catch {
          setThemeSaveStatus({ saving: false, saved: true, error: false, message: "Theme saved locally (database error)" });
        }
      } else {
        setThemeSaveStatus({ saving: false, saved: true, error: false, message: "Theme saved locally" });
      }
      setTimeout(() => setThemeSaveStatus({ saving: false, saved: false, error: false, message: "" }), 3000);
    } catch {
      setThemeSaveStatus({ saving: false, saved: false, error: true, message: "Error saving theme" });
      setTimeout(() => setThemeSaveStatus({ saving: false, saved: false, error: false, message: "" }), 3000);
    }
  };

  // ── Database order ─────────────────────────────────────────────────────────
  const handleDatabaseOrderChange = (newOrder) => {
    setDatabaseOrder(newOrder);
    // persistDbOrder(newOrder); // persistence disabled
  };

  // ── Profile image ──────────────────────────────────────────────────────────
  const handleProfileImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview(reader.result);
      setShowUploadModal(true);
    };
    reader.readAsDataURL(file);
  };

  const saveProfileImage = () => {
    if (uploadPreview) {
      setProfileImage(uploadPreview);
      localStorage.setItem(getProfileImageKey(userCode), uploadPreview);
      setShowUploadModal(false);
      setUploadPreview(null);
      broadcastProfileUpdate({ userCode, profileImage: uploadPreview, userName, initials });
    }
  };

  const removeProfileImage = () => {
    setProfileImage(null);
    localStorage.removeItem(getProfileImageKey(userCode));
    setShowUploadModal(false);
    setUploadPreview(null);
    broadcastProfileUpdate({ userCode, profileImage: null, userName, initials });
  };

  /* ── Sub-components ──────────────────────────────────────────────────────── */

  // Settings "row" — Apple System Settings style
  const SettingRow = ({ label, description, children, stacked = false }) => (
    <div style={{
      padding: '20px 0',
      display: 'flex',
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      justifyContent: 'space-between',
      gap: stacked ? 12 : 24,
      borderBottom: `1px solid ${K.hairline}`,
    }}>
      <div style={{ maxWidth: stacked ? '100%' : 320 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: K.ink, margin: 0 }}>{label}</p>
        {description && (
          <p style={{ fontSize: 11.5, color: K.muted, margin: '3px 0 0', lineHeight: 1.45 }}>{description}</p>
        )}
      </div>
      <div style={{
        flexShrink: 0,
        width: stacked ? '100%' : 'auto',
        display: 'flex',
        justifyContent: stacked ? 'flex-start' : 'flex-end',
      }}>
        {children}
      </div>
    </div>
  );

  const ThemeSelector = ({ currentTheme, onThemeChange }) => {
    const themes = [
      { id: 'light', name: 'Light', icon: Sun,  description: 'Bright and clear'  },
      { id: 'dark',  name: 'Dark',  icon: Moon, description: 'Easy on the eyes' },
    ];
    return (
      <div style={{ width: 260 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
          padding: 5,
          background: K.chipBg,
          border: `1px solid ${K.hairline}`,
          borderRadius: 14,
        }}>
          {themes.map((t) => {
            const active = currentTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => !themeSaveStatus.saving && onThemeChange(t.id)}
                disabled={themeSaveStatus.saving}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '9px 12px', borderRadius: 10,
                  fontSize: 12.5, fontWeight: 600,
                  border: active ? `1px solid ${K.hairline}` : '1px solid transparent',
                  background: active ? (isDark ? 'rgba(255,255,255,0.08)' : '#ffffff') : 'transparent',
                  color: active ? APPLE.blue : K.muted,
                  cursor: themeSaveStatus.saving ? 'not-allowed' : 'pointer',
                  opacity: themeSaveStatus.saving ? 0.6 : 1,
                  transition: 'all 0.2s',
                  boxShadow: active ? (isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(30,41,79,0.08)') : 'none',
                  fontFamily: fontStack,
                }}
              >
                {themeSaveStatus.saving && active
                  ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <t.icon size={14} />}
                {t.name}
                {active && !themeSaveStatus.saving && <Check size={12} />}
              </button>
            );
          })}
        </div>
        {(themeSaveStatus.saving || themeSaveStatus.saved || themeSaveStatus.error) && (
          <div style={{
            marginTop: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
            color: themeSaveStatus.error ? APPLE.red
                 : themeSaveStatus.saved ? APPLE.green
                 : APPLE.blue,
            fontFamily: fontStack,
          }}>
            {themeSaveStatus.saving && <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />}
            {themeSaveStatus.saved && !themeSaveStatus.error && <CheckCircle size={11} />}
            {themeSaveStatus.error && <X size={11} />}
            <span>{themeSaveStatus.message}</span>
          </div>
        )}
      </div>
    );
  };

  /* ─── DATABASE ORDER PREFERENCES — DISABLED ─────────────────────────── */
  // const DatabaseOrderPreferences = ({ currentOrder, onOrderChange }) => { ... };

  const ProfileUploadModal = () => {
    if (!showUploadModal) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
        <div
          className="dash-glass dash-pop"
          style={{
            width: '100%', maxWidth: 460,
            background: K.glassDeep,
            border: `1px solid ${K.rim}`,
            borderRadius: 22,
            boxShadow: K.shadow,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '24px 24px 20px' }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 22,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: K.ink, margin: 0, letterSpacing: '-0.01em' }}>
                Update Profile Picture
              </h3>
              <button
                onClick={() => { setShowUploadModal(false); setUploadPreview(null); }}
                style={{
                  padding: 6, borderRadius: 10, border: 'none',
                  background: 'transparent', color: K.muted, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = K.muted; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Preview */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{
                  width: 128, height: 128, borderRadius: '50%', overflow: 'hidden',
                  border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ffffff'}`,
                  boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(30,41,79,0.15)',
                }}>
                  {uploadPreview ? (
                    <img src={uploadPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : profileImage ? (
                    <img src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 32, fontWeight: 700, color: '#fff', fontFamily: fontStack }}>{initials}</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: K.muted, margin: 0, fontFamily: fontStack }}>
                  Upload a new profile picture. JPG, PNG, or GIF
                </p>
                <p style={{ fontSize: 11, color: K.faint, margin: '4px 0 0', fontFamily: monoStack }}>
                  Max file size: 5MB
                </p>
              </div>

              {/* Upload buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 16, cursor: 'pointer',
                    border: `1.5px dashed ${K.hairline}`, borderRadius: 14,
                    background: K.chipBg,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = APPLE.blue; e.currentTarget.style.background = `${APPLE.blue}14`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = K.hairline; e.currentTarget.style.background = K.chipBg; }}
                >
                  <Upload size={20} color={K.muted} style={{ marginBottom: 8 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: K.ink, fontFamily: fontStack }}>Upload New</span>
                  <input type="file" accept="image/*" onChange={handleProfileImageUpload} style={{ display: 'none' }} />
                </label>
                <button
                  onClick={() => alert("Camera functionality would open here in a real app")}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 16, cursor: 'pointer',
                    border: `1.5px solid ${K.hairline}`, borderRadius: 14,
                    background: 'transparent',
                    transition: 'all 0.2s', fontFamily: fontStack,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = APPLE.blue; e.currentTarget.style.background = `${APPLE.blue}14`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = K.hairline; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Camera size={20} color={K.muted} style={{ marginBottom: 8 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: K.ink }}>Take Photo</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={removeProfileImage}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 999,
                  background: `${APPLE.red}14`, color: APPLE.red,
                  border: `1px solid ${APPLE.red}33`,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: fontStack, transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = `${APPLE.red}22`}
                onMouseLeave={(e) => e.currentTarget.style.background = `${APPLE.red}14`}
              >
                Remove
              </button>
              <button
                onClick={saveProfileImage}
                disabled={!uploadPreview && !profileImage}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 999,
                  border: 'none',
                  background: (uploadPreview || profileImage)
                    ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                    : K.chipBg,
                  color: (uploadPreview || profileImage) ? '#fff' : K.faint,
                  fontSize: 13, fontWeight: 600,
                  cursor: (uploadPreview || profileImage) ? 'pointer' : 'not-allowed',
                  opacity: (uploadPreview || profileImage) ? 1 : 0.6,
                  fontFamily: fontStack, transition: 'all 0.2s',
                  boxShadow: (uploadPreview || profileImage) ? `0 4px 16px -6px ${APPLE.blue}88` : 'none',
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const navItems = [
    { id: 'profile',    label: 'Profile',    icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    // { id: 'databases', label: 'Databases', icon: Database }, // disabled
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="dash-page" style={{ display: 'flex', minHeight: '100vh', width: '100%', background: K.bg, fontFamily: fontStack, color: K.ink }}>
      <style>{DASH_FONT}</style>

      {/* Aurora wash */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            radial-gradient(700px circle at 8% 0%, ${APPLE.blue}${isDark ? "26" : "30"}, transparent 55%),
            radial-gradient(650px circle at 92% 10%, ${APPLE.purple}${isDark ? "1a" : "20"}, transparent 55%)
          `,
          zIndex: 0,
        }}
      />

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userDbOrder={databaseOrder}
      />

      <main style={{
        position: 'relative', flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: '100vh', marginLeft: collapsed ? 80 : 256,
        transition: 'margin-left 0.4s cubic-bezier(.4,0,.2,1)', zIndex: 1,
      }}>
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          profileImage={profileImage}
          //logo={userpreference}
          theme={theme}
        />

        <div className="dash-scroll" style={{ paddingTop: 64, flex: 1, padding: '80px 32px 40px', overflowY: 'auto' }}>
          <div
            className="nx-card dash-glass"
            style={{
              background: K.glass,
              border: `1px solid ${K.hairline}`,
              borderRadius: 22,
              boxShadow: K.shadow,
              padding: '32px 32px 36px',
              maxWidth: 1200, margin: '0 auto',
            }}
          >
            {/* ── Title bar ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 28, paddingBottom: 20,
              borderBottom: `1px solid ${K.hairline}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 16px -4px ${APPLE.blue}88`, flexShrink: 0,
                }}>
                  <SettingsIcon size={22} color="#fff" />
                </div>
                <div>
                  <h1 style={{ fontSize: 17, fontWeight: 700, color: K.ink, margin: 0, letterSpacing: '-0.01em' }}>
                    Settings
                  </h1>
                  <p style={{ fontSize: 12, color: K.muted, margin: '3px 0 0', fontWeight: 400 }}>
                    Manage your account and app preferences
                  </p>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 999,
                background: K.chipBg, border: `1px solid ${K.hairline}`,
                fontSize: 11, color: K.muted, fontWeight: 500, fontFamily: monoStack,
              }}>
                {userCode || '—'}
              </div>
            </div>

            {/* ── Form: side nav + content panel ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Side nav (horizontal pills) */}
              <nav style={{
                display: 'flex', gap: 6, padding: 5,
                background: K.chipBg,
                border: `1px solid ${K.hairline}`,
                borderRadius: 14,
                alignSelf: 'flex-start',
              }}>
                {navItems.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 16px', borderRadius: 10,
                        fontSize: 13, fontWeight: 600,
                        border: active ? `1px solid ${K.hairline}` : '1px solid transparent',
                        background: active ? (isDark ? 'rgba(255,255,255,0.08)' : '#ffffff') : 'transparent',
                        color: active ? APPLE.blue : K.muted,
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: active ? (isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(30,41,79,0.08)') : 'none',
                        fontFamily: fontStack,
                      }}
                    >
                      <item.icon size={14} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Content panel */}
              <div className="dash-glass" style={{
                background: K.glass,
                border: `1px solid ${K.hairline}`,
                borderRadius: 18,
                padding: '8px 24px 12px',
              }}>
                {/* Profile section */}
                {activeSection === 'profile' && (
                  <div>
                    <div style={{ padding: '16px 0 4px' }}>
                      <h2 style={{ fontSize: 14, fontWeight: 700, color: K.ink, margin: 0, letterSpacing: '-0.01em' }}>
                        Profile
                      </h2>
                      <p style={{ fontSize: 12, color: K.muted, margin: '3px 0 0' }}>
                        Your basic account information
                      </p>
                    </div>
                    <div>
                      <SettingRow
                        label="Profile picture"
                        description="JPG, PNG or GIF. Max 5MB. Updates your avatar everywhere, including the navbar."
                      >
                        <button
                          onClick={() => setShowUploadModal(true)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            padding: 0, fontFamily: fontStack,
                          }}
                        >
                          <div style={{
                            width: 52, height: 52, borderRadius: '50%', overflow: 'hidden',
                            border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ffffff'}`,
                            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(30,41,79,0.12)',
                            transition: 'opacity 0.2s',
                          }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          >
                            {profileImage ? (
                              <img src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{
                                width: '100%', height: '100%',
                                background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: fontStack }}>{initials}</span>
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: APPLE.blue }}>Change</span>
                        </button>
                      </SettingRow>
                      <SettingRow label="Display name" description="How your name appears across the app">
                        <div style={{ fontSize: 13, color: K.ink, fontWeight: 500, fontFamily: fontStack }}>
                          {userName || '—'}
                        </div>
                      </SettingRow>
                      <SettingRow label="User code" description="Your unique account identifier">
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: K.muted,
                          fontFamily: monoStack,
                          padding: '3px 9px', borderRadius: 7,
                          background: K.chipBg, border: `1px solid ${K.hairline}`,
                        }}>
                          {userCode || '—'}
                        </div>
                      </SettingRow>
                    </div>
                  </div>
                )}

                {/* Appearance section */}
                {activeSection === 'appearance' && (
                  <div>
                    <div style={{ padding: '16px 0 4px' }}>
                      <h2 style={{ fontSize: 14, fontWeight: 700, color: K.ink, margin: 0, letterSpacing: '-0.01em' }}>
                        Appearance
                      </h2>
                      <p style={{ fontSize: 12, color: K.muted, margin: '3px 0 0' }}>
                        Customize how the app looks on your device
                      </p>
                    </div>
                    <div>
                      <SettingRow label="Theme" description="Switch between light and dark mode">
                        <ThemeSelector currentTheme={theme} onThemeChange={handleThemeChange} />
                      </SettingRow>
                      <SettingRow label="Sync status" description="Where this preference is stored" stacked>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 12px', borderRadius: 12,
                          background: K.chipBg, border: `1px solid ${K.hairline}`,
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: 999,
                            background: userId ? APPLE.green : APPLE.orange,
                            boxShadow: `0 0 8px ${userId ? APPLE.green : APPLE.orange}88`,
                          }} />
                          <p style={{ fontSize: 12, color: K.muted, margin: 0, fontFamily: fontStack }}>
                            {userId
                              ? `Saved to the ${DB_NAME} database and synced across your devices.`
                              : 'Saved locally on this device. Sign in to sync across devices.'}
                          </p>
                        </div>
                      </SettingRow>
                    </div>
                  </div>
                )}

                {/* Database order section intentionally disabled. */}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ProfileUploadModal />
    </div>
  );
}

export default Settings;