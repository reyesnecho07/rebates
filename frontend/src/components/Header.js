import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Loader2, CheckCircle, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';

const Header = ({ 
  collapsed = false, 
  userName = '', 
  userCode = '',
  initials = '',
  logo,
  darkModeLogo, // Dark mode logo (with white text)
  theme = 'light'
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
  const fileInputRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const profileButtonRef = useRef(null);

  const API_BASE = 'http://192.168.100.193:3006/api';
  const DB_NAME = 'USER';

  // Load profile image from localStorage on component mount
  useEffect(() => {
    const savedImage = localStorage.getItem(`userProfileImage_${userCode}`);
    if (savedImage) {
      setProfileImage(savedImage);
    }
  }, [userCode]);

  // Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If dropdown is open AND click is outside both the dropdown and the profile button
      if (showProfileDropdown && 
          profileDropdownRef.current && 
          !profileDropdownRef.current.contains(event.target) &&
          profileButtonRef.current &&
          !profileButtonRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup
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
      // Update theme in context
      updateTheme(newTheme);

      // Get user ID from localStorage
      const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
      const userId = storedUser.UserID || storedUser.User_ID;

      if (userId) {
        try {
          // Save to database
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
        // No user logged in, save locally only
        localStorage.setItem('userTheme', newTheme);
        setThemeSaveStatus({
          saving: false,
          saved: true,
          error: false,
          message: "Theme saved locally"
        });
      }

      // Reset status after 3 seconds
      setTimeout(() => {
        setThemeSaveStatus({
          saving: false,
          saved: false,
          error: false,
          message: ""
        });
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
        setThemeSaveStatus({
          saving: false,
          saved: false,
          error: false,
          message: ""
        });
      }, 3000);
    }
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Check file type
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

  const saveProfileImage = () => {
    let imageToSave = uploadPreview || profileImage;
    
    if (imageToSave) {
      // Save to localStorage
      localStorage.setItem(`userProfileImage_${userCode}`, imageToSave);
      
      // Update state
      if (uploadPreview) {
        setProfileImage(uploadPreview);
      }
      
      // Optional: Sync with parent component or global state
      if (window.updateUserProfileImage) {
        window.updateUserProfileImage(imageToSave);
      }
      
      // Optional: Broadcast to other tabs/windows
      try {
        localStorage.setItem(`profileImageUpdated_${userCode}`, Date.now().toString());
      } catch (error) {
        console.log('Storage event broadcast failed:', error);
      }
      
      console.log('Profile image saved:', imageToSave);
    }
    
    setShowUploadModal(false);
    setUploadPreview(null);
  };

  const removeProfileImage = () => {
    // Remove from localStorage
    localStorage.removeItem(`userProfileImage_${userCode}`);
    
    // Update state
    setProfileImage(null);
    setUploadPreview(null);
    
    // Optional: Sync with parent component or global state
    if (window.updateUserProfileImage) {
      window.updateUserProfileImage(null);
    }
    
    // Optional: Broadcast to other tabs/windows
    try {
      localStorage.setItem(`profileImageRemoved_${userCode}`, Date.now().toString());
    } catch (error) {
      console.log('Storage event broadcast failed:', error);
    }
    
    console.log('Profile image removed');
  };

  // Listen for storage events from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === `userProfileImage_${userCode}`) {
        setProfileImage(e.newValue);
      }
      if (e.key === `profileImageUpdated_${userCode}`) {
        const savedImage = localStorage.getItem(`userProfileImage_${userCode}`);
        if (savedImage) {
          setProfileImage(savedImage);
        }
      }
      if (e.key === `profileImageRemoved_${userCode}`) {
        setProfileImage(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [userCode]);

  const handleProfileClick = () => {
    if (showProfileDropdown) {
      setShowUploadModal(true);
    }
  };

  // SVG Icons as components
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
      <header 
        className={`fixed top-0 right-0 h-16 flex items-center px-8 backdrop-blur-lg border-b z-40 transition-all duration-500 shadow-sm ${
          isDark 
            ? 'bg-gray-900/80 border-gray-700/50' 
            : 'bg-white/80 border-slate-200/50'
        }`}
        style={{ 
          left: collapsed ? '80px' : '256px',
          width: collapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
        }}
      >
        <div className="absolute left-1/2 transform -translate-x-1/2">
        <div className="relative" style={{ height: "90px" }}>
            {/* Original logo (visible in light mode) */}
            <img 
            src={logo} 
            alt="Company Logo" 
            style={{ height: "90px", width: "auto" }}
            className={`object-contain ${isDark ? 'opacity-0' : 'opacity-100'}`}
            />
            
            {/* Dark mode version - only black parts become white */}
            <div 
            className={`absolute inset-0 ${isDark ? 'opacity-100' : 'opacity-0'}`}
            style={{
                maskImage: `url(${logo})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                backgroundColor: 'white', // Only black parts will show this white
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
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
              }`}
            >
<div 
  className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium uppercase overflow-hidden group cursor-pointer"
  onClick={(e) => {
    e.stopPropagation();
    if (showProfileDropdown) {
      handleProfileClick();
    }
  }}
>
  {/* Profile Image or Initials */}
  {profileImage ? (
    <img 
      src={profileImage} 
      alt="Profile" 
      className="w-full h-full object-cover"
      onError={(e) => {
        // If image fails to load, show initials
        e.target.style.display = 'none';
        e.target.parentElement.querySelector('.profile-initials').style.display = 'flex';
      }}
    />
  ) : null}
  
  {/* Initials fallback */}
  <div className={`w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center profile-initials ${
    profileImage ? 'hidden' : ''
  }`}>
    {initials}
  </div>
  
  {/* Hover Overlay for Edit Indicator - ONLY when dropdown is open */}
  {showProfileDropdown && (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  )}
</div>
              
              <div className="hidden md:block text-left">
                <p className={`text-sm font-medium leading-tight ${
                  isDark ? 'text-gray-100' : 'text-gray-800'
                }`}>{userName}</p>
                <p className={`text-xs ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>{userCode}</p>
              </div>
              
              <svg 
                className={`w-4 h-4 transition-transform ${showProfileDropdown ? 'rotate-180' : ''} ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfileDropdown && (
              <div 
                ref={profileDropdownRef}
                className={`absolute right-0 top-full mt-2 w-56 rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-white border-gray-200'
                } border`}
              >
                {/* Profile Summary */}
                <div className={`px-4 py-3 border-b ${
                  isDark ? 'border-gray-700' : 'border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div 
                      className="relative w-10 h-10 rounded-full overflow-hidden group cursor-pointer"
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
                      
                      <div className={`w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium uppercase dropdown-initials ${
                        profileImage ? 'hidden' : ''
                      }`}>
                        {initials}
                      </div>
                      
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className={`font-medium ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>{userName}</p>
                      <p className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>{userCode}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  {/* Theme Toggle Section - ADDED HERE */}
                  <div className={`px-4 py-2.5 border-b ${
                    isDark ? 'border-gray-700' : 'border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Theme
                      </span>
                      
                      {/* Status indicator */}
                      {themeSaveStatus.saving && (
                        <div className="flex items-center gap-1 text-xs text-blue-500">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Saving...</span>
                        </div>
                      )}
                      {themeSaveStatus.saved && !themeSaveStatus.error && (
                        <div className="flex items-center gap-1 text-xs text-green-500">
                          <CheckCircle className="w-3 h-3" />
                          <span>Saved</span>
                        </div>
                      )}
                      {themeSaveStatus.error && (
                        <div className="flex items-center gap-1 text-xs text-red-500">
                          <X className="w-3 h-3" />
                          <span>Error</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleThemeToggle('light')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-lg border transition-all duration-300 text-sm ${
                          currentTheme === 'light' 
                            ? (isDark ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700')
                            : (isDark ? 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600 hover:text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100')
                        }`}
                      >
                        <Sun className="w-4 h-4" />
                        <span>Light</span>
                      </button>
                      
                      <button
                        onClick={() => handleThemeToggle('dark')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-lg border transition-all duration-300 text-sm ${
                          currentTheme === 'dark' 
                            ? (isDark ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700')
                            : (isDark ? 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600 hover:text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100')
                        }`}
                      >
                        <Moon className="w-4 h-4" />
                        <span>Dark</span>
                      </button>
                    </div>
                  </div>

                  {/* User Preference Link */}
                  <Link
                    to="/settings"
                    onClick={() => setShowProfileDropdown(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isDark 
                        ? 'text-gray-300 hover:bg-gray-700' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>User Preference</span>
                  </Link>

                  <Link
                    to="/login"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowProfileDropdown(false);
                      // Clear profile image on logout
                      localStorage.removeItem(`userProfileImage_${userCode}`);
                      localStorage.clear();
                      window.location.href = "/login";
                    }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-t ${
                      isDark 
                        ? 'text-red-400 hover:bg-gray-700 border-gray-700' 
                        : 'text-red-600 hover:bg-gray-50 border-gray-100'
                    }`}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-lg font-semibold ${
                  isDark ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Update Profile Picture
                </h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadPreview(null);
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <XIcon className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex justify-center mb-4">
                  <div className={`w-32 h-32 rounded-full overflow-hidden border-4 shadow-lg ${
                    isDark ? 'border-gray-700' : 'border-white'
                  }`}>
                    {uploadPreview ? (
                      <img
                        src={uploadPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : profileImage ? (
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">{initials}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center mb-6">
                  <p className={`text-sm ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Upload a new profile picture. Supported formats: JPG, PNG, GIF, WebP
                  </p>
                  <p className={`text-xs mt-1 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Max file size: 5MB
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    isDark 
                      ? 'border-gray-600 hover:border-blue-400' 
                      : 'border-gray-300 hover:border-blue-500'
                  }`}>
                    <UploadIcon className={`w-6 h-6 mb-2 ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Upload New
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => {
                      alert("Camera functionality would open here in a real app");
                    }}
                    className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                      isDark 
                        ? 'border-gray-600 hover:border-blue-400' 
                        : 'border-gray-300 hover:border-blue-500'
                    }`}
                  >
                    <CameraIcon className={`w-6 h-6 mb-2 ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Take Photo
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={removeProfileImage}
                  className={`flex-1 py-2.5 px-4 font-medium rounded-lg transition-colors ${
                    isDark
                      ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                >
                  Remove
                </button>
                <button
                  onClick={saveProfileImage}
                  disabled={!uploadPreview && !profileImage}
                  className={`flex-1 py-2.5 px-4 font-medium rounded-lg transition-colors ${
                    uploadPreview || profileImage
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : isDark
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
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