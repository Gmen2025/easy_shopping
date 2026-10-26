export const isCashOnDeliveryAvailable = (databaseName) => Boolean(databaseName);

export const isCashOnDeliveryMethod = (value) =>
  value === 1 || value === "1" ||
  ["cash", "cash on delivery"].includes(String(value).trim().toLowerCase());
