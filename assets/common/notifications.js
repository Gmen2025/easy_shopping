import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import baseUrl from "./baseUrl";

const PUSH_TOKEN_STORAGE_KEY = "expo_push_token";

// Configure incoming notification behavior (e.g. show alert, play sound, etc.)
// By default, notifications received while the app is in the foreground will not show an alert, play a sound, or set a badge.
//  This configuration ensures that all notifications will trigger these behaviors regardless of the app state.
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
  // appOwnership can be unreliable across SDK/runtime combos.
  // executionEnvironment=storeClient is the most reliable Expo Go signal.
  return (
    Constants?.appOwnership === "expo" ||
    Constants?.executionEnvironment === "storeClient"
  );
};

// Android requires a notification channel to be set up for notifications to work properly.
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

// Register the device for push notifications and return the token or an error message.
export const registerForPushNotifications = async () => {
  try {
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

    // The returned token is an Expo push token that can be used with Expo's push notification service.
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenResponse?.data || null;

    console.log("[PUSH_TOKEN_FOR_EXPO]", pushToken);

    if (pushToken) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);
    }

    return { pushToken, error: null };
  } catch (error) {
    const message = error?.message || String(error);
    console.warn("Push registration failed:", message);
    return { pushToken: null, error: `Push setup failed: ${message}` };
  }
};

export const getStoredPushToken = async () => {
  return AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
};

export const syncPushTokenForUser = async (userId, authToken, pushToken) => {
  if (!userId || !authToken || !pushToken) {
    return { ok: false, message: "Missing user/auth/push token" };
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
      const text = await primaryResponse.text();
      return {
        ok: false,
        message: `Push token sync failed (${primaryResponse.status})`,
        details: text,
      };
    }

    if (primaryResponse.ok) {
      return { ok: true, route: "users/:id/push-token" };
    }

    const fallbackResponse = await fetch(`${baseUrl}users/${userId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ expoPushToken: pushToken }),
    });

    if (!fallbackResponse.ok) {
      const text = await fallbackResponse.text();
      return {
        ok: false,
        message: `Push token fallback sync failed (${fallbackResponse.status})`,
        details: text,
      };
    }

    return { ok: true, route: "users/:id" };
  } catch (error) {
    console.warn("Push token sync failed:", error?.message || error);
    return { ok: false, message: error?.message || String(error) };
  }
};

// This function can be used in the app's main component to sync the stored push token 
// with the server whenever the user logs in or the app starts.
// The listener will be called whenever a notification is received while the app is in the foreground (application open). 
export const addNotificationReceivedListener = (listener) => {
  return Notifications.addNotificationReceivedListener((notification) => {
    console.log(
      "Notification received while app is running:",
      JSON.stringify(notification?.request?.content || {}, null, 2)
    );

    if (typeof listener === "function") {
      listener(notification);
    }
  });
};


// The listener will be called whenever a notification response is received (e.g., when the user taps on a notification).
export const addNotificationResponseListener = (listener) => {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    console.log(
      "Notification response: user interacted with notification",
      JSON.stringify(response?.notification?.request?.content || {}, null, 2)
    );

    if (typeof listener === "function") {
      listener(response);
    }
  });
};

// Use the returned subscription object to remove the listener when it's no longer needed.
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
