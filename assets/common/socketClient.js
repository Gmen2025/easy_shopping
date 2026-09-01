import { io } from "socket.io-client";

import baseUrl from "./baseUrl";

let socketInstance = null;
let socketPromise = null;

// Socket.IO runs on the API host root (baseUrl ends with /api/v1/).
const getSocketUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
  const candidate =
    typeof envUrl === "string" && envUrl.trim() ? envUrl.trim() : baseUrl;

  return candidate
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "")
    .replace(/\/api$/i, "");
};

export const getCustomerSocket = (authToken) => {
  if (socketInstance?.connected) {
    return Promise.resolve(socketInstance);
  }

  if (socketPromise) {
    return socketPromise;
  }

  socketPromise = new Promise((resolve, reject) => {
    const instance = io(getSocketUrl(), {
      transports: ["websocket", "polling"],
      path: "/socket.io",
      auth: authToken ? { token: authToken } : undefined,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 8000,
    });

    instance.on("connect", () => {
      socketInstance = instance;
      resolve(instance);
    });

    instance.on("connect_error", (error) => {
      if (!socketInstance) {
        socketPromise = null;
        reject(error);
      }
    });

    instance.on("disconnect", () => {
      socketInstance = null;
      socketPromise = null;
    });
  });

  return socketPromise;
};

export const disconnectCustomerSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
  }
  socketInstance = null;
  socketPromise = null;
};
