import { useState, useEffect, useCallback } from 'react';
import accessControlService from '../services/accessControlService';

const DEFAULT_ACCESS = {
  canView: false, canCreate: false, canEdit: false,
  canDelete: false, canExport: false, canApprove: false,
};

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('currentUser') || 'null') || null; }
  catch { return null; }
}

function getUserCode() {
  const u = getCurrentUser();
  if (!u) return null;
  // User_ID is the string identifier like 'AACC10'
  return u.User_ID ?? u.UserCode ?? u.userCode ?? null;
}

function checkIsSuperUser() {
  const u = getCurrentUser();
  if (!u) return false;
  const val = u.IsSuperUser ?? u.isSuperUser ?? 0;
  return val === 1 || val === true || val === '1';
}

// Tracks users synced this browser session so we don't sync on every page
const syncedUsersThisSession = new Set();

function useAccessControl(routePath) {
  const [access, setAccess]               = useState(DEFAULT_ACCESS);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError]     = useState(null);

  const fetchAccess = useCallback(async () => {
    if (!routePath) {
      setAccess(DEFAULT_ACCESS);
      setAccessLoading(false);
      return;
    }

    // SuperUser bypass
    if (checkIsSuperUser()) {
      setAccess({
        canView: true, canCreate: true, canEdit: true,
        canDelete: true, canExport: true, canApprove: true,
      });
      setAccessLoading(false);
      return;
    }

    const userCode = getUserCode();

    if (!userCode) {
      console.warn('⚠️ No User_ID in localStorage');
      setAccess(DEFAULT_ACCESS);
      setAccessLoading(false);
      return;
    }

    setAccessLoading(true);
    setAccessError(null);

    try {
      // ── Step 1: Sync once per session ─────────────────────────────────────
      if (!syncedUsersThisSession.has(userCode)) {
        try {
          console.log(`🔄 First visit — syncing AccessControl rows for: ${userCode}`);
          const syncResult = await accessControlService.syncUserAccess(userCode, 'USER');
          console.log(`✅ Sync done:`, syncResult?.data);
          syncedUsersThisSession.add(userCode);
        } catch (syncErr) {
          // Non-fatal — still try to fetch
          console.warn('⚠️ Sync failed, continuing anyway:', syncErr.message);
        }
      }

      // ── Step 2: Fetch access for this specific route ───────────────────────
      console.log(`📡 Fetching access: "${routePath}" for "${userCode}"`);
      const response = await accessControlService.getAccessByRouteAndUser_ID(
        routePath, userCode, 'USER'
      );

      if (response?.success && response?.data) {
        const d = response.data;
        console.log(`✅ Access loaded for "${routePath}":`, {
          canView: d.canView, canCreate: d.canCreate, canEdit: d.canEdit,
          canDelete: d.canDelete, canExport: d.canExport, canApprove: d.canApprove,
        });
        setAccess({
          canView:    d.canView    ?? false,
          canCreate:  d.canCreate  ?? false,
          canEdit:    d.canEdit    ?? false,
          canDelete:  d.canDelete  ?? false,
          canExport:  d.canExport  ?? false,
          canApprove: d.canApprove ?? false,
        });
      } else {
        console.warn(`⚠️ No access record for "${routePath}" — all permissions denied`);
        setAccess(DEFAULT_ACCESS);
      }

    } catch (err) {
      console.error('❌ useAccessControl error:', err.message);
      setAccessError(err.response?.data?.error || err.message);
      setAccess(DEFAULT_ACCESS);
    } finally {
      setAccessLoading(false);
    }
  }, [routePath]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  return { access, accessLoading, accessError, refetchAccess: fetchAccess };
}

export default useAccessControl;