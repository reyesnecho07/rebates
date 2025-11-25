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
  Bell,
  Shield,
  Palette,
  Eye,
  EyeOff,
  Check,
  Mail,
  Phone,
  Building,
  Briefcase,
  Globe,
  Calendar,
  Monitor,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "./Logo";

function Settings() {
  // Layout state
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("/settings");
  
  // Settings state
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");
  const [saveStatus, setSaveStatus] = useState("");
  
  // Profile Settings
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    position: ""
  });

  // Security Settings
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: false,
    salesAlerts: true,
    systemUpdates: true,
    monthlyReports: false
  });

  // System Preferences
  const [preferences, setPreferences] = useState({
    language: "english",
    timezone: "UTC+08:00",
    dateFormat: "MM/DD/YYYY",
    autoLogout: 30,
    recordsPerPage: 25
  });

  // Initialize user data
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
    
    // Initialize profile data with user info
    setProfileData({
      firstName: storedUser.firstName || "John",
      lastName: storedUser.lastName || "Doe",
      email: storedUser.email || "john.doe@company.com",
      phone: storedUser.phone || "+1 (555) 123-4567",
      department: storedUser.department || "Sales",
      position: storedUser.position || "Sales Manager"
    });
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

  const handleSecurityChange = (field, value) => {
    setSecurityData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNotificationChange = (field) => {
    setNotifications(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handlePreferenceChange = (field, value) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveSettings = (section) => {
    setSaveStatus(`${section} settings saved successfully!`);
    
    setTimeout(() => {
      setSaveStatus("");
    }, 3000);

    console.log(`Saving ${section} settings:`, {
      profile: profileData,
      security: securityData,
      notifications,
      preferences
    });
  };

  const handleResetSettings = (section) => {
    if (section === 'security') {
      setSecurityData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white font-poppins text-black">
      {/* Sidebar - Fixed */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-300 flex flex-col transition-all duration-300 z-50 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header with Toggle */}
        <div className="flex items-center justify-between p-4 border-gray-200 relative">
          {!collapsed && (
            <h2 className="font-bold text-gray-800 whitespace-nowrap">
              Rebate Management
            </h2>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors ${
              collapsed ? "absolute top-4 left-5" : ""
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            <li>
              <Link 
                to="/dashboard" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/dashboard"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/dashboard")}
              >
                <Home className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Dashboard
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/rebatesetup" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/rebatesetup"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/rebatesetup")}
              >
                <FileText className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Rebate Setup
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/nexchemreports" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/nexchemreports"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/nexchemreports")}
              >
                <BarChart2 className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Reports
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/customer" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/customer"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/customer")}
              >
                <Users className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Customer
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/items" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/items"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/items")}
              >
                <Package className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Items
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/salesemployee" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/salesemployee"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/salesemployee")}
              >
                <IdCardLanyard className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Sales Employee
                </span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="mt-auto p-3">
          <ul className="space-y-1">
            <li>
              <Link 
                to="/settings" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/settings"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/settings")}
              >
                <SettingsIcon className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Settings
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/accountsetup" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/accountsetup"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/accountsetup")}
              >
                <User className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Account Setup
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/login" 
                className="flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all hover:bg-gray-50 hover:text-blue-500"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Logout
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header - Fixed */}
        <header 
          className="fixed top-0 right-0 h-16 flex items-center px-6 bg-white border-b border-gray-300 z-40 transition-all duration-300"
          style={{ 
            left: collapsed ? '80px' : '256px',
            width: collapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
          }}
        >
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Logo size={90} />
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-4 ml-auto mr-8">
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white font-semibold text-sm flex items-center justify-center uppercase shadow-sm">
              {initials}
            </div>
            <div className="flex flex-col text-right">
              <p className="text-base font-semibold text-gray-800 whitespace-nowrap max-w-[150px] overflow-hidden">
                {username}
              </p>
              <p className="text-xs text-gray-600 text-left">
                {role}
              </p>
            </div>
          </div>
        </header>

        {/* Settings Content Area */}
        <div className="pt-16 flex-1 p-6 overflow-auto">
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl border border-blue-100 shadow-lg p-8 w-full max-w-[1600px] mx-auto mt-6">
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
                      <div className="text-xs opacity-80">Personal information</div>
                    </div>
                  </button>
                  
                  <button 
                    className={`flex items-center gap-3 w-full p-4 rounded-xl text-left transition-all duration-200 ${
                      activeSettingsTab === 'security' 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200'
                    }`}
                    onClick={() => setActiveSettingsTab('security')}
                  >
                    <div className={`p-2 rounded-lg ${activeSettingsTab === 'security' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      <Shield size={18} />
                    </div>
                    <div>
                      <div className="font-medium">Security</div>
                      <div className="text-xs opacity-80">Password & protection</div>
                    </div>
                  </button>
                  
                  <button 
                    className={`flex items-center gap-3 w-full p-4 rounded-xl text-left transition-all duration-200 ${
                      activeSettingsTab === 'notifications' 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200'
                    }`}
                    onClick={() => setActiveSettingsTab('notifications')}
                  >
                    <div className={`p-2 rounded-lg ${activeSettingsTab === 'notifications' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      <Bell size={18} />
                    </div>
                    <div>
                      <div className="font-medium">Notifications</div>
                      <div className="text-xs opacity-80">Alerts & updates</div>
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
                        <p className="text-sm text-gray-600">Update your personal information and contact details</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {[
                        { field: 'firstName', label: 'First Name', icon: User },
                        { field: 'lastName', label: 'Last Name', icon: User },
                        { field: 'email', label: 'Email Address', icon: Mail },
                        { field: 'phone', label: 'Phone Number', icon: Phone },
                        { field: 'department', label: 'Department', icon: Building },
                        { field: 'position', label: 'Position', icon: Briefcase }
                      ].map(({ field, label, icon: Icon }) => (
                        <div key={field} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                            <Icon size={16} className="text-blue-500" />
                            {label}
                          </label>
                          {field === 'department' ? (
                            <select
                              value={profileData[field]}
                              onChange={(e) => handleProfileChange(field, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="Sales">Sales</option>
                              <option value="Marketing">Marketing</option>
                              <option value="Finance">Finance</option>
                              <option value="Operations">Operations</option>
                              <option value="IT">IT</option>
                            </select>
                          ) : (
                            <input
                              type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                              value={profileData[field]}
                              onChange={(e) => handleProfileChange(field, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder={`Enter your ${label.toLowerCase()}`}
                            />
                          )}
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
                      <button className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Security Settings */}
                {activeSettingsTab === 'security' && (
                  <div className="animate-fadeIn">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <Shield className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">Security Settings</h2>
                        <p className="text-sm text-gray-600">Manage your password and security preferences</p>
                      </div>
                    </div>

                    <div className="space-y-6 mb-8">
                      {[
                        { field: 'currentPassword', label: 'Current Password', show: showCurrentPassword, setShow: setShowCurrentPassword },
                        { field: 'newPassword', label: 'New Password', show: showNewPassword, setShow: setShowNewPassword },
                        { field: 'confirmPassword', label: 'Confirm New Password', show: showConfirmPassword, setShow: setShowConfirmPassword }
                      ].map(({ field, label, show, setShow }) => (
                        <div key={field} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                            <Lock size={16} className="text-blue-500" />
                            {label}
                          </label>
                          <div className="relative">
                            <input
                              type={show ? "text" : "password"}
                              value={securityData[field]}
                              onChange={(e) => handleSecurityChange(field, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                              placeholder={`Enter ${label.toLowerCase()}`}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                              onClick={() => setShow(!show)}
                            >
                              {show ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-2">Password Requirements:</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li className="flex items-center gap-2">• Minimum 8 characters</li>
                        <li className="flex items-center gap-2">• At least one uppercase letter</li>
                        <li className="flex items-center gap-2">• At least one number</li>
                        <li className="flex items-center gap-2">• At least one special character</li>
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        onClick={() => handleSaveSettings('security')}
                      >
                        <Save size={16} />
                        Update Password
                      </button>
                      <button 
                        className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        onClick={() => handleResetSettings('security')}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Notification Settings */}
                {activeSettingsTab === 'notifications' && (
                  <div className="animate-fadeIn">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <Bell className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">Notification Preferences</h2>
                        <p className="text-sm text-gray-600">Choose how you want to be notified about system activities</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      {Object.entries(notifications).map(([key, value]) => (
                        <div key={key} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-800 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {key === 'emailNotifications' && 'Receive important updates via email'}
                                {key === 'pushNotifications' && 'Get real-time alerts in your browser'}
                                {key === 'salesAlerts' && 'Notifications about sales targets and achievements'}
                                {key === 'systemUpdates' && 'Important system maintenance and updates'}
                                {key === 'monthlyReports' && 'Automated monthly performance reports'}
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={value}
                                onChange={() => handleNotificationChange(key)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button 
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        onClick={() => handleSaveSettings('notifications')}
                      >
                        <Save size={16} />
                        Save Preferences
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
                        ]},
                        { field: 'recordsPerPage', label: 'Records Per Page', icon: Monitor, options: [
                          { value: '10', label: '10 records' },
                          { value: '25', label: '25 records' },
                          { value: '50', label: '50 records' },
                          { value: '100', label: '100 records' }
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

export default Settings;