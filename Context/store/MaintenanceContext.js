import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import baseUrl from '../../assets/common/baseUrl';
import { AuthContext } from './Auth';

const MaintenanceContext = createContext();

export const MaintenanceProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const userId = user?._id || user?.id || null;
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);

  const checkMaintenanceStatus = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${baseUrl}settings/maintenance`, {
        timeout: 20000, headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (typeof response.data?.enabled !== 'boolean' ||
          (response.data.testingAccess !== undefined && typeof response.data.testingAccess !== 'boolean')) {
        throw new Error('Maintenance access could not be verified.');
      }
      if (request === sequence.current) {
        setMaintenanceEnabled(response.data.enabled);
        setAccess({ userId, allowed: response.data.testingAccess === true });
        setError('');
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error.message);
      if (request === sequence.current) {
        setAccess(null);
        setError(error.response?.data?.message || 'Unable to verify maintenance access. Please retry.');
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

      const response = await axios.put(
        `${baseUrl}settings/maintenance`,
        { enabled },
        {
          headers: { Authorization: `Bearer ${token}` },
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
