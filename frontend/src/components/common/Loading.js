import React from "react";

const Loading = ({
  theme = "light",
  showLogo = true,
  logoUrl = "/url_logo.png",
  logoAlt = "Logo",
  label,
}) => {
  const isDark = theme === "dark";

  const ink   = isDark ? "#F2F2F7" : "#1C1C1E";
  const muted = isDark ? "#98989F" : "#6E6E73";
  const bg    = isDark ? "#000000" : "#EEF1F7";
  const track = isDark ? "rgba(255,255,255,0.10)" : "rgba(60,60,67,0.12)";
  const plate = isDark ? "rgba(28,28,32,0.95)" : "#FFFFFF";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: bg,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Inter, sans-serif',
      }}
    >
      <style>{`
        @keyframes loading-spin { to { transform: rotate(360deg); } }
        @keyframes loading-pop  {
          from { opacity: 0; transform: scale(.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          position: "relative",
          width: 96,
          height: 96,
          animation: "loading-pop .25s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Spinner ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `3px solid ${track}`,
            borderTopColor: "#0A84FF",
            animation: "loading-spin 0.9s linear infinite",
          }}
        />

        {/* Logo plate */}
        {showLogo && (
          <div
            style={{
              position: "absolute",
              inset: 14,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: plate,
              boxShadow: isDark
                ? "0 8px 24px rgba(0,0,0,.45)"
                : "0 8px 24px rgba(30,41,79,.15)",
            }}
          >
            <img
              src={logoUrl}
              alt={logoAlt}
              style={{ width: 34, height: 34, objectFit: "contain" }}
            />
          </div>
        )}
      </div>

      {label && (
        <p style={{ fontSize: 13, fontWeight: 500, color: muted, margin: 0 }}>
          {label}
        </p>
      )}
    </div>
  );
};

export default Loading;