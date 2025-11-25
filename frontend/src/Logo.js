import React from "react";
import nexchemLogo from "./assets/nexchem.png";
import vanLogo from "./assets/van.png";
import vastLogo from "./assets/vcp.png";

function Logo({ size = 50 }) {
  const selectedDB = localStorage.getItem("selectedDB");

  const logos = {
    NEXCHEM: nexchemLogo,
    VAN: vanLogo,
    VCP: vastLogo,   // since in your dropdown, VAST = VCP
  };

  return (
    <img
      src={logos[selectedDB] || vastLogo}
      alt="Company Logo"
      style={{ height: size, objectFit: "contain" }}
    />
  );
}

export default Logo;
