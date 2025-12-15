import React, {useContext} from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import {View} from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import CartIcon from '../Shared/CartIcon'
import {AuthContext} from '../Context/store/Auth'


//Stacks
import HomeNavigator from './HomeNavigator'
import CartNavigator from './CartNavigator'
import UserNavigator from './UserNavigator'
import AdminNavigator from './AdminNavigator'

const Tab = createBottomTabNavigator();

const Main = () => {

  const context = useContext(AuthContext);

    return (
        <Tab.Navigator
            initialRouteName='Home'
            screenOptions={{
              headerShown:false,
              tabBarShowLabel:false,
              tabBarActiveTintColor: '#85680ac0', // darker yellow for active tabs
              tabBarInactiveTintColor: '#eac749ff', // yellow for inactive tabs
              tabBarStyle: {
                backgroundColor: 'white',
              }
            }}
        >
            <Tab.Screen 
                name='Home'
                component={HomeNavigator}
                options={{
                    tabBarIcon: ({color}) => {
                        return (<Icon
                            name='home'
                            style={{position: 'relative'}}
                            color={color}
                            size={30}
                        />
                        );
                    },
                }}
            />
            <Tab.Screen
                name='Cart'
                component={CartNavigator}
                options={{              
                    tabBarIcon: ({ color }) => {
                        return (
                          <View style={{ width: 30, height: 30 }}>
                            <Icon
                              name="shopping-cart"
                              style={{ position: "relative" }}
                              color={color}
                              size={30}
                            />
                            <CartIcon color={color} />
                          </View>
                        );
                      },
                }}
            />
            {context.user && context.user.isAdmin === true ? (
              <Tab.Screen
                name='Admin'
                component={AdminNavigator}
                options={{
                    tabBarIcon: ({ color }) => {
                        return (
                          <Icon
                            name="cog"
                            color={color}
                            size={30}
                          />
                        );
                      },
                }}
            />
            ) : null}
             <Tab.Screen
                name='User'
                component={UserNavigator}
                options={{
                    tabBarIcon: ({ color }) => {
                        return (
                          <Icon
                            name="user"
                            color={color}
                            size={30}
                          />
                        );
                      },
                }} 
            />
        </Tab.Navigator>    
    );
};

export default Main
