import React, { useState } from "react";
import RebateSetup from "../components/rebate/RebateSetup";
import vanLogo from "../assets/van.png";

function Van_RebateSetup() {
  const [showVanDropdown, setShowVanDropdown]         = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown]         = useState(false);

  return (
    <RebateSetup
      db="VAN"
      routePath="/Van_RebateSetup"
      logo={vanLogo}
      defaultRebateType="Fixed"
      defaultQuotaType="withQuota"
      showVanDropdown={showVanDropdown}
      setShowVanDropdown={setShowVanDropdown}
      showNexchemDropdown={showNexchemDropdown}
      setShowNexchemDropdown={setShowNexchemDropdown}
      showVcpDropdown={showVcpDropdown}
      setShowVcpDropdown={setShowVcpDropdown}
    />
  );
}

export default Van_RebateSetup;