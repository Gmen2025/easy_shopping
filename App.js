import { StatusBar } from "expo-status-bar";
import { Text, View, StyleSheet } from "react-native";
import { useEffect, useState, useCallback, useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";

//Redux
import { Provider } from "react-redux";
import { store } from "./store/redux/store"; // Adjust the path as necessary

//Context API
import { AuthProvider } from "./Context/store/Auth";
import { AuthContext } from "./Context/store/Auth";
import { StripeProvider } from "@stripe/stripe-react-native";
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

const linking = {
  prefixes: ['easyshopping://'],
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
        console.log("Expo push token:", pushToken);
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
        await syncPushTokenForUser(authContext.user._id, authToken, pushToken);
      }
    };

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
        await syncPushTokenForUser(authContext.user._id, authToken, pushToken);
      }
    };

    syncStoredToken();
  }, [authContext?.user?._id]);

  return null;
};


export default function App() {
  const [dbRefreshKey, setDbRefreshKey] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState([]);

  useEffect(() => {
    attachDatabaseInterceptor();
  }, []);

  const handleDatabaseChanged = useCallback(() => {
    setDbRefreshKey((prevKey) => prevKey + 1);
  }, []);

  const addNotificationItem = useCallback((notification, { increaseUnread = false } = {}) => {
    const title = notification?.request?.content?.title || "New notification";
    const body = notification?.request?.content?.body || "You have a new update";

    const newItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      body,
      receivedAt: new Date().toISOString(),
    };

    setNotificationItems((prevItems) => [newItem, ...prevItems].slice(0, 20));

    if (increaseUnread) {
      setUnreadNotificationCount((prevCount) => prevCount + 1);
    }
  }, []);

  const handleNotificationReceived = useCallback((notification) => {
    addNotificationItem(notification, { increaseUnread: true });
  }, [addNotificationItem]);

  const handleNotificationOpened = useCallback((notification) => {
    addNotificationItem(notification, { increaseUnread: false });
  }, [addNotificationItem]);

  const handleMarkAllNotificationsRead = useCallback(() => {
    setUnreadNotificationCount(0);
  }, []);

  return (
    <AuthProvider>
      <Provider store={store}>
        <StripeProvider publishableKey="pk_test_51SHSJmPIAcOeDqNEp78RzlADjQOLU9wqMNAIRJgKcaNRqbuKSpeUT12SL4ggEGHlJzEnYZv7hBqbb7zdGT6naZQM00nES3vyDJ">
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
