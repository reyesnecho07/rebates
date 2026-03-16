// frontend/src/api/userPreferences.js
import axios from './axios';

export const userPreferencesAPI = {
  // Get all preferences for a user
  getUserPreferences: async (userId) => {
    const response = await axios.get(`/user-preferences/user/${userId}`);
    return response.data;
  },

  // Get specific preference by key
  getUserPreference: async (userId, key) => {
    const response = await axios.get(`/user-preferences/user/${userId}/${key}`);
    return response.data;
  },

  // Create or update preference
  upsertPreference: async (userId, key, value) => {
    const response = await axios.post(`/user-preferences/user/${userId}`, { key, value });
    return response.data;
  },

  // Update multiple preferences
  updateUserPreferences: async (userId, preferences) => {
    const response = await axios.put(`/user-preferences/user/${userId}/batch`, { preferences });
    return response.data;
  },

  // Delete preference
  deletePreference: async (userId, key) => {
    const response = await axios.delete(`/user-preferences/user/${userId}/${key}`);
    return response.data;
  },

  // Clear all preferences
  clearPreferences: async (userId) => {
    const response = await axios.delete(`/user-preferences/user/${userId}`);
    return response.data;
  },

  // Get user database preferences
  getUserDatabasePreferences: async (userId) => {
    const response = await axios.get(`/user-preferences/user/${userId}/database-preferences`);
    return response.data;
  },

  // Update user database order - USE DATABASE ROUTE
  updateUserDatabaseOrder: async (userId, updateData) => {
    // This calls the endpoint in databaseRoutes.js
    const response = await axios.put(`/databases/user/${userId}/order`, updateData);
    return response.data;
  },

  // Reset user database order
  resetUserDatabaseOrder: async (userId) => {
    const response = await axios.delete(`/user-preferences/user/${userId}/database-preferences`);
    return response.data;
  }
};