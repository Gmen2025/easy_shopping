import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { NavigationContainer } from "@react-navigation/native";
import Toast from "react-native-toast-message";

//Redux
import { Provider } from "react-redux";
import { store } from "./store/redux/store"; // Adjust the path as necessary

//Context API
import { AuthProvider } from "./Context/store/Auth";
import { StripeProvider } from "@stripe/stripe-react-native";
import { TelebirrProvider } from "./Context/store/Telebirr";

import { Linking } from 'react-native';

//Navigators
import Main from "./Navigators/Main";

import Header from "./Shared/Header";
import { attachDatabaseInterceptor } from "./assets/common/attachDatabaseInterceptor";

const linking = {
  prefixes: ['easyshopping://'],
  config: {
    screens: {
      PaymentSuccess: 'payment-success',
      PaymentCancel: 'payment-cancel',
    },
  },
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
            <Header onDatabaseChanged={handleDatabaseChanged} />
            <NavigationContainer key={`db-${dbRefreshKey}`} linking={linking}>
              <Main />
              <Toast />
            </NavigationContainer>
          </TelebirrProvider>
        </StripeProvider>
      </Provider>
    </AuthProvider>
  );
}
