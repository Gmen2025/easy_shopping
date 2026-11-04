import { apiRequest } from "./storefront";

export const parseCatalogCoordinates = (latitude, longitude) => {
  if (String(latitude ?? "").trim() === "" || String(longitude ?? "").trim() === "") {
    throw new Error("Enter both latitude and longitude, or use your current location.");
  }
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  if (!Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 ||
      !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) {
    throw new Error("Latitude must be between -90 and 90; longitude between -180 and 180.");
  }
  return point;
};

const validateSettings = (data) => {
  if (typeof data?.nearestStorePricingEnabled !== "boolean") {
    throw new Error("Catalog pricing settings could not be verified. Please retry.");
  }
  return data;
};

export const getCatalogSettings = async () =>
  validateSettings(await apiRequest("products", "catalog-settings"));

export const saveCatalogSettings = async (enabled) =>
  validateSettings(await apiRequest("products", "catalog-settings", {
    method: "put", data: { nearestStorePricingEnabled: enabled },
  }));

export const getNearestStoreProduct = async (productId, coordinates) => {
  const point = parseCatalogCoordinates(coordinates.latitude, coordinates.longitude);
  const result = await apiRequest("products",
    `${encodeURIComponent(productId)}/nearest-store?latitude=${point.latitude}&longitude=${point.longitude}`);
  if (!result?.product?.storefrontId || !result?.store?._id ||
      String(result.product._id) !== String(productId) || result.product.inventoryManaged !== true ||
      String(result.product.storefrontId) !== String(result.store._id) ||
      !Number.isFinite(result.product.price) || result.product.price < 0 ||
      !Number.isFinite(result.product.countInStock) || result.product.countInStock <= 0 ||
      !Number.isFinite(result.distanceKm) || result.distanceKm < 0) {
    throw new Error("The nearest store returned an invalid price or stock. Please retry.");
  }
  return result;
};

export const requiresStoreSelection = (items, enabled) =>
  enabled && items.some((item) => !item.storefrontId);

export const catalogNotificationWarning = (data) => {
  const warnings = data?.notificationWarnings;
  return data?.notification?.error ||
    (warnings?.length ? "Saved, but some change notifications failed. Contact Admin." : "");
};
