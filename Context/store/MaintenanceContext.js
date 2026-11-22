import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import baseUrl from '../../assets/common/baseUrl';
import { AuthContext } from './Auth';
import { getDatabaseNameFromStorage } from '../../assets/common/databaseConfig';

const MaintenanceContext = createContext();

export const MaintenanceProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const userId = user?._id || user?.id || null;
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [usaRestricted, setUsaRestricted] = useState(false);
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);

  const checkMaintenanceStatus = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const token = await AsyncStorage.getItem('token');
      const database = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}settings/maintenance`, {
        timeout: 20000,
        headers: { 'x-database-name': database, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (typeof response.data?.enabled !== 'boolean' ||
          (/usa/i.test(database) && typeof response.data?.usaRegionEnabled !== 'boolean') ||
          (response.data.testingAccess !== undefined && typeof response.data.testingAccess !== 'boolean')) {
        throw Object.assign(new Error('The server returned incomplete maintenance settings. Check the backend connection and try again.'), {
          code: 'INVALID_MAINTENANCE_RESPONSE',
        });
      }
      if (request === sequence.current) {
        setMaintenanceEnabled(response.data.enabled);
        setUsaRestricted(/usa/i.test(database) && !response.data.usaRegionEnabled);
        setAccess({ userId, allowed: response.data.testingAccess === true });
        setError('');
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error.message);
      if (request === sequence.current) {
        setAccess(null);
        setError(error.code === 'INVALID_MAINTENANCE_RESPONSE' ? error.message :
          error.response?.data?.message || 'Unable to verify maintenance access. Please retry.');
      }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [userId]);

  const toggleMaintenance = useCallback(async (enabled) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Admin token required' };
      }
      const database = await getDatabaseNameFromStorage();

      const response = await axios.put(
        `${baseUrl}settings/maintenance`,
        { enabled },
        {
          headers: { Authorization: `Bearer ${token}`, 'x-database-name': database },
        }
      );

      if (response.data.success) {
        setMaintenanceEnabled(response.data.enabled);
        await checkMaintenanceStatus();
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
  }, [checkMaintenanceStatus]);

  useEffect(() => {
    setLoading(true);
    checkMaintenanceStatus();
    // Check every 30 seconds
    const interval = setInterval(checkMaintenanceStatus, 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkMaintenanceStatus();
    });
    return () => { sequence.current += 1; clearInterval(interval); subscription.remove(); };
  }, [checkMaintenanceStatus]);

  return (
    <MaintenanceContext.Provider
      value={{
        maintenanceEnabled,
        usaRestricted,
        testingAccess: Boolean(userId && access?.userId === userId && access.allowed),
        error,
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
