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
  { keyword: 'rebatesetup',   icon: FileText        },
  { keyword: 'rebate',        icon: FileCog         },
  { keyword: 'report',        icon: BarChart2       },
  { keyword: 'customer',      icon: Users           },
  { keyword: 'item',          icon: Package         },
  { keyword: 'sales',         icon: User            },
  { keyword: 'employee',      icon: User            },
  { keyword: 'setting',       icon: Settings        },
  { keyword: 'overview',      icon: LayoutDashboard },
  { keyword: 'payout',        icon: DollarSign      },
  { keyword: 'log',           icon: ClipboardList   },
  { keyword: 'user',          icon: Users           },
  { keyword: 'authorization', icon: Shield          },
  { keyword: 'navigation',    icon: Layout          },
  { keyword: 'database',      icon: Database        },
  { keyword: 'group',         icon: Users           },
  { keyword: 'preference',    icon: Settings        },
];
function getIcon(str = '') {
  const lower = str.toLowerCase();
  const match = ICON_RULES.find(r => lower.includes(r.keyword));
  return match ? match.icon : FileText;
}

// ── Static visual config ──────────────────────────────────────────────────────
const DB_VISUAL = {
  VAN_DB: {
    id: 'van', pathPrefix: '/Van_', dashboardPath: '/Van_Dashboard',
    colorLight: 'from-blue-500 to-blue-600',     colorDark: 'from-blue-700 to-blue-800',
    activeColorLight: 'bg-blue-50 text-blue-700 border-blue-200',
    activeColorDark:  'bg-blue-900/30 text-blue-300 border-blue-700/50',
    dotLight: 'bg-blue-500', dotDark: 'bg-blue-400',
  },
  NEXCHEM_DB: {
    id: 'nexchem', pathPrefix: '/Nexchem_', dashboardPath: '/Nexchem_Dashboard',
    colorLight: 'from-violet-500 to-purple-600',  colorDark: 'from-violet-700 to-purple-800',
    activeColorLight: 'bg-violet-50 text-violet-700 border-violet-200',
    activeColorDark:  'bg-violet-900/30 text-violet-300 border-violet-700/50',
    dotLight: 'bg-violet-500', dotDark: 'bg-violet-400',
  },
  VCP_DB: {
    id: 'vcp', pathPrefix: '/Vcp_', dashboardPath: '/Vcp_Dashboard',
    colorLight: 'from-emerald-500 to-teal-600',  colorDark: 'from-emerald-700 to-teal-800',
    activeColorLight: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    activeColorDark:  'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
    dotLight: 'bg-emerald-500', dotDark: 'bg-emerald-400',
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
    colorLight: 'from-slate-500 to-slate-600', colorDark: 'from-slate-700 to-slate-800',
    activeColorLight: 'bg-slate-50 text-slate-700 border-slate-200',
    activeColorDark:  'bg-slate-800 text-slate-300 border-slate-600',
    dotLight: 'bg-slate-500', dotDark: 'bg-slate-400',
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
        colorLight: visual.colorLight, colorDark: visual.colorDark,
        activeColorLight: visual.activeColorLight, activeColorDark: visual.activeColorDark,
        dotLight: visual.dotLight, dotDark: visual.dotDark,
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
    icon:     getIcon(item.label || item.path || ''),
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
      .map(db => ({ ...db, groups: db.groups.map(g => ({ ...g, items: restoreIcons(g.items) })) }));
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

// ─────────────────────────────────────────────────────────────────────────────
// NavItem — single link or collapsible parent
// ─────────────────────────────────────────────────────────────────────────────
const NavItem = ({ item, depth = 0, activeColor, dotColor, isDark, location }) => {
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
  const baseItem    = `flex items-center gap-2 w-full pr-3 py-1.5 rounded-lg transition-colors text-left text-xs font-medium`;
  const inactiveItem = isDark
    ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'
    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';

  return (
    <div>
      {hasChildren ? (
        <button
          onClick={() => setOpen(o => !o)}
          style={{ paddingLeft }}
          className={`${baseItem} justify-between ${inactiveItem}`}
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
          style={{ paddingLeft }}
          className={`${baseItem} border ${
            isActive
              ? `${activeColor} font-semibold`
              : `border-transparent ${inactiveItem}`
          }`}
        >
          {isActive
            ? <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
            : <IconComp size={13} className="flex-shrink-0 opacity-60" />
          }
          <span>{item.label}</span>
        </Link>
      )}
      {hasChildren && (
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className={`ml-3 border-l ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            {visibleChildren.map(child => (
              <NavItem
                key={child.navItemId} item={child} depth={depth + 1}
                activeColor={activeColor} dotColor={dotColor} isDark={isDark} location={location}
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
//
// `singleDb` — when true (only 1 DB visible across the whole sidebar):
//   • Skip the DB name header / chevron button entirely
//   • Render nav items directly, always expanded, no accordion wrapper
//
// `singleDb` — when false (2+ DBs visible):
//   • Show the normal collapsible DB header with gradient icon + name
// ─────────────────────────────────────────────────────────────────────────────
const DBBlock = ({
  db, isDark, location, singleDb,
  getDropdownState, getColor, getActiveColor, getDotColor,
}) => {
  // Items are already access-filtered at build time — just flatten for rendering
  const rebateItems = useMemo(() => {
    const rebateGroups = filterGroups(db.groups || []);
    return rebateGroups.flatMap(g => g.items || []);
  }, [db.groups]);

  const dropdown    = getDropdownState(db.id);
  const color       = getColor(db);
  const activeColor = getActiveColor(db);
  const dotColor    = getDotColor(db);

  if (!rebateItems.length) return null;

  // ── Single DB mode: no header, items always visible ───────────────────────
  if (singleDb) {
    return (
      <div className="space-y-0.5">
        {rebateItems.map(item => (
          <NavItem
            key={item.navItemId} item={item} depth={0}
            activeColor={activeColor} dotColor={dotColor} isDark={isDark} location={location}
          />
        ))}
      </div>
    );
  }

  // ── Multi-DB mode: collapsible accordion with DB name header ─────────────
  const isDbActive = rebateItems.some(
    item => location.pathname === item.path ||
            item.children?.some(c => location.pathname === c.path)
  );

  return (
    <div className={`rounded-xl overflow-hidden border transition-all ${
      isDark
        ? `border-slate-700/60 ${isDbActive ? 'border-slate-600' : ''}`
        : `border-slate-200 ${isDbActive ? 'border-slate-300' : ''}`
    }`}>
      {/* DB header button */}
      <button
        onClick={() => dropdown.setShow(!dropdown.show)}
        className={`flex items-center justify-between w-full px-3 py-2.5 transition-colors ${
          isDark ? 'hover:bg-slate-700/40 bg-slate-800/60' : 'hover:bg-slate-50 bg-white'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-6 h-6 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <Database size={11} className="text-white" />
          </div>
          <span className={`text-xs font-bold tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {db.name}
          </span>
        </div>
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 flex-shrink-0 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          } ${dropdown.show ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible items */}
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
        dropdown.show ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className={`px-2 pb-2 pt-1 space-y-0.5 ${isDark ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
          {rebateItems.map(item => (
            <NavItem
              key={item.navItemId} item={item} depth={0}
              activeColor={activeColor} dotColor={dotColor} isDark={isDark} location={location}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TagBlock — passes singleDb flag down to DBBlock
// ─────────────────────────────────────────────────────────────────────────────
const TagBlock = ({
  tagName, tagDbs, isDark, location, singleDb,
  getDropdownState, getColor, getActiveColor, getDotColor,
}) => {
  if (!tagDbs.length) return null;
  return (
    <div className="space-y-1.5">
      {tagDbs.map(db => (
        <DBBlock
          key={db.id} db={db} isDark={isDark} location={location}
          singleDb={singleDb}
          getDropdownState={getDropdownState} getColor={getColor}
          getActiveColor={getActiveColor} getDotColor={getDotColor}
        />
      ))}
    </div>
  );
};

// ── Small syncing indicator ───────────────────────────────────────────────────
const SyncDot = ({ isDark }) => (
  <span
    title="Syncing navigation…"
    className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
const Sidebar = ({ collapsed, setCollapsed, userDbOrder }) => {
  const location               = useLocation();
  const { theme, updateTheme } = useTheme();
  const isDark                 = theme === 'dark';

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

      // ── Step 1: fetch nav structure ───────────────────────────────────────
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

      // ── Step 2: build raw nav tree ────────────────────────────────────────
      const rawDbs = buildSidebarData(dbRows, navStructure);

      // ── Step 3: collect all leaf routePaths ───────────────────────────────
      const allRoutePaths = new Set();
      for (const db of rawDbs)
        for (const group of db.groups)
          collectRoutePaths(group.items, allRoutePaths);

      // ── Step 4: batch-fetch canView per route ─────────────────────────────
      const accessMap = await fetchAccessMap(allRoutePaths, userCode);
      if (!isMountedRef.current) return;

      // ── Step 5: stamp _canView onto every item ────────────────────────────
      const stampedDbs = rawDbs.map(db => ({
        ...db,
        groups: db.groups.map(group => ({
          ...group,
          items: stampAccess(group.items, accessMap),
        })),
      }));

      // ── Step 6: filter out inaccessible items / groups / DBs ─────────────
      const built  = filterDatabases(stampedDbs);
      const serial = serialise(built);

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
  }, [location.pathname]); // eslint-disable-line

  // ── Mount + polling ────────────────────────────────────────────────────────
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

  // ── Sorted visible databases ───────────────────────────────────────────────
  const visibleDatabases = useMemo(() => {
    const order = userDbOrder ?? userDbOrderRef.current;
    if (!order) return activeDatabases;
    return [...activeDatabases].sort((a, b) => (order[a.id] ?? 999) - (order[b.id] ?? 999));
  }, [activeDatabases, userDbOrder]);

  const visibleTagGroups = useMemo(() => groupByTag(visibleDatabases), [visibleDatabases]);

  /**
   * Key decision: if the user only has access to exactly 1 DB,
   * we skip the DB header/accordion entirely and show nav items flat.
   */
  const singleDb = visibleDatabases.length === 1;

  // ── Auto-open active DB on route change ───────────────────────────────────
  useEffect(() => {
    // In single-DB mode there's no accordion to manage
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

  // ── Accordion helpers ──────────────────────────────────────────────────────
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

  const activeDbId     = visibleDatabases.find(db => location.pathname.startsWith(db.pathPrefix))?.id ?? null;
  const getColor       = db => isDark ? db.colorDark       : db.colorLight;
  const getActiveColor = db => isDark ? db.activeColorDark : db.activeColorLight;
  const getDotColor    = db => isDark ? db.dotDark         : db.dotLight;

  const asideClass = `fixed top-0 left-0 h-screen border-r flex flex-col transition-all duration-500 z-50 ${
    isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'
  } ${collapsed ? 'w-20' : 'w-64'}`;

  // ── Hard loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <aside className={asideClass}>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className={`w-8 h-8 rounded-full border-4 border-t-transparent animate-spin ${isDark ? 'border-blue-400' : 'border-blue-500'}`} />
          {!collapsed && <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading navigation…</p>}
        </div>
      </aside>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (fetchError && !visibleDatabases.length) {
    return (
      <aside className={asideClass}>
        <SideBarError error={fetchError} onRetry={handleRetry} collapsed={collapsed} isDark={isDark} />
      </aside>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <aside className={asideClass}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 py-3.5 ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
        <div className={`flex items-center gap-3 transition-all duration-300 group ${collapsed ? 'justify-center w-full' : 'min-w-0 flex-1'}`}>
          <div className="relative w-8 h-8 flex-shrink-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm transition-all duration-300 ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            } ${collapsed ? 'group-hover:opacity-0 group-hover:scale-0' : ''}`}>
              <img src="/url_logo.png" alt="Logo" className="w-5 h-5" />
            </div>
            {collapsed && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute inset-0 flex items-center justify-center p-2 rounded-xl transition-all duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100"
              >
                <PanelRight className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
              </button>
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <h2
                className={`font-bold leading-none whitespace-nowrap text-ellipsis overflow-hidden ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                style={{ fontSize: 'clamp(13px, 1.1vw, 15px)' }}
              >
                RMS
              </h2>
              {syncing && <SyncDot isDark={isDark} />}
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <PanelRight size={15} />
          </button>
        )}
      </div>

      {/* ── Nav list ────────────────────────────────────────────────────────── */}
      <div className="flex-1 py-3 overflow-y-auto">
        {visibleDatabases.length === 0 ? (
          // ── No accessible DBs ──────────────────────────────────────────────
          <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-2">
            <Database className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            {!collapsed && (
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                No accessible databases
              </p>
            )}
            {!collapsed && fetchError && (
              <button
                onClick={handleRetry}
                className={`mt-2 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Retry
              </button>
            )}
          </div>

        ) : !collapsed ? (
          // ── Expanded sidebar ───────────────────────────────────────────────
          <div className="px-3 space-y-1.5">
            {Object.entries(visibleTagGroups).map(([tagName, tagDbs]) => (
              <TagBlock
                key={tagName} tagName={tagName} tagDbs={tagDbs}
                isDark={isDark} location={location}
                singleDb={singleDb}
                getDropdownState={getDropdownState} getColor={getColor}
                getActiveColor={getActiveColor} getDotColor={getDotColor}
              />
            ))}
          </div>

        ) : singleDb ? (
          // ── Collapsed · single DB → show each nav item's icon ─────────────
          <div className="flex flex-col items-center space-y-1 pt-2 px-1">
            {(() => {
              const db          = visibleDatabases[0];
              const activeColor = getActiveColor(db);
              const dotColor    = getDotColor(db);
              const rebateItems = filterGroups(db.groups || []).flatMap(g => g.items || []);
              return rebateItems.map(item => {
                const IconComp  = item.icon || FileText;
                const isActive  = location.pathname === item.path ||
                                  item.children?.some(c => location.pathname === c.path);
                return (
                  <div key={item.navItemId} className="relative group w-full flex justify-center">
                    <Link
                      to={item.path || item.children?.[0]?.path || '#'}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 border ${
                        isActive
                          ? `${activeColor} shadow-sm`
                          : `border-transparent ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`
                      }`}
                    >
                      {isActive
                        ? <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                        : <IconComp size={15} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                      }
                    </Link>
                    {/* Tooltip */}
                    <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl ${
                      isDark ? 'bg-slate-800 border border-slate-700 text-slate-100' : 'bg-slate-900 text-white'
                    }`}>
                      {item.label}
                      <span className="absolute top-1/2 right-full -translate-y-1/2">
                        <span className={`block w-0 h-0 border-t-4 border-b-4 border-r-4 border-solid border-t-transparent border-b-transparent ${
                          isDark ? 'border-r-slate-800' : 'border-r-slate-900'
                        }`} />
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

        ) : (
          // ── Collapsed · multi-DB → show one DB icon per database ──────────
          <div className="flex flex-col items-center space-y-2 pt-2">
            {visibleDatabases.map(db => {
              const isCurrentDb = activeDbId === db.id;
              const color       = getColor(db);
              return (
                <div key={db.id} className="relative group w-full flex justify-center">
                  <Link
                    to={db.dashboardPath}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
                      isCurrentDb
                        ? `bg-gradient-to-br ${color} shadow-md`
                        : isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    <Database size={15} className={isCurrentDb ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-500'} />
                  </Link>
                  {/* Tooltip */}
                  <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl ${
                    isDark ? 'bg-slate-800 border border-slate-700 text-slate-100' : 'bg-slate-900 text-white'
                  }`}>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                      {db.dbTag || db.name}
                    </div>
                    <div className="font-semibold">{db.name}</div>
                    <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-300'}`}>
                      {db.groups.length} {db.groups.length === 1 ? 'group' : 'groups'}
                    </div>
                    <span className="absolute top-1/2 right-full -translate-y-1/2">
                      <span className={`block w-0 h-0 border-t-4 border-b-4 border-r-4 border-solid border-t-transparent border-b-transparent ${
                        isDark ? 'border-r-slate-800' : 'border-r-slate-900'
                      }`} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className={`px-4 py-3 border-t ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
        {!collapsed ? (
          <div className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'} px-2`}>
            <p className={`text-[10px] font-bold leading-none tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Rebate Management System
            </p>
            <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>v0.0.1</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
              <span className="text-[10px] font-bold text-white">RMS</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default React.memo(Sidebar);