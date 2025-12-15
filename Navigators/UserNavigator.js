import React, { useContext } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { AuthContext } from "../Context/store/Auth";

import Login from "../Screens/User/Login";
import Register from "../Screens/User/Register";
import UserProfile from "../Screens/User/UserProfile";
import ProductContainer from "../Screens/Products/ProductContainer";
import EditProfile from "../Screens/User/EditProfile";
import EmailVerification from "../Screens/User/EmailVerification";
import ForgotPassword from "../Screens/User/ForgotPassword";
import ResetPassword from "../Screens/User/ResetPassword";

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
      {/* login screen be unavaialable if user is logged in. */}
      {!isLoggedIn ? (
        <Stack.Screen name="Login" component={Login} />
      ) : (
        <Stack.Screen name="User Profile" component={UserProfile} />
      )}
      <Stack.Screen name="Register" component={Register} />
      <Stack.Screen name="EmailVerification" component={EmailVerification} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="ResetPassword" component={ResetPassword} />
      {/* <Stack.Screen name="EditProfile" component={EditProfile} /> */}
    </Stack.Navigator>
  );
};

export default function UserNavigator() {
  return <MyStack />;
}
