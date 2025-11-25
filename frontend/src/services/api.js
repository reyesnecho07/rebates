// src/services/apiService.js
const API_BASE = "http://192.168.100.193:5000/api";

class ApiService {
  constructor(database) {
    this.database = database;
  }

  // Generic API call method
  async callEndpoint(endpoint) {
    try {
      const url = `${API_BASE}/${this.database.toLowerCase()}/${endpoint}`;
      console.log(`📡 API Call: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  // Specific methods for each data type
  async getSalesEmployees() {
    return this.callEndpoint('sales-employees');
  }

  async getItems() {
    return this.callEndpoint('items');
  }

  async getCustomers() {
    return this.callEndpoint('customer');
  }

  async getInvoices() {
    return this.callEndpoint('invoices');
  }
}

export default ApiService;