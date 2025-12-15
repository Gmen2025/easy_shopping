import React, {useEffect, useState, useContext} from 'react';
import { View, Text, FlatList, StyleSheet, Image  } from 'react-native';
import { Card, Button, Appbar, Avatar } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart, deductQuantity} from '../../store/cartSlice'; // Adjust the import path as necessary
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import baseUrl from '../../assets/common/baseUrl'; // Import the base URL for API requests
import { AuthContext } from '../../Context/store/Auth';
import EasyButton from '../../Shared/StyledComponenets/EasyButton';
//import { CheckoutProvider } from '../../Context/store/CheckoutContext'; // Import the CheckoutProvider

// products data
//const products = require('../../assets/data/products.json'); // Import the products data



const CartView = (props) => {

  const context = useContext(AuthContext);
  console.log("context value", context)

  // Fetch products from the API or use a static file
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  


  const cartItems = useSelector((state) => state.cart.cartItems);
  const dispatch = useDispatch();

  // Clear cart when user changes (different user logs in)
  useEffect(() => {
    const checkAndClearCart = async () => {
      const currentUserId = context.user?._id;
      const cartUserId = await AsyncStorage.getItem('cartUserId');
      
      // If there's a different user or user logged out, clear cart
      if (currentUserId !== cartUserId) {
        if (cartItems.length > 0) {
          dispatch(clearCart());
        }
        // Update the stored user ID
        if (currentUserId) {
          await AsyncStorage.setItem('cartUserId', currentUserId);
        } else {
          await AsyncStorage.removeItem('cartUserId');
        }
      }
    };
    
    checkAndClearCart();
  }, [context.user?._id, dispatch, cartItems.length]);

  useEffect(() => {
    // Fetch products from the API
    axios.get(`${baseUrl}products`)
      .then((response) => {
        const fetchedProducts = Array.isArray(response.data)
          ? response.data
          : response.data.products;
        //console.log("Fetched products:", fetchedProducts);
        setProducts(fetchedProducts || []);
        setLoading(false); // Set loading to false after fetching products
      })
      .catch((error) => {
        console.error("Error fetching products:", error);
        setLoading(false); // Set loading to false even if there's an error
      });

  }, []);

  // Access the cart items from the Redux store
  const productsData = products.filter(product => 
    cartItems.some(cartItem => cartItem.id === product._id)  
  ); // Filter products to match cart items

  //console.log('cartItems:', cartItems.map(i => i.id));
  //console.log('products:', products.map(p => p._id));
  //console.log('products:', products);
  //console.log('cartItems full:', cartItems);


  

  const handleClearCart = () => {
    dispatch(clearCart());
  };

  const handleDeductQuantity = (itemId) => {
    dispatch(deductQuantity({ _id: itemId })); // Adjust based on your cartSlice implementation
  };

return (
  <View style={styles.container}>
    <Appbar.Header>
      <Appbar.Content titleStyle={styles.appbarTitle} title="Your Cart" />
      <Appbar.Action
        icon="delete"
        color="red"
        size={40}
        onPress={handleClearCart}
      />
    </Appbar.Header>
    {productsData.length === 0 ? (
      <View style={styles.emptyCart}>
        <Text style={styles.emptyText}>Your cart is empty</Text>
      </View>
    ) : (
      <FlatList
        data={productsData}
        renderItem={({ item }) => {
          const quantity =
            cartItems.find((cartItem) => cartItem.id === item._id)?.quantity ||
            1;
          return (
            <View style={styles.rowItem}>
              <Avatar.Image
                size={60}
                source={{
                  uri:
                    item.image ||
                    "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
                }}
                style={styles.avatar}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                <Text>Qty: {quantity}</Text>
                <Text>Subtotal: ETB {(item.price * quantity).toFixed(2)}</Text>
              </View>
              <View style={styles.actions}>
                <Button
                  onPress={() => handleDeductQuantity(item._id)}
                  mode="outlined"
                >
                  -
                </Button>
              </View>
            </View>
          );
        }}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
      />
    )}
    {productsData.length > 0 && (
      <View style={{ padding: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>
          Grand Total: ETB 
          {productsData
            .reduce((total, item) => {
              const quantity =
                cartItems.find((cartItem) => cartItem.id === item._id)
                  ?.quantity || 1;
              return total + item.price * quantity;
            }, 0)
            .toFixed(2)}
        </Text>
        <View style={{ height: 60 }}>
          {context.isAuthenticated ? (
            <EasyButton
              mode="contained"
              tertiary
              onPress={() => props.navigation.navigate("Checkout")}
              style={{ margin: 10 }}
            >
              <Text style={{ color: 'white' }}>Proceed to Checkout</Text>
            </EasyButton>
          ) : (
            <EasyButton
              mode="contained"
              tertiary
              onPress={() => props.navigation.navigate("User", { screen: "Login" })}
              style={{ margin: 10 }}
            >
              <Text style={{ color: 'white' }}>Proceed to Login</Text>
            </EasyButton>
          )}
        </View>
      </View>
    )}
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'gainsboro',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    padding: 10,
    elevation: 2,
  },
  appbarTitle: {
    color: '#e6c20eff', 
  },
  avatar: {
    marginRight: 10,
    backgroundColor: '#eee',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemPrice: {
    fontSize: 14,
    color: 'gray',
  },
  actions: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: 'gray',
  },
});

export default CartView;
