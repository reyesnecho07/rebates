import componentService from '../services/componentService.js';
import { getDatabaseConfig } from '../config/database.js';

export const registerComponent = async (req, res) => {
  try {
    console.log('📝 registerComponent called with body:', JSON.stringify(req.body, null, 2));
    
    // Get database from query parameter, default to USER
    const dbName = req.query.db || 'USER';
    console.log('📊 Using database:', dbName);
    
    // Log database config (without password)
    const dbConfig = getDatabaseConfig(dbName);
    console.log('🔌 Database config:', {
      server: dbConfig.server,
      database: dbConfig.database,
      user: dbConfig.user,
      port: dbConfig.port
    });
    
    // Save to database using ComponentService - pass dbName
    const result = await componentService.saveComponentMetadata(req.body, dbName);
    
    console.log('✅ Save result:', result);
    
    res.json({ 
      success: true, 
      message: 'Component registered successfully',
      data: result 
    });
  } catch (error) {
    console.error('❌ Error registering component:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error registering component' 
    });
  }
};

export const registerComponents = async (req, res) => {
  try {
    console.log('📝 registerComponents called with body:', req.body);
    
    const dbName = req.query.db || 'USER';
    const { components } = req.body;
    const results = [];
    
    if (Array.isArray(components)) {
      for (const component of components) {
        try {
          const result = await componentService.saveComponentMetadata(component, dbName);
          results.push(result);
        } catch (error) {
          console.error(`Error registering component ${component.componentName}:`, error);
          results.push({ 
            success: false, 
            componentName: component.componentName,
            error: error.message 
          });
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Registered ${results.length} components`,
      data: results
    });
  } catch (error) {
    console.error('Error registering components:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Rest of the controllers...
export const getAvailableRoutePaths = async (req, res) => {
  try {
    console.log('📝 getAvailableRoutePaths called');
    res.json([{ value: '/test', label: 'Test Component', version: '1.0.0', description: 'Test' }]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const refreshRoutePaths = async (req, res) => {
  try {
    console.log('📝 refreshRoutePaths called with body:', req.body);
    res.json({ 
      success: true, 
      message: 'refreshRoutePaths working',
      count: req.body.components?.length || 0 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const scanAllComponents = async (req, res) => {
  try {
    console.log('📝 scanAllComponents called');
    res.json({ 
      success: true, 
      message: 'scanAllComponents working',
      summary: { scannedFiles: 0, componentsWithRoute: 0, componentsWithoutRoute: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};