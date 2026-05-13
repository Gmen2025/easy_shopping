import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import baseUrl from "./baseUrl";

const PUSH_TOKEN_STORAGE_KEY = "expo_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const getProjectId = () => {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  );
};

const isExpoGo = () => {
  return Constants?.appOwnership === "expo";
};

const setupAndroidChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1a237e",
  });
};

export const registerForPushNotifications = async () => {
  await setupAndroidChannel();

  if (isExpoGo()) {
    return {
      pushToken: null,
      error:
        "Remote push notifications are not supported in Expo Go (SDK 53+). Use a development build.",
    };
  }

  if (!Device.isDevice) {
    return { pushToken: null, error: "Physical device is required" };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return { pushToken: null, error: "Notification permission not granted" };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return { pushToken: null, error: "Missing EAS projectId in app config" };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const pushToken = tokenResponse?.data || null;

  if (pushToken) {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);
  }

  return { pushToken, error: null };
};

export const getStoredPushToken = async () => {
  return AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
};

export const syncPushTokenForUser = async (userId, authToken, pushToken) => {
  if (!userId || !authToken || !pushToken) {
    return false;
  }

  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    };

    const primaryResponse = await fetch(`${baseUrl}users/${userId}/push-token`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ pushToken }),
    });

    if (!primaryResponse.ok && primaryResponse.status !== 404) {
      return false;
    }

    if (primaryResponse.ok) {
      return true;
    }

    const fallbackResponse = await fetch(`${baseUrl}users/${userId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ expoPushToken: pushToken }),
    });

    if (!fallbackResponse.ok) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Push token sync failed:", error?.message || error);
    return false;
  }
};

export const addNotificationReceivedListener = (listener) => {
  return Notifications.addNotificationReceivedListener(listener);
};

export const addNotificationResponseListener = (listener) => {
  return Notifications.addNotificationResponseReceivedListener(listener);
};

export const removeNotificationSubscription = (subscription) => {
  if (subscription) {
    if (typeof subscription.remove === "function") {
      subscription.remove();
      return;
    }

    if (typeof Notifications.removeNotificationSubscription === "function") {
      Notifications.removeNotificationSubscription(subscription);
    }
  }
};
