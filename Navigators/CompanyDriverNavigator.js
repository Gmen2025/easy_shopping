import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import CompanyDriverDashboard from "../Screens/Driver/CompanyDriverDashboard";
import DeliveryRouteScreen from "../Screens/Driver/DeliveryRouteScreen";
import DeliveryProgressScreen from "../Screens/Driver/DeliveryProgressScreen";

const Stack = createStackNavigator();

const CompanyDriverNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompanyDriverHome" component={CompanyDriverDashboard} />
      <Stack.Screen name="DeliveryRoute" component={DeliveryRouteScreen} />
      <Stack.Screen name="DeliveryProgress" component={DeliveryProgressScreen} />
    </Stack.Navigator>
  );
};

export default CompanyDriverNavigator;
