const sapService = require('../services/sapService');

class ReportController {
  async generateReport(req, res) {
    const startTime = Date.now();
    
    try {
      const { selectedCustomer, dateFrom, dateTo } = req.body;
      
      console.log('Generating report request received:', {
        selectedCustomer,
        dateFrom,
        dateTo,
        timestamp: new Date().toISOString()
      });
      
      // Validate required field
      if (!selectedCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Customer code is required'
        });
      }
      
      // Fetch report data from SAP
      const reportData = await sapService.getKitanexReport(selectedCustomer, dateFrom, dateTo);
      
      const duration = Date.now() - startTime;
      
      console.log('Report generation completed:', {
        duration: `${duration}ms`,
        invoiceCount: reportData.length,
        totalItems: reportData.reduce((sum, inv) => sum + inv.items.length, 0)
      });
      
      // Return data in exact format expected by frontend
      res.json({
        success: true,
        data: reportData,
        generatedAt: new Date().toISOString(),
        processingTime: `${duration}ms`
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Report generation error:', {
        error: error.message,
        duration: `${duration}ms`
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: error.message,
        duration: `${duration}ms`
      });
    }
  }
  
  async testConnection(req, res) {
    try {
      const result = await sapService.testConnection();
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Connected to SAP database successfully',
          serverTime: result.serverTime,
          config: {
            host: process.env.NEXCHEM_DB_HOST,
            database: process.env.NEXCHEM_DB_NAME
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to connect to SAP database',
          error: result.error,
          config: {
            host: process.env.NEXCHEM_DB_HOST,
            database: process.env.NEXCHEM_DB_NAME,
            user: process.env.NEXCHEM_DB_USER
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Connection test failed',
        error: error.message
      });
    }
  }
  
  // Simple health check
  async healthCheck(req, res) {
    res.json({
      status: 'ok',
      service: 'nexchem-report-api',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new ReportController();