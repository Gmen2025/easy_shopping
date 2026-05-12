import React, {useContext} from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Platform } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import CartIcon from '../Shared/CartIcon'
import {AuthContext} from '../Context/store/Auth'

import HomeNavigator from './HomeNavigator'
import CartNavigator from './CartNavigator'
import UserNavigator from './UserNavigator'
import AdminNavigator from './AdminNavigator'

const Tab = createBottomTabNavigator();

const TAB_ACTIVE   = '#1a237e';
const TAB_INACTIVE = '#9fa8da';
const TAB_BG       = '#ffffff';

const PillIcon = ({ name, color, focused }) => (
  <Icon name={name} color={color} size={24} />
);

const Main = () => {
  const context = useContext(AuthContext);

  return (
    <Tab.Navigator
      initialRouteName='Home'
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopWidth: 0,
          elevation: 16,
          shadowColor: '#1a237e',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          height: Platform.OS === 'ios' ? 92 : 64,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: Platform.OS === 'ios' ? 4 : 2,
        },
      }}
    >
      <Tab.Screen
        name='Home'
        component={HomeNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <PillIcon name='home' color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name='Cart'
        component={CartNavigator}
        options={{
          tabBarLabel: 'Cart',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative' }}>
              <Icon name='shopping-cart' color={color} size={24} />
              <CartIcon />
            </View>
          ),
        }}
      />
      {context.user?.isAdmin === true ? (
        <Tab.Screen
          name='Admin'
          component={AdminNavigator}
          options={{
            tabBarLabel: 'Admin',
            tabBarIcon: ({ color, focused }) => (
              <PillIcon name='cog' color={color} focused={focused} />
            ),
          }}
        />
      ) : null}
      <Tab.Screen
        name='User'
        component={UserNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <PillIcon name='user' color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default Main
