import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";

export async function financeRequest(path, { method = "get", data } = {}) {
  const [token, database] = await Promise.all([AsyncStorage.getItem("token"), getDatabaseNameFromStorage()]);
  if (!token) throw new Error("Sign in to view financial information.");
  const response = await axios({
    url: `${baseUrl}finance/${path}`, method, data, timeout: 30000,
    headers: { Authorization: `Bearer ${token}`, "x-database-name": database },
  });
  return response.data;
}

export const financeMoney = (value, currency) => `${currency} ${Number(value).toFixed(2)}`;
export const financeError = (error) => error?.response?.data?.message || error.message || "Unable to complete the request.";
