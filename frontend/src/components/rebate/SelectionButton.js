// src/components/rebate/SelectionButton.jsx
import React from 'react';
import { ChevronDown, Users, Package } from 'lucide-react';

/* ─── Apple system colour language ───────────────────────────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const dashTokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"  : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const SelectionButton = ({
  onClick,
  selectedCount = 0,
  type = 'customer',
  theme
}) => {
  const isDark = theme === 'dark';
  const K = dashTokens(isDark);
  const isCustomer = type === 'customer';

  // Accent colour per type — blue for customers, purple for items
  const accent = isCustomer ? APPLE.blue : APPLE.purple;
  const Icon = isCustomer ? Users : Package;

  const hasSelection = selectedCount > 0;

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-all dash-glass"
      style={{
        background: hasSelection ? `${accent}1c` : K.glass,
        border: `1px solid ${hasSelection ? `${accent}55` : K.hairline}`,
        color: hasSelection ? accent : K.ink,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hasSelection ? `${accent}28` : K.hover;
        e.currentTarget.style.borderColor = hasSelection ? `${accent}88` : `${accent}55`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = hasSelection ? `${accent}1c` : K.glass;
        e.currentTarget.style.borderColor = hasSelection ? `${accent}55` : K.hairline;
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: hasSelection ? accent : K.muted }}
        />
        <span
          className="truncate font-medium"
          style={{ color: hasSelection ? accent : K.muted }}
        >
          {selectedCount === 0
            ? `Select ${isCustomer ? 'Customers' : 'Items'}`
            : `${selectedCount} ${isCustomer ? 'customer' : 'item'}${selectedCount > 1 ? 's' : ''} selected`}
        </span>
      </div>
      <ChevronDown
        className="w-4 h-4 flex-shrink-0"
        style={{ color: hasSelection ? accent : K.faint }}
      />
    </button>
  );
};

export default SelectionButton;