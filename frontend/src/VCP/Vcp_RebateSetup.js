import React, { useState } from "react";
import RebateSetup from "../components/rebate/RebateSetup";
import vcpLogo from "../assets/vcp.png";

function Vcp_RebateSetup() {
  const [showVanDropdown, setShowVanDropdown]         = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown]         = useState(true);

  return (
    <RebateSetup
      db="VCP"
      routePath="/Vcp_RebateSetup"
      logo={vcpLogo}
      defaultRebateType="Percentage"
      defaultQuotaType="withoutQuota"
      showVanDropdown={showVanDropdown}
      setShowVanDropdown={setShowVanDropdown}
      showNexchemDropdown={showNexchemDropdown}
      setShowNexchemDropdown={setShowNexchemDropdown}
      showVcpDropdown={showVcpDropdown}
      setShowVcpDropdown={setShowVcpDropdown}
    />
  );
}

export default Vcp_RebateSetup;