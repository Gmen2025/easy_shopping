import axios from "axios";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";

let interceptorAttached = false;

const isApiRequest = (requestUrl) => {
  if (typeof requestUrl !== "string") {
    return false;
  }

  return requestUrl.startsWith(baseUrl);
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

    const dbName = await getDatabaseNameFromStorage();

    config.headers = {
      ...(config.headers || {}),
      "x-database-name": dbName,
    };

    config.url = appendDbQuery(config.url, dbName);

    const method = (config.method || "get").toLowerCase();
    if (!["get", "head", "options"].includes(method)) {
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

    if (!["GET", "HEAD", "OPTIONS"].includes(requestMethod)) {
      requestInit.body = attachDatabaseNameToJsonBody(init.body, dbName);
    }

    const requestUrlWithDb = appendDbQuery(requestUrl, dbName);
    return originalFetch(requestUrlWithDb, requestInit);
  };
};
