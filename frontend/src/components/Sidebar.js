import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PanelRight,
  Database,
  ChevronDown,
  Home,
  FileText,
  BarChart2,
  Users,
  Package,
  User,
  Settings,
  LayoutDashboard,
  DollarSign,
  ClipboardList,
  Shield,
  Layout,
  FileCog,
} from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import SideBarError from '../components/common/SideBarError';

const BASE_URL            = 'http://192.168.100.193:3006/api';
const POLL_INTERVAL       = 5000;
const CACHE_KEY           = 'sidebar_nav_cache';
const CACHE_TIMESTAMP_KEY = 'sidebar_nav_cache_timestamp';
const DROPDOWN_STATE_KEY  = 'sidebar_dropdown_states';
const CACHE_DURATION      = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Whitelist — only the "JL Server" tag and these three databases will appear.
// Access control (IsActive / IsVisible / user permissions) still applies on
// top of this; the whitelist is purely a UI-level restriction.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_SERVER_TAG    = 'JL Server';
const ALLOWED_DB_NAMES      = new Set(['VAN_DB', 'NEXCHEM_DB', 'VCP_DB']);

// Only nav groups whose name contains one of these keywords are shown.
// All other groups (Settings, Users, etc.) are hidden.
const REBATE_GROUP_KEYWORDS = ['rebate'];

function isRebateGroup(groupName = '') {
  const lower = groupName.toLowerCase();
  return REBATE_GROUP_KEYWORDS.some(k => lower.includes(k));
}

// ─────────────────────────────────────────────────────────────────────────────
// Icon resolver
// ─────────────────────────────────────────────────────────────────────────────
const ICON_RULES = [
  { keyword: 'dashboard',     icon: Home           },
  { keyword: 'rebatesetup',   icon: FileText        },
  { keyword: 'rebate',        icon: FileCog     },
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

// ─────────────────────────────────────────────────────────────────────────────
// Static visual config — keys must match DBName in Databases table exactly
// ─────────────────────────────────────────────────────────────────────────────
const DB_VISUAL = {
  VAN_DB: {
    id: 'van', pathPrefix: '/Van_', dashboardPath: '/Van_Dashboard',
    colorLight: 'from-blue-500 to-blue-600',      colorDark: 'from-blue-700 to-blue-800',
    activeColorLight: 'bg-blue-100 text-blue-700 border-blue-200',
    activeColorDark:  'bg-blue-900/30 text-blue-100 border-blue-700',
    groupHeaderLight: 'text-blue-600',             groupHeaderDark: 'text-blue-400',
  },
  NEXCHEM_DB: {
    id: 'nexchem', pathPrefix: '/Nexchem_', dashboardPath: '/Nexchem_Dashboard',
    colorLight: 'from-purple-500 to-purple-600',   colorDark: 'from-purple-700 to-purple-800',
    activeColorLight: 'bg-purple-100 text-purple-700 border-purple-200',
    activeColorDark:  'bg-purple-900/30 text-purple-100 border-purple-700',
    groupHeaderLight: 'text-purple-600',            groupHeaderDark: 'text-purple-400',
  },
  VCP_DB: {
    id: 'vcp', pathPrefix: '/Vcp_', dashboardPath: '/Vcp_Dashboard',
    colorLight: 'from-emerald-500 to-emerald-600', colorDark: 'from-emerald-700 to-emerald-800',
    activeColorLight: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    activeColorDark:  'bg-emerald-900/30 text-emerald-100 border-emerald-700',
    groupHeaderLight: 'text-emerald-600',           groupHeaderDark: 'text-emerald-400',
  },
};

function getVisual(dbName) {
  const key =
    Object.keys(DB_VISUAL).find(k => k === dbName) ||
    Object.keys(DB_VISUAL).find(k => k.toLowerCase() === dbName?.toLowerCase());
  if (key) return DB_VISUAL[key];

  console.warn(`⚠️ Sidebar: no visual config for DBName "${dbName}" — using fallback`);
  const safe = (dbName || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
  const pathPrefix = `/${safe.charAt(0).toUpperCase() + safe.slice(1)}_`;
  return {
    id:               safe.toLowerCase(),
    pathPrefix,
    dashboardPath:    `${pathPrefix}Dashboard`,
    colorLight:       'from-slate-500 to-slate-600',
    colorDark:        'from-slate-700 to-slate-800',
    activeColorLight: 'bg-slate-100 text-slate-700 border-slate-200',
    activeColorDark:  'bg-slate-900/30 text-slate-100 border-slate-700',
    groupHeaderLight: 'text-slate-600',
    groupHeaderDark:  'text-slate-400',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────
function getUserCode() {
  try {
    const parsed = JSON.parse(localStorage.getItem('currentUser') || 'null');
    return parsed?.User_ID || null;
  } catch { return null; }
}

function checkIsSuperUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const val = parsed?.IsSuperUser ?? 0;
    return val === 1 || val === true || val === '1';
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attach icons recursively to items + children
// ─────────────────────────────────────────────────────────────────────────────
function attachIcons(items) {
  return items.map(item => ({
    ...item,
    icon:     getIcon(item.routePath || item.navItemName || ''),
    label:    item.navItemName,
    path:     item.routePath,
    children: item.children ? attachIcons(item.children) : [],
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter helpers — prune empty branches at every level
// ─────────────────────────────────────────────────────────────────────────────
function filterItems(items) {
  return items.reduce((acc, item) => {
    if (!item.children?.length) {
      if (item.path) acc.push(item);
      return acc;
    }
    const filteredChildren = filterItems(item.children);
    if (filteredChildren.length) acc.push({ ...item, children: filteredChildren });
    return acc;
  }, []);
}

function filterGroups(groups) {
  return groups.reduce((acc, group) => {
    // Only keep rebate groups
    if (!isRebateGroup(group.groupName)) return acc;
    const filteredItems = filterItems(group.items || []);
    if (filteredItems.length) acc.push({ ...group, items: filteredItems });
    return acc;
  }, []);
}

function filterDatabases(databases) {
  return databases.reduce((acc, db) => {
    const filteredGroups = filterGroups(db.groups || []);
    if (filteredGroups.length) acc.push({ ...db, groups: filteredGroups });
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
  return Object.fromEntries(
    Object.entries(map).filter(([, tagDbs]) => tagDbs.length > 0)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Build sidebar data — only JL Server tag + allowed DB names pass through.
// The existing IsActive / IsVisible / user-access checks still apply on top.
// ─────────────────────────────────────────────────────────────────────────────
function buildSidebarData(dbRows, navStructure) {
  const built = dbRows
    .filter(row => {
      // ── Whitelist: server tag must be "JL Server" ─────────────────────────
      const tagMatch = row.DBTag?.toLowerCase() === ALLOWED_SERVER_TAG.toLowerCase();
      if (!tagMatch) return false;

      // ── Whitelist: DB name must be in the allowed set ─────────────────────
      const nameMatch =
        ALLOWED_DB_NAMES.has(row.DBName) ||
        [...ALLOWED_DB_NAMES].some(n => n.toLowerCase() === row.DBName?.toLowerCase());
      if (!nameMatch) return false;

      // ── Existing access checks ────────────────────────────────────────────
      const active  = row.IsActive  === 1 || row.IsActive  === true || row.IsActive  === '1';
      const visible = row.IsVisible === 1 || row.IsVisible === true || row.IsVisible === '1'
                   || row.IsVisible == null;
      return active && visible;
    })
    .map(row => {
      const visual   = getVisual(row.DBName);
      const navEntry = navStructure[row.DatabaseID];

      const groups = (navEntry?.groups || []).map(group => ({
        groupId:   group.groupId,
        groupName: group.groupName,
        sortOrder: group.sortOrder,
        items:     attachIcons(group.items || []),
      }));

      // Find actual dashboard path from nav items
      let dashboardPath = visual.dashboardPath;
      outer: for (const group of groups) {
        for (const item of group.items) {
          if (item.path?.toLowerCase().includes('dashboard')) {
            dashboardPath = item.path;
            break outer;
          }
        }
      }

      return {
        name:             row.DBName,
        id:               visual.id,
        dbTag:            row.DBTag,
        pathPrefix:       visual.pathPrefix,
        dashboardPath,
        colorLight:       visual.colorLight,
        colorDark:        visual.colorDark,
        activeColorLight: visual.activeColorLight,
        activeColorDark:  visual.activeColorDark,
        groupHeaderLight: visual.groupHeaderLight,
        groupHeaderDark:  visual.groupHeaderDark,
        databaseId:       row.DatabaseID,
        displayOrder:     row.DisplayOrder,
        groups,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  return filterDatabases(built);
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialise for change detection
// ─────────────────────────────────────────────────────────────────────────────
function flattenItem(item) {
  const base = `${item.label}|${item.path}`;
  return item.children?.length
    ? `${base}(${item.children.map(flattenItem).join(',')})`
    : base;
}

function serialise(dbs) {
  return dbs.map(db =>
    `${db.name}:${db.groups.map(g =>
      `${g.groupName}[${g.items.map(flattenItem).join(';')}]`
    ).join(',')}`
  ).sort().join('||');
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache helpers — icons are functions, strip before JSON then restore after
// ─────────────────────────────────────────────────────────────────────────────
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
    const cached    = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!cached || !timestamp) return null;
    if (Date.now() - parseInt(timestamp, 10) > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      return null;
    }
    const dbs = JSON.parse(cached);
    // Re-apply whitelists when restoring from cache so stale entries are dropped
    return dbs
      .filter(db =>
        ALLOWED_DB_NAMES.has(db.name) ||
        [...ALLOWED_DB_NAMES].some(n => n.toLowerCase() === db.name?.toLowerCase())
      )
      .map(db => ({
        ...db,
        groups: db.groups.map(g => ({ ...g, items: restoreIcons(g.items) })),
      }));
  } catch (err) {
    console.error('Sidebar cache read error:', err);
    return null;
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
  } catch (err) {
    console.error('Sidebar cache write error:', err);
  }
}

function saveDropdownStates(states) {
  try { localStorage.setItem(DROPDOWN_STATE_KEY, JSON.stringify(states)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// NavItem — recursive leaf / parent node
// ─────────────────────────────────────────────────────────────────────────────
const NavItem = ({ item, depth = 0, activeColor, isDark, location }) => {
  const visibleChildren = useMemo(
    () => filterItems(item.children || []),
    [item.children]
  );
  const hasChildren = visibleChildren.length > 0;
  const IconComp    = item.icon || FileText;

  const isDescendantActive = useCallback(
    (children) => children.some(c =>
      location.pathname === c.path || isDescendantActive(c.children || [])
    ),
    [location.pathname]
  );

  const shouldBeOpen = hasChildren && isDescendantActive(visibleChildren);
  const [open, setOpen] = useState(shouldBeOpen);
  useEffect(() => { setOpen(shouldBeOpen); }, [location.pathname, shouldBeOpen]);

  if (!hasChildren && !item.path) return null;

  const isActive    = location.pathname === item.path;
  const paddingLeft = 8 + depth * 14;

  return (
    <div>
      {hasChildren ? (
        <button
          onClick={() => setOpen(o => !o)}
          style={{ paddingLeft }}
          className={`flex items-center justify-between w-full pr-3 py-1.5 rounded-lg
            transition-colors text-left
            ${isDark
              ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}
        >
          <div className="flex items-center gap-2">
            <IconComp size={13} className="flex-shrink-0" />
            <span className="text-xs font-medium">{item.label}</span>
          </div>
          <ChevronDown
            size={11}
            className={`flex-shrink-0 transition-transform duration-200
              ${isDark ? 'text-gray-500' : 'text-slate-400'}
              ${open ? 'rotate-180' : ''}`}
          />
        </button>
      ) : (
        <Link
          to={item.path}
          style={{ paddingLeft }}
          className={`flex items-center gap-2 pr-3 py-1.5 rounded-lg transition-colors
            ${isActive
              ? `${activeColor} border`
              : isDark
                ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}
        >
          <IconComp size={13} className="flex-shrink-0" />
          <span className="text-xs font-medium">{item.label}</span>
        </Link>
      )}

      {hasChildren && (
        <div className={`overflow-hidden transition-all duration-200 ease-in-out
          ${open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className={`ml-3 border-l ${isDark ? 'border-gray-700' : 'border-slate-200'}`}>
            {visibleChildren.map(child => (
              <NavItem
                key={child.navItemId}
                item={child}
                depth={depth + 1}
                activeColor={activeColor}
                isDark={isDark}
                location={location}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DBBlock — collapsible database.
// Renders rebate group items directly — no group header label shown.
// ─────────────────────────────────────────────────────────────────────────────
const DBBlock = ({
  db, isDark, location,
  getDropdownState, getColor, getActiveColor,
}) => {
  // Collect only rebate-group items, flattened — group header is not rendered
  const rebateItems = useMemo(() => {
    const rebateGroups = filterGroups(db.groups || []);
    return rebateGroups.flatMap(g => filterItems(g.items || []));
  }, [db.groups]);

  // Hooks must be called before early returns
  const dropdown    = getDropdownState(db.id);
  const color       = getColor(db);
  const activeColor = getActiveColor(db);

  if (!rebateItems.length) return null;

  return (
    <div>
      {/* DB header — collapsible */}
      <button
        onClick={() => dropdown.setShow(!dropdown.show)}
        className={`flex items-center justify-between w-full px-2 py-2
          rounded-lg cursor-pointer transition-colors
          ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-slate-100'}`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 bg-gradient-to-br ${color} rounded-md
            flex items-center justify-center flex-shrink-0`}
          >
            <Database size={12} className="text-white" />
          </div>
          <span className={`text-sm font-semibold
            ${isDark ? 'text-gray-100' : 'text-slate-800'}`}
          >
            {db.name}
          </span>
        </div>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 flex-shrink-0
            ${isDark ? 'text-gray-500' : 'text-slate-400'}
            ${dropdown.show ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Items — no group heading, just the nav links */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out
        ${dropdown.show ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className={`ml-4 border-l space-y-0.5 py-1
          ${isDark ? 'border-gray-700' : 'border-slate-200'}`}
        >
          {rebateItems.map(item => (
            <NavItem
              key={item.navItemId}
              item={item}
              depth={0}
              activeColor={activeColor}
              isDark={isDark}
              location={location}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TagBlock — static non-collapsible server label with DBs listed below.
// ─────────────────────────────────────────────────────────────────────────────
const TagBlock = ({
  tagName, tagDbs, isDark, location,
  getDropdownState, getColor, getActiveColor,
}) => {
  const visibleDbs = useMemo(() => filterDatabases(tagDbs), [tagDbs]);

  if (!visibleDbs.length) return null;

  return (
    <div>
      {/* Static server label — no chevron, no toggle */}


      {/* DB blocks sit directly below the label — no indent wrapper */}
      <div className="space-y-1">
        {visibleDbs.map(db => (
          <DBBlock
            key={db.id}
            db={db}
            isDark={isDark}
            location={location}
            getDropdownState={getDropdownState}
            getColor={getColor}
            getActiveColor={getActiveColor}
          />
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────────────────────────────────────
const Sidebar = ({ collapsed, setCollapsed }) => {
  const location               = useLocation();
  const { theme, updateTheme } = useTheme();
  const isDark                 = theme === 'dark';

  const [activeDatabases,  setActiveDatabases]  = useState(() => loadCachedNavData() || []);
  const [loading,          setLoading]          = useState(() => !loadCachedNavData());
  const [error,            setError]            = useState(null);
  const [syncing,          setSyncing]          = useState(false);
  const [errorCount,       setErrorCount]       = useState(0);
  const [dropdownStates,   setDropdownStates]   = useState({});

  const prevSerialRef = useRef('');
  const isMountedRef  = useRef(true);
  const pollTimerRef  = useRef(null);

  // ── Load theme from DB on mount ───────────────────────────────────────────
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userId = stored.UserID || stored.User_ID;
        if (!userId) return;
        const res = await axios.get(
          `${BASE_URL}/user/preferences/${userId}/theme?db=USER`
        );
        if (res.data.success && res.data.value) {
          const dbTheme = res.data.value.toLowerCase();
          if (dbTheme !== theme) updateTheme(dbTheme);
        }
      } catch {
        const local = localStorage.getItem('userTheme');
        if (local && local !== theme) updateTheme(local);
      }
    };
    loadTheme();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch DB list + nav structure ─────────────────────────────────────────
  // Nav groups are fetched per-database independently so that removing all
  // access from one DB (e.g. VCP) never affects the other databases.
  const fetchAll = useCallback(async (isInitial = false) => {
    if (!isMountedRef.current) return;
    isInitial ? setLoading(true) : setSyncing(true);

    try {
      const userCode  = getUserCode();
      const superUser = checkIsSuperUser();

      let dbRows       = [];
      let navStructure = {};

      if (userCode && !superUser) {
        // Step 1 — fetch the list of databases the user has access to
        const dbRes = await axios.get(`${BASE_URL}/user-access/databases`, {
          params: { userCode, db: 'USER' }, timeout: 8000,
        });
        dbRows = dbRes.data?.data || [];

        // Step 2 — fetch nav groups per-database in parallel.
        // Each call is independent: a failure or empty result for one DB
        // does NOT affect the others.
        const allowedRows = dbRows.filter(row =>
          ALLOWED_DB_NAMES.has(row.DBName) ||
          [...ALLOWED_DB_NAMES].some(n => n.toLowerCase() === row.DBName?.toLowerCase())
        );

        const navResults = await Promise.allSettled(
          allowedRows.map(row =>
            axios.get(`${BASE_URL}/user-access/nav-groups`, {
              params: { userCode, db: 'USER', databaseId: row.DatabaseID },
              timeout: 8000,
            })
          )
        );

        // Merge per-DB results into a single navStructure map
        navResults.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            const data = result.value.data?.data || {};
            Object.assign(navStructure, data);
          } else {
            console.warn(
              `⚠️ Sidebar: nav fetch failed for DB "${allowedRows[i].DBName}":`,
              result.reason?.message
            );
          }
        });

      } else if (superUser) {
        const [dbRes, navRes] = await Promise.all([
          axios.get(`${BASE_URL}/databases`,             { params: { db: 'USER' }, timeout: 8000 }),
          axios.get(`${BASE_URL}/nav-groups/with-items`, { params: { db: 'USER' }, timeout: 8000 }),
        ]);
        dbRows       = dbRes.data?.data  || [];
        navStructure = navRes.data?.data || {};
      } else {
        console.warn('⚠️ Sidebar: no user in localStorage');
      }

      if (!isMountedRef.current) return;

      const built  = buildSidebarData(dbRows, navStructure);
      const serial = serialise(built);

      if (serial !== prevSerialRef.current) {
        console.log(
          isInitial ? '🟢 Sidebar loaded:' : '🔄 Sidebar updated:',
          built.map(d => `${d.dbTag}/${d.name}(${d.groups.length}g)`).join(', ') || '(none)'
        );
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
          if (openIds.length > 1) {
            built.forEach(db => { next[db.id] = location.pathname.startsWith(db.pathPrefix); });
          }
          saveDropdownStates(next);
          return next;
        });

        setError(null);
      } else {
        if (!isInitial) console.log('✓ Sidebar: no changes');
      }

      setErrorCount(0);

    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('❌ Sidebar fetch error:', err.message);
      setErrorCount(n => n + 1);
      if (isInitial) {
        let msg = 'Failed to load navigation';
        if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') msg = 'Cannot connect to server.';
        else if (err.response?.status === 500) msg = 'Server error. Please try again later.';
        else if (err.response) msg = `Server error ${err.response.status}`;
        else if (err.request)  msg = 'No response from server.';
        setError(msg);
      }
    } finally {
      if (isMountedRef.current) { setLoading(false); setSyncing(false); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mount / polling ───────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    const cached = loadCachedNavData();
    if (cached?.length) {
      prevSerialRef.current = serialise(cached);
      console.log('📦 Sidebar: restored from cache');
    }

    fetchAll(true);

    pollTimerRef.current = setInterval(() => {
      if (errorCount >= 3) { clearInterval(pollTimerRef.current); return; }
      fetchAll(false);
    }, POLL_INTERVAL);

    return () => {
      isMountedRef.current = false;
      clearInterval(pollTimerRef.current);
    };
  }, [fetchAll, errorCount]);

  // ── Derived visible lists ─────────────────────────────────────────────────
  const visibleDatabases = useMemo(
    () => filterDatabases(activeDatabases),
    [activeDatabases]
  );

  const visibleTagGroups = useMemo(
    () => groupByTag(visibleDatabases),
    [visibleDatabases]
  );

  // ── Auto-open active DB on route change ───────────────────────────────────
  useEffect(() => {
    if (!visibleDatabases.length) return;
    const activeDb = visibleDatabases.find(db =>
      location.pathname.startsWith(db.pathPrefix)
    );
    if (!activeDb) return;

    setDropdownStates(prev => {
      const alreadyOnly =
        prev[activeDb.id] === true &&
        visibleDatabases.every(db => db.id === activeDb.id || !prev[db.id]);
      if (alreadyOnly) return prev;

      const next = {};
      visibleDatabases.forEach(db => { next[db.id] = db.id === activeDb.id; });
      saveDropdownStates(next);
      return next;
    });
  }, [location.pathname, visibleDatabases]);

  // ── Accordion helper ──────────────────────────────────────────────────────
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

  const asideClass = `
    fixed top-0 left-0 h-screen border-r flex flex-col transition-all duration-500 z-50 shadow-lg
    ${isDark
      ? 'bg-gradient-to-b from-gray-900 to-gray-800 border-gray-700'
      : 'bg-gradient-to-b from-slate-50 to-white border-slate-200'}
    ${collapsed ? 'w-20' : 'w-64'}
  `;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <aside className={asideClass}>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          {!collapsed && (
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Loading navigation…
            </p>
          )}
        </div>
      </aside>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <aside className={asideClass}>
        <SideBarError
          error={error}
          onRetry={() => { setError(null); setErrorCount(0); fetchAll(true); }}
          collapsed={collapsed}
          isDark={isDark}
        />
      </aside>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <aside className={asideClass}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between p-4 relative
        after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px
        ${isDark ? 'after:bg-gray-700' : 'after:bg-slate-200'}`}
      >
        <div className={`flex items-center gap-3 transition-all duration-300 group
          ${collapsed ? 'justify-center w-full' : ''}`}
        >
          <div className="relative w-8 h-8">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md border
              transition-all duration-300
              ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}
              ${collapsed ? 'group-hover:opacity-0 group-hover:scale-0' : ''}`}
            >
              <img src="/url_logo.png" alt="Logo" className="w-5 h-5" />
            </div>
            {collapsed && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute inset-0 flex items-center justify-center p-2 rounded-xl
                  transition-all duration-300 opacity-0 scale-0
                  group-hover:opacity-100 group-hover:scale-100"
              >
                <PanelRight className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-slate-700'}`} />
              </button>
            )}
          </div>
          {!collapsed && (
            <h2 className={`font-bold text-lg whitespace-nowrap animate-in slide-in-from-left-5
              ${isDark ? 'text-gray-100' : 'text-slate-800'}`}
            >
              RebateSystem
            </h2>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-xl transition-all duration-300 hover:scale-110
              absolute right-2 top-4 z-10
              ${isDark ? 'hover:bg-gray-700' : 'hover:bg-slate-100'}`}
          >
            <PanelRight className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-slate-600'}`} />
          </button>
        )}
      </div>

      {/* ── Nav list ───────────────────────────────────────────────────────── */}
      <div className="flex-1 py-2 overflow-y-auto">

        {visibleDatabases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-2">
            <Database className={`w-8 h-8 ${isDark ? 'text-gray-600' : 'text-slate-300'}`} />
            {!collapsed && (
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                No accessible databases
              </p>
            )}
          </div>

        ) : !collapsed ? (

          /* ── Expanded: static server label → DB → nav items ───────────── */
          <div className="px-2 space-y-1">
            {Object.entries(visibleTagGroups).map(([tagName, tagDbs]) => (
              <TagBlock
                key={tagName}
                tagName={tagName}
                tagDbs={tagDbs}
                isDark={isDark}
                location={location}
                getDropdownState={getDropdownState}
                getColor={getColor}
                getActiveColor={getActiveColor}
              />
            ))}
          </div>

        ) : (

          /* ── Collapsed: icon buttons with tooltip ──────────────────────── */
          <div className="flex flex-col items-center space-y-3 pt-2">
            {visibleDatabases.map(db => {
              const isCurrentDb = activeDbId === db.id;
              const color       = getColor(db);
              return (
                <div key={db.id} className="relative group w-full flex justify-center">
                  <Link
                    to={db.dashboardPath}
                    className={`w-12 h-12 flex items-center justify-center rounded-lg
                      transition-all duration-300
                      ${isCurrentDb
                        ? `bg-gradient-to-br ${color} shadow-md`
                        : isDark ? 'bg-gray-800 hover:bg-gray-700'
                                 : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <Database
                      size={16}
                      className={isCurrentDb ? 'text-white'
                        : isDark ? 'text-gray-400' : 'text-slate-600'}
                    />
                  </Link>

                  {/* Tooltip */}
                  <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2
                    rounded-md text-xs font-medium whitespace-nowrap z-50
                    opacity-0 group-hover:opacity-100 transition-opacity duration-200
                    pointer-events-none
                    ${isDark ? 'bg-gray-900 text-white' : 'bg-slate-900 text-white'}`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wide opacity-60 mb-0.5">
                      {db.dbTag || db.name}
                    </div>
                    <div className="font-semibold">{db.name}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">
                      {db.groups.length} {db.groups.length === 1 ? 'group' : 'groups'}
                    </div>
                    <span className="absolute top-1/2 right-full -translate-y-1/2">
                      <span className={`block w-0 h-0 border-t-4 border-b-4 border-r-4
                        border-solid border-t-transparent border-b-transparent
                        ${isDark ? 'border-r-gray-900' : 'border-r-slate-900'}`}
                      />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-slate-200'}`}>
        {!collapsed ? (
          <div className="text-center">
            <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Rebate Management System
            </p>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
              v0.0.1
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center
              ${isDark ? 'bg-gray-800' : 'bg-slate-100'}`}
            >
              <span className={`text-[10px] font-bold
                ${isDark ? 'text-gray-300' : 'text-slate-600'}`}
              >
                RMS
              </span>
            </div>
          </div>
        )}
      </div>

    </aside>
  );
};

export default React.memo(Sidebar);