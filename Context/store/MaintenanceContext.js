import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import baseUrl from '../assets/common/baseUrl';

const MaintenanceContext = createContext();

export const MaintenanceProvider = ({ children }) => {
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkMaintenanceStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${baseUrl}settings/maintenance`);
      setMaintenanceEnabled(response.data.enabled || false);
    } catch (error) {
      console.log('Error checking maintenance status:', error.message);
      setMaintenanceEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleMaintenance = useCallback(async (enabled) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Admin token required' };
      }

      const response = await axios.put(
        `${baseUrl}settings/maintenance`,
        { enabled },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setMaintenanceEnabled(response.data.enabled);
        return { success: true, message: response.data.message };
      }
      return { success: false, message: 'Failed to update maintenance mode' };
    } catch (error) {
      console.log('Error toggling maintenance:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Error updating maintenance mode',
      };
    }
  }, []);

  useEffect(() => {
    checkMaintenanceStatus();
    // Check every 30 seconds
    const interval = setInterval(checkMaintenanceStatus, 30000);
    return () => clearInterval(interval);
  }, [checkMaintenanceStatus]);

  return (
    <MaintenanceContext.Provider
      value={{
        maintenanceEnabled,
        loading,
        checkMaintenanceStatus,
        toggleMaintenance,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenance must be used within MaintenanceProvider');
  }
  return context;
};
