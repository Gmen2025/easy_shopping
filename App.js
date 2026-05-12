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

const NotificationBootstrap = () => {
  const authContext = useContext(AuthContext);

  useEffect(() => {
    let mounted = true;
    let receivedSubscription;
    let responseSubscription;

    const initializeNotifications = async () => {
      const { pushToken } = await registerForPushNotifications();

      receivedSubscription = addNotificationReceivedListener(() => {});
      responseSubscription = addNotificationResponseListener(() => {});

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
  }, [authContext?.user?._id]);

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

  useEffect(() => {
    attachDatabaseInterceptor();
  }, []);

  const handleDatabaseChanged = useCallback(() => {
    setDbRefreshKey((prevKey) => prevKey + 1);
  }, []);

  return (
    <AuthProvider>
      <Provider store={store}>
        <StripeProvider publishableKey="pk_test_51SHSJmPIAcOeDqNEp78RzlADjQOLU9wqMNAIRJgKcaNRqbuKSpeUT12SL4ggEGHlJzEnYZv7hBqbb7zdGT6naZQM00nES3vyDJ">
          <TelebirrProvider>
            <NotificationBootstrap />
            <View style={styles.appContainer}>
              <View style={styles.headerLayer}>
                <Header onDatabaseChanged={handleDatabaseChanged} />
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
