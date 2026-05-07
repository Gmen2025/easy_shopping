import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_DB_NAME = "E_Shopping";
export const ALLOWED_DB_NAMES = ["E_Shopping", "E_Shopping_2", "E_ShopUSA"];
export const DB_STORAGE_KEY = "selectedDatabaseName";

// Maps the country dropdown value to its corresponding database name.
export const COUNTRY_DB_MAP = {
  Ethio: "E_Shopping",
  USA: "E_ShopUSA",
};

export const sanitizeDatabaseName = (name) => {
  if (typeof name !== "string") {
    return DEFAULT_DB_NAME;
  }

  const trimmed = name.trim();
  if (trimmed === "E_ShpUSA" || trimmed === "E_ShopUsA") {
    return "E_ShopUSA";
  }

  if (!trimmed || !ALLOWED_DB_NAMES.includes(trimmed)) {
    return DEFAULT_DB_NAME;
  }

  return trimmed;
};

export const getDatabaseNameFromStorage = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(DB_STORAGE_KEY);
    return sanitizeDatabaseName(storedValue);
  } catch (error) {
    return DEFAULT_DB_NAME;
  }
};

export const setDatabaseNameInStorage = async (name) => {
  const safeName = sanitizeDatabaseName(name);

  try {
    await AsyncStorage.setItem(DB_STORAGE_KEY, safeName);
  } catch (error) {
    // Ignore persistence failures and keep runtime state.
  }

  return safeName;
};
