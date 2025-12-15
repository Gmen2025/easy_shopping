import React, { createContext, useReducer } from "react";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage"; //Store data in the device

export const AuthContext = createContext();

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
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = async (email, password) => {
    dispatch({ type: "LOGIN_START" });
    try {
      const res = await axios.post(`${baseUrl}users/login`, {
        email,
        password,
      });
      dispatch({ type: "LOGIN_SUCCESS", payload: res.data });
      AsyncStorage.setItem("token", res.data.token);
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
      dispatch({ type: "FETCH_USER_SUCCESS", payload: res.data });
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
      dispatch({ type: "REGISTER_SUCCESS", payload: res.data.user });
    } catch (error) {
      dispatch({
        type: "REGISTER_FAIL",
        payload: error.response?.data?.message || "Registration failed",
      });
    }
  };

  const logout = () => {
    dispatch({ type: "LOGOUT" });
    AsyncStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};
