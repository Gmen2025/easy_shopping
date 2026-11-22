import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthContext } from '../Context/store/Auth';
import { useMaintenance } from '../Context/store/MaintenanceContext';
import MaintenanceScreen from '../Screens/MaintenanceScreen';
import Login from '../Screens/User/Login';
import Register from '../Screens/User/Register';
import EmailVerification from '../Screens/User/EmailVerification';
import ForgotPassword from '../Screens/User/ForgotPassword';
import ResetPassword from '../Screens/User/ResetPassword';
import Main from './Main';

const Stack = createStackNavigator();

const MaintenanceNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
      <Stack.Screen name="EmailVerification" component={EmailVerification} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="ResetPassword" component={ResetPassword} />
    </Stack.Navigator>
  );
};

const MaintenanceWrapper = () => {
  const { user } = useContext(AuthContext);
  const { maintenanceEnabled, usaRestricted, testingAccess, error, loading, checkMaintenanceStatus } = useMaintenance();

  // Show loading while checking maintenance status
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8a6c09" />
      </View>
    );
  }

  if (error) return <View style={styles.loadingContainer}>
    <Text accessibilityRole="alert">{error}</Text>
    <TouchableOpacity accessibilityRole="button" onPress={checkMaintenanceStatus}><Text>Retry maintenance access</Text></TouchableOpacity>
  </View>;
  if ((usaRestricted && !testingAccess && !user) || (maintenanceEnabled && !user?.isAdmin && !testingAccess)) {
    return <MaintenanceNavigator />;
  }

  // Otherwise show the main app
  return <Main />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});

export default MaintenanceWrapper;
