import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CartView from '../Screens/Cart/CartView'; // Adjust the import path as necessary
import CheckoutNavigator from './CheckoutNavigator';
import MultiDeliveryCheckout from '../Screens/Cart/Checkout/MultiDeliveryCheckout';
import DeliveryCheckouts from '../Screens/Cart/Checkout/DeliveryCheckouts';


const Stack = createStackNavigator();
function MyStack() {
  return (
    <Stack.Navigator
      initialRouteName="CartHome"
      screenOptions={{
        headerTitleStyle: { color: '#8a6c09ff', fontWeight: 'bold' },
        headerTintColor: '#8a6c09ff',
      }}
    >
      <Stack.Screen name="MultiDeliveryCheckout" component={MultiDeliveryCheckout} options={{ title: "Multi-delivery checkout" }} />
      <Stack.Screen name="ServiceUsdCheckout" component={MultiDeliveryCheckout} options={{ title: "Service USD payment" }} />
      <Stack.Screen name="DeliveryCheckouts" component={DeliveryCheckouts} options={{ title: "Deliveries & payments" }} />
      <Stack.Screen
        name="CartHome"
        component={CartView}  
        options={{
          headerShown: false,
          headerTitleStyle: { color: '#8a6c09ff', fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutNavigator}
        options={{
          title: 'Checkout',
          headerTitleAlign: 'center', // This centers the title on both Android and iOS
          headerTitleStyle: { color: '#8a6c09ff', fontWeight: 'bold' },
        }}
      />
    </Stack.Navigator>
  );
}

export default function CartNavigator() {
  return <MyStack />;
}
