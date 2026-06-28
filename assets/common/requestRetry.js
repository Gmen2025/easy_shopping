import axios from "axios";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isServiceUnavailableError = (error) => {
  return Number(error?.response?.status) === 503;
};

const isRetryableError = (error) => {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || "").toUpperCase();

  if (!error?.response) {
    return true;
  }

  if (status >= 500) {
    return true;
  }

  return code === "ECONNABORTED" || code === "ETIMEDOUT";
};

export const getWithRetry = async (
  url,
  axiosConfig = {},
  retryConfig = { retries: 2, delayMs: 800 }
) => {
  const retries = Number(retryConfig?.retries ?? 2);
  const delayMs = Number(retryConfig?.delayMs ?? 800);

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await axios.get(url, axiosConfig);
    } catch (error) {
      lastError = error;

      const shouldRetry = attempt < retries && isRetryableError(error);
      if (!shouldRetry) {
        throw error;
      }

      await sleep(delayMs * (attempt + 1));
    }
  }

  throw lastError;
};
