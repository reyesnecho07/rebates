// src/hooks/useAccessControl.js
import { useState, useEffect, useCallback } from 'react';
import accessControlService from '../services/accessControlService';

const DEFAULT_ACCESS = {
  canView: false, canCreate: false, canEdit: false,
  canDelete: false, canExport: false, canApprove: false,
};

const FAIL_OPEN_ACCESS = {
  canView: true, canCreate: true, canEdit: true,
  canDelete: true, canExport: true, canApprove: true,
};

const SYNC_TIMEOUT_MS = 8000;   // sync is best-effort — don't block on it
const FETCH_TIMEOUT_MS = 12000; // hard cap on the access lookup

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('currentUser') || 'null') || null; }
  catch { return null; }
}

function getUserCode() {
  const u = getCurrentUser();
  if (!u) return null;
  return u.User_ID ?? u.UserCode ?? u.userCode ?? null;
}

function checkIsSuperUser() {
  const u = getCurrentUser();
  if (!u) return false;
  const val = u.IsSuperUser ?? u.isSuperUser ?? 0;
  return val === 1 || val === true || val === '1';
}

const syncedUsersThisSession = new Set();

function useAccessControl(routePath) {
  const [access, setAccess]               = useState(DEFAULT_ACCESS);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError]     = useState(null);

  const fetchAccess = useCallback(async () => {
    if (!routePath) {
      setAccess(DEFAULT_ACCESS);
      setAccessError('No routePath supplied');
      setAccessLoading(false);
      return;
    }

    if (checkIsSuperUser()) {
      setAccess({
        canView: true, canCreate: true, canEdit: true,
        canDelete: true, canExport: true, canApprove: true,
      });
      setAccessError(null);
      setAccessLoading(false);
      return;
    }

    const userCode = getUserCode();

    if (!userCode) {
      console.warn('⚠️ No User_ID in localStorage — denying all access');
      setAccess(DEFAULT_ACCESS);
      setAccessError('No User_ID in localStorage');
      setAccessLoading(false);
      return;
    }

    setAccessLoading(true);
    setAccessError(null);

    try {
      // ── Step 1: Sync once per session (best-effort, never blocks) ────────
      if (!syncedUsersThisSession.has(userCode)) {
        try {
          console.log(`🔄 First visit — syncing AccessControl rows for: ${userCode}`);
          const syncResult = await withTimeout(
            accessControlService.syncUserAccess(userCode, 'USER'),
            SYNC_TIMEOUT_MS,
            'syncUserAccess'
          );
          console.log(`✅ Sync done:`, syncResult?.data);
          syncedUsersThisSession.add(userCode);
        } catch (syncErr) {
          console.warn('⚠️ Sync failed/timed out, continuing anyway:', syncErr.message);
          // Do NOT mark as synced so a later visit can retry.
        }
      }

      // ── Step 2: Fetch access (the important one) ─────────────────────────
      console.log(`📡 Fetching access: "${routePath}" for "${userCode}"`);
      const response = await withTimeout(
        accessControlService.getAccessByRouteAndUser_ID(routePath, userCode, 'USER'),
        FETCH_TIMEOUT_MS,
        'getAccessByRouteAndUser_ID'
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
        console.warn(`⚠️ No access record for "${routePath}" — denying all`);
        setAccess(DEFAULT_ACCESS);
        setAccessError(`No access record for ${routePath}`);
      }

    } catch (err) {
      console.error('❌ useAccessControl error:', err.message);
      setAccessError(err.response?.data?.error || err.message);
      // Fail-open so the spinner stops and the page renders. Change to
      // setAccess(DEFAULT_ACCESS) if you want fail-closed behavior.
      setAccess(FAIL_OPEN_ACCESS);
    } finally {
      // CRITICAL: always runs
      setAccessLoading(false);
    }
  }, [routePath]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  return { access, accessLoading, accessError, refetchAccess: fetchAccess };
}

export default useAccessControl;