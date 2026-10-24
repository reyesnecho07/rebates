import React, { useState } from "react";
import RebateSetup from "../components/rebate/RebateSetup";
import nexchemLogo from "../assets/nexchem.png";

function Nexchem_RebateSetup() {
  const [showVanDropdown, setShowVanDropdown]         = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(true);
  const [showVcpDropdown, setShowVcpDropdown]         = useState(false);

  return (
    <RebateSetup
      db="NEXCHEM"
      routePath="/Nexchem_RebateSetup"
      logo={nexchemLogo}
      defaultRebateType="Fixed"
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

export default Nexchem_RebateSetup;