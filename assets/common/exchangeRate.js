import { apiRequest } from "./storefront";

export const exchangeRequest = (path = "", options) => apiRequest("exchange-rate", path, options);
export const rateIsActive = (state, now = Date.now()) => Boolean(state?.active && state?.enabled &&
  Number.isFinite(state.birrPerUsd) && state.birrPerUsd > 0 && new Date(state.appliedAt).getTime() <= now &&
  new Date(state.expiresAt).getTime() > now);
export const usdAmount = (etb, rate) => Math.round(Number(etb) / rate * 100) / 100;
export const usdText = (amount) => `USD $${Number(amount).toFixed(2)}`;
export const birrAmount = (usd, rate) => Math.round(Number(usd) * rate * 100) / 100;
export const etbText = (amount) => `ETB ${Number(amount).toFixed(2)}`;
export const paymentText = (value) => value.exchangeRate?.direction === "usd-to-etb" ? etbText(value.paymentAmount) : usdText(value.paymentAmount);
export const exportInactiveMessage = "Birr checkout for US products shipped to Ethiopia is inactive because the daily exchange rate is not current. Please wait until Admin applies an updated rate.";
export const usdInactiveMessage = "USD purchasing is temporarily inactive because the current exchange rate has not been updated within 24 hours. Please wait until Admin applies an updated rate.";
