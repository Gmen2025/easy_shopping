import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import ProductContainer from "../Screens/Products/ProductContainer";
import SingleProduct from "../Screens/Products/SingleProduct";
import ServiceRequestForm from "../Screens/Service/ServiceRequestForm";

const Stack = createStackNavigator();

function MyStack() {
  return (
    <Stack.Navigator>
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
