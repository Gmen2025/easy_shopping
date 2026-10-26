import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";

export const PAYMENT_LABELS = { cash: "Cash on delivery / cash to driver", bank: "Bank transfer", card: "Card", telebirr: "Telebirr" };
export const PAYMENT_UNAVAILABLE = "Payment is temporarily unavailable. Please try again later.";

export function parsePaymentSettings(data) {
  if (data?.success !== true || Object.keys(PAYMENT_LABELS).some((key) => typeof data.methods?.[key] !== "boolean")) {
    throw new Error("Unable to load payment availability. Please try again.");
  }
  return data.methods;
}

export async function paymentSettings(database, methods) {
  const db = database || await getDatabaseNameFromStorage();
  const token = await AsyncStorage.getItem("token");
  const response = await axios({
    url: `${baseUrl}settings/payment-methods`, method: methods ? "put" : "get",
    ...(methods ? { data: { methods } } : {}), timeout: 20000,
    headers: { "x-database-name": db, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return parsePaymentSettings(response.data);
}
