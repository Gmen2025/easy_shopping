import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import CompanyStoreDashboard from "../Screens/Store/CompanyStoreDashboard";
import CompanyStoreOrderDetails from "../Screens/Store/CompanyStoreOrderDetails";
import StoreManagement from "../Screens/Store/StoreManagement";
import StoreAssignments from "../Screens/Store/StoreAssignments";

const Stack = createStackNavigator();

const CompanyStoreNavigator = () => (
  <Stack.Navigator initialRouteName="CompanyStoreHome">
    <Stack.Screen name="StoreManagement" component={StoreManagement} options={{ title: "My store" }} />
    <Stack.Screen name="StoreAssignments" component={StoreAssignments} options={{ title: "Assignments" }} />
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
