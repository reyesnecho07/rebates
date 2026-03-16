import React from "react";

const Loading = ({ 
  theme = "light",
  showLogo = true,
  logoUrl = "/url_logo.png",
  logoAlt = "Logo",
  logoSize = "w-12 h-12"
}) => {
  const isDark = theme === 'dark';
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${
      isDark ? 'bg-gray-900/95' : 'bg-white/95'
    }`}>
      <div className="relative">
        {showLogo && (
          <div className="relative">
            {/* Logo with subtle blur */}
            <img 
              src={logoUrl} 
              alt={logoAlt} 
              className={`${logoSize} object-contain opacity-80 blur-[0.5px]`}
            />
            
            {/* Single rotating ring */}
            <div className={`absolute -inset-3 rounded-full border border-t-transparent animate-spin ${
              isDark ? 'border-gray-500/50' : 'border-gray-400/50'
            }`}></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Loading;