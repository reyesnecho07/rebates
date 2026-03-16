import axios from 'axios';

const BASE_URL = 'http://192.168.100.193:3006/api';
const TIMEOUT = 10000;
const HEADERS = { 'Content-Type': 'application/json' };

const databaseApi = {
  async testConnection() {
    try {
      const response = await axios.get(`${BASE_URL}/databases/test`, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      throw error;
    }
  },

  async getAllDatabases() {
    try {
      const response = await axios.get(`${BASE_URL}/databases`, {
        params: { db: 'USER' },
        timeout: TIMEOUT,
        headers: HEADERS
      });
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.error('❌ Request timeout');
      } else if (error.request) {
        console.error('❌ No response — is backend running on', BASE_URL);
      } else {
        console.error('❌ Request setup error:', error.message);
      }
      throw error;
    }
  },

  async getDatabaseByName(dbName) {
    try {
      const response = await axios.get(`${BASE_URL}/databases/${dbName}`, {
        params: { db: 'USER' },
        timeout: TIMEOUT,
        headers: HEADERS
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching database:', error.response || error.message);
      throw error;
    }
  },

  async checkDatabaseActive(dbName) {
    try {
      const response = await axios.get(`${BASE_URL}/databases/${dbName}/active`, {
        params: { db: 'USER' },
        timeout: TIMEOUT,
        headers: HEADERS
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error checking database status:', error.response || error.message);
      throw error;
    }
  }
};

export default databaseApi;