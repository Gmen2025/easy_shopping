import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import CompanyStoreDashboard from "../Screens/Store/CompanyStoreDashboard";
import CompanyStoreOrderDetails from "../Screens/Store/CompanyStoreOrderDetails";

const Stack = createStackNavigator();

const CompanyStoreNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="CompanyStoreHome"
      component={CompanyStoreDashboard}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="CompanyStoreOrderDetails"
      component={CompanyStoreOrderDetails}
      options={{ title: "Order products" }}
    />
  </Stack.Navigator>
);

export default CompanyStoreNavigator;
