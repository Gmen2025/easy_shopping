import React, { useContext } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { AuthContext, isDriverUser } from "../Context/store/Auth";

import Login from "../Screens/User/Login";
import Register from "../Screens/User/Register";
import UserProfile from "../Screens/User/UserProfile";
import ProductContainer from "../Screens/Products/ProductContainer";
import EditProfile from "../Screens/User/EditProfile";
import EmailVerification from "../Screens/User/EmailVerification";
import ForgotPassword from "../Screens/User/ForgotPassword";
import ResetPassword from "../Screens/User/ResetPassword";
import DeliveryRouteScreen from "../Screens/Driver/DeliveryRouteScreen";
import DeliveryProgressScreen from "../Screens/Driver/DeliveryProgressScreen";
import OrderTrackingScreen from "../Screens/User/OrderTrackingScreen";
import RoleSetupScreen from "../Screens/User/RoleSetupScreen";
import ServiceRequests from "../Screens/Service/ServiceRequests";

const Stack = createStackNavigator();

const MyStack = () => {
  const context = useContext(AuthContext);
  const isLoggedIn = context.isAuthenticated;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {isLoggedIn ? (
        <>
          <Stack.Screen name="User Profile" component={UserProfile} />
          <Stack.Screen name="EditProfile" component={EditProfile} />
          <Stack.Screen name="ServiceRequests" component={ServiceRequests} />
          <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
          <Stack.Screen name="RoleSetup" component={RoleSetupScreen} />
          {isDriverUser(context.user) ? (
            <>
              <Stack.Screen name="DeliveryRoute" component={DeliveryRouteScreen} />
              <Stack.Screen name="DeliveryProgress" component={DeliveryProgressScreen} />
            </>
          ) : null}
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Register" component={Register} />
          <Stack.Screen name="EmailVerification" component={EmailVerification} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          <Stack.Screen name="ResetPassword" component={ResetPassword} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default function UserNavigator() {
  return <MyStack />;
}
