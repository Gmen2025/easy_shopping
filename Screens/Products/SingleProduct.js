import React, { useState, useEffect } from "react";
import {
  Image,
  View,
  StyleSheet,
  Text,
  ScrollView,
  Button,
} from "react-native";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import TrafficLight from "../../Shared/StyledComponenets/TrafficLight";
import Toast from "react-native-toast-message";
import { useDispatch } from "react-redux";
import { addToCart } from "../../store/cartSlice"; // Adjust the import path as necessary

const SingleProduct = (props) => {
  const [item, setItem] = useState(props.route.params.item);
  const [availabality, setAvailability] = useState(null);
  const [availabiltyText, setAvailabilityText] = useState("");
  //console.log("SingleProduct item:", item.countInStock);

  useEffect(() => {
    if(item.countInStock == 0) {
      setAvailability(<TrafficLight unavailable></TrafficLight>);
      setAvailabilityText("Unavailable");
    } else if (item.countInStock <= 5) {
      setAvailability(<TrafficLight limited></TrafficLight>);
      setAvailabilityText("Limited Stock");
    }else {
      setAvailability(<TrafficLight available></TrafficLight>);
      setAvailabilityText("Available");
    }
    if (!item) {
      console.error("Item is undefined. Ensure it is passed correctly.");
    }

    // Cleanup function to reset state when component unmounts
    return () => (
      setAvailability(null),
      setAvailabilityText(""),
      setItem(null)
    );

    //this immeditely resets the component to null and "", so never see the status
    // return (
    //   setAvailability(null),
    //   setAvailabilityText(""),
    //   setItem(null)
    // )

  }, []);

  //Redux store is used to manage the cart state
  // This allows us to add items to the cart and access the cart state globally
  // The useSelector hook is used to access the Redux store state
  // The useDispatch hook is used to dispatch actions to the Redux store
  // The addToCart action is dispatched to add an item to the cart
  // The cartItems state is accessed from the Redux store to check if the item is already in the cart

  // The addToCart function is called when the user clicks the "Add" button
  // It checks if the item is defined, then creates a product object with the necessary properties
  // and dispatches the addToCart action with the product object
  // If the item is undefined, an error is logged to the console
  // The product object contains the id, name, price, image, and countInStock properties
  // The id is extracted from the item._id.$oid property, assuming each product has a unique id
  // The name, price, image, and countInStock properties are extracted from the item object
  // The addToCart action will update the cart state in the Redux store
  // The cart state can be accessed in other components using the useSelector hook
  // The useDispatch hook is used to dispatch the addToCart action

  const dispatch = useDispatch();
  const handleAddToCart = () => {
    if (item) {
      const product = {
        id: item._id, // Assuming each product has a unique id
        name: item.name,
        price: item.price,
        image: item.image,
        countInStock: item.countInStock,
      };
      dispatch(addToCart(product));
      Toast.show({
        type: "success",
        text1: `${item.name} added to cart`,
        text2: "Go to your cart to complete order",
      });
    } else {
      console.error("Item is undefined. Cannot add to cart.");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ marginBottom: 80, padding: 5 }}>
        <View>
          <Image
            source={{
              uri: item.image
                ? item.image
                : "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
            }}
            resizeMode="contain"
            style={styles.image}
          />
          <Text style={styles.name}>{item.name || "No Name Available"}</Text>
          <Text style={styles.brand}>{item.brand}</Text>
          <View style={styles.availabilityContainer}>
            <View style={ styles.availability }>
              <Text style={{marginRight:10}}>Availability: {availabiltyText}</Text>
              {availabality}
            </View>
          </View>
          <Text style={styles.description}>
            {item.description || "No Description Available"}
          </Text>
          <Text style={styles.price}>
            ETB {item.price || "No Price Available"}
          </Text>
          <View style={styles.buttonContainer}>
            <EasyButton onPress={handleAddToCart} tertiary medium>
              <Text style={{ color: "white" }}>Add</Text>
            </EasyButton>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    height: "100%",
  },
  imageContainer: {
    backgroundColor: "white",
    padding: 0,
    margin: 0,
  },
  image: {
    width: "100%",
    height: 250,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 10,
  },
  brand: {
    fontSize: 16,
    textAlign: "center",
    color: "gray",
    fontWeight: "bold",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: "gray",
    marginVertical: 10,
  },
  price: {
    fontSize: 24,
    color: "red",
    margin: 20,
  },
  buttonContainer: {
    alignSelf: "flex-end", // Align the button to the right
    marginRight: 20, // Add some margin to the right
    marginTop: -60,
  },
  availabilityContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  availability: {
    flexDirection: "row",
    marginBottom: 10,
  },
});

export default SingleProduct;
