import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";

export const SERVICE_LABELS = { rides: "Ride service", services: "Service requests", financialHealth: "Financial Health" };

export function validateServiceAvailability(data) {
  if (Object.keys(SERVICE_LABELS).some((key) => typeof data?.[key] !== "boolean") ||
      (data.testingAccess !== undefined && typeof data.testingAccess !== "boolean")) {
    throw new Error("Service availability could not be verified. Please retry.");
  }
  return data;
}

export const effectiveServiceAvailability = (data) => ({
  ...data, ...Object.fromEntries(Object.keys(SERVICE_LABELS).map((key) => [key, data[key] || data.testingAccess === true])),
});

export async function serviceAvailabilityRequest(database, features) {
  const selectedDatabase = database || await getDatabaseNameFromStorage();
  const token = await AsyncStorage.getItem("token");
  const response = await axios({
    url: `${baseUrl}settings/service-availability`,
    method: features ? "put" : "get", data: features, timeout: 20000,
    headers: { "x-database-name": selectedDatabase, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return validateServiceAvailability(response.data);
}
