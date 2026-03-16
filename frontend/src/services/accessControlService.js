import axios from 'axios';

const BASE_URL = 'http://192.168.100.193:3006/api';
const TIMEOUT = 10000;
const HEADERS = { 'Content-Type': 'application/json' };

// Create axios instance with default config
const api = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: HEADERS
});

// Add request interceptor to remove problematic headers
api.interceptors.request.use((config) => {
  if (config.headers && config.headers['x-client-ip']) {
    delete config.headers['x-client-ip'];
  }
  return config;
});

const accessControlService = {
  /**
   * Get access by route path and user code
   * @param {string} routePath - The route path (e.g., '/Nexchem_SalesEmployee')
   * @param {string} userCode - The user code
   * @param {string} db - Database name (default: 'USER')
   * @returns {Promise} - Access data
   */
  async getAccessByRouteAndUserCode(routePath, userCode, db = 'USER') {
    try {
      const response = await api.get('/access-control/route/usercode', {
        params: { 
          path: routePath, 
          userCode: userCode,
          db: db 
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching access by route and userCode:', error.response || error.message);
      throw error;
    }
  },

  /**
   * Get access by route path and user ID
   * @param {string} routePath - The route path
   * @param {number} userId - The user ID
   * @param {string} db - Database name
   * @returns {Promise} - Access data
   */
  async getAccessByRouteAndUser(routePath, userId, db = 'USER') {
    try {
      const response = await api.get('/access-control/route', {
        params: { 
          path: routePath, 
          userId: userId,
          db: db 
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching access by route and userId:', error.response || error.message);
      throw error;
    }
  },

  /**
   * Get all access records for a user by user code
   * @param {string} userCode - The user code
   * @param {string} db - Database name
   * @returns {Promise} - Array of access records
   */
  async getAccessByUserCode(userCode, db = 'USER') {
    try {
      const response = await api.get(`/access-control/usercode/${userCode}`, {
        params: { db: db }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching access by userCode:', error.response || error.message);
      throw error;
    }
  },

  /**
   * Get all access records for a user by user ID
   * @param {number} userId - The user ID
   * @param {string} db - Database name
   * @returns {Promise} - Array of access records
   */
  async getAccessByUserId(userId, db = 'USER') {
    try {
      const response = await api.get(`/access-control/user/${userId}`, {
        params: { db: db }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching access by userId:', error.response || error.message);
      throw error;
    }
  },

  /**
   * Get access map for a user (keyed by NavItemID)
   * @param {number} userId - The user ID
   * @param {string} db - Database name
   * @returns {Promise} - Access map object
   */
  async getAccessMapByUserId(userId, db = 'USER') {
    try {
      const response = await api.get(`/access-control/map/${userId}`, {
        params: { db: db }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching access map:', error.response || error.message);
      throw error;
    }
  },

  /**
   * Get all access control records
   * @param {string} db - Database name
   * @returns {Promise} - Array of all access records
   */
  async getAllAccessControl(db = 'USER') {
    try {
      const response = await api.get('/access-control', {
        params: { db: db }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching all access control:', error.response || error.message);
      throw error;
    }
  },


async ensureAccessByRouteAndUserCode(routePath, userCode, db = 'USER') {
  try {
    const response = await api.get('/access-control/route/usercode/ensure', {
      params: { path: routePath, userCode, db }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error ensuring access by route and userCode:', error.response || error.message);
    throw error;
  }
},


async getAccessByRouteAndUser_ID(routePath, userCode, db = 'USER') {
  try {
    const response = await api.get('/access-control/route/by-user', {
      params: { path: routePath, userCode, db }
    });
    return response.data;
  } catch (error) {
    console.error('❌ getAccessByRouteAndUser_ID:', error.response || error.message);
    throw error;
  }
},

async syncUserAccess(userCode, db = 'USER') {
  try {
    const response = await api.post(`/access-control/sync/${userCode}`, null, {
      params: { db }
    });
    return response.data;
  } catch (error) {
    console.error('❌ syncUserAccess:', error.response || error.message);
    throw error;
  }
},

  /**
   * Test the access control API connection
   * @returns {Promise} - Test result
   */
  async testConnection() {
    try {
      const response = await api.get('/access-control/test');
      return response.data;
    } catch (error) {
      console.error('❌ Access control API test failed:', error.message);
      throw error;
    }
  }
};

export default accessControlService;