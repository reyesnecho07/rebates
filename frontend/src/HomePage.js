import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import axios from 'axios';
import RebateLogo from "./assets/Rebate.png";
import userpreference from "./assets/userpreference.png";
import Sidebar from "./components/Sidebar";
import Header from './components/Header';
import { useTheme } from './context/ThemeContext';

function HomePage() {
  const { theme, updateTheme } = useTheme();
  
  // State declarations
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");
  const [showVanDropdown, setShowVanDropdown] = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown] = useState(false);

  // API Base URL - Update this to your backend server
  const API_BASE = 'http://192.168.100.193:3006/api';
  const DB_NAME = 'USER';

  // Floating particles effect state
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Get the current user from localStorage
    const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const username = storedUser.DisplayName || storedUser.Username || "Unknown User";
    const userCode = storedUser.User_ID || "Unknown ID";

    
    setUserName(username);
    setUserCode(userCode);
  
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

    // Create floating particles
    const newParticles = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      speed: Math.random() * 0.5 + 0.2,
      opacity: Math.random() * 0.3 + 0.1,
      type: i % 3 // 0: circle, 1: square, 2: triangle
    }));
    setParticles(newParticles);
  }, []);


      useEffect(() => {
    const loadThemeFromDatabase = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
        const userId = storedUser.UserID || storedUser.User_ID;
        
        if (userId) {
          const response = await axios.get(`${API_BASE}/user/preferences/${userId}/theme?db=${DB_NAME}`);
          
          if (response.data.success && response.data.value) {
            const dbTheme = response.data.value.toLowerCase();
            // Only update if different from current theme
            if (dbTheme !== theme) {
              console.log('Loading theme from database:', dbTheme);
              updateTheme(dbTheme);
            }
          }
        }
      } catch (error) {
        console.error('Error loading theme from database:', error);
        // Use localStorage theme as fallback
        const localTheme = localStorage.getItem('userTheme');
        if (localTheme && localTheme !== theme) {
          updateTheme(localTheme);
        }
      }
    };
    
    loadThemeFromDatabase();
  }, []);

  // REMOVED: Duplicate theme loading - ThemeContext already handles this
  // The theme loading is now handled centrally in ThemeContext.js
  // No need to load it again here

  // Futuristic color schemes
  const lightTheme = {
    primary: "bg-gradient-to-r from-blue-500 to-cyan-400",
    secondary: "bg-gradient-to-r from-purple-500 to-pink-500",
    accent: "bg-gradient-to-r from-emerald-500 to-teal-400",
    glass: "bg-white/10 backdrop-blur-lg border border-white/20",
    surface: "bg-white/5 backdrop-blur-sm",
    text: "text-gray-800",
    muted: "text-gray-600"
  };

  const darkTheme = {
    primary: "bg-gradient-to-r from-blue-600 to-cyan-500",
    secondary: "bg-gradient-to-r from-purple-600 to-pink-500",
    accent: "bg-gradient-to-r from-emerald-600 to-teal-500",
    glass: "bg-gray-900/30 backdrop-blur-lg border border-gray-700/30",
    surface: "bg-gray-900/20 backdrop-blur-sm",
    text: "text-white",
    muted: "text-gray-400"
  };

  const colors = theme === 'dark' ? darkTheme : lightTheme;

  return (
    <div className={`min-h-screen overflow-hidden ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Animated background with layered effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Gradient overlay */}
        <div className={`absolute inset-0 opacity-10 ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-blue-900/20 via-gray-900 to-purple-900/20' 
            : 'bg-gradient-to-br from-blue-50 via-gray-50 to-cyan-50'
        }`} />
        
        {/* Animated grid pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} 1px, transparent 1px),
                           linear-gradient(to bottom, ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          maskImage: 'radial-gradient(circle at center, black 30%, transparent 70%)'
        }} />
        
        {/* Floating particles */}
        {particles.map(particle => (
          <div
            key={particle.id}
            className={`absolute ${
              particle.type === 0 ? 'rounded-full' : 
              particle.type === 1 ? 'rounded-lg' : 
              'clip-triangle'
            } ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30' : 'bg-gradient-to-r from-blue-400/30 to-cyan-300/30'}`}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              animation: `float ${10 / particle.speed}s infinite ease-in-out`,
              transform: `rotate(${particle.id * 36}deg)`
            }}
          />
        ))}
        
        {/* Pulsing orbs */}
        <div className={`absolute top-1/4 left-1/4 w-64 h-64 ${colors.primary} rounded-full filter blur-3xl opacity-5 animate-pulse`} />
        <div className={`absolute bottom-1/3 right-1/4 w-96 h-96 ${colors.secondary} rounded-full filter blur-3xl opacity-5 animate-pulse delay-1000`} />
      </div>

      {/* Header */}
      <Header
        collapsed={collapsed}
        userName={userName}
        userCode={userCode}
        initials={initials}
        logo={userpreference}
        theme={theme}
      />
      
      {/* Sidebar */}
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
      
      {/* Main Content */}
      <main className={`pt-16 transition-all duration-500 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="p-8">
          {/* Hero Section */}
          <div className="relative mb-16">
            {/* Animated gradient background */}
            <div className={`absolute -top-32 -left-32 w-[800px] h-[800px] ${colors.primary} rounded-full filter blur-3xl opacity-10 animate-spin-slow`} />
            <div className={`absolute -top-40 -right-32 w-[600px] h-[600px] ${colors.secondary} rounded-full filter blur-3xl opacity-10 animate-spin-slow reverse`} />
            
            <div className="relative flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
              {/* Spacer to push everything down */}
              <div className="h-20 md:h-32"></div>
              
              {/* Main Logo Container - still on top */}
              <div className="mb-8 relative group">
                {/* Logo without background */}
                <div className="relative group">
                  {/* Glowing effect behind logo */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-400 blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500 -z-10" />
                  
                  <img 
                    src={RebateLogo} 
                    alt="Rebate Management System" 
                    className="h-32 w-auto transform transition-all duration-700 group-hover:scale-105"
                    style={{ 
                      filter: theme === 'dark' 
                        ? 'brightness(1.2) contrast(1.1)' 
                        : 'none'
                    }}
                  />
                </div>
                
                {/* Floating elements around logo */}
                <div className="absolute -top-3 -left-3 w-6 h-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-bounce" />
                <div className="absolute -bottom-3 -right-3 w-5 h-5 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full animate-bounce delay-300" />
                <div className="absolute -top-3 -right-3 w-4 h-4 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full animate-bounce delay-700" />
              </div>
              
              {/* Title Section */}
              <div className="mb-16 max-w-5xl mx-auto">
                {/* Main Title - "Rebate Management System" in one line */}
                <div className="relative mb-6">
                  {/* Text shadow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 blur-3xl opacity-20 -z-10" />
                  
                  <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                    <span className="relative">
                      {/* Gradient "REBATE" */}
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 animate-gradient">
                        REBATE
                      </span>
                      {/* Black/white " MANAGEMENT SYSTEM" */}
                      <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>
                        {" "}MANAGEMENT SYSTEM
                      </span>
                    </span>
                  </h1>
                </div>
                
                {/* Description */}
                <p className={`text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-12 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                  Streamline your rebate management with flexible setup, centralized rebate lists, and real-time analytics.
                </p>
              </div>
              
              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-6xl mx-auto mb-16">
                <div className={`p-4 rounded-xl ${colors.surface} border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-300/30'} transform transition-all duration-300 hover:scale-102 hover:shadow-lg`}>
                  <div className={`w-10 h-10 ${colors.primary} rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold mb-2 text-center">Dashboard</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-center leading-tight`}>
                    Comprehensive overview of all rebate activities and metrics
                  </p>
                </div>
                
                <div className={`p-4 rounded-xl ${colors.surface} border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-300/30'} transform transition-all duration-300 hover:scale-102 hover:shadow-lg`}>
                  <div className={`w-10 h-10 ${colors.secondary} rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold mb-2 text-center">Analytics</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-center leading-tight`}>
                    Track rebate performance and identify trends
                  </p>
                </div>
                
                <div className={`p-4 rounded-xl ${colors.surface} border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-300/30'} transform transition-all duration-300 hover:scale-102 hover:shadow-lg`}>
                  <div className={`w-10 h-10 ${colors.accent} rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold mb-2 text-center">Transaction History</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-center leading-tight`}>
                    Complete record of all rebate transactions
                  </p>
                </div>
                
                <div className={`p-4 rounded-xl ${colors.surface} border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-300/30'} transform transition-all duration-300 hover:scale-102 hover:shadow-lg`}>
                  <div className={`w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold mb-2 text-center">Payout History</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-center leading-tight`}>
                    Track all rebate payouts and settlements
                  </p>
                </div>
                
                <div className={`p-4 rounded-xl ${colors.surface} border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-300/30'} transform transition-all duration-300 hover:scale-102 hover:shadow-lg`}>
                  <div className={`w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold mb-2 text-center">Rebate Setup</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-center leading-tight`}>
                    Configure and manage rebate programs
                  </p>
                </div>
                
                <div className={`p-4 rounded-xl ${colors.surface} border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-300/30'} transform transition-all duration-300 hover:scale-102 hover:shadow-lg`}>
                  <div className={`w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold mb-2 text-center">Reports</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-center leading-tight`}>
                    Generate detailed reports and gain insights
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FIXED: Removed jsx attribute from style tag */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
          33% { transform: translateY(-30px) translateX(10px) rotate(120deg); }
          66% { transform: translateY(20px) translateX(-15px) rotate(240deg); }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        
        .animate-spin-slow.reverse {
          animation-direction: reverse;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .clip-triangle {
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
        }
      `}</style>
    </div>
  );
}

export default HomePage;