import { DEFAULT_DB_NAME, sanitizeDatabaseName } from "./databaseConfig";

export const cartItemKey = (item) => [
  sanitizeDatabaseName(item.databaseName || item.dbName || DEFAULT_DB_NAME),
  String(item._id || item.id),
  String(item.storefrontId || ""),
  String(Math.round(Number(item.price) * 100)),
].join(":");
