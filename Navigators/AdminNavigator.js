import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import AdminDashboard from "../Screens/Admin/AdminDashboard";
import Products from "../Screens/Admin/Products";
import Orders from "../Screens/Admin/Orders";
import Categories from "../Screens/Admin/Categories";
import ProductForm from "../Screens/Admin/ProductForm";
import BroadcastNotifications from "../Screens/Admin/BroadcastNotifications";
import LowStock from "../Screens/Admin/LowStock";
import MaintenanceSettings from "../Screens/Admin/MaintenanceSettings";
import BankAccountSettings from "../Screens/Admin/BankAccountSettings";
import DeliverySettings from "../Screens/Admin/DeliverySettings";
import VehicleDeliverySettings from "../Screens/Admin/VehicleDeliverySettings";
import DeliveryCheckouts from "../Screens/Cart/Checkout/DeliveryCheckouts";
import SingleProduct from "../Screens/Products/SingleProduct";
import ServiceRequests from "../Screens/Service/ServiceRequests";
import Drivers from "../Screens/Admin/Drivers";
import StoreOwners from "../Screens/Admin/StoreOwners";
import Payouts from "../Screens/Admin/Payouts";
import AssignRoles from "../Screens/Admin/AssignRoles";
import AdminStores from "../Screens/Admin/AdminStores";
import AdminDrivers from "../Screens/Admin/AdminDrivers";
import RideSettings from "../Screens/Admin/RideSettings";
import ExchangeRateSettings from "../Screens/Admin/ExchangeRateSettings";
import InternationalShippingSettings from "../Screens/Admin/InternationalShippingSettings";

const Stack = createStackNavigator();

function MyStack() {
  return (
    <Stack.Navigator initialRouteName="AdminDashboard">
      <Stack.Screen name="RideSettings" component={RideSettings} options={{ title: "Ride fares, drivers & payments" }} />
      <Stack.Screen name="ExchangeRateSettings" component={ExchangeRateSettings} options={{ title: "Cross-currency daily rate" }} />
      <Stack.Screen name="InternationalShippingSettings" component={InternationalShippingSettings} options={{ title: "USA to Ethiopia shipping" }} />
      <Stack.Screen name="VehicleDeliverySettings" component={VehicleDeliverySettings} options={{ title: "Vehicles & packaged sizes" }} />
      <Stack.Screen name="DeliveryCheckouts" component={DeliveryCheckouts} initialParams={{ admin: true }} options={{ title: "Combined payments & refunds" }} />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboard}
        options={{
          title: "Admin Dashboard",
          headerTitleStyle: { color: "#e6c20eff" },
        }}
      />
      <Stack.Screen
        name="Products"
        component={Products}
        options={{
          title: 'Products',
          headerTitleStyle:{
            color:'#e6c20eff',
          },
        }}
      />
      <Stack.Screen
        name="Orders"
        component={Orders}
        options={{
          title: 'Orders',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center', // This centers the title on both Android and iOS
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="BroadcastNotifications"
        component={BroadcastNotifications}
        options={{
          title: 'Broadcast',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center',
          headerTitleStyle: {
            color: '#e6c20eff',
          },
        }}
      />
      <Stack.Screen
        name="Categories"
        component={Categories}
        options={{
          title: 'Categories',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center', // This centers the title on both Android and iOS
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="ProductForm"
        component={ProductForm}
        options={{
          title: 'Product Form',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center', // This centers the title on both Android and iOS
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="LowStock"
        component={LowStock}
        options={{
          title: 'Low Stock',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center',
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="MaintenanceSettings"
        component={MaintenanceSettings}
        options={{
          title: 'Maintenance Mode',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center',
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="BankAccountSettings"
        component={BankAccountSettings}
        options={{
          title: 'Bank Account Settings',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center',
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="DeliverySettings"
        component={DeliverySettings}
        options={{
          title: 'Delivery Pricing',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center',
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={SingleProduct}
        options={{
          title: 'Product Detail',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center', // This centers the title on both Android and iOS
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="ServiceRequestsAdmin"
        component={ServiceRequests}
        initialParams={{ mode: 'admin' }}
        options={{
          title: 'Service Requests',
          headerTintColor: '#e6c20eff',
          headerTitleAlign: 'center',
          headerTitleStyle:{
            color:'#e6c20eff'
          }
        }}
      />
      <Stack.Screen
        name="Drivers"
        component={Drivers}
        options={{
          title: "Driver Applications",
          headerTintColor: "#e6c20eff",
          headerTitleAlign: "center",
          headerTitleStyle: { color: "#e6c20eff" },
        }}
      />
      <Stack.Screen
        name="StoreOwners"
        component={StoreOwners}
        options={{ title: "Store Owners", headerTintColor: "#e6c20eff", headerTitleAlign: "center", headerTitleStyle: { color: "#e6c20eff" } }}
      />
      <Stack.Screen
        name="Payouts"
        component={Payouts}
        options={{ title: "Store Payouts", headerTintColor: "#e6c20eff", headerTitleAlign: "center", headerTitleStyle: { color: "#e6c20eff" } }}
      />
      <Stack.Screen
        name="AssignRoles"
        component={AssignRoles}
        options={{ title: "Assign Roles", headerTintColor: "#e6c20eff", headerTitleAlign: "center", headerTitleStyle: { color: "#e6c20eff" } }}
      />
      <Stack.Screen
        name="AdminStores"
        component={AdminStores}
        options={{ title: "Company Stores", headerTintColor: "#e6c20eff", headerTitleAlign: "center", headerTitleStyle: { color: "#e6c20eff" } }}
      />
      <Stack.Screen
        name="AdminDrivers"
        component={AdminDrivers}
        options={{ title: "Company Drivers", headerTintColor: "#e6c20eff", headerTitleAlign: "center", headerTitleStyle: { color: "#e6c20eff" } }}
      />
    </Stack.Navigator>
  );
}

export default function AdminNavigator() {
    return <MyStack />;
}