import React, {useContext} from 'react'
import { View, StyleSheet, Dimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Text, Card, Button, Divider, Avatar } from 'react-native-paper';
import EasyButton from '../../../Shared/StyledComponenets/EasyButton';

import { useDispatch } from 'react-redux';
import { clearCart } from '../../../store/cartSlice'; // Uncomment if you have a clearCart action in your Redux store
import { AuthContext } from "../../../Context/store/Auth";
import Toast from "react-native-toast-message"
import axios from "axios";
import baseUrl from '../../../assets/common/baseUrl'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCheckout } from '../../../Context/store/CheckoutContext'; // Import the useCheckout hook



const width = Dimensions.get('window').width; // Get the width of the device screen


const Confirm = (props) => {
    const { order: contextOrder } = useCheckout();
    //const finalOrder = route.params;
    const context = useContext(AuthContext);

    // Get order from route params or context
    const order = props.route?.params?.order || contextOrder;
    
    const dispatch = useDispatch(); // Initialize the Redux dispatch function


    // If you need to clear the cart, you can call this function
    const handlePlaceOrder = async() => {
      // You can handle order placement logic here
      // For example, you might want to dispatch an action to save the order in your Redux store
      // or navigate to a different screen after placing the order
      
      //const orderInfo = order.order;
      const orderItem = {
        ...order,
        user: context.user?._id,
        orderItems: order.orderItems.map((item) => ({
          product: item._id,
          quantity: item.quantity || 1,
        })),
      };

      
      console.log("Order to submit: ", orderItem);
      const token = await AsyncStorage.getItem("token");
      axios
      .post(`${baseUrl}orders`, orderItem, {
        headers: {Authorization: `Bearer ${token}`}
      })
      .then((res) => {
        if(res.status == 200 || res.status == 201){
          Toast.show({
            topOffset: 60,
            type: "success",
            text1: "order placed",
            text2: "Thank you for your purchase",
          });
          setTimeout(() => {
            dispatch(clearCart()); // Clear the cart after placing the order
            props.navigation.navigate("Cart");
          }, 500); // Simulate a delay for placing the order
        }
      })
      .catch((error) => {
        console.log("Order submit error:", error.response?.data || error.message);
        Toast.show({
            topOffset: 60,
            type: "error",
            text1: "Something went wrong",
            text2: "Please try again",
          });
      })
      
    };  

    if (!order) {
    return (
      <View style={styles.container}>
        <Text>No order data available</Text>
        <EasyButton
          tertiary
          large
          onPress={() => props.navigation.navigate("Shipping")}
        >
          <Text style={{ color: 'white' }}>Start Checkout</Text>
        </EasyButton>
      </View>
    );
  }

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.title}>
                Order Confirmation
              </Text>
              <Text variant="bodyLarge" style={styles.label}>
                Shipping Address:
              </Text>
              <Text>Address: {order.address || order.shippingAddress1}</Text>
              {order.address2 || order.shippingAddress2 ? (
                <Text>
                  Address2: {order.address2 || order.shippingAddress2}
                </Text>
              ) : null}
              <Text>City: {order.city}</Text>
              <Text>Zip Code: {order.zip}</Text>
              <Text>{order.country}</Text>
              <Text variant="bodyLarge" style={styles.label}>
                Phone:
              </Text>
              <Text>{order.phone}</Text>
              <Text variant="bodyLarge" style={styles.label}>
                Payment Method:
              </Text>
              <Text>{order.methodName || order.method || "Not specified"}</Text>
              {order.cardType ? <Text>Card Type: {order.cardType}</Text> : null}

              <Divider style={{ marginVertical: 10 }} />

              <Text variant="bodyLarge" style={styles.label}>
                Order Items:
              </Text>
              {Array.isArray(order.orderItems) &&
              order.orderItems.length > 0 ? (
                order.orderItems.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Avatar.Image
                      size={40}
                      source={{
                        uri: item.image || "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
                      }}
                      style={styles.thumbnail}
                    />
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>X: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>
                      $
                      {item.price?.toFixed ? item.price.toFixed(2) : item.price}
                    </Text>
                  </View>
                ))
              ) : (
                <Text>No items in this order.</Text>
              )}
              <Text variant="bodyLarge" style={styles.label}>
                Total Price:
              </Text>
              <Text>
                $
                {Array.isArray(order.orderItems)
                  ? order.orderItems
                      .reduce(
                        (sum, item) => sum + item.price * (item.quantity || 1),
                        0
                      )
                      .toFixed(2)
                  : "0.00"}
              </Text>
            </Card.Content>
            <Card.Actions style={{ justifyContent: "space-between" }}>
              <EasyButton 
                style={{ marginLeft: 10 }} 
                secondary 
                large
                onPress={() => props.navigation.navigate("Shipping")}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Back</Text>
              </EasyButton>
              <EasyButton style={{ marginRight: 10 }} tertiary onPress={handlePlaceOrder}>
                <Text style={{ color: 'black', fontWeight: 'bold' }}>Place Order</Text>
              </EasyButton>
            </Card.Actions>
          </Card>
        </ScrollView>
        <View style={{ height: 10 }} />
      </View>
    );       
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: width - 80, // Make the card width responsive
    padding: 20,
    marginTop: 10,
    marginBottom: 50,
  },
  title: {
    marginBottom: 10,
    textAlign: 'center',
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  itemName: {
    flex: 2,
    fontSize: 15,
  },
  itemQty: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
  },
  itemPrice: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
  },
  thumbnail: {
    marginRight: 8,
    backgroundColor: '#eee',
  },
});

export default Confirm;
