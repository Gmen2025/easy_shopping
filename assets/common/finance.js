import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";

export async function financeRequest(path, { method = "get", data } = {}) {
  const result = await operatorRequest(`finance/${path}`, { method, data });
  if (/^accounts\/(driver|store)\/[^/]+$/.test(path)) validateDepositWallet(result.wallet, result.account?.depositPolicy);
  return result;
}

export function validateDepositWallet(wallet, policy) {
  if (!wallet || typeof wallet.enabled !== "boolean" || !["ETB", "USD"].includes(wallet.currency) ||
      !Number.isFinite(wallet.balance) || !["off", "healthy", "low", "blocked"].includes(wallet.state) ||
      !Array.isArray(wallet.transactions) || !Array.isArray(wallet.legacyTransactions) || !Array.isArray(wallet.bankAccounts) ||
      !["bank", "card", "telebirr"].every((method) => typeof wallet.methods?.[method] === "boolean") ||
      typeof policy?.enabled !== "boolean" || !Number.isFinite(policy.lowBalance) ||
      !Number.isFinite(policy.minimumBalance) || policy.minimumBalance < 0 || policy.lowBalance <= policy.minimumBalance) {
    throw new Error("The server returned incomplete deposit wallet data.");
  }
  return wallet;
}

export async function operatorRequest(path, { method = "get", data } = {}) {
  const [token, database] = await Promise.all([AsyncStorage.getItem("token"), getDatabaseNameFromStorage()]);
  if (!token) throw new Error("Sign in to view financial information.");
  const response = await axios({
    url: `${baseUrl}${path}`, method, data, timeout: 30000,
    headers: { Authorization: `Bearer ${token}`, "x-database-name": database },
  });
  return response.data;
}

export const financeMoney = (value, currency) => `${currency} ${Number(value).toFixed(2)}`;
export const financeError = (error) => error?.response?.data?.error?.message || error?.response?.data?.message || error.message || "Unable to complete the request.";
