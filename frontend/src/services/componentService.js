import axios from 'axios';

// Use your backend server IP address
const API_BASE = 'http://192.168.100.193:3006/api'; // Update this IP to match your backend server

const databaseApi = {
  // Fetch all active databases
  async getAllDatabases() {
    try {
      console.log('📡 Fetching databases from:', `${API_BASE}/databases?db=USER`);
      const response = await axios.get(`${API_BASE}/databases?db=USER`);
      console.log('✅ Databases response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching databases:', error.response || error.message);
      throw error;
    }
  },

  // Get database config by name
  async getDatabaseByName(dbName) {
    try {
      console.log(`📡 Fetching database ${dbName} from:`, `${API_BASE}/databases/${dbName}?db=USER`);
      const response = await axios.get(`${API_BASE}/databases/${dbName}?db=USER`);
      console.log('✅ Database response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching database:', error.response || error.message);
      throw error;
    }
  },

  // Check if specific database is active
  async checkDatabaseActive(dbName) {
    try {
      console.log(`📡 Checking database ${dbName} status from:`, `${API_BASE}/databases/${dbName}/active?db=USER`);
      const response = await axios.get(`${API_BASE}/databases/${dbName}/active?db=USER`);
      console.log('✅ Database status response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error checking database status:', error.response || error.message);
      throw error;
    }
  },

  // Register a single component
async registerComponent(registrationData) {
  try {
    console.log('📝 Registering component:', registrationData.name);
    const response = await axios.post(`${API_BASE}/components/register?db=USER`, registrationData);
    console.log('✅ Component registered:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Backend error response:', error.response?.data);
    console.error('❌ Error registering component:', error.response || error.message);
    throw error;
  }
},

  // Register multiple components
  async registerMultipleComponents(components) {
    try {
      console.log('📝 Registering multiple components:', components.length);
      const response = await axios.post(`${API_BASE}/components/register-multiple`, { components });
      console.log('✅ Components registered:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error registering multiple components:', error.response || error.message);
      throw error;
    }
  },

  // Get available component route paths
  async getAvailablePaths() {
    try {
      console.log('📡 Fetching available component paths...');
      const response = await axios.get(`${API_BASE}/components/available-paths`);
      console.log('✅ Available paths:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching available paths:', error.response || error.message);
      throw error;
    }
  },

  // Scan all components from file system
  async scanAllComponents() {
    try {
      console.log('🔍 Scanning all components...');
      const response = await axios.post(`${API_BASE}/components/scan-all`);
      console.log('✅ Scan complete:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error scanning components:', error.response || error.message);
      throw error;
    }
  }
};

export default databaseApi;