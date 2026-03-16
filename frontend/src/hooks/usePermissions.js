// hooks/usePermissions.js
// ─────────────────────────────────────────────────────────────────────────────
// Usage in any page/component:
//
//   const perms = usePermissions(5);   // pass the NavItemID for this page
//
//   if (perms.loading) return <Spinner />;
//   if (!perms.canView) return <AccessDenied />;
//
//   return (
//     <>
//       {perms.canCreate && <button>Add New</button>}
//       {perms.canEdit   && <button>Edit</button>}
//       {perms.canDelete && <button>Delete</button>}
//       {perms.canExport && <button>Export</button>}
//     </>
//   );
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BASE_URL = 'http://192.168.100.193:3006/api';

// Default: deny everything while loading
const DENY_ALL = {
  canView:    false,
  canCreate:  false,
  canEdit:    false,
  canDelete:  false,
  canExport:  false,
  canApprove: false,
};

const ALLOW_ALL = {
  canView:    true,
  canCreate:  true,
  canEdit:    true,
  canDelete:  true,
  canExport:  true,
  canApprove: true,
};

function getUserCode() {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.User_ID || parsed?.userCode || parsed?.user?.User_ID || null;
  } catch {
    return null;
  }
}

function isSuperUser() {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    const val = parsed?.IsSuperUser ?? parsed?.user?.IsSuperUser ?? 0;
    return val === 1 || val === true || val === '1';
  } catch {
    return false;
  }
}

const usePermissions = (navItemId) => {
  const [permissions, setPermissions] = useState(DENY_ALL);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const load = async () => {
      // SuperUser bypasses all permission checks
      if (isSuperUser()) {
        setPermissions(ALLOW_ALL);
        setLoading(false);
        return;
      }

      const userCode = getUserCode();

      // If no user in localStorage yet — deny silently (redirect to login happens elsewhere)
      if (!userCode || !navItemId) {
        setPermissions(DENY_ALL);
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${BASE_URL}/user-access/permissions`, {
          params: { userCode, navItemId },
          timeout: 5000,
        });

        if (!isMountedRef.current) return;

        const data = res.data?.data || DENY_ALL;
        setPermissions({
          canView:    !!data.canView,
          canCreate:  !!data.canCreate,
          canEdit:    !!data.canEdit,
          canDelete:  !!data.canDelete,
          canExport:  !!data.canExport,
          canApprove: !!data.canApprove,
        });
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('usePermissions error:', err.message);
        setError(err.message);
        setPermissions(DENY_ALL);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    load();

    return () => { isMountedRef.current = false; };
  }, [navItemId]); // re-fetch if navItemId changes

  return { ...permissions, loading, error };
};

export default usePermissions;