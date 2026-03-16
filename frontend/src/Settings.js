import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Database,
  Sun,
  Moon,
  Monitor,
  Upload,
  Camera,
  X,
  Loader2,
  CheckCircle
} from "lucide-react";
import { useLocation } from "react-router-dom";
import userpreference from "./assets/userpreference.png";
import Sidebar from "./components/Sidebar";
import Header from './components/Header';
import { useTheme } from './context/ThemeContext';
import axios from 'axios';

function Settings() {
  const location = useLocation();
  const { theme, updateTheme } = useTheme();
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showVanDropdown, setShowVanDropdown] = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [userId, setUserId] = useState("");
  const [actualUserId, setActualUserId] = useState("");
  const [initials, setInitials] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  
  const [databaseOrder, setDatabaseOrder] = useState({
    van: 1,
    nexchem: 2,
    vcp: 3
  });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [themeSaveStatus, setThemeSaveStatus] = useState({
    saving: false,
    saved: false,
    error: false,
    message: ""
  });

  // API Base URL - Update this to your backend server
  const API_BASE = 'http://192.168.100.193:3006/api';
  const DB_NAME = 'USER';

  // Initialize user data and preferences
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const username = storedUser.DisplayName || storedUser.Username || "John Smith";
    const userCode = storedUser.User_ID || storedUser.UserCode || "USR001";
    const userId = storedUser.UserID || storedUser.User_ID || "";
    
    setUserName(username);
    setUserCode(userCode);
    setUserId(userId);

    const getInitials = (name) => {
      if (!name) return "??";
      const parts = name.trim().split(" ");
      if (parts.length === 1) {
        return parts[0][0].toUpperCase();
      }
      return (
        parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
      );
    };

    setInitials(getInitials(username));

    const savedProfileImage = localStorage.getItem('profileImage');
    if (savedProfileImage) {
      setProfileImage(savedProfileImage);
    }

    const savedDatabaseOrder = JSON.parse(localStorage.getItem('databaseOrder')) || {
      van: 1,
      nexchem: 2,
      vcp: 3
    };
    
    setDatabaseOrder(savedDatabaseOrder);

    // Load theme from database if user is logged in
    if (userId) {
      loadThemeFromDatabase(userId);
    }
  }, []);

  // Load theme from database
  const loadThemeFromDatabase = async (userIdentifier) => {
    try {
      const response = await axios.get(`${API_BASE}/user/preferences/${userIdentifier}/theme?db=${DB_NAME}`);
      
      if (response.data.success && response.data.value) {
        const dbTheme = response.data.value.toLowerCase();
        if (dbTheme !== theme) {
          console.log('Loading theme from database:', dbTheme);
          updateTheme(dbTheme);
        }
      }
    } catch (error) {
      console.error('Error loading theme from database:', error);
      const localTheme = localStorage.getItem('userTheme');
      if (localTheme && localTheme !== theme) {
        updateTheme(localTheme);
      }
    }
  };

  const handleThemeChange = async (newTheme) => {
    setThemeSaveStatus({
      saving: true,
      saved: false,
      error: false,
      message: "Saving theme preference..."
    });
    
    try {
      updateTheme(newTheme);
      
      if (userId) {
        try {
          const response = await axios.post(`${API_BASE}/user/preferences/save?db=${DB_NAME}`, {
            userId: userId,
            preferenceKey: 'theme',
            preferenceValue: newTheme.charAt(0).toUpperCase() + newTheme.slice(1)
          });
          
          if (response.data.success) {
            console.log('Theme saved to database:', response.data);
            
            if (response.data.actualUserId) {
              setActualUserId(response.data.actualUserId);
            }
            
            setThemeSaveStatus({
              saving: false,
              saved: true,
              error: false,
              message: "Theme saved to database successfully!"
            });
          }
        } catch (dbError) {
          console.error('Database save error:', dbError);
          setThemeSaveStatus({
            saving: false,
            saved: true,
            error: false,
            message: "Theme saved locally (database error)"
          });
        }
      } else {
        setThemeSaveStatus({
          saving: false,
          saved: true,
          error: false,
          message: "Theme saved locally"
        });
      }
      
      setTimeout(() => {
        setThemeSaveStatus({
          saving: false,
          saved: false,
          error: false,
          message: ""
        });
      }, 3000);
      
    } catch (error) {
      console.error('Error changing theme:', error);
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

  const handleDatabaseOrderChange = (newOrder) => {
    setDatabaseOrder(newOrder);
    localStorage.setItem('databaseOrder', JSON.stringify(newOrder));
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageDataUrl = reader.result;
        setUploadPreview(imageDataUrl);
        setShowUploadModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfileImage = () => {
    if (uploadPreview) {
      setProfileImage(uploadPreview);
      localStorage.setItem('profileImage', uploadPreview);
      setShowUploadModal(false);
      setUploadPreview(null);
    }
  };

  const removeProfileImage = () => {
    setProfileImage(null);
    localStorage.removeItem('profileImage');
    setShowUploadModal(false);
    setUploadPreview(null);
  };

  const ThemeSelector = ({ currentTheme, onThemeChange }) => {
    const themes = [
      { id: 'light', name: 'Light', icon: Sun, description: 'Bright and clear' },
      { id: 'dark', name: 'Dark', icon: Moon, description: 'Easy on the eyes' },
    ];
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {themes.map((themeOption) => (
            <button
              key={themeOption.id}
              onClick={() => !themeSaveStatus.saving && onThemeChange(themeOption.id)}
              disabled={themeSaveStatus.saving}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 relative ${
                currentTheme === themeOption.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${themeSaveStatus.saving ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {themeSaveStatus.saving && currentTheme === themeOption.id && (
                <div className="absolute top-2 right-2">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                </div>
              )}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                currentTheme === themeOption.id
                  ? 'bg-blue-100 dark:bg-blue-800'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <themeOption.icon className={`w-5 h-5 ${
                  currentTheme === themeOption.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`} />
              </div>
              <span className={`font-medium text-sm ${
                currentTheme === themeOption.id
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {themeOption.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {themeOption.description}
              </span>
            </button>
          ))}
        </div>
        
        {themeSaveStatus.saving && (
          <div className={`p-3 rounded text-sm flex items-center gap-2 ${
            theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'
          }`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{themeSaveStatus.message}</span>
          </div>
        )}
        
        {themeSaveStatus.saved && !themeSaveStatus.error && (
          <div className={`p-3 rounded text-sm flex items-center gap-2 ${
            theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-600'
          }`}>
            <CheckCircle className="w-4 h-4" />
            <span>{themeSaveStatus.message}</span>
          </div>
        )}
        
        {themeSaveStatus.error && (
          <div className={`p-3 rounded text-sm flex items-center gap-2 ${
            theme === 'dark' ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'
          }`}>
            <X className="w-4 h-4" />
            <span>{themeSaveStatus.message}</span>
          </div>
        )}
      </div>
    );
  };

  const DatabaseOrderPreferences = ({ currentOrder, onOrderChange }) => {
    const [dragItem, setDragItem] = useState(null);
    const [dragOverItem, setDragOverItem] = useState(null);
    const [localOrder, setLocalOrder] = useState(currentOrder);

    const databases = [
      { id: 'van', name: 'VAN Database', color: 'from-blue-500 to-blue-600', icon: Database },
      { id: 'nexchem', name: 'NEXCHEM Database', color: 'from-purple-500 to-purple-600', icon: Database },
      { id: 'vcp', name: 'VCP Database', color: 'from-emerald-500 to-emerald-600', icon: Database }
    ];

    const sortedDatabases = [...databases].sort((a, b) => localOrder[a.id] - localOrder[b.id]);

    const handleDragStart = (e, index) => {
      setDragItem(index);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
      e.preventDefault();
      setDragOverItem(index);
    };

    const handleDrop = (e, dropIndex) => {
      e.preventDefault();
      if (dragItem === null || dragItem === dropIndex) return;

      const newOrder = { ...localOrder };
      const draggedId = sortedDatabases[dragItem].id;
      const dropId = sortedDatabases[dropIndex].id;
      
      const tempOrder = newOrder[draggedId];
      newOrder[draggedId] = newOrder[dropId];
      newOrder[dropId] = tempOrder;

      setLocalOrder(newOrder);
      setDragItem(null);
      setDragOverItem(null);
      
      onOrderChange(newOrder);
    };

    const handleDragEnd = () => {
      setDragItem(null);
      setDragOverItem(null);
    };

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {sortedDatabases.map((db, index) => (
            <div
              key={db.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-move transition-all duration-300 ${
                dragItem === index
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 opacity-50'
                  : dragOverItem === index
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${db.color} flex items-center justify-center`}>
                  <db.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-200">{db.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Order: {localOrder[db.id]} of {databases.length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  {[1, 2, 3].map((num) => (
                    <div
                      key={num}
                      className={`w-2 h-2 rounded-full ${
                        localOrder[db.id] === num
                          ? 'bg-blue-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              const defaultOrder = { van: 1, nexchem: 2, vcp: 3 };
              setLocalOrder(defaultOrder);
              onOrderChange(defaultOrder);
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Reset to default order
          </button>
        </div>
      </div>
    );
  };

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
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadPreview(null);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg">
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
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Upload a new profile picture. Supported formats: JPG, PNG, GIF
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Max file size: 5MB
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Upload New
                  </span>
                  <input
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
                  className="flex flex-col items-center justify-center p-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors"
                >
                  <Camera className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Take Photo
                  </span>
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

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 font-poppins text-slate-900 dark:text-gray-100">

      {/* Use the Sidebar component */}
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
        className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Enhanced Header */}
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={userpreference}
          theme={theme}
        />

        <div className="pt-16 flex-1 p-8 overflow-auto">
          <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border ${
            theme === 'dark' 
              ? 'border-gray-700/50' 
              : 'border-white/50'
          } shadow-2xl p-8 w-full max-w-[1600px] mx-auto mt-6`}>
            <div className={`flex items-center gap-4 mb-8 pb-6 border-b ${
              theme === 'dark' ? 'border-blue-800' : 'border-blue-200'
            }`}>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <SettingsIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                }`}>User Preferences</h1>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>Manage your account settings and preferences</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={`bg-white dark:bg-gray-800 rounded-2xl border ${
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              } p-6 shadow-sm`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                      <Sun className="w-4 h-4 text-white" />
                    </div>
                    <h2 className={`text-lg font-semibold ${
                      theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                    }`}>Theme Settings</h2>
                  </div>
                  
                  {themeSaveStatus.saving && (
                    <div className="flex items-center gap-1 text-xs text-blue-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  )}
                  {themeSaveStatus.saved && !themeSaveStatus.error && (
                    <div className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle className="w-3 h-3" />
                      <span>Saved!</span>
                    </div>
                  )}
                  {themeSaveStatus.error && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <X className="w-3 h-3" />
                      <span>Error</span>
                    </div>
                  )}
                </div>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                } mb-6`}>Choose your preferred application theme</p>
                
                <ThemeSelector 
                  currentTheme={theme}
                  onThemeChange={handleThemeChange}
                />
                
                <div className={`mt-6 pt-4 border-t ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
                }`}>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {userId 
                      ? `Your theme preference is saved to ${DB_NAME} database and will sync across all your devices.`
                      : 'Theme saved locally. Sign in to sync across devices.'
                    }
                  </p>
                </div>
              </div>

              <div className={`bg-white dark:bg-gray-800 rounded-2xl border ${
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              } p-6 shadow-sm`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <h2 className={`text-lg font-semibold ${
                    theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                  }`}>Database Order</h2>
                </div>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                } mb-6`}>Drag to reorder your database sections in the sidebar</p>
                
                <DatabaseOrderPreferences 
                  currentOrder={databaseOrder}
                  onOrderChange={handleDatabaseOrderChange}
                />
                
                <div className={`mt-6 pt-4 border-t ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
                }`}>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Changes are applied immediately and will be reflected in your sidebar.
                  </p>
                </div>
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