import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";

const DELIVERY_SETTINGS_CACHE_PREFIX = "deliverySettings:";

const getDeliverySettingsCacheKey = async () => {
  const databaseName = await getDatabaseNameFromStorage();
  return `${DELIVERY_SETTINGS_CACHE_PREFIX}${databaseName}`;
};

export const cacheDeliverySettings = async (deliveryConfig) => {
  if (!deliveryConfig || typeof deliveryConfig !== "object") {
    return;
  }

  const cacheKey = await getDeliverySettingsCacheKey();
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ deliveryConfig }));
};

const getCachedDeliverySettings = async () => {
  try {
    const cacheKey = await getDeliverySettingsCacheKey();
    const cachedValue = await AsyncStorage.getItem(cacheKey);
    return cachedValue ? JSON.parse(cachedValue) : null;
  } catch (error) {
    return null;
  }
};

const getOrderId = (order) =>
  order?.orderId || order?._id || order?.rawPayload?.orderId || order?.rawPayload?._id;

export const formatScheduledDeliveryDate = (order) => {
  const value =
    order?.scheduledDeliveryDate ||
    order?.scheduledFor ||
    order?.scheduledDate ||
    order?.rawPayload?.scheduledDeliveryDate ||
    order?.rawPayload?.scheduledFor;
  if (!value) {
    return null;
  }

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsedDate = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
        12
      )
    : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const updateDeliveryStatus = async (order, deliveryStatus) => {
  const orderId = getOrderId(order);
  const token = await AsyncStorage.getItem("token");

  if (!orderId || !token) {
    throw new Error("Missing order or driver authentication");
  }

  const response = await fetch(`${baseUrl}orders/${orderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ deliveryStatus }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || `Delivery update failed (${response.status})`);
  }

  return response.json();
};

// Admin-adjustable delivery fee rates (base fees, per-km rates, etc.), same source the
// AdduGenetE_Shop admin dashboard writes to.
export const getDeliverySettings = async ({ token, allowCached = true } = {}) => {
  try {
    const response = await axios.get(`${baseUrl}settings/delivery`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 10000,
    });
    await cacheDeliverySettings(response.data?.deliveryConfig);
    return response.data;
  } catch (error) {
    if (allowCached) {
      return getCachedDeliverySettings();
    }

    throw error;
  }
};

// Asks the server to compute driving distance via the Google Distance Matrix API (server-side
// key). Prefers the assigned store's own address as the origin; falls back to the admin's
// single hub address. Returns null if the API isn't configured or the lookup fails, in which
// case callers should fall back to a straight-line (haversine) estimate.
export const estimateDeliveryDistanceKm = async ({ destinationAddress, storeId } = {}) => {
  if (!destinationAddress) {
    return null;
  }

  try {
    const response = await axios.post(
      `${baseUrl}settings/delivery/estimate-distance`,
      { destinationAddress, storeId },
      { timeout: 10000 }
    );
    return Number.isFinite(response.data?.distanceKm) ? response.data.distanceKm : null;
  } catch (error) {
    return null;
  }
};
