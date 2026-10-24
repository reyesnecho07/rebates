// src/components/DuplicationError.jsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Package, Users, Calendar, User, FileText, Percent, TrendingUp, LocateFixed } from 'lucide-react';

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

const DASH_FONT = `
  .dash-page, .dash-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  @keyframes dash-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dash-pop { animation: dash-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
`;

const DuplicationError = ({
  isOpen,
  onClose,
  type,
  data,
  theme
}) => {
  const [visible, setVisible] = useState(false);
  const isDark = theme === 'dark';
  const K = dashTokens(isDark);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isWarning = type === 'duplicateItem' || type === 'duplicateCustomer';
  const accentColor = isWarning ? APPLE.orange : APPLE.red;

  const styles = {
    overlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: isDark ? 'rgba(10,10,14,0.65)' : 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      padding: '1rem',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s ease',
    },
    modal: {
      position: 'relative',
      width: '100%',
      maxWidth: '480px',
      borderRadius: '28px',
      overflow: 'hidden',
      background: K.glassDeep,
      border: `1px solid ${K.rim}`,
      boxShadow: K.shadow,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    },
    accentBar: {
      height: '3px',
      background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}aa 100%)`,
      width: '100%',
    },
    header: {
      padding: '20px 20px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '14px',
      borderBottom: `1px solid ${K.hairline}`,
    },
    iconWrap: {
      width: '42px',
      height: '42px',
      borderRadius: '14px',
      background: `${accentColor}1c`,
      border: `1px solid ${accentColor}33`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    titleGroup: {
      flex: 1,
      minWidth: 0,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: accentColor,
      background: `${accentColor}1c`,
      border: `1px solid ${accentColor}33`,
      borderRadius: '999px',
      padding: '2px 8px',
      marginBottom: '6px',
    },
    title: {
      fontSize: '16px',
      fontWeight: 700,
      color: K.ink,
      margin: 0,
      lineHeight: 1.3,
    },
    subtitle: {
      fontSize: '13px',
      color: K.muted,
      marginTop: '3px',
      lineHeight: 1.5,
    },
    closeBtn: {
      width: '32px',
      height: '32px',
      borderRadius: '999px',
      border: 'none',
      background: K.chipBg,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: K.muted,
      flexShrink: 0,
      transition: 'background 0.15s, color 0.15s',
    },
    content: {
      padding: '16px 20px',
      maxHeight: '340px',
      overflowY: 'auto',
    },
    sectionLabel: {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: K.faint,
      marginBottom: '10px',
    },
    infoGrid: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    // ── Single-line info row: label left, value right ─────────────────────
    infoRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: '10px',
      gap: '12px',
      background: K.chipBg,
      transition: 'background 0.15s',
      minHeight: '40px',
    },
    infoLabel: {
      fontSize: '12px',
      color: K.muted,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    },
    infoValue: {
      fontSize: '13px',
      fontWeight: 600,
      color: K.ink,
      textAlign: 'right',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0,
    },
    codeValue: {
      fontSize: '13px',
      fontWeight: 600,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      color: isWarning ? APPLE.orange : APPLE.blue,
      textAlign: 'right',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0,
    },
    dupCard: {
      borderRadius: '14px',
      border: `1px solid ${K.hairline}`,
      overflow: 'hidden',
      marginBottom: '8px',
      background: K.glass,
    },
    dupCardHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      background: K.chipBg,
      borderBottom: `1px solid ${K.hairline}`,
    },
    dupCardBody: {
      padding: '10px 12px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
    },
    dupField: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    dupFieldLabel: {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: K.faint,
    },
    dupFieldValue: {
      fontSize: '12px',
      fontWeight: 500,
      color: K.muted,
    },
    footer: {
      padding: '14px 20px',
      borderTop: `1px solid ${K.hairline}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    footerNote: {
      fontSize: '12px',
      color: K.muted,
    },
    okBtn: {
      height: '36px',
      padding: '0 18px',
      borderRadius: '999px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 600,
      color: '#fff',
      background: accentColor,
      boxShadow: `0 4px 16px -6px ${accentColor}88`,
      transition: 'opacity 0.15s, transform 0.1s',
      letterSpacing: '0.02em',
    },
  };

  const getIcon = () => {
    switch (type) {
      case 'duplicateProgram':  return <FileText size={18} color={accentColor} />;
      case 'duplicateItem':     return <Package size={18} color={accentColor} />;
      case 'duplicateCustomer': return <Users size={18} color={accentColor} />;
      default:                  return <AlertTriangle size={18} color={accentColor} />;
    }
  };

  const getBadgeText = () => {
    switch (type) {
      case 'duplicateProgram':  return 'Program conflict';
      case 'duplicateItem':     return 'Item conflict';
      case 'duplicateCustomer': return 'Customer conflict';
      default:                  return 'Conflict detected';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'duplicateProgram':  return 'Duplicate Rebate Program';
      case 'duplicateItem':     return 'Duplicate Items Found';
      case 'duplicateCustomer': return 'Duplicate Customers Found';
      default:                  return 'Duplicate Entry';
    }
  };

  const getMessage = () => {
    switch (type) {
      case 'duplicateProgram':  return 'A program with the same type, sales employee, and frequency already covers an overlapping date range.';
      case 'duplicateItem':     return 'Items already assigned to a program with an overlapping date range.';
      case 'duplicateCustomer': return 'An active rebate already exists for this sales employee and rebate type within the selected date range.';
      default:                  return 'Unable to save due to duplicates.';
    }
  };

  // ── Single-line info row: label left · value right ──────────────────────
  const InfoRow = ({ icon: Icon, label, value, isCode }) => (
    <div style={styles.infoRow}>
      <div style={styles.infoLabel}>
        {Icon && <Icon size={13} color={K.faint} />}
        <span>{label}</span>
      </div>
      <div style={isCode ? styles.codeValue : styles.infoValue} title={value}>
        {value}
      </div>
    </div>
  );

  const renderDuplicateProgramDetails = () => {
    if (!data?.program) return null;
    const p = data.program;
    return (
      <div>
        <div style={styles.sectionLabel}>Conflicting Program</div>
        <div style={styles.infoGrid}>
          <InfoRow icon={FileText} label="Rebate Code" value={p.RebateCode} isCode />
          <InfoRow icon={User} label="Rebate Type" value={p.RebateType} />
          <InfoRow icon={Users} label="Sales Employee" value={p.SlpName} />
          <InfoRow icon={Calendar} label="Date From" value={new Date(p.DateFrom).toLocaleDateString()} />
          <InfoRow icon={Calendar} label="Date To" value={new Date(p.DateTo).toLocaleDateString()} />
          <InfoRow icon={TrendingUp} label="Frequency" value={p.Frequency} />
          <InfoRow
            icon={p.RebateType === 'Percentage' ? Percent : p.RebateType === 'Incremental' ? TrendingUp : LocateFixed}
            label="Quota Type"
            value={p.QuotaType}
          />
        </div>
      </div>
    );
  };

  const renderDupList = (items, keyFn, iconComp) => {
    if (!items || items.length === 0) return null;
    const Icon = iconComp;
    return (
      <div>
        <div style={styles.sectionLabel}>
          {items.length} conflicting {type === 'duplicateItem' ? 'item' : 'customer'}{items.length !== 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item, idx) => (
            <div key={idx} style={styles.dupCard}>
              <div style={styles.dupCardHeader}>
                <div style={{ ...styles.iconWrap, width: 28, height: 28, borderRadius: 10, background: `${accentColor}1c`, border: `1px solid ${accentColor}33` }}>
                  <Icon size={14} color={accentColor} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: K.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: K.faint, flexShrink: 0 }}>
                  {item.code}
                </span>
              </div>
              {item.existingProgram && (
                <div style={styles.dupCardBody}>
                  <div style={styles.dupField}>
                    <div style={styles.dupFieldLabel}>Existing Program</div>
                    <div style={{ ...styles.dupFieldValue, color: isWarning ? APPLE.orange : APPLE.blue, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600 }}>
                      {item.existingProgram.RebateCode}
                    </div>
                  </div>
                  <div style={styles.dupField}>
                    <div style={styles.dupFieldLabel}>Active Period</div>
                    <div style={styles.dupFieldValue}>
                      {new Date(item.existingProgram.DateFrom).toLocaleDateString()} – {new Date(item.existingProgram.DateTo).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (type) {
      case 'duplicateProgram':  return renderDuplicateProgramDetails();
      case 'duplicateItem':     return renderDupList(data?.duplicateItems, i => i.code, Package);
      case 'duplicateCustomer': return renderDupList(data?.duplicateCustomers, c => c.code, Users);
      default:
        return <div style={{ fontSize: 13, color: K.muted }}>{data?.message || 'Please review your entries and try again.'}</div>;
    }
  };

  const count = type === 'duplicateItem'
    ? data?.duplicateItems?.length
    : type === 'duplicateCustomer'
    ? data?.duplicateCustomers?.length
    : null;

  return (
    <div className="dash-page" style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <style>{DASH_FONT}</style>
      <div style={styles.modal}>
        <div style={styles.accentBar} />

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.iconWrap}>{getIcon()}</div>
          <div style={styles.titleGroup}>
            <div style={styles.badge}>
              <AlertTriangle size={9} />
              {getBadgeText()}
            </div>
            <h3 style={styles.title}>{getTitle()}</h3>
            <p style={styles.subtitle}>{getMessage()}</p>
          </div>
          <button
            onClick={onClose}
            style={styles.closeBtn}
            onMouseEnter={e => { e.currentTarget.style.background = K.hairline; e.currentTarget.style.color = K.ink; }}
            onMouseLeave={e => { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.muted; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content} className="dash-scroll">
          {renderContent()}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerNote}>
            {count != null ? `${count} record${count !== 1 ? 's' : ''} affected` : 'Review and resolve before saving'}
          </span>
          <button
            style={styles.okBtn}
            onClick={onClose}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicationError;