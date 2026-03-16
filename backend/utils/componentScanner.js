// backend/utils/componentScanner.js
const fs = require('fs');
const path = require('path');

/**
 * Recursively finds all .jsx and .js files in a directory
 * @param {string} dirPath - Directory to scan
 * @returns {Array} Array of file paths
 */
const getAllComponentFiles = (dirPath) => {
  const files = [];
  
  function walkDirectory(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other hidden/system directories
          if (!item.startsWith('.') && item !== 'node_modules' && item !== '__tests__') {
            walkDirectory(fullPath);
          }
        } else if (item.endsWith('.jsx') || item.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`❌ Error reading directory ${currentPath}:`, error.message);
    }
  }
  
  walkDirectory(dirPath);
  return files;
};

/**
 * Extracts COMPONENT_METADATA from a file
 * @param {string} filePath - Path to the file
 * @returns {Object|null} Component metadata or null if not found
 */
const extractComponentMetadata = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern 1: Look for COMPONENT_METADATA object (exported or not)
    const objectPattern = /(?:export\s+)?const\s+COMPONENT_METADATA\s*=\s*{([\s\S]*?)}/g;
    const objectMatch = objectPattern.exec(content);
    
    if (objectMatch) {
      const objectContent = `{${objectMatch[1]}}`;
      
      // Extract individual properties using regex (handle multi-line)
      const nameMatch = objectContent.match(/name\s*:\s*['"]([^'"]+)['"]/);
      const versionMatch = objectContent.match(/version\s*:\s*['"]([^'"]+)['"]/);
      const descriptionMatch = objectContent.match(/description\s*:\s*['"]([^'"]+)['"]/);
      const routePathMatch = objectContent.match(/routePath\s*:\s*['"]([^'"]+)['"]/);
      
      // Also look for spread patterns
      const spreadMatch = objectContent.match(/\.\.\.([^,}]+)/);
      
      const componentName = nameMatch ? nameMatch[1] : path.basename(filePath, path.extname(filePath));
      
      return {
        name: componentName,
        version: versionMatch ? versionMatch[1] : '1.0.0',
        description: descriptionMatch ? descriptionMatch[1] : '',
        routePath: routePathMatch ? routePathMatch[1] : '',
        filePath: filePath,
        source: 'object',
        hasRoutePath: !!routePathMatch
      };
    }
    
    // Pattern 2: Look for setComponentMetadata calls with parameters
    const functionPattern = /setComponentMetadata\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
    const functionMatch = functionPattern.exec(content);
    
    if (functionMatch) {
      return {
        name: functionMatch[1],
        version: functionMatch[2],
        routePath: functionMatch[3],
        description: functionMatch[4],
        filePath: filePath,
        source: 'function',
        hasRoutePath: !!functionMatch[3]
      };
    }
    
    // Pattern 3: Look for setComponentMetadata with COMPONENT_METADATA properties
    const propertyPattern = /setComponentMetadata\s*\(\s*COMPONENT_METADATA\.name\s*,\s*COMPONENT_METADATA\.version\s*,\s*COMPONENT_METADATA\.routePath\s*,\s*COMPONENT_METADATA\.description\s*\)/g;
    const propertyMatch = propertyPattern.exec(content);
    
    if (propertyMatch) {
      // If we found property pattern but not the object, try to find the object
      const metadata = extractComponentMetadata(filePath);
      if (metadata) {
        metadata.source = 'property_access';
        return metadata;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error reading file ${filePath}:`, error.message);
    return null;
  }
};

/**
 * Scans a directory for components with metadata
 * @param {string} componentsDir - Directory to scan
 * @returns {Object} Scan results
 */
const scanComponents = (componentsDir) => {
  console.log(`🔍 Scanning components in: ${componentsDir}`);
  
  if (!fs.existsSync(componentsDir)) {
    return {
      success: false,
      message: `Components directory not found: ${componentsDir}`,
      components: [],
      warnings: [],
      errors: []
    };
  }
  
  const files = getAllComponentFiles(componentsDir);
  console.log(`📁 Found ${files.length} component files`);
  
  const componentsWithRoute = [];
  const componentsWithoutRoute = [];
  const errors = [];
  
  for (const file of files) {
    try {
      const metadata = extractComponentMetadata(file);
      
      if (metadata) {
        if (metadata.hasRoutePath && metadata.routePath && metadata.routePath.trim() !== '') {
          componentsWithRoute.push(metadata);
        } else {
          componentsWithoutRoute.push({
            ...metadata,
            file: path.relative(componentsDir, file)
          });
        }
      }
    } catch (error) {
      errors.push({
        file: path.relative(componentsDir, file),
        error: error.message
      });
    }
  }
  
  // Remove duplicates by component name (keep first occurrence)
  const uniqueComponentsWithRoute = [];
  const seenNames = new Set();
  
  for (const component of componentsWithRoute) {
    if (!seenNames.has(component.name)) {
      seenNames.add(component.name);
      uniqueComponentsWithRoute.push(component);
    }
  }
  
  console.log(`✅ Found ${uniqueComponentsWithRoute.length} components with route paths`);
  console.log(`⚠️  Found ${componentsWithoutRoute.length} components WITHOUT route paths`);
  console.log(`❌ ${errors.length} files had errors`);
  
  return {
    success: true,
    message: `Scanned ${files.length} files, found ${uniqueComponentsWithRoute.length} components with route paths and ${componentsWithoutRoute.length} without`,
    scanned: files.length,
    foundWithRoute: uniqueComponentsWithRoute.length,
    foundWithoutRoute: componentsWithoutRoute.length,
    componentsWithRoute: uniqueComponentsWithRoute,
    componentsWithoutRoute: componentsWithoutRoute,
    errors: errors
  };
};

/**
 * Formats components for database insertion
 * @param {Array} components - Array of component metadata
 * @returns {Array} Formatted components ready for DB
 */
const formatComponentsForDB = (components) => {
  return components.map(comp => ({
    ComponentName: comp.name,
    ComponentVersion: comp.version,
    RoutePath: comp.routePath,
    Metadata: JSON.stringify({
      name: comp.name,
      version: comp.version,
      description: comp.description,
      routePath: comp.routePath,
      source: comp.source,
      filePath: comp.filePath,
      scannedAt: new Date().toISOString()
    }),
    ViewedAt: new Date()
  }));
};

/**
 * Gets the frontend components directory path
 * @returns {string} Absolute path to components directory
 */
const getComponentsDirectory = () => {
  // Calculate path relative to backend directory
  const backendDir = path.dirname(__dirname); // Goes up from utils
  const projectRoot = path.dirname(backendDir); // Goes up to project root
  
  const componentsDir = path.join(projectRoot, 'frontend', 'src', 'components');
  return componentsDir;
};

module.exports = {
  getAllComponentFiles,
  extractComponentMetadata,
  scanComponents,
  formatComponentsForDB,
  getComponentsDirectory
};