import React, { createContext, useReducer, useEffect, useCallback } from "react";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage"; //Store data in the device
import { AppState } from "react-native";

export const AuthContext = createContext();

const INACTIVITY_TIMEOUT_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds

const extractUserProfile = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  if (payload.user && typeof payload.user === "object" && !Array.isArray(payload.user)) {
    return payload.user;
  }

  if (payload.profile && typeof payload.profile === "object" && !Array.isArray(payload.profile)) {
    return payload.profile;
  }

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }

  return payload;
};

const looksLikeDriverRole = (value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["driver", "delivery_driver", "delivery-driver", "delivery driver", "driver_role", "driver-role"].includes(normalized);
  }

  if (Array.isArray(value)) {
    return value.some((item) => looksLikeDriverRole(item));
  }

  return value === true;
};

export const isDriverUser = (user) => {
  const profile = extractUserProfile(user);

  if (!profile || typeof profile !== "object") {
    return false;
  }

  if (profile?.isAdmin === true || profile?.is_admin === true || profile?.role === "admin" || profile?.user?.role === "admin" || profile?.profile?.role === "admin") {
    return true;
  }

  const roleValues = [
    profile?.isDriver,
    profile?.is_driver,
    profile?.driver,
    profile?.driverRole,
    profile?.userType,
    profile?.accountType,
    profile?.role,
    profile?.type,
    profile?.roles,
    profile?.permissions,
    profile?.user?.role,
    profile?.profile?.role,
  ];

  return roleValues.some((value) => looksLikeDriverRole(value));
};
const ACTIVITY_UPDATE_INTERVAL = 60000; // Update activity timestamp every minute

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_START":
    case "REGISTER_START":
      return { ...state, loading: true, error: null };
    case "LOGIN_SUCCESS":
      return {
        ...state,
        loading: false,
        user: action.payload,
        isAuthenticated: true,
        error: null,
      };
    case "REGISTER_SUCCESS":
      return {
        ...state,
        loading: false,
        user: action.payload,
        isAuthenticated: true,
        error: null,
      };
    case "LOGIN_FAIL":
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false,
      };
    case "REGISTER_FAIL":
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false,
        _id: null,
      };
    case "FETCH_USER_START":
      return { ...state, loading: true, error: null };
    case "FETCH_USER_SUCCESS":
      return { ...state, loading: false, user: action.payload, error: null };
    case "FETCH_USER_FAIL":
      return { ...state, loading: false, error: action.payload };
    case "LOGOUT":
      return { ...initialState };
    case "SESSION_EXPIRED":
      return { ...initialState, error: "Your session has expired due to inactivity. Please log in again." };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Helper function to save last activity timestamp
  const updateLastActivity = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        await AsyncStorage.setItem("lastActivityTime", Date.now().toString());
      }
    } catch (error) {
      console.warn("Failed to update last activity:", error);
    }
  }, []);

  // Helper function to check if session has expired due to inactivity
  const isSessionExpired = useCallback(async () => {
    try {
      const lastActivityStr = await AsyncStorage.getItem("lastActivityTime");
      if (!lastActivityStr) {
        return true;
      }

      const lastActivity = parseInt(lastActivityStr, 10);
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      return timeSinceLastActivity > INACTIVITY_TIMEOUT_MS;
    } catch (error) {
      console.warn("Failed to check session expiry:", error);
      return false;
    }
  }, []);

  const restoreSession = useCallback(async () => {
    dispatch({ type: "FETCH_USER_START" });
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        dispatch({ type: "LOGOUT" });
        return;
      }

      // Check if session has expired due to inactivity
      const expired = await isSessionExpired();
      if (expired) {
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("lastActivityTime");
        dispatch({ type: "SESSION_EXPIRED" });
        return;
      }

      const profileResponse = await axios.get(`${baseUrl}users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Log user profile data for debugging
      console.log('User profile data:', profileResponse.data);

      // Extract just the user object from the response
      const userData = extractUserProfile(profileResponse.data);
      dispatch({ type: "LOGIN_SUCCESS", payload: userData });
      // Update last activity time on successful session restore
      await updateLastActivity();
    } catch (error) {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("lastActivityTime");
      dispatch({ type: "LOGOUT" });
    }
  }, [isSessionExpired, updateLastActivity]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const handleAppStateChange = useCallback(
    async (nextAppState) => {
      if (nextAppState === "active") {
        // App came to foreground - check if session expired
        const token = await AsyncStorage.getItem("token");
        if (token) {
          const expired = await isSessionExpired();
          if (expired) {
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("lastActivityTime");
            dispatch({ type: "SESSION_EXPIRED" });
          } else {
            // Session still valid - update last activity
            await updateLastActivity();
          }
        }
      }
    },
    [isSessionExpired, updateLastActivity]
  );

  // Monitor app state changes (foreground/background) to update activity
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      appStateSubscription.remove();
    };
  }, [handleAppStateChange]);

  const login = async (email, password) => {
    dispatch({ type: "LOGIN_START" });
    try {
      const res = await axios.post(`${baseUrl}users/login`, {
        email,
        password,
      });
      // Extract user data and token from response
      const { token, ...responseData } = res.data;
      const userData = extractUserProfile(responseData);
      dispatch({ type: "LOGIN_SUCCESS", payload: userData });
      await AsyncStorage.setItem("token", token);
      // Set initial activity timestamp on login
      await updateLastActivity();
    } catch (error) {
      dispatch({
        type: "LOGIN_FAIL",
        payload: error.response?.data?.message || "Login failed",
      });
    }
  };

  const fetchUser = async (userId, token) => {
    dispatch({ type: "FETCH_USER_START" });
    try {
      const res = await axios.get(`${baseUrl}users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userData = extractUserProfile(res.data);
      dispatch({ type: "FETCH_USER_SUCCESS", payload: userData });
    } catch (error) {
      dispatch({
        type: "FETCH_USER_FAIL",
        payload: error.response?.data?.message || "Failed to fetch user",
      });
    }
  };

  const register = async (userData) => {
    dispatch({ type: "REGISTER_START" });
    try {
      const res = await axios.post(`${baseUrl}users/register`, userData);
      // Extract user data from nested structure
      const userObj = extractUserProfile(res.data);
      dispatch({ type: "REGISTER_SUCCESS", payload: userObj });
      // Set initial activity timestamp on registration if token provided
      if (res.data.token) {
        await AsyncStorage.setItem("token", res.data.token);
        await updateLastActivity();
      }
    } catch (error) {
      dispatch({
        type: "REGISTER_FAIL",
        payload: error.response?.data?.message || "Registration failed",
      });
    }
  };

  const logout = useCallback(async () => {
    dispatch({ type: "LOGOUT" });
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("lastActivityTime");
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, fetchUser, restoreSession, updateLastActivity }}>
      {children}
    </AuthContext.Provider>
  );
};
