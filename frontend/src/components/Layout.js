import { useState } from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showVanDropdown, setShowVanDropdown] = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 font-poppins text-slate-900">
      <Sidebar 
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}
        setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown}
        setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}
        setShowVcpDropdown={setShowVcpDropdown}
      />
      {children}
    </div>
  );
};

export default Layout;