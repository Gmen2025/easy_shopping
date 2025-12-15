import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import Products from "../Screens/Admin/Products";
import Orders from "../Screens/Admin/Orders";
import Categories from "../Screens/Admin/Categories";
import ProductForm from "../Screens/Admin/ProductForm";
import SingleProduct from "../Screens/Products/SingleProduct";

const Stack = createStackNavigator();

function MyStack() {
  return (
    <Stack.Navigator>
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
    </Stack.Navigator>
  );
}

export default function AdminNavigator() {
    return <MyStack />;
}