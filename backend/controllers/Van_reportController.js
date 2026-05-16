// Van_reportController.js
import sql from 'mssql';                    // if not already imported elsewhere, add this
import { getPool } from '../services/databaseService.js'; // ensure this path is correct
import { getAvailableRebates, generateRebateReport } from '../services/Van_reportService.js';

/**
 * GET /api/van/report/rebates
 * Returns list of rebate programs for the selector.
 */
export const listRebates = async (req, res) => {
  try {
    const db   = req.query.db || 'VAN_OWN';
    const data = await getAvailableRebates(db);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ listRebates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/van/report/generate
 * Body: { rebateCodes: string[], db?: string }
 * Generates the full monitoring report for the selected rebate codes.
 */
export const generateReport = async (req, res) => {
  try {
    const { rebateCodes, db = 'VAN_OWN' } = req.body;

    if (!rebateCodes || !Array.isArray(rebateCodes) || !rebateCodes.length) {
      return res.status(400).json({ success: false, message: 'rebateCodes array is required' });
    }

    console.log(`📊 Generating report for ${rebateCodes.length} rebate code(s):`, rebateCodes);

    const sections = await generateRebateReport(rebateCodes, db);

    if (!sections.length) {
      return res.status(404).json({ success: false, message: 'No data found for the selected rebate codes' });
    }

    // Validate that all rebates share the same quarter/year (warn if not)
    const periods = sections.map(s => `Q${s.quarter} ${s.year}`);
    const uniquePeriods = [...new Set(periods)];
    if (uniquePeriods.length > 1) {
      console.warn('⚠️ Multiple periods detected:', uniquePeriods);
    }

    res.json({
      success: true,
      data: sections,
      meta: {
        rebateCount: sections.length,
        periods: uniquePeriods,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ generateReport error:', error);
    res.status(500).json({ success: false, message: error.message, stack: error.stack });
  }
};

/**
 * GET /api/van/report/rebate/:rebateCode/customers
 * Returns list of customers (CardCode, CardName) assigned to a specific rebate code.
 * Query param: ?db=VAN_OWN (optional, default VAN_OWN)
 */
export const getCustomersForRebate = async (req, res) => {
  const { rebateCode } = req.params;
  const db = req.query.db || 'VAN_OWN';

  try {
    const pool = getPool(db);
    if (!pool) throw new Error('Database pool not available');

    // 1. Find rebate type
    const typeRes = await pool.request()
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`SELECT RebateType FROM RebateProgram WHERE RebateCode = @rc`);

    if (!typeRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Rebate code not found' });
    }

    const rebateType = typeRes.recordset[0].RebateType;
    let customerTable = '';
    if (rebateType === 'Fixed') customerTable = 'FixCustRebate';
    else if (rebateType === 'Incremental') customerTable = 'IncCustRebate';
    else if (rebateType === 'Percentage') customerTable = 'PerCustRebate';
    else {
      return res.status(400).json({ success: false, message: 'Unsupported rebate type' });
    }

    const query = `
      SELECT DISTINCT CardCode, CardName
      FROM ${customerTable}
      WHERE RebateCode = @rc
      ORDER BY CardName
    `;

    const result = await pool.request()
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(query);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('❌ getCustomersForRebate error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};