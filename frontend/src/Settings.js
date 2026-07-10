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

const API_BASE            = 'http://192.168.100.193:3009/api';
const DB_NAME             = 'USER';
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

/* ────────────────────────────────────────────────────────────────────────
 * DATABASE ORDER PERSISTENCE — DISABLED
 * The drag-to-reorder database preference feature is temporarily turned
 * off. Logic kept intact (commented) so it can be re-enabled later without
 * having to rebuild it from scratch.
 * ──────────────────────────────────────────────────────────────────────── */
// /**
//  * Save order keyed by user ID.
//  * Falls back to a generic key only when no user is logged in.
//  */
// function persistDbOrder(order) {
//   try {
//     const uid = getCurrentUserId();
//     const key = uid ? `${USER_DB_ORDER_PREFIX}${uid}` : 'databaseOrder';
//     localStorage.setItem(key, JSON.stringify(order));
//   } catch {}
// }
//
// /**
//  * Load order for the current user.
//  * Checks per-user key first, then legacy shared key as a one-time migration.
//  */
// function readDbOrder() {
//   try {
//     const uid = getCurrentUserId();
//     if (uid) {
//       const perUser = localStorage.getItem(`${USER_DB_ORDER_PREFIX}${uid}`);
//       if (perUser) return JSON.parse(perUser);
//     }
//     // Legacy migration: if old shared key exists, adopt it then remove it
//     const legacy = localStorage.getItem('databaseOrder');
//     if (legacy) {
//       const parsed = JSON.parse(legacy);
//       if (uid) {
//         // Migrate to per-user key and clean up the shared one
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
  const location = useLocation();
  const { theme, updateTheme } = useTheme();
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

    // Use the SAME per-user key that Header.jsx reads/writes, so both
    // components always show the exact same avatar.
    const savedImage = localStorage.getItem(getProfileImageKey(code));
    if (savedImage) setProfileImage(savedImage);

    // Database order loading disabled — keeping default order in state.
    // const savedOrder = readDbOrder();
    // if (savedOrder) setDatabaseOrder(savedOrder);

    if (uid) loadThemeFromDatabase(uid);
  }, []); // eslint-disable-line

  // ── Keep Settings in sync with profile changes made elsewhere ─────────────
  // 1) Same-tab, other components (e.g. Header): listen for PROFILE_UPDATED_EVENT.
  // 2) Other tabs/windows: the native 'storage' event fires automatically
  //    whenever localStorage.setItem(<same key>, ...) runs elsewhere.
  useEffect(() => {
    if (!userCode) return;

    const handleProfileUpdated = (e) => {
      if (!e.detail) return;
      // Ignore updates for a different user code, if ever relevant.
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

  // ── Theme ──────────────────────────────────────────────────────────────────
  const loadThemeFromDatabase = async (userIdentifier) => {
    try {
      const response = await axios.get(
        `${API_BASE}/user/preferences/${userIdentifier}/theme?db=${DB_NAME}`
      );
      if (response.data.success && response.data.value) {
        const dbTheme = response.data.value.toLowerCase();
        if (dbTheme !== theme) updateTheme(dbTheme);
      }
    } catch {
      const localTheme = localStorage.getItem('userTheme');
      if (localTheme && localTheme !== theme) updateTheme(localTheme);
    }
  };

  const handleThemeChange = async (newTheme) => {
    setThemeSaveStatus({ saving: true, saved: false, error: false, message: "Saving theme preference..." });
    try {
      updateTheme(newTheme);
      // Use getCurrentUserId() instead of state — avoids stale closure
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
  // Handler kept (commented body) in case the feature is switched back on.
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
      // Save to the SAME per-user key that Header.jsx reads/writes.
      localStorage.setItem(getProfileImageKey(userCode), uploadPreview);
      setShowUploadModal(false);
      setUploadPreview(null);
      // Sync the navbar/Header immediately.
      broadcastProfileUpdate({ userCode, profileImage: uploadPreview, userName, initials });
    }
  };

  const removeProfileImage = () => {
    setProfileImage(null);
    localStorage.removeItem(getProfileImageKey(userCode));
    setShowUploadModal(false);
    setUploadPreview(null);
    // Sync the navbar/Header immediately.
    broadcastProfileUpdate({ userCode, profileImage: null, userName, initials });
  };

  // ── Sub-components ─────────────────────────────────────────────────────────
  // A single settings "row" — label + description on the left, control on the right.
  // This is the core building block of the form-style layout.
  const SettingRow = ({ label, description, children, stacked = false }) => (
    <div className={`py-5 flex ${stacked ? 'flex-col gap-3' : 'flex-col sm:flex-row sm:items-center sm:justify-between gap-4'} border-b border-slate-100 dark:border-gray-700/60 last:border-b-0`}>
      <div className="sm:max-w-xs">
        <p className="text-sm font-medium text-slate-800 dark:text-gray-200">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className={stacked ? 'w-full' : 'flex-shrink-0 w-full sm:w-auto'}>{children}</div>
    </div>
  );

  const ThemeSelector = ({ currentTheme, onThemeChange }) => {
    const themes = [
      { id: 'light', name: 'Light', icon: Sun,  description: 'Bright and clear'  },
      { id: 'dark',  name: 'Dark',  icon: Moon, description: 'Easy on the eyes' },
    ];
    return (
      <div className="w-full sm:w-72">
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-gray-900/60 rounded-xl">
          {themes.map((themeOption) => {
            const active = currentTheme === themeOption.id;
            return (
              <button
                key={themeOption.id}
                type="button"
                onClick={() => !themeSaveStatus.saving && onThemeChange(themeOption.id)}
                disabled={themeSaveStatus.saving}
                className={`relative flex items-center gap-2 justify-center py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                } ${themeSaveStatus.saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {themeSaveStatus.saving && active ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <themeOption.icon className="w-4 h-4" />
                )}
                {themeOption.name}
                {active && !themeSaveStatus.saving && (
                  <Check className="w-3.5 h-3.5 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
        {(themeSaveStatus.saving || themeSaveStatus.saved || themeSaveStatus.error) && (
          <div className={`mt-2 text-xs flex items-center gap-1.5 ${
            themeSaveStatus.error
              ? 'text-red-500'
              : themeSaveStatus.saved
              ? 'text-emerald-500'
              : 'text-blue-500'
          }`}>
            {themeSaveStatus.saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {themeSaveStatus.saved && !themeSaveStatus.error && <CheckCircle className="w-3 h-3" />}
            {themeSaveStatus.error && <X className="w-3 h-3" />}
            <span>{themeSaveStatus.message}</span>
          </div>
        )}
      </div>
    );
  };

  /* ──────────────────────────────────────────────────────────────────────
   * DATABASE ORDER PREFERENCES — DISABLED
   * Component kept in full so drag-to-reorder can be restored later.
   * Not rendered anywhere below.
   * ────────────────────────────────────────────────────────────────────── */
  // const DatabaseOrderPreferences = ({ currentOrder, onOrderChange }) => {
  //   const [dragItem,     setDragItem]     = useState(null);
  //   const [dragOverItem, setDragOverItem] = useState(null);
  //   const [localOrder,   setLocalOrder]   = useState(currentOrder);
  //
  //   useEffect(() => { setLocalOrder(currentOrder); }, [currentOrder]);
  //
  //   const databases = [
  //     { id: 'van',    name: 'VAN Database',    color: 'from-blue-500 to-blue-600',    icon: Database },
  //     { id: 'nexchem',name: 'NEXCHEM Database', color: 'from-purple-500 to-purple-600', icon: Database },
  //     { id: 'vcp',    name: 'VCP Database',    color: 'from-emerald-500 to-emerald-600', icon: Database },
  //   ];
  //
  //   const sortedDatabases = [...databases].sort((a, b) => (localOrder[a.id] ?? 99) - (localOrder[b.id] ?? 99));
  //
  //   const handleDragStart = (e, index) => {
  //     setDragItem(index);
  //     e.dataTransfer.effectAllowed = 'move';
  //   };
  //   const handleDragOver = (e, index) => {
  //     e.preventDefault();
  //     setDragOverItem(index);
  //   };
  //   const handleDrop = (e, dropIndex) => {
  //     e.preventDefault();
  //     if (dragItem === null || dragItem === dropIndex) return;
  //     const newOrder = { ...localOrder };
  //     const draggedId = sortedDatabases[dragItem].id;
  //     const dropId    = sortedDatabases[dropIndex].id;
  //     const temp      = newOrder[draggedId];
  //     newOrder[draggedId] = newOrder[dropId];
  //     newOrder[dropId]    = temp;
  //     setLocalOrder(newOrder);
  //     setDragItem(null);
  //     setDragOverItem(null);
  //     onOrderChange(newOrder);
  //   };
  //   const handleDragEnd = () => {
  //     setDragItem(null);
  //     setDragOverItem(null);
  //   };
  //
  //   return (
  //     <div className="space-y-3">
  //       {/* ... original drag list markup unchanged ... */}
  //     </div>
  //   );
  // };

  const ProfileUploadModal = () => {
    if (!showUploadModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Update Profile Picture
              </h3>
              <button
                onClick={() => { setShowUploadModal(false); setUploadPreview(null); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg">
                  {uploadPreview ? (
                    <img src={uploadPreview}  alt="Preview" className="w-full h-full object-cover" />
                  ) : profileImage ? (
                    <img src={profileImage}   alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">{initials}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Upload a new profile picture. Supported formats: JPG, PNG, GIF
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max file size: 5MB</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload New</span>
                  <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="hidden" />
                </label>
                <button
                  onClick={() => alert("Camera functionality would open here in a real app")}
                  className="flex flex-col items-center justify-center p-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors"
                >
                  <Camera className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Take Photo</span>
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={removeProfileImage}
                className="flex-1 py-2.5 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                Remove
              </button>
              <button
                onClick={saveProfileImage}
                disabled={!uploadPreview && !profileImage}
                className={`flex-1 py-2.5 px-4 font-medium rounded-lg transition-colors ${
                  uploadPreview || profileImage
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 font-poppins text-slate-900 dark:text-gray-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userDbOrder={databaseOrder}
      />
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${collapsed ? "ml-20" : "ml-64"}`}>
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          profileImage={profileImage}
          //logo={userpreference}
          theme={theme}
        />
        <div className="pt-16 flex-1 p-6 md:p-8 overflow-auto mt-10">
          <div className="w-full max-w-5xl mx-auto mt-6">
            {/* Page title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                <SettingsIcon className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100 leading-tight">Settings</h1>
                <p className="text-xs text-slate-500 dark:text-gray-400">Manage your account and app preferences</p>
              </div>
            </div>
            {/* Settings form shell: side nav + content panel */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* Side nav */}
              <nav className="md:w-52 flex-shrink-0">
                <div className="flex md:flex-col gap-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-slate-200/70 dark:border-gray-700/60 rounded-2xl p-2 shadow-sm">
                  {navItems.map((item) => {
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                          active
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700/40'
                        }`}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>
              {/* Content panel */}
              <div className="flex-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-slate-200/70 dark:border-gray-700/60 rounded-2xl shadow-sm overflow-hidden">
                {/* Profile section */}
                {activeSection === 'profile' && (
                  <div>
                    <div className="px-6 pt-6 pb-2">
                      <h2 className="text-base font-semibold text-slate-800 dark:text-gray-200">Profile</h2>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        Your basic account information
                      </p>
                    </div>
                    <div className="px-6 pb-6">
                      <SettingRow label="Profile picture" description="JPG, PNG or GIF. Max 5MB. Updates your avatar everywhere, including the navbar.">
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="flex items-center gap-3 group"
                        >
                          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white dark:border-gray-700 shadow-md group-hover:opacity-80 transition-opacity">
                            {profileImage ? (
                              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-lg font-bold text-white">{initials}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Change</span>
                        </button>
                      </SettingRow>
                      <SettingRow label="Display name" description="How your name appears across the app">
                        <div className="text-sm text-slate-700 dark:text-gray-300 sm:text-right">
                          {userName || '—'}
                        </div>
                      </SettingRow>
                      <SettingRow label="User code" description="Your unique account identifier">
                        <div className="text-sm font-mono text-slate-700 dark:text-gray-300 sm:text-right">
                          {userCode || '—'}
                        </div>
                      </SettingRow>
                    </div>
                  </div>
                )}
                {/* Appearance section */}
                {activeSection === 'appearance' && (
                  <div>
                    <div className="px-6 pt-6 pb-2">
                      <h2 className="text-base font-semibold text-slate-800 dark:text-gray-200">Appearance</h2>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        Customize how the app looks on your device
                      </p>
                    </div>
                    <div className="px-6 pb-6">
                      <SettingRow label="Theme" description="Switch between light and dark mode">
                        <ThemeSelector currentTheme={theme} onThemeChange={handleThemeChange} />
                      </SettingRow>
                      <SettingRow label="Sync status" description="Where this preference is stored" stacked>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          {userId
                            ? `Saved to the ${DB_NAME} database and synced across your devices.`
                            : 'Saved locally on this device. Sign in to sync across devices.'}
                        </p>
                      </SettingRow>
                    </div>
                  </div>
                )}
                {/*
                  Database order section intentionally disabled.
                  To restore: add the nav item back above, add a
                  `databases` case here rendering <DatabaseOrderPreferences />,
                  and uncomment persistDbOrder / readDbOrder / the component
                  definition further up this file.
                */}
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