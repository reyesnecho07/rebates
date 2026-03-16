import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Package, Users, Calendar, User, FileText, Percent, TrendingUp, LocateFixed, Copy } from 'lucide-react';

const DuplicationError = ({
  isOpen,
  onClose,
  type,
  data,
  theme
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const isWarning = type === 'duplicateItem' || type === 'duplicateCustomer';
  const accentColor = isWarning ? '#f59e0b' : '#ef4444';
  const accentBg = isWarning
    ? (isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)')
    : (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)');

  const styles = {
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(6px)',
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
      borderRadius: '16px',
      overflow: 'hidden',
      background: isDark ? '#111827' : '#ffffff',
      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
      boxShadow: isDark
        ? '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
        : '0 24px 64px rgba(0,0,0,0.15)',
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
    },
    accentBar: {
      height: '4px',
      background: `linear-gradient(90deg, ${accentColor}, ${accentColor}aa)`,
      width: '100%',
    },
    header: {
      padding: '20px 20px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '14px',
      borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
    },
    iconWrap: {
      width: '42px',
      height: '42px',
      borderRadius: '12px',
      background: accentBg,
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
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: accentColor,
      background: accentBg,
      borderRadius: '5px',
      padding: '2px 8px',
      marginBottom: '6px',
    },
    title: {
      fontSize: '16px',
      fontWeight: 700,
      color: isDark ? '#f9fafb' : '#111827',
      margin: 0,
      lineHeight: 1.3,
    },
    subtitle: {
      fontSize: '13px',
      color: isDark ? '#6b7280' : '#6b7280',
      marginTop: '3px',
      lineHeight: 1.5,
    },
    closeBtn: {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: isDark ? '#6b7280' : '#9ca3af',
      flexShrink: 0,
      transition: 'background 0.15s, color 0.15s',
    },
    content: {
      padding: '16px 20px',
      maxHeight: '340px',
      overflowY: 'auto',
    },
    sectionLabel: {
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      color: isDark ? '#4b5563' : '#9ca3af',
      marginBottom: '10px',
    },
    infoGrid: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    infoRow: {
      display: 'flex',
      alignItems: 'center',
      padding: '7px 10px',
      borderRadius: '8px',
      gap: '10px',
      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
      transition: 'background 0.15s',
    },
    infoLabel: {
      fontSize: '13px',
      color: isDark ? '#6b7280' : '#9ca3af',
      width: '110px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    infoValue: {
      fontSize: '13px',
      fontWeight: 500,
      color: isDark ? '#e5e7eb' : '#111827',
      flex: 1,
    },
    codeValue: {
      fontSize: '13px',
      fontWeight: 600,
      fontFamily: 'monospace',
      color: isWarning
        ? (isDark ? '#fcd34d' : '#d97706')
        : (isDark ? '#93c5fd' : '#2563eb'),
      flex: 1,
    },
    dupCard: {
      borderRadius: '10px',
      border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      overflow: 'hidden',
      marginBottom: '8px',
    },
    dupCardHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
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
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: isDark ? '#4b5563' : '#9ca3af',
    },
    dupFieldValue: {
      fontSize: '12px',
      fontWeight: 500,
      color: isDark ? '#d1d5db' : '#374151',
    },
    footer: {
      padding: '14px 20px',
      borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerNote: {
      fontSize: '12px',
      color: isDark ? '#4b5563' : '#9ca3af',
    },
    okBtn: {
      height: '34px',
      padding: '0 18px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 600,
      color: '#fff',
      background: accentColor,
      transition: 'opacity 0.15s, transform 0.1s',
      letterSpacing: '0.02em',
    },
  };

  const getIcon = () => {
    switch (type) {
      case 'duplicateProgram': return <FileText size={18} color={accentColor} />;
      case 'duplicateItem': return <Package size={18} color={accentColor} />;
      case 'duplicateCustomer': return <Users size={18} color={accentColor} />;
      default: return <AlertTriangle size={18} color={accentColor} />;
    }
  };

  const getBadgeText = () => {
    switch (type) {
      case 'duplicateProgram': return 'Program conflict';
      case 'duplicateItem': return 'Item conflict';
      case 'duplicateCustomer': return 'Customer conflict';
      default: return 'Conflict detected';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'duplicateProgram': return 'Duplicate Rebate Program';
      case 'duplicateItem': return 'Duplicate Items Found';
      case 'duplicateCustomer': return 'Duplicate Customers Found';
      default: return 'Duplicate Entry';
    }
  };

  const getMessage = () => {
    switch (type) {
      case 'duplicateProgram': return 'A program with identical parameters already exists.';
      case 'duplicateItem': return 'Items already assigned to an active program.';
      case 'duplicateCustomer': return 'Customers already assigned to an active program.';
      default: return 'Unable to save due to duplicates.';
    }
  };

  const InfoRow = ({ icon: Icon, label, value, isCode }) => (
    <div style={styles.infoRow}>
      <div style={styles.infoLabel}>
        {Icon && <Icon size={13} color={isDark ? '#4b5563' : '#9ca3af'} />}
        <span>{label}</span>
      </div>
      <div style={isCode ? styles.codeValue : styles.infoValue}>{value}</div>
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
        <div style={styles.sectionLabel}>{items.length} conflicting {type === 'duplicateItem' ? 'item' : 'customer'}{items.length !== 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item, idx) => (
            <div key={idx} style={styles.dupCard}>
              <div style={styles.dupCardHeader}>
                <div style={{ ...styles.iconWrap, width: 28, height: 28, borderRadius: 7 }}>
                  <Icon size={14} color={accentColor} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e5e7eb' : '#111827' }}>
                  {item.name}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'monospace', color: isDark ? '#6b7280' : '#9ca3af' }}>
                  {item.code}
                </span>
              </div>
              {item.existingProgram && (
                <div style={styles.dupCardBody}>
                  <div style={styles.dupField}>
                    <div style={styles.dupFieldLabel}>Existing Program</div>
                    <div style={{ ...styles.dupFieldValue, color: isWarning ? (isDark ? '#fcd34d' : '#d97706') : (isDark ? '#93c5fd' : '#2563eb'), fontFamily: 'monospace' }}>
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
      case 'duplicateProgram': return renderDuplicateProgramDetails();
      case 'duplicateItem': return renderDupList(data?.duplicateItems, i => i.code, Package);
      case 'duplicateCustomer': return renderDupList(data?.duplicateCustomers, c => c.code, Users);
      default:
        return <div style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>{data?.message || 'Please review your entries and try again.'}</div>;
    }
  };

  const count = type === 'duplicateItem'
    ? data?.duplicateItems?.length
    : type === 'duplicateCustomer'
    ? data?.duplicateCustomers?.length
    : null;

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
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
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = isDark ? '#d1d5db' : '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
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
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
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