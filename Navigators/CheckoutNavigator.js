import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { CheckoutProvider } from '../Context/store/CheckoutContext';

// Importing the screens
import Payment from '../Screens/Cart/Checkout/Payment';
import Confirm from '../Screens/Cart/Checkout/Confirm';
import Checkout from '../Screens/Cart/Checkout/Checkout';
import StripePayment from '../Screens/Cart/Checkout/StripePayment';
import TelebirrPayment from '../Screens/Cart/Checkout/TelebirrPayment';

const Tab = createMaterialTopTabNavigator();

function MyTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: "white" },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIndicatorStyle: { backgroundColor: "#8a6c09ff" },
      }}
    >
      <Tab.Screen name="Shipping" component={Checkout} />
      <Tab.Screen name="Payment" component={Payment} />
      <Tab.Screen name="Confirm" component={Confirm} />
      <Tab.Screen name="StripePayment" component={StripePayment} />
      <Tab.Screen name="TelebirrPayment" component={TelebirrPayment} />
    </Tab.Navigator>
  );
}

export default function CheckoutNavigator() {
    return (
        <CheckoutProvider>
            <MyTabs />
        </CheckoutProvider>
    )
}
