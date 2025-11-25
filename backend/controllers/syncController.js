import { syncService } from '../services/syncService.js';

export const refreshData = async (req, res) => {
  try {
    const { database } = req.body;
    
    if (!database) {
      return res.status(400).json({
        success: false,
        message: "Database parameter is required"
      });
    }

    console.log(`🔄 Starting data refresh for ${database}`);

    const results = {
      salesEmployees: null,
      customers: null,
      items: null
    };

    // Sync Sales Employees
    try {
      const sapSalesEmployees = await syncService.getSapData(database, 'salesEmployees');
      results.salesEmployees = await syncService.syncToLocalDatabase(database, sapSalesEmployees, 'salesEmployees');
      console.log(`✅ Sales Employees sync completed for ${database}:`, results.salesEmployees);
    } catch (error) {
      console.error(`❌ Sales Employees sync failed for ${database}:`, error);
      results.salesEmployees = { error: error.message };
    }

    // Sync Customers
    try {
      const sapCustomers = await syncService.getSapData(database, 'customers');
      results.customers = await syncService.syncToLocalDatabase(database, sapCustomers, 'customers');
      console.log(`✅ Customers sync completed for ${database}:`, results.customers);
    } catch (error) {
      console.error(`❌ Customers sync failed for ${database}:`, error);
      results.customers = { error: error.message };
    }

    // Sync Items
    try {
      const sapItems = await syncService.getSapData(database, 'items');
      results.items = await syncService.syncToLocalDatabase(database, sapItems, 'items');
      console.log(`✅ Items sync completed for ${database}:`, results.items);
    } catch (error) {
      console.error(`❌ Items sync failed for ${database}:`, error);
      results.items = { error: error.message };
    }

    res.json({
      success: true,
      message: `Data refresh completed for ${database}`,
      database: database,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in refreshData:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getLocalSalesEmployees = async (req, res) => {
  try {
    const salesEmployees = await syncService.getLocalData('salesEmployees');
    res.json(salesEmployees);
  } catch (error) {
    console.error('Error fetching local sales employees:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getLocalCustomers = async (req, res) => {
  try {
    const customers = await syncService.getLocalData('customers');
    res.json(customers);
  } catch (error) {
    console.error('Error fetching local customers:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getLocalItems = async (req, res) => {
  try {
    const items = await syncService.getLocalData('items');
    res.json(items);
  } catch (error) {
    console.error('Error fetching local items:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSyncStatus = async (req, res) => {
  try {
    const status = await syncService.getSyncStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};