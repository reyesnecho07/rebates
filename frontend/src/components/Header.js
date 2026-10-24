// src/components/Header.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Loader2, CheckCircle, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';

/* ─── Apple system colour language ───────────────────────────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const tokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.9)"   : "rgba(255,255,255,0.95)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const FONT = `
  .hd-page, .hd-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .hd-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  @keyframes hd-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .hd-pop { animation: hd-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
  @keyframes hd-fade { from { opacity: 0; } to { opacity: 1; } }
  .hd-fade { animation: hd-fade 0.2s ease-out; }
`;

// ── Shared profile-sync constants ────────────────────────────────────────
const PROFILE_UPDATED_EVENT = 'app:profile-updated';
const getProfileImageKey = (userCode) => `userProfileImage_${userCode}`;

const Header = ({
  collapsed = false,
  userName = '',
  userCode = '',
  initials = '',
  logo,
  darkModeLogo,
  theme = 'light',
  profileImage: profileImageProp,
}) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [themeSaveStatus, setThemeSaveStatus] = useState({
    saving: false,
    saved: false,
    error: false,
    message: ""
  });

  const { theme: currentTheme, updateTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const K = tokens(isDark);

  const fileInputRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const profileButtonRef = useRef(null);
  const API_BASE = 'http://192.168.100.193:3009/api';
  const DB_NAME = 'USER';

  useEffect(() => {
    if (profileImageProp !== undefined) {
      setProfileImage(profileImageProp);
    }
  }, [profileImageProp]);

  useEffect(() => {
    if (profileImageProp !== undefined) return;
    const savedImage = localStorage.getItem(getProfileImageKey(userCode));
    setProfileImage(savedImage || null);
  }, [userCode, profileImageProp]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown &&
          profileDropdownRef.current &&
          !profileDropdownRef.current.contains(event.target) &&
          profileButtonRef.current &&
          !profileButtonRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  const handleThemeToggle = async (newTheme) => {
    setThemeSaveStatus({
      saving: true,
      saved: false,
      error: false,
      message: "Saving theme..."
    });
    try {
      updateTheme(newTheme);
      const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
      const userId = storedUser.UserID || storedUser.User_ID;
      if (userId) {
        try {
          const response = await axios.post(`${API_BASE}/user/preferences/save?db=${DB_NAME}`, {
            userId: userId,
            preferenceKey: 'theme',
            preferenceValue: newTheme.charAt(0).toUpperCase() + newTheme.slice(1)
          });
          if (response.data.success) {
            console.log('Theme saved to database:', response.data);
            setThemeSaveStatus({
              saving: false,
              saved: true,
              error: false,
              message: "Theme saved!"
            });
          }
        } catch (dbError) {
          console.error('Database save error:', dbError);
          setThemeSaveStatus({
            saving: false,
            saved: true,
            error: false,
            message: "Theme saved locally"
          });
        }
      } else {
        localStorage.setItem('userTheme', newTheme);
        setThemeSaveStatus({
          saving: false,
          saved: true,
          error: false,
          message: "Theme saved locally"
        });
      }
      setTimeout(() => {
        setThemeSaveStatus({ saving: false, saved: false, error: false, message: "" });
      }, 3000);
    } catch (error) {
      console.error('Error toggling theme:', error);
      setThemeSaveStatus({
        saving: false,
        saved: false,
        error: true,
        message: "Error saving theme"
      });
      setTimeout(() => {
        setThemeSaveStatus({ saving: false, saved: false, error: false, message: "" });
      }, 3000);
    }
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    if (!file.type.match('image/(jpeg|png|gif|jpg|webp)')) {
      alert('Only JPG, PNG, GIF, and WebP files are allowed');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const broadcastProfileUpdate = (image) => {
    try {
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, {
        detail: { userCode, profileImage: image, userName, initials }
      }));
    } catch {}
  };

  const saveProfileImage = () => {
    let imageToSave = uploadPreview || profileImage;
    if (imageToSave) {
      localStorage.setItem(getProfileImageKey(userCode), imageToSave);
      if (uploadPreview) setProfileImage(uploadPreview);
      if (window.updateUserProfileImage) window.updateUserProfileImage(imageToSave);
      broadcastProfileUpdate(imageToSave);
      console.log('Profile image saved:', imageToSave);
    }
    setShowUploadModal(false);
    setUploadPreview(null);
  };

  const removeProfileImage = () => {
    localStorage.removeItem(getProfileImageKey(userCode));
    setProfileImage(null);
    setUploadPreview(null);
    if (window.updateUserProfileImage) window.updateUserProfileImage(null);
    broadcastProfileUpdate(null);
    console.log('Profile image removed');
  };

  useEffect(() => {
    const handleProfileUpdated = (e) => {
      if (!e.detail) return;
      if (e.detail.userCode !== userCode) return;
      setProfileImage(e.detail.profileImage || null);
    };
    const handleStorageChange = (e) => {
      if (e.key === getProfileImageKey(userCode)) {
        setProfileImage(e.newValue || null);
      }
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [userCode]);

  const handleProfileClick = () => {
    if (showProfileDropdown) {
      setShowUploadModal(true);
    }
  };

  const XIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
  const UploadIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
  const CameraIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <>
      <style>{FONT}</style>
      <header
        className="hd-page hd-glass fixed top-0 right-0 h-16 flex items-center px-8 border-b z-40 transition-all duration-500"
        style={{
          left: collapsed ? '80px' : '256px',
          width: collapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
          background: K.glass,
          borderColor: K.hairline,
          boxShadow: isDark ? "0 4px 24px -8px rgba(0,0,0,0.4)" : "0 4px 24px -8px rgba(30,41,79,0.08)",
        }}
      >
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <div className="relative" style={{ height: "90px" }}>
            <img
              src={logo}
              alt=""
              style={{ height: "90px", width: "auto" }}
              className={`object-contain ${isDark ? 'opacity-0' : 'opacity-100'}`}
            />
            <div
              className={`absolute inset-0 ${isDark ? 'opacity-100' : 'opacity-0'}`}
              style={{
                maskImage: `url(${logo})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                backgroundColor: 'white',
                WebkitMaskImage: `url(${logo})`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
              }}
            />
          </div>
        </div>

        {/* User Profile Section */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="relative">
            <button
              ref={profileButtonRef}
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors"
              style={{ background: showProfileDropdown ? K.chipBg : "transparent" }}
              onMouseEnter={(e) => { if (!showProfileDropdown) e.currentTarget.style.background = K.chipBg; }}
              onMouseLeave={(e) => { if (!showProfileDropdown) e.currentTarget.style.background = "transparent"; }}
            >
              <div
                className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium uppercase overflow-hidden group cursor-pointer"
                style={{ boxShadow: `0 0 0 2px ${APPLE.blue}33` }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (showProfileDropdown) {
                    handleProfileClick();
                  }
                }}
              >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.querySelector('.profile-initials').style.display = 'flex';
                    }}
                  />
                ) : null}

                <div
                  className={`w-full h-full flex items-center justify-center profile-initials ${profileImage ? 'hidden' : ''}`}
                  style={{
                    background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                  }}
                >
                  {initials}
                </div>

                {showProfileDropdown && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                    <CameraIcon className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-tight" style={{ color: K.ink }}>{userName}</p>
                <p className="text-xs" style={{ color: K.muted }}>{userCode}</p>
              </div>

              <svg
                className={`w-4 h-4 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: K.muted }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfileDropdown && (
              <div
                ref={profileDropdownRef}
                className="hd-glass hd-pop absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-50"
                style={{
                  background: K.glassDeep,
                  border: `1px solid ${K.rim}`,
                  boxShadow: K.shadow,
                }}
              >
                {/* Profile Summary */}
                <div className="px-4 py-3 border-b" style={{ borderColor: K.hairline }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="relative w-10 h-10 rounded-full overflow-hidden group cursor-pointer"
                      style={{ boxShadow: `0 0 0 2px ${APPLE.blue}33` }}
                      onClick={() => {
                        setShowProfileDropdown(false);
                        setShowUploadModal(true);
                      }}
                    >
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt="Profile"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.querySelector('.dropdown-initials').style.display = 'flex';
                          }}
                        />
                      ) : null}

                      <div
                        className={`w-full h-full flex items-center justify-center text-white font-medium uppercase dropdown-initials ${profileImage ? 'hidden' : ''}`}
                        style={{ background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)` }}
                      >
                        {initials}
                      </div>

                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: K.ink }}>{userName}</p>
                      <p className="text-sm truncate" style={{ color: K.muted }}>{userCode}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  {/* Theme Toggle */}
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: K.hairline }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: K.ink }}>Theme</span>

                      {themeSaveStatus.saving && (
                        <div className="flex items-center gap-1 text-xs" style={{ color: APPLE.blue }}>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Saving…</span>
                        </div>
                      )}
                      {themeSaveStatus.saved && !themeSaveStatus.error && (
                        <div className="flex items-center gap-1 text-xs" style={{ color: APPLE.green }}>
                          <CheckCircle className="w-3 h-3" />
                          <span>Saved</span>
                        </div>
                      )}
                      {themeSaveStatus.error && (
                        <div className="flex items-center gap-1 text-xs" style={{ color: APPLE.red }}>
                          <X className="w-3 h-3" />
                          <span>Error</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleThemeToggle('light')}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-xl border transition-all duration-200 text-sm"
                        style={{
                          background: currentTheme === 'light' ? `${APPLE.blue}18` : K.chipBg,
                          borderColor: currentTheme === 'light' ? `${APPLE.blue}55` : K.hairline,
                          color: currentTheme === 'light' ? APPLE.blue : K.muted,
                          fontWeight: currentTheme === 'light' ? 600 : 500,
                        }}
                        onMouseEnter={(e) => {
                          if (currentTheme !== 'light') {
                            e.currentTarget.style.background = K.hover;
                            e.currentTarget.style.color = K.ink;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentTheme !== 'light') {
                            e.currentTarget.style.background = K.chipBg;
                            e.currentTarget.style.color = K.muted;
                          }
                        }}
                      >
                        <Sun className="w-4 h-4" />
                        <span>Light</span>
                      </button>

                      <button
                        onClick={() => handleThemeToggle('dark')}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-xl border transition-all duration-200 text-sm"
                        style={{
                          background: currentTheme === 'dark' ? `${APPLE.blue}18` : K.chipBg,
                          borderColor: currentTheme === 'dark' ? `${APPLE.blue}55` : K.hairline,
                          color: currentTheme === 'dark' ? APPLE.blue : K.muted,
                          fontWeight: currentTheme === 'dark' ? 600 : 500,
                        }}
                        onMouseEnter={(e) => {
                          if (currentTheme !== 'dark') {
                            e.currentTarget.style.background = K.hover;
                            e.currentTarget.style.color = K.ink;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentTheme !== 'dark') {
                            e.currentTarget.style.background = K.chipBg;
                            e.currentTarget.style.color = K.muted;
                          }
                        }}
                      >
                        <Moon className="w-4 h-4" />
                        <span>Dark</span>
                      </button>
                    </div>
                  </div>

                  {/* User Preference */}
                  <Link
                    to="/settings"
                    onClick={() => setShowProfileDropdown(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: K.muted }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = K.muted; }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>User Preference</span>
                  </Link>

                  {/* Logout */}
                  <Link
                    to="/login"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowProfileDropdown(false);
                      localStorage.removeItem(getProfileImageKey(userCode));
                      localStorage.clear();
                      window.location.href = "/login";
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-t"
                    style={{ color: APPLE.red, borderColor: K.hairline }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${APPLE.red}14`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Logout</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Profile Picture Upload Modal */}
      {showUploadModal && (
        <div
          className="hd-page fixed inset-0 flex items-center justify-center z-50 p-4 hd-fade"
          style={{
            backgroundColor: isDark ? "rgba(10,10,14,0.55)" : "rgba(0,0,0,0.35)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div
            className="hd-glass hd-pop rounded-[28px] w-full max-w-md overflow-hidden"
            style={{
              background: K.glassDeep,
              border: `1px solid ${K.rim}`,
              boxShadow: K.shadow,
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold" style={{ color: K.ink }}>
                  Update Profile Picture
                </h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadPreview(null);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: K.chipBg, color: K.muted }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex justify-center mb-4">
                  <div
                    className="w-32 h-32 rounded-full overflow-hidden"
                    style={{
                      border: `3px solid ${K.rim}`,
                      boxShadow: K.shadow,
                    }}
                  >
                    {uploadPreview ? (
                      <img src={uploadPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)` }}
                      >
                        <span className="text-3xl font-bold text-white">{initials}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center mb-6">
                  <p className="text-sm" style={{ color: K.muted }}>
                    Upload a new profile picture. Supported formats: JPG, PNG, GIF, WebP
                  </p>
                  <p className="text-xs mt-1" style={{ color: K.faint }}>
                    Max file size: 5MB
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label
                    className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors"
                    style={{ borderColor: K.hairline }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = `${APPLE.blue}88`}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = K.hairline}
                  >
                    <UploadIcon className="w-6 h-6 mb-2" style={{ color: K.muted }} />
                    <span className="text-sm font-medium" style={{ color: K.ink }}>Upload New</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => alert("Camera functionality would open here in a real app")}
                    className="flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-colors"
                    style={{ borderColor: K.hairline }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = `${APPLE.blue}88`}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = K.hairline}
                  >
                    <CameraIcon className="w-6 h-6 mb-2" style={{ color: K.muted }} />
                    <span className="text-sm font-medium" style={{ color: K.ink }}>Take Photo</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={removeProfileImage}
                  className="flex-1 py-2.5 px-4 font-medium rounded-xl transition-colors"
                  style={{
                    background: `${APPLE.red}18`,
                    color: APPLE.red,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = `${APPLE.red}28`}
                  onMouseLeave={(e) => e.currentTarget.style.background = `${APPLE.red}18`}
                >
                  Remove
                </button>
                <button
                  onClick={saveProfileImage}
                  disabled={!uploadPreview && !profileImage}
                  className="flex-1 py-2.5 px-4 font-medium rounded-xl transition-colors text-white"
                  style={{
                    background: (uploadPreview || profileImage)
                      ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                      : K.chipBg,
                    color: (uploadPreview || profileImage) ? "#FFFFFF" : K.faint,
                    cursor: (uploadPreview || profileImage) ? "pointer" : "not-allowed",
                    opacity: (uploadPreview || profileImage) ? 1 : 0.6,
                    boxShadow: (uploadPreview || profileImage)
                      ? `0 4px 16px -6px ${APPLE.blue}66`
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (uploadPreview || profileImage) e.currentTarget.style.opacity = "0.9";
                  }}
                  onMouseLeave={(e) => {
                    if (uploadPreview || profileImage) e.currentTarget.style.opacity = "1";
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;