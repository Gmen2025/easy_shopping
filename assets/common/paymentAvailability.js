export const isCashOnDeliveryAvailable = (databaseName, isDevelopment) =>
  databaseName === "E_ShopUSA" || databaseName === "E_ShoppingUSA"
    ? isDevelopment === true
    : true;

export const isCashOnDeliveryMethod = (value) =>
  value === 1 || value === "1" || String(value).trim().toLowerCase() === "cash on delivery";
