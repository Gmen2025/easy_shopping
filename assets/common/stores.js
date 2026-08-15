import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "./baseUrl";

const STORES_STORAGE_KEY = "registered_stores";

export const haversineDistanceKm = (start, end) => {
  if (!start || !end || start.latitude == null || start.longitude == null || end.latitude == null || end.longitude == null) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(end.latitude - start.latitude);
  const dLon = toRad(end.longitude - start.longitude);
  const lat1 = toRad(start.latitude);
  const lat2 = toRad(end.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const normalizeStore = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const latitude = Number(payload.latitude ?? payload.location?.latitude ?? payload.coords?.latitude);
  const longitude = Number(payload.longitude ?? payload.location?.longitude ?? payload.coords?.longitude);

  return {
    _id: payload._id || payload.id || `store-${Date.now()}`,
    id: payload.id || payload._id || `store-${Date.now()}`,
    name: payload.name || payload.storeName || "Store",
    ownerName: payload.ownerName || payload.owner?.name || payload.ownerName || "",
    ownerEmail: payload.ownerEmail || payload.owner?.email || "",
    address: payload.address || payload.street || payload.location?.address || "",
    city: payload.city || payload.location?.city || "",
    country: payload.country || payload.location?.country || "",
    phone: payload.phone || payload.contactPhone || "",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    isActive: payload.isActive !== false,
    createdAt: payload.createdAt || new Date().toISOString(),
    raw: payload,
  };
};

export const saveStores = async (stores) => {
  try {
    const payload = Array.isArray(stores) ? stores : [];
    await AsyncStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(payload));
    return payload;
  } catch (error) {
    console.warn("Unable to save stores locally:", error);
    return [];
  }
};

export const getStoredStores = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORES_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeStore).filter(Boolean) : [];
  } catch (error) {
    console.warn("Unable to read stores locally:", error);
    return [];
  }
};

export const fetchStores = async (token = null) => {
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const response = await axios.get(`${baseUrl}stores`, config);
    const storeList = Array.isArray(response?.data)
      ? response.data
      : response?.data?.stores || response?.data?.data || [];
    const normalized = storeList.map(normalizeStore).filter(Boolean);
    await saveStores(normalized);
    return normalized;
  } catch (error) {
    return getStoredStores();
  }
};

export const getNearbyStores = async (customerLocation, token = null) => {
  const stores = await fetchStores(token);
  const activeStores = stores.filter((store) => store.isActive !== false);

  if (!customerLocation || customerLocation.latitude == null || customerLocation.longitude == null) {
    return activeStores;
  }

  return activeStores
    .map((store) => ({
      ...store,
      distanceKm: haversineDistanceKm(customerLocation, {
        latitude: store.latitude,
        longitude: store.longitude,
      }),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm);
};

export const findNearestStore = async (customerLocation, token = null) => {
  const nearby = await getNearbyStores(customerLocation, token);
  return nearby[0] || null;
};

export const buildStoreAssignmentPayload = async (customerLocation, token = null) => {
  const nearestStore = await findNearestStore(customerLocation, token);
  const location = customerLocation && customerLocation.latitude != null && customerLocation.longitude != null
    ? {
        latitude: Number(customerLocation.latitude),
        longitude: Number(customerLocation.longitude),
      }
    : null;

  return {
    pickupStore: nearestStore
      ? {
          id: nearestStore.id,
          _id: nearestStore._id,
          name: nearestStore.name,
          address: nearestStore.address,
          city: nearestStore.city,
          country: nearestStore.country,
          phone: nearestStore.phone,
          latitude: nearestStore.latitude,
          longitude: nearestStore.longitude,
        }
      : null,
    pickupStoreId: nearestStore?._id || nearestStore?.id || null,
    storeId: nearestStore?._id || nearestStore?.id || null,
    assignedStoreId: nearestStore?._id || nearestStore?.id || null,
    pickupStoreName: nearestStore?.name || null,
    storeLocation: nearestStore
      ? {
          latitude: nearestStore.latitude,
          longitude: nearestStore.longitude,
        }
      : null,
    customerLocation: location,
    storeAssignment: nearestStore
      ? {
          storeId: nearestStore._id || nearestStore.id,
          pickupStoreId: nearestStore._id || nearestStore.id,
          storeName: nearestStore.name,
          address: nearestStore.address,
          city: nearestStore.city,
          country: nearestStore.country,
          phone: nearestStore.phone,
          coordinates: {
            latitude: nearestStore.latitude,
            longitude: nearestStore.longitude,
          },
          assignedAt: new Date().toISOString(),
        }
      : null,
    storeAssignmentStatus: nearestStore ? "assigned" : "unassigned",
  };
};
