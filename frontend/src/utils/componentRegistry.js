// frontend/utils/componentRegistry.js
import axios from 'axios';

const API_BASE = 'http://192.168.100.193:3006/api';

/**
 * Register a component with its metadata
 * @param {Object} component - Component metadata
 * @param {string} component.name - Component name
 * @param {string} component.version - Component version
 * @param {string} component.description - Component description
 * @param {string} component.routePath - Route path
 */
export const registerComponent = async (component) => {
  try {
    // You can send to a dedicated endpoint or use the refresh endpoint
    const response = await axios.post(`${API_BASE}/components/refresh`, {
      components: [{
        name: component.name,
        version: component.version,
        description: component.description,
        routePath: component.routePath
      }]
    });
    
    console.log(`✅ Component ${component.name} registered successfully`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to register component ${component.name}:`, error);
    return null;
  }
};

/**
 * Register multiple components at once
 * @param {Array} components - Array of component metadata objects
 */
export const registerComponents = async (components) => {
  try {
    const response = await axios.post(`${API_BASE}/components/refresh`, {
      components: components.map(comp => ({
        name: comp.name,
        version: comp.version,
        description: comp.description,
        routePath: comp.routePath
      }))
    });
    
    console.log(`✅ Registered ${components.length} components`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to register components:', error);
    return null;
  }
};