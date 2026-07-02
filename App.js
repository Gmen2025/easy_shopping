import { StatusBar } from "expo-status-bar";
import { Text, View, StyleSheet } from "react-native";
import { useEffect, useState, useCallback, useContext, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

//Redux
import { Provider } from "react-redux";
import { store } from "./store/redux/store"; // Adjust the path as necessary

//Context API
import { AuthProvider } from "./Context/store/Auth";
import { AuthContext } from "./Context/store/Auth";
import { TelebirrProvider } from "./Context/store/Telebirr";

import { Linking } from 'react-native';

//Navigators
import Main from "./Navigators/Main";

import Header from "./Shared/Header";
import { attachDatabaseInterceptor } from "./assets/common/attachDatabaseInterceptor";
import {
  registerForPushNotifications,
  getStoredPushToken,
  syncPushTokenForUser,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  removeNotificationSubscription,
} from "./assets/common/notifications";

const NOTIFICATION_ITEMS_STORAGE_KEY = "notification_items";

const getStripePublishableKey = () => {
  const configKey = Constants?.expoConfig?.extra?.stripePublishableKey;
  const envKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return typeof configKey === "string" && configKey.trim()
    ? configKey
    : typeof envKey === "string"
    ? envKey
    : "";
};

const isExpoGo = () => {
  return (
    Constants?.appOwnership === "expo" ||
    Constants?.executionEnvironment === "storeClient"
  );
};

const isValidStripePublishableKey = (key) => {
  const normalized = typeof key === "string" ? key.trim() : "";
  return normalized.startsWith("pk_");
};

const createStripeProvider = (publishableKey) => {
  if (isExpoGo()) {
    return ({ children }) => children;
  }

  if (!isValidStripePublishableKey(publishableKey)) {
    console.warn("Stripe provider disabled: missing or invalid publishable key.");
    return ({ children }) => children;
  }

  try {
    return require("@stripe/stripe-react-native").StripeProvider;
  } catch (error) {
    console.warn("Stripe provider unavailable:", error?.message || error);
    return ({ children }) => children;
  }
};

const stripePublishableKey =
  getStripePublishableKey();
const StripeProvider = createStripeProvider(stripePublishableKey);

const linking = {
  prefixes: ['addugeneteshop://', 'easyshopping://'],
  config: {
    screens: {
      PaymentSuccess: 'payment-success',
      PaymentCancel: 'payment-cancel',
    },
  },
};

const NotificationBootstrap = ({ onNotificationReceived, onNotificationOpened }) => {
  const authContext = useContext(AuthContext);
  const [setupShown, setSetupShown] = useState(false);

  useEffect(() => {
    let mounted = true;
    let receivedSubscription;
    let responseSubscription;

    const initializeNotifications = async () => {
      const { pushToken, error } = await registerForPushNotifications();

      if (error && !setupShown) {
        Toast.show({
          type: "error",
          text1: "Notifications inactive",
          text2: error,
        });
        setSetupShown(true);
      }

      if (pushToken) {
        if (!setupShown) {
          Toast.show({
            type: "success",
            text1: "Notifications enabled",
            text2: "Push token registered on this device",
          });
          setSetupShown(true);
        }
      }

      receivedSubscription = addNotificationReceivedListener((notification) => {
        const title = notification?.request?.content?.title || "New notification";
        const body = notification?.request?.content?.body || "You received an update";

        if (typeof onNotificationReceived === "function") {
          onNotificationReceived(notification);
        }

        Toast.show({
          type: "info",
          text1: title,
          text2: body,
          visibilityTime: 4000,
        });
      });

      responseSubscription = addNotificationResponseListener((response) => {
        const title = response?.notification?.request?.content?.title || "Notification opened";

        if (typeof onNotificationOpened === "function") {
          onNotificationOpened(response?.notification);
        }

        Toast.show({
          type: "success",
          text1: title,
          text2: "Opened from notification",
          visibilityTime: 3000,
        });
      });

      if (!mounted || !pushToken || !authContext?.user?._id) {
        return;
      }

      const authToken = await AsyncStorage.getItem("token");
      if (authToken) {
        const syncResult = await syncPushTokenForUser(authContext.user._id, authToken, pushToken);
        if (!syncResult?.ok) {
          console.warn("Push token sync result:", syncResult);
          Toast.show({
            type: "error",
            text1: "Push token sync failed",
            text2: syncResult?.message || "Backend rejected push token",
          });
        }
      }
    };

    //purpose is to ensure that the push token is registered and listeners are set up as soon as the app starts, 
    // so that the app can receive notifications even if the user hasn't logged in yet. 
    // The token will be synced with the server once the user logs in and we have their user ID and auth token available.
    initializeNotifications();

    return () => {
      mounted = false;
      removeNotificationSubscription(receivedSubscription);
      removeNotificationSubscription(responseSubscription);
    };
  }, [authContext?.user?._id, onNotificationOpened, onNotificationReceived, setupShown]);

  useEffect(() => {
    const syncStoredToken = async () => {
      if (!authContext?.user?._id) {
        return;
      }

      const authToken = await AsyncStorage.getItem("token");
      const pushToken = await getStoredPushToken();

      if (authToken && pushToken) {
        const syncResult = await syncPushTokenForUser(authContext.user._id, authToken, pushToken);
        if (!syncResult?.ok) {
          console.warn("Stored push token sync result:", syncResult);
        }
      }
    };

    syncStoredToken();
  }, [authContext?.user?._id]);

  return null;
};


export default function App() {
  const [dbRefreshKey, setDbRefreshKey] = useState(0);
  const [notificationItems, setNotificationItems] = useState([]);
  const [notificationsHydrated, setNotificationsHydrated] = useState(false);
  const lastSavedNotificationsJson = useRef(null);

  useEffect(() => {
    attachDatabaseInterceptor();
  }, []);

  useEffect(() => {
    const hydrateNotifications = async () => {
      try {
        const savedNotifications = await AsyncStorage.getItem(NOTIFICATION_ITEMS_STORAGE_KEY);
        if (savedNotifications) {
          const parsedNotifications = JSON.parse(savedNotifications);
          if (Array.isArray(parsedNotifications)) {
            setNotificationItems(parsedNotifications.slice(0, 20));
            lastSavedNotificationsJson.current = savedNotifications;
          }
        }
      } catch (error) {
        console.warn("Failed to load saved notifications:", error?.message || error);
      } finally {
        setNotificationsHydrated(true);
      }
    };

    // This will load the most recent notifications from storage when the app starts, 
    // ensuring that the user sees their notifications even if they were received while the app was closed.
    hydrateNotifications();
  }, []);

  useEffect(() => {
    if (!notificationsHydrated) {
      return;
    }

    const payload = JSON.stringify(notificationItems.slice(0, 20));
    if (payload === lastSavedNotificationsJson.current) {
      return;
    }

    lastSavedNotificationsJson.current = payload;
    AsyncStorage.setItem(NOTIFICATION_ITEMS_STORAGE_KEY, payload).catch((error) => {
      console.warn("Failed to save notifications:", error?.message || error);
    });
  }, [notificationItems, notificationsHydrated]);

  const handleDatabaseChanged = useCallback(() => {
    setDbRefreshKey((prevKey) => prevKey + 1);
  }, []);

  const addNotificationItem = useCallback((notification, { increaseUnread = false } = {}) => {
    const title = notification?.request?.content?.title || "New notification";
    const body = notification?.request?.content?.body || "You have a new update";
    const notificationId =
      notification?.request?.identifier ||
      notification?.request?.content?.data?.orderId ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const newItem = {
      id: notificationId,
      title,
      body,
      receivedAt: new Date().toISOString(),
      isRead: !increaseUnread,
    };

    setNotificationItems((prevItems) => [newItem, ...prevItems].slice(0, 20));
  }, []);

  const handleNotificationReceived = useCallback((notification) => {
    addNotificationItem(notification, { increaseUnread: true });
  }, [addNotificationItem]);

  const handleNotificationOpened = useCallback((notification) => {
    addNotificationItem(notification, { increaseUnread: false });
  }, [addNotificationItem]);

  const handleMarkNotificationRead = useCallback((notificationId) => {
    setNotificationItems((prevItems) =>
      prevItems.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item
      )
    );
  }, []);

  const handleDeleteNotification = useCallback((notificationId) => {
    setNotificationItems((prevItems) =>
      prevItems.filter((item) => item.id !== notificationId)
    );
  }, []);

  const handleMarkAllNotificationsRead = useCallback(() => {
    setNotificationItems((prevItems) =>
      prevItems.map((item) => ({ ...item, isRead: true }))
    );
  }, []);

  const unreadNotificationCount = notificationItems.filter(
    (item) => !item.isRead
  ).length;

  return (
    <AuthProvider>
      <Provider store={store}>
        <StripeProvider publishableKey={stripePublishableKey}>
          <TelebirrProvider>
            <NotificationBootstrap
              onNotificationReceived={handleNotificationReceived}
              onNotificationOpened={handleNotificationOpened}
            />
            <View style={styles.appContainer}>
              <View style={styles.headerLayer}>
                <Header
                  onDatabaseChanged={handleDatabaseChanged}
                  notificationCount={unreadNotificationCount}
                  notifications={notificationItems}
                  onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
                  onMarkNotificationRead={handleMarkNotificationRead}
                  onDeleteNotification={handleDeleteNotification}
                />
              </View>
              <View style={styles.navLayer}>
                <NavigationContainer key={`db-${dbRefreshKey}`} linking={linking}>
                  <Main />
                  <Toast />
                </NavigationContainer>
              </View>
            </View>
          </TelebirrProvider>
        </StripeProvider>
      </Provider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  headerLayer: {
    width: "100%",
    zIndex: 1000,
    elevation: 1000,
  },
  navLayer: {
    flex: 1,
    zIndex: 1,
    elevation: 1,
  },
});
