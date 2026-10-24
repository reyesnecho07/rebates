// src/components/Sidebar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PanelRight, Database, ChevronDown, Home, FileText, BarChart2, Users, Package,
  User, Settings, LayoutDashboard, DollarSign, ClipboardList, Shield, Layout, FileCog,
} from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import SideBarError from '../components/common/SideBarError';
import accessControlService from '../services/accessControlService';

/* ─── Apple system colour language ───────────────────────────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const tokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.85)"  : "rgba(255,255,255,0.9)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const FONT = `
  .sb-page, .sb-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .sb-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .sb-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .sb-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.35); border-radius: 999px; }
  .sb-scroll::-webkit-scrollbar-track { background: transparent; }
`;

const BASE_URL              = 'http://192.168.100.193:3009/api';
const POLL_INTERVAL         = 30_000;
const CACHE_KEY             = 'sidebar_nav_cache';
const CACHE_TIMESTAMP_KEY   = 'sidebar_nav_cache_timestamp';
const DROPDOWN_STATE_KEY    = 'sidebar_dropdown_states';
const CACHE_DURATION        = 30 * 60 * 1000;
const ALLOWED_SERVER_TAG    = 'JL Server';
const ALLOWED_DB_NAMES      = new Set(['VAN_DB', 'NEXCHEM_DB', 'VCP_DB']);
const REBATE_GROUP_KEYWORDS = ['rebate'];
const USER_DB_ORDER_PREFIX  = 'databaseOrder_';

/* ─── Hardcoded primary items — EXACT order is preserved ─────────────────────
   These are always injected at the top of each DB's item list, in the order
   below. Items already supplied by the API with the same `routePath` are
   skipped, so no duplicates ever appear.
   ──────────────────────────────────────────────────────────────────────────── */
const HARDCODED_PRIMARY_ITEMS = {
  NEXCHEM_DB: [
    { navItemId: 'nexchem-01-dashboard',   navItemName: 'Dashboard',       routePath: '/Nexchem_Dashboard',       icon: Home,       order: 1 },
    { navItemId: 'nexchem-02-rebsetup',    navItemName: 'Rebate Setup',    routePath: '/Nexchem_RebateSetup',     icon: FileCog,    order: 2 },
    { navItemId: 'nexchem-03-rebprog',     navItemName: 'Rebate Program',  routePath: '/Nexchem_RebatePrograms',  icon: FileText,   order: 3 },
    { navItemId: 'nexchem-04-status',      navItemName: 'Customer Summary',  routePath: '/Nexchem_CustomerSummary',   icon: BarChart2,  order: 4 },
    { navItemId: 'nexchem-05-reports',     navItemName: 'Reports',         routePath: '/Nexchem_Reports',         icon: BarChart2,  order: 5 },
    //{ navItemId: 'nexchem-06-items',       navItemName: 'Item Records',    routePath: '/Nexchem_ItemRecords',     icon: Package,    order: 6 },
    //{ navItemId: 'nexchem-07-sales',       navItemName: 'Sales Employee',  routePath: '/Nexchem_SalesEmployee',   icon: User,       order: 7 },
    //{ navItemId: 'nexchem-08-customers',   navItemName: 'Customer Records',routePath: '/Nexchem_CustomerRecords', icon: Users,      order: 8 },
  ],
  VAN_DB: [
    { navItemId: 'van-01-dashboard',   navItemName: 'Dashboard',        routePath: '/Van_Dashboard',       icon: Home,       order: 1 },
    { navItemId: 'van-02-rebsetup',    navItemName: 'Rebate Setup',     routePath: '/Van_RebateSetup',     icon: FileCog,    order: 2 },
    { navItemId: 'van-03-rebprog',     navItemName: 'Rebate Program',   routePath: '/Van_RebatePrograms',  icon: FileText,   order: 3 },
    { navItemId: 'van-04-status',      navItemName: 'Customer Summary',   routePath: '/Van_CustomerSummary',   icon: BarChart2,  order: 4 },
    { navItemId: 'van-05-reports',     navItemName: 'Reports',          routePath: '/Van_Reports',         icon: BarChart2,  order: 5 },
   //{ navItemId: 'van-06-items',       navItemName: 'Item Records',     routePath: '/Van_ItemRecords',     icon: Package,    order: 6 },
   // { navItemId: 'van-07-sales',       navItemName: 'Sales Employee',   routePath: '/Van_SalesEmployee',   icon: User,       order: 7 },
    //{ navItemId: 'van-08-customers',   navItemName: 'Customer Records', routePath: '/Van_CustomerRecords', icon: Users,      order: 8 },
  ],
  VCP_DB: [
    { navItemId: 'vcp-01-dashboard',   navItemName: 'Dashboard',        routePath: '/Vcp_Dashboard',       icon: Home,       order: 1 },
    { navItemId: 'vcp-02-rebsetup',    navItemName: 'Rebate Setup',     routePath: '/Vcp_RebateSetup',     icon: FileCog,    order: 2 },
    { navItemId: 'vcp-03-rebprog',     navItemName: 'Rebate Program',   routePath: '/Vcp_RebatePrograms',  icon: FileText,   order: 3 },
    { navItemId: 'vcp-04-status',      navItemName: 'Customer Summary',   routePath: '/Vcp_CustomerSummary',   icon: BarChart2,  order: 4 },
    { navItemId: 'vcp-05-reports',     navItemName: 'Reports',          routePath: '/Vcp_Reports',         icon: BarChart2,  order: 5 },
    //{ navItemId: 'vcp-06-items',       navItemName: 'Item Records',     routePath: '/Vcp_ItemRecords',     icon: Package,    order: 6 },
   // { navItemId: 'vcp-07-sales',       navItemName: 'Sales Employee',   routePath: '/Vcp_SalesEmployee',   icon: User,       order: 7 },
    //{ navItemId: 'vcp-08-customers',   navItemName: 'Customer Records', routePath: '/Vcp_CustomerRecords', icon: Users,      order: 8 },
  ],
};

function isRebateGroup(groupName = '') {
  return REBATE_GROUP_KEYWORDS.some(k => groupName.toLowerCase().includes(k));
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('currentUser') || 'null') || null; }
  catch { return null; }
}
function getUserCode() {
  const u = getCurrentUser();
  if (!u) return null;
  return u.User_ID ?? u.UserCode ?? u.userCode ?? null;
}
function getUserId() {
  const u = getCurrentUser();
  if (!u) return null;
  return u.UserID ?? u.User_ID ?? null;
}
function checkIsSuperUser() {
  const u = getCurrentUser();
  if (!u) return false;
  const v = u.IsSuperUser ?? u.isSuperUser ?? 0;
  return v === 1 || v === true || v === '1';
}
function loadUserDbOrder() {
  try {
    const uid = getUserId();
    if (uid) {
      const perUser = localStorage.getItem(`${USER_DB_ORDER_PREFIX}${uid}`);
      if (perUser) return JSON.parse(perUser);
    }
    const legacy = localStorage.getItem('databaseOrder');
    if (legacy) return JSON.parse(legacy);
    return null;
  } catch { return null; }
}

// ── Access: batch-fetch canView for every leaf route ─────────────────────────
function collectRoutePaths(items, out = new Set()) {
  for (const item of items) {
    if (item.routePath) out.add(item.routePath);
    if (item.children?.length) collectRoutePaths(item.children, out);
  }
  return out;
}

async function fetchAccessMap(routePaths, userCode) {
  const map = new Map();
  if (checkIsSuperUser()) {
    routePaths.forEach(p => map.set(p, true));
    return map;
  }
  if (!userCode) {
    routePaths.forEach(p => map.set(p, false));
    return map;
  }
  const results = await Promise.allSettled(
    [...routePaths].map(async (routePath) => {
      try {
        const res = await accessControlService.getAccessByRouteAndUser_ID(
          routePath, userCode, 'USER'
        );
        const canView = res?.success && res?.data ? (res.data.canView ?? false) : false;
        return { routePath, canView };
      } catch {
        return { routePath, canView: false };
      }
    })
  );
  results.forEach(r => {
    if (r.status === 'fulfilled') map.set(r.value.routePath, r.value.canView);
  });
  return map;
}

function stampAccess(items, accessMap) {
  return items.map(item => ({
    ...item,
    _canView: item.routePath ? (accessMap.get(item.routePath) ?? false) : true,
    children: item.children?.length ? stampAccess(item.children, accessMap) : [],
  }));
}

// ── Icon resolver ─────────────────────────────────────────────────────────────
const ICON_RULES = [
  { keyword: 'dashboard',     icon: Home           },
  { keyword: 'rebatesetup',   icon: FileCog        },
  { keyword: 'rebate',        icon: FileCog        },
  { keyword: 'report',        icon: BarChart2      },
  { keyword: 'status',        icon: BarChart2      },
  { keyword: 'customer',      icon: Users          },
  { keyword: 'item',          icon: Package        },
  { keyword: 'sales',         icon: User           },
  { keyword: 'employee',      icon: User           },
  { keyword: 'setting',       icon: Settings       },
  { keyword: 'overview',      icon: LayoutDashboard },
  { keyword: 'payout',        icon: DollarSign     },
  { keyword: 'log',           icon: ClipboardList  },
  { keyword: 'user',          icon: Users          },
  { keyword: 'authorization', icon: Shield         },
  { keyword: 'navigation',    icon: Layout         },
  { keyword: 'database',      icon: Database       },
  { keyword: 'group',         icon: Users          },
  { keyword: 'preference',    icon: Settings       },
];
function getIcon(str = '') {
  const lower = str.toLowerCase();
  const match = ICON_RULES.find(r => lower.includes(r.keyword));
  return match ? match.icon : FileText;
}

// ── Hardcoded icon lookup (used when restoring from cache) ────────────────────
function getHardcodedIcon(navItemId) {
  for (const dbName of Object.keys(HARDCODED_PRIMARY_ITEMS)) {
    const found = HARDCODED_PRIMARY_ITEMS[dbName].find(h => h.navItemId === navItemId);
    if (found) return found.icon;
  }
  return null;
}

// ── Static visual config ──────────────────────────────────────────────────────
const DB_VISUAL = {
  VAN_DB: {
    id: 'van', pathPrefix: '/Van_', dashboardPath: '/Van_Dashboard',
    gradient: 'linear-gradient(155deg, #5AC8FA 0%, #0A84FF 100%)',
    dotColor: APPLE.blue,
  },
  NEXCHEM_DB: {
    id: 'nexchem', pathPrefix: '/Nexchem_', dashboardPath: '/Nexchem_Dashboard',
    gradient: 'linear-gradient(155deg, #BF5AF2 0%, #8B3FD1 100%)',
    dotColor: APPLE.purple,
  },
  VCP_DB: {
    id: 'vcp', pathPrefix: '/Vcp_', dashboardPath: '/Vcp_Dashboard',
    gradient: 'linear-gradient(155deg, #32D74B 0%, #1D9E3F 100%)',
    dotColor: APPLE.green,
  },
};
function getVisual(dbName) {
  const key = Object.keys(DB_VISUAL).find(k => k === dbName) ||
              Object.keys(DB_VISUAL).find(k => k.toLowerCase() === dbName?.toLowerCase());
  if (key) return DB_VISUAL[key];
  const safe = (dbName || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
  const pathPrefix = `/${safe.charAt(0).toUpperCase() + safe.slice(1)}_`;
  return {
    id: safe.toLowerCase(), pathPrefix, dashboardPath: `${pathPrefix}Dashboard`,
    gradient: 'linear-gradient(155deg, #8E8E93 0%, #58585B 100%)',
    dotColor: APPLE.gray,
  };
}

function attachIcons(items) {
  return items.map(item => ({
    ...item,
    icon:     getIcon(item.routePath || item.navItemName || ''),
    label:    item.navItemName,
    path:     item.routePath,
    children: item.children ? attachIcons(item.children) : [],
  }));
}

// ── Filter helpers ────────────────────────────────────────────────────────────
function filterItems(items) {
  return items.reduce((acc, item) => {
    if (item.children?.length) {
      const visibleChildren = filterItems(item.children);
      if (visibleChildren.length) acc.push({ ...item, children: visibleChildren });
      return acc;
    }
    if (item._canView && item.path) acc.push(item);
    return acc;
  }, []);
}
function filterGroups(groups) {
  return groups.reduce((acc, group) => {
    if (!isRebateGroup(group.groupName)) return acc;
    const visibleItems = filterItems(group.items || []);
    if (visibleItems.length) acc.push({ ...group, items: visibleItems });
    return acc;
  }, []);
}
function filterDatabases(databases) {
  return databases.reduce((acc, db) => {
    const visibleGroups = filterGroups(db.groups || []);
    if (visibleGroups.length) acc.push({ ...db, groups: visibleGroups });
    return acc;
  }, []);
}
function groupByTag(dbs) {
  const map = {};
  for (const db of dbs) {
    const tag = db.dbTag || db.name;
    if (!map[tag]) map[tag] = [];
    map[tag].push(db);
  }
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v.length > 0));
}

// ── Build raw nav tree ────────────────────────────────────────────────────────
function buildSidebarData(dbRows, navStructure) {
  return dbRows
    .filter(row => {
      const tagMatch  = row.DBTag?.toLowerCase() === ALLOWED_SERVER_TAG.toLowerCase();
      const nameMatch = ALLOWED_DB_NAMES.has(row.DBName) ||
                        [...ALLOWED_DB_NAMES].some(n => n.toLowerCase() === row.DBName?.toLowerCase());
      if (!tagMatch || !nameMatch) return false;
      const active  = row.IsActive  === 1 || row.IsActive  === true || row.IsActive  === '1';
      const visible = row.IsVisible === 1 || row.IsVisible === true || row.IsVisible === '1' || row.IsVisible == null;
      return active && visible;
    })
    .map(row => {
      const visual   = getVisual(row.DBName);
      const navEntry = navStructure[row.DatabaseID];
      const groups   = (navEntry?.groups || []).map(group => ({
        groupId:   group.groupId,
        groupName: group.groupName,
        sortOrder: group.sortOrder,
        items:     attachIcons(group.items || []),
      }));
      let dashboardPath = visual.dashboardPath;
      outer: for (const group of groups) for (const item of group.items) {
        if (item.path?.toLowerCase().includes('dashboard')) { dashboardPath = item.path; break outer; }
      }
      return {
        name: row.DBName, id: visual.id, dbTag: row.DBTag,
        pathPrefix: visual.pathPrefix, dashboardPath,
        gradient: visual.gradient,
        dotColor: visual.dotColor,
        databaseId: row.DatabaseID, displayOrder: row.DisplayOrder, groups,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
}

function flattenItem(item) {
  const base = `${item.label}|${item.path}`;
  return item.children?.length ? `${base}(${item.children.map(flattenItem).join(',')})` : base;
}
function serialise(dbs) {
  return dbs.map(db =>
    `${db.name}:${db.groups.map(g => `${g.groupName}[${g.items.map(flattenItem).join(';')}]`).join(',')}`
  ).sort().join('||');
}

// ── Cache helpers ─────────────────────────────────────────────────────────────
function stripIcons(items) {
  return items.map(({ icon, ...rest }) => ({
    ...rest,
    children: rest.children ? stripIcons(rest.children) : [],
  }));
}
function restoreIcons(items) {
  return items.map(item => ({
    ...item,
    icon: item._hardcoded
      ? (getHardcodedIcon(item.navItemId) || getIcon(item.label || item.path || ''))
      : getIcon(item.label || item.path || ''),
    children: item.children ? restoreIcons(item.children) : [],
  }));
}
function loadCachedNavData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const ts     = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!cached) return { data: null, expired: true };
    const age     = ts ? Date.now() - parseInt(ts, 10) : Infinity;
    const expired = age > CACHE_DURATION;
    const dbs     = JSON.parse(cached);
    const restored = dbs
      .filter(db =>
        ALLOWED_DB_NAMES.has(db.name) ||
        [...ALLOWED_DB_NAMES].some(n => n.toLowerCase() === db.name?.toLowerCase())
      )
      .map(db => {
        const visual = getVisual(db.name);
        return {
          ...db,
          gradient: visual.gradient,
          dotColor: visual.dotColor,
          pathPrefix: visual.pathPrefix,
          dashboardPath: db.dashboardPath || visual.dashboardPath,
          groups: db.groups.map(g => ({ ...g, items: restoreIcons(g.items) })),
        };
      });
    return { data: restored.length ? restored : null, expired };
  } catch {
    return { data: null, expired: true };
  }
}
function saveCachedNavData(data) {
  try {
    const stripped = data.map(db => ({
      ...db,
      groups: db.groups.map(g => ({ ...g, items: stripIcons(g.items) })),
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(stripped));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch {}
}
function loadDropdownStates() {
  try { return JSON.parse(localStorage.getItem(DROPDOWN_STATE_KEY) || '{}'); }
  catch { return {}; }
}
function saveDropdownStates(states) {
  try { localStorage.setItem(DROPDOWN_STATE_KEY, JSON.stringify(states)); } catch {}
}

/* ─── Inject hardcoded primary items into a DB, respecting user access.
   Hardcoded items are added as a dedicated "Rebate Primary" group so they
   flow through the normal filterGroups → filterDatabases pipeline. Items the
   user cannot view (`accessMap.get(routePath) !== true`) are dropped. ────── */
function injectHardcodedPrimaryItems(db, accessMap) {
  const hardcoded = HARDCODED_PRIMARY_ITEMS[db.name] || [];
  if (!hardcoded.length) return db;

  const hardcodedPaths = new Set(hardcoded.map(h => h.routePath));

  // Remove any API items whose routePath collides with a hardcoded one
  const cleanedGroups = db.groups.map(group => ({
    ...group,
    items: (group.items || []).filter(
      item => !hardcodedPaths.has(item.path) && !hardcodedPaths.has(item.routePath)
    ),
  }));

  // Only keep hardcoded items the current user is allowed to view
  const accessible = hardcoded
    .filter(h => accessMap.get(h.routePath) === true)
    .sort((a, b) => a.order - b.order)
    .map(h => ({
      navItemId:   h.navItemId,
      label:       h.navItemName,
      path:        h.routePath,
      routePath:   h.routePath,
      navItemName: h.navItemName,
      icon:        h.icon,
      children:    [],
      _canView:    true,
      _hardcoded:  true,
      _order:      h.order,
    }));

  if (!accessible.length) return { ...db, groups: cleanedGroups };

  const hardcodedGroup = {
    groupId:   `${db.id}__primary`,
    groupName: 'Rebate Primary',   // contains "rebate" → isRebateGroup === true
    sortOrder: -1,
    items:     accessible,
  };

  return { ...db, groups: [hardcodedGroup, ...cleanedGroups] };
}

// ─────────────────────────────────────────────────────────────────────────────
// NavItem
// ─────────────────────────────────────────────────────────────────────────────
const NavItem = ({ item, depth = 0, dotColor, isDark, location, K }) => {
  const visibleChildren = item.children || [];
  const hasChildren     = visibleChildren.length > 0;
  const IconComp        = item.icon || FileText;

  const isDescendantActive = useCallback(
    (children) => children.some(c => location.pathname === c.path || isDescendantActive(c.children || [])),
    [location.pathname] // eslint-disable-line
  );
  const shouldBeOpen = hasChildren && isDescendantActive(visibleChildren);
  const [open, setOpen] = useState(shouldBeOpen);
  useEffect(() => { setOpen(shouldBeOpen); }, [location.pathname, shouldBeOpen]);

  if (!hasChildren && !item.path) return null;

  const isActive    = location.pathname === item.path;
  const paddingLeft = 10 + depth * 12;

  return (
    <div>
      {hasChildren ? (
        <button
          onClick={() => setOpen(o => !o)}
          style={{ paddingLeft, color: isDark ? "#98989F" : "#6E6E73" }}
          className="flex items-center gap-2 w-full pr-3 py-1.5 rounded-lg transition-colors text-left text-xs font-medium justify-between"
          onMouseEnter={(e) => { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = K.muted; }}
        >
          <div className="flex items-center gap-2">
            <IconComp size={13} className="flex-shrink-0 opacity-70" />
            <span>{item.label}</span>
          </div>
          <ChevronDown size={11} className={`flex-shrink-0 transition-transform duration-200 opacity-50 ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <Link
          to={item.path}
          style={{
            paddingLeft,
            color: isActive ? dotColor : K.muted,
            background: isActive ? `${dotColor}1c` : "transparent",
            border: `1px solid ${isActive ? `${dotColor}33` : "transparent"}`,
          }}
          className="flex items-center gap-2 w-full pr-3 py-1.5 rounded-lg transition-colors text-left text-xs font-medium"
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = K.chipBg;
              e.currentTarget.style.color = K.ink;
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = K.muted;
            }
          }}
        >
          <IconComp
            size={13}
            className="flex-shrink-0"
            style={{
              opacity: isActive ? 1 : 0.6,
              color: isActive ? dotColor : "currentColor",
            }}
          />
          <span style={{ fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
        </Link>
      )}
      {hasChildren && (
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="ml-3 border-l" style={{ borderColor: K.hairline }}>
            {visibleChildren.map(child => (
              <NavItem
                key={child.navItemId} item={child} depth={depth + 1}
                dotColor={dotColor} isDark={isDark} location={location} K={K}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DBBlock
// ─────────────────────────────────────────────────────────────────────────────
const DBBlock = ({
  db, isDark, location, singleDb, K,
  getDropdownState, getDotColor,
}) => {
  const rebateItems = useMemo(() => {
    const rebateGroups = filterGroups(db.groups || []);
    return rebateGroups.flatMap(g => g.items || []);
  }, [db]);

  const dropdown = getDropdownState(db.id);

  const visual   = getVisual(db.name);
  const gradient = db.gradient || visual.gradient;
  const dotColor = db.dotColor || visual.dotColor;

  if (!rebateItems.length) return null;

  if (singleDb) {
    return (
      <div className="space-y-0.5">
        {rebateItems.map(item => (
          <NavItem
            key={item.navItemId} item={item} depth={0}
            dotColor={dotColor} isDark={isDark} location={location} K={K}
          />
        ))}
      </div>
    );
  }

  const isDbActive = rebateItems.some(
    item => location.pathname === item.path ||
            item.children?.some(c => location.pathname === c.path)
  );

  return (
    <div
      className="rounded-2xl overflow-hidden border transition-all"
      style={{
        borderColor: isDbActive ? `${dotColor}55` : K.hairline,
        background: K.glass,
      }}
    >
      <button
        onClick={() => dropdown.setShow(!dropdown.show)}
        className="flex items-center justify-between w-full px-3 py-2.5 transition-colors"
        onMouseEnter={(e) => e.currentTarget.style.background = K.chipBg}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: gradient,
              boxShadow: `0 4px 12px -4px ${dotColor}88`,
            }}
          >
            <Database size={12} strokeWidth={2.5} style={{ color: "#FFFFFF" }} />
          </div>
          <span className="text-xs font-semibold tracking-wide" style={{ color: K.ink }}>
            {db.name}
          </span>
        </div>
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 flex-shrink-0 ${dropdown.show ? 'rotate-180' : ''}`}
          style={{ color: K.faint }}
        />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
        dropdown.show ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-2 pb-2 pt-1 space-y-0.5" style={{ borderTop: `1px solid ${K.hairline}` }}>
          {rebateItems.map(item => (
            <NavItem
              key={item.navItemId} item={item} depth={0}
              dotColor={dotColor} isDark={isDark} location={location} K={K}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TagBlock
// ─────────────────────────────────────────────────────────────────────────────
const TagBlock = ({
  tagName, tagDbs, isDark, location, singleDb, K,
  getDropdownState, getDotColor,
}) => {
  if (!tagDbs.length) return null;
  return (
    <div className="space-y-1.5">
      {tagDbs.map(db => (
        <DBBlock
          key={db.id} db={db} isDark={isDark} location={location}
          singleDb={singleDb} K={K}
          getDropdownState={getDropdownState} getDotColor={getDotColor}
        />
      ))}
    </div>
  );
};

// ── Small syncing indicator ───────────────────────────────────────────────────
const SyncDot = () => (
  <span
    title="Syncing navigation…"
    className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
    style={{ background: APPLE.blue }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
const Sidebar = ({ collapsed, setCollapsed, userDbOrder }) => {
  const location               = useLocation();
  const { theme, updateTheme } = useTheme();
  const isDark                 = theme === 'dark';
  const K                      = tokens(isDark);

  const [activeDatabases, setActiveDatabases] = useState(() => {
    const { data } = loadCachedNavData();
    return data || [];
  });
  const [loading,        setLoading]        = useState(() => !loadCachedNavData().data);
  const [syncing,        setSyncing]        = useState(false);
  const [fetchError,     setFetchError]     = useState(null);
  const [dropdownStates, setDropdownStates] = useState(() => loadDropdownStates());

  const userDbOrderRef    = useRef(userDbOrder ?? loadUserDbOrder());
  const prevSerialRef     = useRef('');
  const isMountedRef      = useRef(true);
  const pollTimerRef      = useRef(null);
  const consecutiveErrRef = useRef(0);

  useEffect(() => {
    if (userDbOrder !== undefined) userDbOrderRef.current = userDbOrder;
  }, [userDbOrder]);

  useEffect(() => {
    const { data } = loadCachedNavData();
    if (data?.length) prevSerialRef.current = serialise(data);
  }, []); // eslint-disable-line

  // ── Load theme ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userId = stored.UserID || stored.User_ID;
        if (!userId) return;
        const res = await axios.get(`${BASE_URL}/user/preferences/${userId}/theme?db=USER`);
        if (res.data.success && res.data.value) {
          const t = res.data.value.toLowerCase();
          if (t !== theme) updateTheme(t);
        }
      } catch {
        const l = localStorage.getItem('userTheme');
        if (l && l !== theme) updateTheme(l);
      }
    };
    load();
  }, []); // eslint-disable-line

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (isBackground = false) => {
    if (!isMountedRef.current) return;

    const hasCachedData = activeDatabases.length > 0;
    if (!isBackground && !hasCachedData) setLoading(true);
    if (hasCachedData) setSyncing(true);

    try {
      const userCode  = getUserCode();
      const superUser = checkIsSuperUser();
      let dbRows = [], navStructure = {};

      if (userCode && !superUser) {
        const dbRes = await axios.get(`${BASE_URL}/user-access/databases`, {
          params: { userCode, db: 'USER' }, timeout: 10_000,
        });
        dbRows = dbRes.data?.data || [];

        const allowedRows = dbRows.filter(row =>
          ALLOWED_DB_NAMES.has(row.DBName) ||
          [...ALLOWED_DB_NAMES].some(n => n.toLowerCase() === row.DBName?.toLowerCase())
        );

        const navResults = await Promise.allSettled(
          allowedRows.map(row =>
            axios.get(`${BASE_URL}/user-access/nav-groups`, {
              params: { userCode, db: 'USER', databaseId: row.DatabaseID }, timeout: 10_000,
            })
          )
        );
        navResults.forEach((result, i) => {
          if (result.status === 'fulfilled') Object.assign(navStructure, result.value.data?.data || {});
          else console.warn(`⚠️ Sidebar: nav fetch failed for "${allowedRows[i].DBName}":`, result.reason?.message);
        });

      } else if (superUser) {
        const [dbRes, navRes] = await Promise.all([
          axios.get(`${BASE_URL}/databases`,             { params: { db: 'USER' }, timeout: 10_000 }),
          axios.get(`${BASE_URL}/nav-groups/with-items`, { params: { db: 'USER' }, timeout: 10_000 }),
        ]);
        dbRows       = dbRes.data?.data  || [];
        navStructure = navRes.data?.data || {};
      }

      if (!isMountedRef.current) return;

      const rawDbs = buildSidebarData(dbRows, navStructure);

      const allRoutePaths = new Set();
      for (const db of rawDbs)
        for (const group of db.groups)
          collectRoutePaths(group.items, allRoutePaths);
      for (const dbName of Object.keys(HARDCODED_PRIMARY_ITEMS)) {
        (HARDCODED_PRIMARY_ITEMS[dbName] || []).forEach(h => allRoutePaths.add(h.routePath));
      }

      const accessMap = await fetchAccessMap(allRoutePaths, userCode);
      if (!isMountedRef.current) return;

      const stampedDbs = rawDbs.map(db => ({
        ...db,
        groups: db.groups.map(group => ({
          ...group,
          items: stampAccess(group.items, accessMap),
        })),
      }));

      // Inject hardcoded primary items now (respecting accessMap), then filter.
      const withPrimary = stampedDbs.map(db => injectHardcodedPrimaryItems(db, accessMap));
      const built       = filterDatabases(withPrimary);
      const serial      = serialise(built);

      if (serial !== prevSerialRef.current) {
        prevSerialRef.current = serial;
        setActiveDatabases(built);
        saveCachedNavData(built);
        setDropdownStates(prev => {
          const next = {};
          built.forEach(db => {
            const isActive = location.pathname.startsWith(db.pathPrefix);
            next[db.id] = prev[db.id] !== undefined ? prev[db.id] : isActive;
          });
          const openIds = Object.keys(next).filter(id => next[id]);
          if (openIds.length > 1)
            built.forEach(db => { next[db.id] = location.pathname.startsWith(db.pathPrefix); });
          saveDropdownStates(next);
          return next;
        });
      }

      setFetchError(null);
      consecutiveErrRef.current = 0;
    } catch (err) {
      if (!isMountedRef.current) return;
      consecutiveErrRef.current += 1;
      console.warn(`⚠️ Sidebar fetch failed (attempt ${consecutiveErrRef.current}):`, err.message);
      if (!activeDatabases.length) {
        let msg = 'Failed to load navigation.';
        if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') msg = 'Cannot connect to server.';
        else if (err.response?.status === 500) msg = 'Server error. Please try again later.';
        else if (err.response) msg = `Server error ${err.response.status}.`;
        else if (err.request)  msg = 'No response from server.';
        setFetchError(msg);
      }
    } finally {
      if (isMountedRef.current) { setLoading(false); setSyncing(false); }
    }
  }, [location.pathname, activeDatabases.length]); // eslint-disable-line

  useEffect(() => {
    isMountedRef.current      = true;
    consecutiveErrRef.current = 0;
    if (userDbOrder === undefined) userDbOrderRef.current = loadUserDbOrder();

    const { data, expired } = loadCachedNavData();
    fetchAll(!data || expired ? false : true);

    pollTimerRef.current = setInterval(() => {
      if (consecutiveErrRef.current >= 10) { clearInterval(pollTimerRef.current); return; }
      fetchAll(true);
    }, POLL_INTERVAL);

    return () => { isMountedRef.current = false; clearInterval(pollTimerRef.current); };
  }, [fetchAll]);

  const handleRetry = useCallback(() => {
    setFetchError(null);
    consecutiveErrRef.current = 0;
    fetchAll(false);
  }, [fetchAll]);

  const visibleDatabases = useMemo(() => {
    const order = userDbOrder ?? userDbOrderRef.current;
    if (!order) return activeDatabases;
    return [...activeDatabases].sort((a, b) => (order[a.id] ?? 999) - (order[b.id] ?? 999));
  }, [activeDatabases, userDbOrder]);

  const visibleTagGroups = useMemo(() => groupByTag(visibleDatabases), [visibleDatabases]);

  const singleDb = visibleDatabases.length === 1;

  useEffect(() => {
    if (singleDb || !visibleDatabases.length) return;
    const activeDb = visibleDatabases.find(db => location.pathname.startsWith(db.pathPrefix));
    if (!activeDb) return;
    setDropdownStates(prev => {
      const alreadyOnly = prev[activeDb.id] === true &&
        visibleDatabases.every(db => db.id === activeDb.id || !prev[db.id]);
      if (alreadyOnly) return prev;
      const next = {};
      visibleDatabases.forEach(db => { next[db.id] = db.id === activeDb.id; });
      saveDropdownStates(next);
      return next;
    });
  }, [location.pathname, visibleDatabases, singleDb]);

  const getDropdownState = useCallback((dbId) => ({
    show: dropdownStates[dbId] ?? false,
    setShow: (value) => {
      setDropdownStates(prev => {
        const resolved = typeof value === 'function' ? value(prev[dbId] ?? false) : value;
        const next = {};
        visibleDatabases.forEach(db => { next[db.id] = false; });
        next[dbId] = resolved;
        saveDropdownStates(next);
        return next;
      });
    },
  }), [dropdownStates, visibleDatabases]);

  const activeDbId  = visibleDatabases.find(db => location.pathname.startsWith(db.pathPrefix))?.id ?? null;
  const getDotColor = db => db.dotColor || getVisual(db.name).dotColor;

  const asideStyle = {
    background: K.glass,
    borderColor: K.hairline,
    backdropFilter: "blur(28px) saturate(180%)",
    WebkitBackdropFilter: "blur(28px) saturate(180%)",
  };

  const asideClass = `sb-page sb-glass fixed top-0 left-0 h-screen border-r flex flex-col transition-all duration-500 z-50 ${
    collapsed ? 'w-20' : 'w-64'
  }`;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <aside className={asideClass} style={asideStyle}>
        <style>{FONT}</style>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div
            className="w-8 h-8 rounded-full border-4 animate-spin"
            style={{ borderColor: `${APPLE.blue}33`, borderTopColor: APPLE.blue }}
          />
          {!collapsed && <p className="text-xs" style={{ color: K.muted }}>Loading navigation…</p>}
        </div>
      </aside>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (fetchError && !visibleDatabases.length) {
    return (
      <aside className={asideClass} style={asideStyle}>
        <style>{FONT}</style>
        <SideBarError error={fetchError} onRetry={handleRetry} collapsed={collapsed} isDark={isDark} />
      </aside>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <aside className={asideClass} style={asideStyle}>
      <style>{FONT}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: `1px solid ${K.hairline}` }}>
        <div className={`flex items-center gap-3 transition-all duration-300 group ${collapsed ? 'justify-center w-full' : 'min-w-0 flex-1'}`}>
          <div className="relative w-8 h-8 flex-shrink-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm transition-all duration-300 ${collapsed ? 'group-hover:opacity-0 group-hover:scale-0' : ''}`}
              style={{ background: K.chipBg, borderColor: K.hairline }}
            >
              <img src="/url_logo.png" alt="Logo" className="w-5 h-5" />
            </div>
            {collapsed && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute inset-0 flex items-center justify-center p-2 rounded-xl transition-all duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100"
              >
                <PanelRight className="w-5 h-5" style={{ color: K.muted }} />
              </button>
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <h2
                className="font-bold leading-none whitespace-nowrap text-ellipsis overflow-hidden"
                style={{ color: K.ink, fontSize: 'clamp(13px, 1.1vw, 15px)' }}
              >
                RMS
              </h2>
              {syncing && <SyncDot />}
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
            style={{ color: K.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.chipBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = "transparent"; }}
          >
            <PanelRight size={15} />
          </button>
        )}
      </div>

      {/* ── Nav list ────────────────────────────────────────────────────────── */}
      <div className="flex-1 py-3 overflow-y-auto sb-scroll">
        {visibleDatabases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-2">
            <Database className="w-8 h-8" style={{ color: K.faint }} />
            {!collapsed && (
              <p className="text-xs" style={{ color: K.muted }}>No accessible databases</p>
            )}
            {!collapsed && fetchError && (
              <button
                onClick={handleRetry}
                className="mt-2 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: K.chipBg, color: K.ink }}
                onMouseEnter={(e) => e.currentTarget.style.background = K.hover}
                onMouseLeave={(e) => e.currentTarget.style.background = K.chipBg}
              >
                Retry
              </button>
            )}
          </div>

        ) : !collapsed ? (
          <div className="px-3 space-y-1.5">
            {Object.entries(visibleTagGroups).map(([tagName, tagDbs]) => (
              <TagBlock
                key={tagName} tagName={tagName} tagDbs={tagDbs}
                isDark={isDark} location={location}
                singleDb={singleDb} K={K}
                getDropdownState={getDropdownState} getDotColor={getDotColor}
              />
            ))}
          </div>

        ) : singleDb ? (
          <div className="flex flex-col items-center space-y-1 pt-2 px-1">
            {(() => {
              const db          = visibleDatabases[0];
              const dotColor    = getDotColor(db);
              const rebateGroups = filterGroups(db.groups || []);
              const rebateItems  = rebateGroups.flatMap(g => g.items || []);
              return rebateItems.map(item => {
                const IconComp = item.icon || FileText;
                const isActive = location.pathname === item.path ||
                                 item.children?.some(c => location.pathname === c.path);
                return (
                  <div key={item.navItemId} className="relative group w-full flex justify-center">
                    <Link
                      to={item.path || item.children?.[0]?.path || '#'}
                      className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 border"
                      style={{
                        background: isActive ? `${dotColor}1c` : "transparent",
                        borderColor: isActive ? `${dotColor}33` : "transparent",
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = K.chipBg; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      <IconComp
                        size={15}
                        style={{
                          color: isActive ? dotColor : K.muted,
                          opacity: isActive ? 1 : 0.85,
                        }}
                      />
                    </Link>
                    <div
                      className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                      style={{
                        background: K.glassDeep,
                        border: `1px solid ${K.rim}`,
                        color: K.ink,
                        boxShadow: K.shadow,
                      }}
                    >
                      {item.label}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

        ) : (
          <div className="flex flex-col items-center space-y-2 pt-2">
            {visibleDatabases.map(db => {
              const isCurrentDb = activeDbId === db.id;
              const visual   = getVisual(db.name);
              const gradient = db.gradient || visual.gradient;
              const dotColor = db.dotColor || visual.dotColor;
              return (
                <div key={db.id} className="relative group w-full flex justify-center">
                  <Link
                    to={db.dashboardPath}
                    className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200"
                    style={{
                      background: isCurrentDb ? gradient : `${dotColor}18`,
                      border: `1px solid ${isCurrentDb ? "transparent" : `${dotColor}33`}`,
                      boxShadow: isCurrentDb ? `0 4px 12px -4px ${dotColor}88` : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrentDb) e.currentTarget.style.background = `${dotColor}28`;
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrentDb) e.currentTarget.style.background = `${dotColor}18`;
                    }}
                  >
                    <Database
                      size={15}
                      strokeWidth={2.5}
                      style={{ color: isCurrentDb ? "#FFFFFF" : dotColor }}
                    />
                  </Link>
                  <div
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                    style={{
                      background: K.glassDeep,
                      border: `1px solid ${K.rim}`,
                      color: K.ink,
                      boxShadow: K.shadow,
                    }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: dotColor }}>
                      {db.dbTag || db.name}
                    </div>
                    <div className="font-semibold">{db.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: K.muted }}>
                      {db.groups.length} {db.groups.length === 1 ? 'group' : 'groups'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${K.hairline}` }}>
        {!collapsed ? (
          <div className="flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg px-2">
            <p className="text-[10px] font-bold leading-none tracking-wide" style={{ color: K.muted }}>
              RMS v0.0.1
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center">
              <span className="text-[10px] font-bold" style={{ color: K.muted }}>RMS</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default React.memo(Sidebar);