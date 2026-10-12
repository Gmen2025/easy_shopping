import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import ProductContainer from "../Screens/Products/ProductContainer";
import SingleProduct from "../Screens/Products/SingleProduct";
import ServiceRequestForm from "../Screens/Service/ServiceRequestForm";
import StoreDirectory from "../Screens/Store/StoreDirectory";
import Storefront from "../Screens/Store/Storefront";
import RideBooking from "../Screens/Ride/RideBooking";
import MyRides from "../Screens/Ride/MyRides";

const Stack = createStackNavigator();

function MyStack() {
  return (
    <Stack.Navigator initialRouteName="Home Screen">
      <Stack.Screen name="RideBooking" component={RideBooking} options={{ title: "Ride service" }} />
      <Stack.Screen name="MyRides" component={MyRides} options={{ title: "My rides & payments" }} />
      <Stack.Screen name="Stores" component={StoreDirectory} options={{ title: "Stores" }} />
      <Stack.Screen name="Storefront" component={Storefront} options={{ title: "Store products" }} />
      <Stack.Screen
        name="Home Screen"
        component={ProductContainer}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Product Detail"
        component={SingleProduct}
        options={{
          tabBarStyle: {display:'flex'},
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Service Request"
        component={ServiceRequestForm}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default function HomeNavigator() {
  return <MyStack />;
}
