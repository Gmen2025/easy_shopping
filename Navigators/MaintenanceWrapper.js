import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthContext } from '../Context/store/Auth';
import { useMaintenance } from '../Context/store/MaintenanceContext';
import MaintenanceScreen from '../Screens/MaintenanceScreen';
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
    </Stack.Navigator>
  );
};

const MaintenanceWrapper = () => {
  const { user } = useContext(AuthContext);
  const { maintenanceEnabled, loading } = useMaintenance();

  // Show loading while checking maintenance status
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8a6c09" />
      </View>
    );
  }

  // If maintenance is enabled and user is not admin, show maintenance screen
  if (maintenanceEnabled && !user?.isAdmin) {
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
