import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";

export const SERVICE_LABELS = { rides: "Ride service", services: "Service requests" };

export function validateServiceAvailability(data) {
  if (typeof data?.rides !== "boolean" || typeof data?.services !== "boolean") {
    throw new Error("Service availability could not be verified. Please retry.");
  }
  return data;
}

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
