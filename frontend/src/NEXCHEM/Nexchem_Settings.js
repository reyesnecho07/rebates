import React, { useState, useEffect } from "react";
import {
  Home,
  FileText,
  BarChart2,
  Users,
  Package,
  Settings as SettingsIcon,
  User,
  IdCardLanyard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Save,
  Palette,
  Check,
  Building,
  Briefcase,
  Globe,
  Calendar,
  Lock,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import Logo from "../Logo";

function Nexchem_Settings() {
  const location = useLocation();
  
  // Layout state
  const [collapsed, setCollapsed] = useState(false);
  
  // Settings state
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");
  const [saveStatus, setSaveStatus] = useState("");
  
  // Profile Settings
  const [profileData, setProfileData] = useState({
    userCode: "",
    userName: "",
    role: "",
    group: ""
  });

  // System Preferences
  const [preferences, setPreferences] = useState({
    language: "english",
    timezone: "UTC+08:00",
    dateFormat: "MM/DD/YYYY",
    autoLogout: 30,
    pageOrder: ["dashboard", "rebatesetup", "reports", "customer", "items", "salesemployee"]
  });

  // Navigation items configuration
  const navigationItems = {
    dashboard: { icon: Home, label: "Dashboard", path: "/nexchem/dashboard" },
    rebatesetup: { icon: FileText, label: "Rebate Setup", path: "/nexchem/rebatesetup" },
    reports: { icon: BarChart2, label: "Reports", path: "/nexchem/nexchemreports" },
    customer: { icon: Users, label: "Customer", path: "/nexchem/customer" },
    items: { icon: Package, label: "Items", path: "/nexchem/items" },
    salesemployee: { icon: IdCardLanyard, label: "Sales Employee", path: "/nexchem/salesemployee" },
  };

  // Initialize user data
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
    
    // Initialize profile data with user info
    setProfileData({
      userCode: storedUser.userCode || "USR001",
      userName: storedUser.userName || "John Doe",
      role: storedUser.role || "Sales Manager",
      group: storedUser.group || "DEPT001"
    });

    // Initialize preferences from localStorage if available
    const storedPreferences = JSON.parse(localStorage.getItem("userPreferences")) || {};
    if (Object.keys(storedPreferences).length > 0) {
      setPreferences(storedPreferences);
    }
  }, []);

  // ✅ Get user from localStorage
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const username = storedUser.username || "Unknown User";
  const role = storedUser.role || "Unknown Role";

  // ✅ Generate initials
  const getInitials = (name) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
  };
  const initials = getInitials(username);

  // Settings handlers
  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferenceChange = (field, value) => {
    const updatedPreferences = {
      ...preferences,
      [field]: value
    };
    setPreferences(updatedPreferences);
    
    // Save to localStorage immediately for persistence
    localStorage.setItem("userPreferences", JSON.stringify(updatedPreferences));
  };

  const handleSaveSettings = (section) => {
    if (section === 'profile') {
      // Update user data in localStorage
      const updatedUser = {
        ...storedUser,
        ...profileData
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
    
    setSaveStatus(`${section} settings saved successfully!`);
    
    setTimeout(() => {
      setSaveStatus("");
    }, 3000);

    console.log(`Saving ${section} settings:`, {
      profile: profileData,
      preferences
    });
  };

  const handleResetSettings = (section) => {
    if (section === 'profile') {
      const storedUser = JSON.parse(localStorage.getItem("user")) || {};
      setProfileData({
        userCode: storedUser.userCode || "USR001",
        userName: storedUser.userName || "John Doe",
        role: storedUser.role || "Sales Manager",
        group: storedUser.group || "DEPT001"
      });
    }
  };

  // Page order handlers
  const movePageUp = (index) => {
    if (index === 0) return; // Can't move first item up
    
    const newPageOrder = [...preferences.pageOrder];
    const temp = newPageOrder[index];
    newPageOrder[index] = newPageOrder[index - 1];
    newPageOrder[index - 1] = temp;
    
    handlePreferenceChange('pageOrder', newPageOrder);
  };

  const movePageDown = (index) => {
    if (index === preferences.pageOrder.length - 1) return; // Can't move last item down
    
    const newPageOrder = [...preferences.pageOrder];
    const temp = newPageOrder[index];
    newPageOrder[index] = newPageOrder[index + 1];
    newPageOrder[index + 1] = temp;
    
    handlePreferenceChange('pageOrder', newPageOrder);
  };

  const resetPageOrder = () => {
    const defaultOrder = ["dashboard", "rebatesetup", "reports", "customer", "items", "salesemployee"];
    handlePreferenceChange('pageOrder', defaultOrder);
  };

  // Get page order display names
  const getPageDisplayName = (page) => {
    return navigationItems[page]?.label || page;
  };

  const getPageIcon = (page) => {
    const IconComponent = navigationItems[page]?.icon;
    return IconComponent ? <IconComponent size={16} /> : null;
  };

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 font-poppins text-slate-900">
      {/* Enhanced Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 flex flex-col transition-all duration-500 z-50 shadow-2xl ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header with Enhanced Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 relative">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 rounded-xl flex items-center justify-center shadow-lg">
                <img src="/url_logo.png" alt="Logo" className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-white text-lg whitespace-nowrap">
                RebateSystem
              </h2>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-xl bg-slate-700 hover:bg-slate-600 transition-all duration-300 hover:scale-110 ${
              collapsed ? "absolute top-4 left-5" : ""
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-300" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-300" />
            )}
          </button>
        </div>

        <nav className="flex-1 py-6">
          <ul className="space-y-2 px-3">
            {preferences.pageOrder.map((pageKey) => {
              const item = navigationItems[pageKey];
              if (!item) return null;
              
              return (
                <li key={item.path}>
                  <Link 
                    to={item.path} 
                    className={`flex items-center text-slate-300 px-4 py-3 rounded-xl transition-all duration-300 group hover:bg-slate-700/50 hover:text-white hover:scale-105 ${
                      location.pathname === item.path
                        ? "bg-blue-500/20 text-white border-r-2 border-blue-400 shadow-lg"
                        : ""
                    }`}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                      location.pathname === item.path ? "text-blue-400" : ""
                    }`} />
                    <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                      collapsed ? "opacity-0 w-0" : "opacity-100"
                    }`}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto p-4 border-t border-slate-700">
          <ul className="space-y-2">
            {[
              { icon: SettingsIcon, label: "Settings", path: "/nexchem/settings" },
              { icon: LogOut, label: "Logout", path: "/login" },
            ].map((item) => (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`flex items-center text-slate-300 px-4 py-3 rounded-xl transition-all duration-300 group hover:bg-slate-700/50 hover:text-white ${
                    location.pathname === item.path
                      ? "bg-blue-500/20 text-white border-r-2 border-blue-400"
                      : ""
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                    collapsed ? "opacity-0 w-0" : "opacity-100"
                  }`}>
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Enhanced Header */}
        <header 
          className="fixed top-0 right-0 h-16 flex items-center px-8 bg-white/80 backdrop-blur-lg border-b border-slate-200/50 z-40 transition-all duration-500 shadow-sm"
          style={{ 
            left: collapsed ? '80px' : '256px',
            width: collapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
          }}
        >
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Logo size={100} />
          </div>

          {/* Enhanced User Profile */}
          <div className="flex items-center gap-4 ml-auto mr-8">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-base flex items-center justify-center uppercase shadow-lg transition-transform duration-300 hover:scale-105">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex flex-col text-right">
              <p className="text-base font-bold text-slate-800 whitespace-nowrap max-w-[150px]">
                {username}
              </p>
              <p className="text-xs text-slate-600 rounded-full text-left font-medium">
                {role}
              </p>
            </div>
          </div>
        </header>

        {/* Settings Content Area */}
        <div className="pt-16 flex-1 p-8 overflow-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 shadow-2xl p-8 w-full max-w-[1600px] mx-auto mt-6">
            {/* Modern Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-blue-200">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <SettingsIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
                <p className="text-sm text-gray-600">Manage your account settings and preferences</p>
              </div>
            </div>

            {saveStatus && (
              <div className="flex items-center gap-2 p-4 mb-6 bg-green-50 text-green-700 rounded-xl border border-green-200 text-sm">
                <Check size={16} className="text-green-600" />
                {saveStatus}
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8">
              {/* Modern Settings Sidebar */}
              <div className="lg:w-80 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-fit">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Settings Menu</h3>
                <div className="space-y-2">
                  <button 
                    className={`flex items-center gap-3 w-full p-4 rounded-xl text-left transition-all duration-200 ${
                      activeSettingsTab === 'profile' 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200'
                    }`}
                    onClick={() => setActiveSettingsTab('profile')}
                  >
                    <div className={`p-2 rounded-lg ${activeSettingsTab === 'profile' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      <User size={18} />
                    </div>
                    <div>
                      <div className="font-medium">Profile</div>
                      <div className="text-xs opacity-80">User information</div>
                    </div>
                  </button>
                  
                  <button 
                    className={`flex items-center gap-3 w-full p-4 rounded-xl text-left transition-all duration-200 ${
                      activeSettingsTab === 'preferences' 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200'
                    }`}
                    onClick={() => setActiveSettingsTab('preferences')}
                  >
                    <div className={`p-2 rounded-lg ${activeSettingsTab === 'preferences' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      <Palette size={18} />
                    </div>
                    <div>
                      <div className="font-medium">Preferences</div>
                      <div className="text-xs opacity-80">System settings</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Modern Settings Content */}
              <div className="flex-1">
                {/* Profile Settings */}
                {activeSettingsTab === 'profile' && (
                  <div className="animate-fadeIn">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">Profile Information</h2>
                        <p className="text-sm text-gray-600">Update your user information</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {[
                        { field: 'userCode', label: 'User Code', icon: User },
                        { field: 'userName', label: 'User Name', icon: User },
                        { field: 'group', label: 'Group', icon: Building },
                        { field: 'role', label: 'Role', icon: Briefcase }
                      ].map(({ field, label, icon: Icon }) => (
                        <div key={field} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                            <Icon size={16} className="text-blue-500" />
                            {label}
                          </label>
                          <input
                            type="text"
                            value={profileData[field]}
                            onChange={(e) => handleProfileChange(field, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`Enter your ${label.toLowerCase()}`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button 
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        onClick={() => handleSaveSettings('profile')}
                      >
                        <Save size={16} />
                        Save Changes
                      </button>
                      <button 
                        className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        onClick={() => handleResetSettings('profile')}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Preferences Settings */}
                {activeSettingsTab === 'preferences' && (
                  <div className="animate-fadeIn">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <Palette className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">System Preferences</h2>
                        <p className="text-sm text-gray-600">Customize your system experience and display preferences</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {[
                        { field: 'language', label: 'Language', icon: Globe, options: [
                          { value: 'english', label: 'English' },
                          { value: 'spanish', label: 'Spanish' },
                          { value: 'french', label: 'French' },
                          { value: 'german', label: 'German' }
                        ]},
                        { field: 'timezone', label: 'Timezone', icon: Globe, options: [
                          { value: 'UTC+08:00', label: 'UTC+08:00 (Philippine Time)' },
                          { value: 'UTC-05:00', label: 'UTC-05:00 (Eastern Time)' },
                          { value: 'UTC+00:00', label: 'UTC+00:00 (GMT)' },
                          { value: 'UTC+01:00', label: 'UTC+01:00 (Central European Time)' }
                        ]},
                        { field: 'dateFormat', label: 'Date Format', icon: Calendar, options: [
                          { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                          { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                          { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
                        ]},
                        { field: 'autoLogout', label: 'Auto Logout', icon: Lock, options: [
                          { value: '15', label: '15 minutes' },
                          { value: '30', label: '30 minutes' },
                          { value: '60', label: '1 hour' },
                          { value: '120', label: '2 hours' }
                        ]}
                      ].map(({ field, label, icon: Icon, options }) => (
                        <div key={field} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                            <Icon size={16} className="text-blue-500" />
                            {label}
                          </label>
                          <select
                            value={preferences[field]}
                            onChange={(e) => handlePreferenceChange(field, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Page Order Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <GripVertical size={18} className="text-blue-500" />
                          Page Order in Sidebar
                        </h3>
                        <button
                          onClick={resetPageOrder}
                          className="px-4 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          Reset to Default
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Drag and drop or use arrows to reorder pages in the sidebar navigation
                      </p>
                      <div className="space-y-3">
                        {preferences.pageOrder.map((page, index) => (
                          <div 
                            key={page} 
                            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </div>
                              <div className="w-5 h-5 text-gray-600 flex items-center justify-center">
                                {getPageIcon(page)}
                              </div>
                              <span className="font-medium text-gray-700">
                                {getPageDisplayName(page)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => movePageUp(index)}
                                disabled={index === 0}
                                className={`p-2 rounded-lg transition-colors ${
                                  index === 0 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-gray-600 hover:bg-blue-100 hover:text-blue-600'
                                }`}
                                title="Move up"
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                onClick={() => movePageDown(index)}
                                disabled={index === preferences.pageOrder.length - 1}
                                className={`p-2 rounded-lg transition-colors ${
                                  index === preferences.pageOrder.length - 1
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-gray-600 hover:bg-blue-100 hover:text-blue-600'
                                }`}
                                title="Move down"
                              >
                                <ArrowDown size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700">
                          <strong>Note:</strong> Page order changes are applied immediately to the sidebar navigation.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        onClick={() => handleSaveSettings('preferences')}
                      >
                        <Save size={16} />
                        Save Preferences
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Nexchem_Settings;