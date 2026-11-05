import { apiRequest } from "./storefront";

const validate = (data) => {
  if (typeof data?.enabled !== "boolean") {
    throw new Error("Financial Health availability could not be verified. Please retry.");
  }
  return data;
};

export const getFinancialHealthSettings = async () =>
  validate(await apiRequest("settings", "financial-health"));

export const saveFinancialHealthSettings = async (enabled) =>
  validate(await apiRequest("settings", "financial-health", { method: "put", data: { enabled } }));
