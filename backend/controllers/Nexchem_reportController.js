/**
 * controllers/Nexchem_reportController.js
 *
 * Each handler calls the matching service function and returns
 * the same response shape as the original route file.
 */

import {
  getCustomers,
  getRebatePrograms,
  generateReport,
  generateMultiCustomerReport,
  getCustomersByRebateCode,
} from '../services/Nexchem_reportService.js';

// ── GET /api/nexchem/report/customers ─────────────────────────────────────────
// Mirrors original: GET /nexchem/customer
export const getCustomerList = async (req, res) => {
  try {
    const data = await getCustomers();
    res.json(data);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── GET /api/nexchem/report/rebate-programs ───────────────────────────────────
// Mirrors original: GET /nexchem/rebate-programs
export const getRebateProgramList = async (req, res) => {
  try {
    const data = await getRebatePrograms();
    res.json(data);
  } catch (error) {
    console.error('Error fetching rebate programs:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── GET /api/nexchem/report/rebate/:rebateCode/customers ──────────────────────
// Used by the rebate-code dropdown to auto-load customers
export const getCustomersByRebate = async (req, res) => {
  try {
    const { rebateCode } = req.params;
    if (!rebateCode)
      return res.status(400).json({ success: false, message: 'rebateCode is required' });

    const data = await getCustomersByRebateCode(rebateCode);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('Error fetching customers by rebate:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ── POST /api/nexchem/report/generate-report ──────────────────────────────────
// Mirrors original: POST /nexchem/generate-report (single customer)
export const generateSingleCustomerReport = async (req, res) => {
  try {
    const { selectedCustomer, dateFrom, dateTo } = req.body;

    if (!selectedCustomer)
      return res.status(400).json({ error: 'Customer is required' });

    const reportData = await generateReport({ selectedCustomer, dateFrom, dateTo });

    res.json({
      success:  true,
      data:     reportData,
      summary:  {
        totalDocuments: reportData.length,
        totalItems:     reportData.reduce((sum, g) => sum + g.items.length, 0),
        dateFrom:       dateFrom || 'All',
        dateTo:         dateTo   || 'All',
      },
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /api/nexchem/report/generate-multi-customer-report ───────────────────
// Mirrors original: POST /nexchem/generate-multi-customer-report
// Also handles rebate-code mode: if customerCodes is empty but rebateCode is
// provided, customers are resolved server-side (safe race-condition fallback).
export const generateMultiReport = async (req, res) => {
  try {
    let { customerCodes, rebateCode, dateFrom, dateTo } = req.body;

    // Rebate-code mode — resolve customers server-side
    if (rebateCode && (!customerCodes || !customerCodes.length)) {
      console.log(`Resolving customers for rebate "${rebateCode}"`);
      const { customers } = await getCustomersByRebateCode(rebateCode);
      customerCodes = customers.map(c => c.CardCode).filter(Boolean);

      if (!customerCodes.length)
        return res.status(404).json({
          error: `No customers found for rebate code "${rebateCode}"`,
        });

      // Auto-fill date range from rebate programme
      if (!dateFrom || !dateTo) {
        const programs = await getRebatePrograms();
        const found    = programs.find(r => r.RebateCode === rebateCode);
        if (found) {
          if (!dateFrom && found.DateFrom)
            dateFrom = new Date(found.DateFrom).toISOString().split('T')[0];
          if (!dateTo && found.DateTo)
            dateTo = new Date(found.DateTo).toISOString().split('T')[0];
        }
      }
    }

    if (!customerCodes || customerCodes.length === 0)
      return res.status(400).json({ error: 'At least one customer is required' });

    const reportData = await generateMultiCustomerReport({ customerCodes, dateFrom, dateTo });

    res.json({
      success:  true,
      data:     reportData,
      summary:  {
        totalDocuments: reportData.length,
        totalItems:     reportData.reduce((sum, g) => sum + g.items.length, 0),
        totalCustomers: customerCodes.length,
        dateFrom:       dateFrom || 'All',
        dateTo:         dateTo   || 'All',
      },
    });
  } catch (error) {
    console.error('Error generating multi-customer report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};