import React, { useContext } from "react";
import { AuthContext } from "../Context/store/Auth";
import { createStackNavigator } from "@react-navigation/stack";
import CompanyStoreDashboard from "../Screens/Store/CompanyStoreDashboard";
import CompanyStoreOrderDetails from "../Screens/Store/CompanyStoreOrderDetails";
import StoreManagement from "../Screens/Store/StoreManagement";
import StoreAssignments from "../Screens/Store/StoreAssignments";
import IncomeDashboard from "../Screens/Finance/IncomeDashboard";
import ProductForm from "../Screens/Admin/ProductForm";
import Categories from "../Screens/Admin/Categories";

const Stack = createStackNavigator();

const CompanyStoreNavigator = () => {
  const { user } = useContext(AuthContext);
  return (
  <Stack.Navigator initialRouteName={user?.isCompanyOwnedStore ? "CompanyStoreHome" : "IncomeDashboard"}>
    <Stack.Screen name="IncomeDashboard" component={IncomeDashboard} initialParams={{ kind: "store" }} options={{ title: "Store income & payouts" }} />
    <Stack.Screen name="StoreManagement" component={StoreManagement} options={{ title: "My store" }} />
    <Stack.Screen name="StoreProductForm" component={ProductForm} options={{ title: "Store product" }} />
    <Stack.Screen name="StoreCategories" component={Categories} options={{ title: "Shared categories" }} />
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
};

export default CompanyStoreNavigator;
