import React, { useEffect, useState, useContext } from "react";
import { View, Text, Button } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome5";
import { Picker } from "@react-native-picker/picker";
import FormContainer from "../../../Shared/Form/FormContainer";
import Input from "../../../Shared/Form/Input";
import { AuthContext } from "../../../Context/store/Auth";
import Toast from "react-native-toast-message";
import EasyButton from "../../../Shared/StyledComponenets/EasyButton";

const countries = require("../../../assets/data/countries.json"); // Assuming you have a countries.json file with country data
import { useSelector } from "react-redux"; // Assuming you are using Redux to manage cart state
import axios from "axios";
import baseUrl from "../../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";

function Checkout(props) {
  const context = useContext(AuthContext);
  const cartItems = useSelector((state) => state.cart.cartItems); // Accessing cart items from Redux store
  const [token, setToken] = useState();

  const [orderItems, setOrderItems] = useState([]);
  const [address, setAddress] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [user, setUser] = useState();

  useEffect(() => {
    // This is where you can fetch the cart items and set them to orderItems state
    // For example, if you have a Redux store or context, you can dispatch an action to get the cart items
    // setOrderItems(fetchedCartItems);

    // If you want to set default values for the address fields, you can do that here as well
    // setAddress("Default Address");

    console.log("user id from context", context.user._id);

    if (context.isAuthenticated) {
      setUser(context.user.sub);

      //API call to get user details
      AsyncStorage.getItem("token").then((res) => {
        setToken(res);

        const config = {
          headers: {
            Authorization: `Bearer ${res}`,
          },
        };

        // Fetch user's orders
        axios
          .get(`${baseUrl}orders/get/userorders/${context.user._id}`, config)
          .then((orderRes) => {
            const orders = orderRes.data;
            if (orders && orders.length > 0) {
              // Prefill from the most recent order
              const firstOrder = orders[0];
              console.log("First order found:", firstOrder);

              setAddress(firstOrder.shippingAddress1 || "");
              setAddress2(firstOrder.shippingAddress2 || "");
              setCity(firstOrder.city || "");
              setZip(firstOrder.zip || "");
              setCountry(firstOrder.country || "");
              setPhone(firstOrder.phone || "");
            } else {
              // If no orders, fallback to user profile
              axios
                .get(`${baseUrl}users/${context.user._id}`, config)
                .then((res) => {
                  const data = res.data;
                  if (data) {
                    setAddress(data.street || "");
                    setAddress2(data.shippingAddress2 || "");
                    setCity(data.city || "");
                    setZip(data.zip || "");
                    setCountry(data.country || "");
                    setPhone(data.phone || "");
                  }
                })
                .catch((error) => console.log("User data error: ", error));
            }
          })
          .catch((error) => console.log("User data error: ", error));
      });
    } else {
      props.navigation.navigate("Cart");
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Please login to checkout",
        text2: "",
      });
    }

    setOrderItems(cartItems); // Assuming cartItems is passed as a prop

    return () => {
      // Cleanup if necessary
      setOrderItems([]);
    };
  }, [cartItems]);

  const calculateTotal = (items) => {
    //console.log("Calculating total for items:", items);
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  const handleSubmit = () => {
    // Validate form fields
    if (!address || !city || !zip || !country || !phone) {
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Please fill in all required fields",
        text2: "",
      });
      return;
    }

    if (!orderItems || orderItems.length === 0) {
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Your cart is empty",
        text2: "Add items to your cart before checking out",
      });
      return;
    }

    // Create order object with proper structure
    let order = {
      _id: `temp_order_${Date.now()}`, // Add temporary ID
      orderId: `ORDER_${Date.now()}`, // Add orderId property
      shippingAddress1: address,
      shippingAddress2: address2,
      status: "3",
      city,
      zip,
      country,
      phone,
      orderItems: orderItems.map((item) => ({
        ...item,
        _id: item._id || item.id, // Ensure _id exists
        quantity: item.quantity || 1,
      })),
      user: user || context.user._id,
      dateOrdered: Date.now(),
      totalPrice: calculateTotal(orderItems),
      // Add these additional properties that might be expected
      paymentMethod: null,
      methodName: null,
      cardType: null,
      paymentStatus: "pending",
    };

    console.log("Order object being passed:", order);

    props.navigation.navigate("Payment", { order });

    // Or you can dispatch an action to save the order in Redux store
    // You can navigate or dispatch an action here
  };

  return (
    <FormContainer title="Shipping Address">
      <Input
        placeholder="Shipping Address 1"
        name="Shipping address 1"
        value={address}
        onChangeText={(text) => setAddress(text)}
      />
      <Input
        placeholder="Address 2"
        name="Shipping address 2"
        value={address2}
        onChangeText={(text) => setAddress2(text)}
      />
      <Input
        placeholder="City"
        name="city"
        value={city}
        onChangeText={(text) => setCity(text)}
      />
      <Input
        placeholder="Zip Code"
        name="zip"
        value={zip}
        onChangeText={(text) => setZip(text)}
        keyboardType="numeric"
      />
      <Input
        placeholder="Phone"
        name="phone"
        value={phone}
        keyboardType={"numeric"}
        onChangeText={(text) => setPhone(text)}
      />
      <Text style={{ marginTop: 10, fontWeight: "bold", fontSize: 20 }}>
        Country
      </Text>
      <Picker
        selectedValue={country}
        onValueChange={(itemValue) => setCountry(itemValue)}
        style={{ marginBottom: 10, marginTop: -2, width: 250 }}
        mode="dropdown"
      >
        <Picker.Item label="Select a country..." value="" />
        {countries.map((c) => (
          <Picker.Item key={c.code} label={c.name} value={c.name} />
        ))}
      </Picker>
      <EasyButton style={{ marginTop: 30 }} tertiary large onPress={handleSubmit}>
        <Text style={{ color: "black", fontWeight: "bold" }}>Confirm</Text>
      </EasyButton>
    </FormContainer>
  );
}

export default Checkout;
