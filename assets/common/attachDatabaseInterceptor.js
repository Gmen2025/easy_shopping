import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";

let interceptorAttached = false;

const isApiRequest = (requestUrl) => {
  if (typeof requestUrl !== "string") {
    return false;
  }

  return requestUrl.startsWith(baseUrl);
};

const isPublicShoppingRead = (requestUrl, method) => {
  if (method !== "get") return false;
  const path = requestUrl.slice(baseUrl.length).split(/[?#]/)[0];
  return /^(?:products|categories)(?:\/|$)/i.test(path) ||
    /^stores\/directory(?:\/|$)/i.test(path) ||
    /^settings\/bank-account\/?$/i.test(path);
};

const headerValue = (headers, name) => {
  const key = Object.keys(headers || {}).find((item) => item.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
};

const hasStrictRequestBody = (requestUrl) => {
  const path = requestUrl.split(/[?#]/)[0];
  return path === `${baseUrl}reviews` || path.startsWith(`${baseUrl}reviews/`) ||
    path === `${baseUrl}cloudinary/sign` || path === `${baseUrl}cloudinary/sign/` ||
    path === `${baseUrl}settings/service-availability` || path === `${baseUrl}settings/service-availability/` ||
    path === `${baseUrl}settings/testing-access` || path === `${baseUrl}settings/testing-access/` ||
    path === `${baseUrl}settings/maintenance` || path === `${baseUrl}settings/maintenance/` ||
    path === `${baseUrl}settings/usa-availability` || path === `${baseUrl}settings/usa-availability/` ||
    path === `${baseUrl}settings/financial-health` || path === `${baseUrl}settings/financial-health/` ||
    path === `${baseUrl}rides/me/customer-profile` || path === `${baseUrl}rides/me/customer-profile/`;
};

const appendDbQuery = (requestUrl, dbName) => {
  if (typeof requestUrl !== "string" || !requestUrl) {
    return requestUrl;
  }

  if (/([?&])db=/.test(requestUrl)) {
    return requestUrl;
  }

  const separator = requestUrl.includes("?") ? "&" : "?";
  return `${requestUrl}${separator}db=${encodeURIComponent(dbName)}`;
};

const attachDatabaseNameToJsonBody = (body, dbName) => {
  if (!body) {
    return body;
  }

  if (typeof body === "object" && !Array.isArray(body)) {
    if (Object.prototype.hasOwnProperty.call(body, "databaseName")) {
      return body;
    }

    return {
      ...body,
      databaseName: dbName,
    };
  }

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (Object.prototype.hasOwnProperty.call(parsed, "databaseName")) {
          return body;
        }

        return JSON.stringify({
          ...parsed,
          databaseName: dbName,
        });
      }
    } catch (error) {
      return body;
    }
  }

  return body;
};

export const attachDatabaseInterceptor = () => {
  if (interceptorAttached) {
    return;
  }

  interceptorAttached = true;

  axios.interceptors.request.use(async (config) => {
    const requestUrl = `${config.baseURL || ""}${config.url || ""}`;

    if (!isApiRequest(requestUrl)) {
      return config;
    }

    const selectedDatabase = await getDatabaseNameFromStorage();
    const dbName = headerValue(config.headers, "x-database-name") || selectedDatabase;
    const method = (config.method || "get").toLowerCase();
    const authorization = headerValue(config.headers, "authorization");

    config.headers = {
      ...(config.headers || {}),
      "x-database-name": dbName,
    };

    if (authorization === undefined && dbName === selectedDatabase && isPublicShoppingRead(requestUrl, method)) {
      const token = await AsyncStorage.getItem("token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }

    config.url = appendDbQuery(config.url, dbName);

    if (!["get", "head", "options"].includes(method) && !hasStrictRequestBody(requestUrl)) {
      config.data = attachDatabaseNameToJsonBody(config.data, dbName);
    }

    return config;
  });

  const originalFetch = global.fetch;
  global.fetch = async (input, init = {}) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input && typeof input.url === "string"
        ? input.url
        : "";

    if (!isApiRequest(requestUrl)) {
      return originalFetch(input, init);
    }

    const dbName = await getDatabaseNameFromStorage();
    const requestMethod =
      (init.method || (input && input.method) || "GET").toUpperCase();

    const requestHeaders = {
      ...(input && typeof input.headers === "object" ? input.headers : {}),
      ...(init.headers || {}),
      "x-database-name": dbName,
    };

    const requestInit = {
      ...init,
      headers: requestHeaders,
      body: init.body,
    };

    if (!["GET", "HEAD", "OPTIONS"].includes(requestMethod) && !hasStrictRequestBody(requestUrl)) {
      requestInit.body = attachDatabaseNameToJsonBody(init.body, dbName);
    }

    const requestUrlWithDb = appendDbQuery(requestUrl, dbName);
    return originalFetch(requestUrlWithDb, requestInit);
  };
};
