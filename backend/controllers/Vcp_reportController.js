/**
 * Vcp_reportController.js
 * Thin controller — delegates everything to Vcp_reportService.
 */

import * as reportService from '../services/Vcp_reportService.js';

const normaliseCodes = (rebateCode, rebateCodes) => {
  if (Array.isArray(rebateCodes) && rebateCodes.length > 0) return rebateCodes;
  if (typeof rebateCode === 'string' && rebateCode.trim())  return [rebateCode.trim()];
  return [];
};
// inside Van_reportController.js — wherever generateRebateReport is called:
const getRequestBaseUrl = (req) => {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host  = req.get('x-forwarded-host')  || req.get('host');
  if (!host) return (process.env.INTERNAL_API_BASE || 'http://localhost:3011').replace(/\/api\/?$/, '');
  return `${proto}://${host}`;
};

// ── GET /api/vcp/report/rebates?db= ──────────────────────────────────────────
export const getActiveRebates = async (req, res) => {
  try {
    const { db } = req.query;
    const data   = await reportService.getActiveRebates(db || 'VCP');
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [ReportCtrl] getActiveRebates:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/vcp/report/customers?db= ────────────────────────────────────────
export const getAllCustomers = async (req, res) => {
  try {
    const { db } = req.query;
    const data = await reportService.getAllCustomers(db || 'VCP');
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [ReportCtrl] getAllCustomers:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/vcp/report/rebates/:rebateCode/customers?db= ────────────────────
export const getCustomersByRebate = async (req, res) => {
  try {
    const { rebateCode } = req.params;
    const { db } = req.query;

    if (!rebateCode) {
      return res.status(400).json({ success: false, message: 'rebateCode is required' });
    }

    const rows = await reportService.getCustomersByRebate(rebateCode, db || 'VCP');

    const seen = new Set();
    const data = rows.filter(r => {
      if (!r.CardCode || seen.has(r.CardCode)) return false;
      seen.add(r.CardCode);
      return true;
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [ReportCtrl] getCustomersByRebate:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/vcp/report/cash-fund ────────────────────────────────────────────
export const generateCashFundReport = async (req, res) => {
  try {
    const { rebateCode, rebateCodes, customerCodes, dateFrom, dateTo, db } = req.body || {};

    const codes        = normaliseCodes(rebateCode, rebateCodes);
    const hasCodes     = codes.length > 0;
    const hasCustomers = Array.isArray(customerCodes) && customerCodes.length > 0;

    if (!hasCodes && !hasCustomers) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one rebate code or at least one customer.',
      });
    }
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: 'Date From and Date To are required.',
      });
    }

    const requestBaseUrl = getRequestBaseUrl(req);

    const data = await reportService.generateCashFundReport({
      rebateCodes:   codes,
      customerCodes: hasCustomers ? customerCodes : [],
      dateFrom,
      dateTo,
      db: db || 'VCP',
      requestBaseUrl,
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [ReportCtrl] generateCashFundReport:', error.message);
    res.status(500).json({ success: false, message: error.message, error: error.message });
  }
};

// ── POST /api/vcp/report/sync-payouts ─────────────────────────────────────────
export const syncPayoutsForReport = async (req, res) => {
  try {
    const { rebateCode, rebateCodes, dateFrom, dateTo, db } = req.body || {};

    const codes = normaliseCodes(rebateCode, rebateCodes);

    if (codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one rebate code is required to sync.',
      });
    }

    const result = await reportService.syncPayoutsForRebate({
      rebateCodes: codes,
      dateFrom: dateFrom || null,
      dateTo:   dateTo   || null,
      db:       db       || 'VCP',
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ [ReportCtrl] syncPayoutsForReport:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};