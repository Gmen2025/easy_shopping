import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Button,
} from "react-native";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import { useDispatch } from "react-redux";
import { addToCart } from "../../store/cartSlice"; // Adjust the import path as necessary

var { width } = Dimensions.get("window");

const ProductCard = (props) => {
  const { name, price, image, countInStock } = props;
  const dispatch = useDispatch(); // Import the action to add items to the cart

  const handleAddToCart = () => {
    const product = {
      _id: props._id, // Assuming each product has a unique id
      name: name,
      price: price,
      image: image,
      countInStock: countInStock,
    };

    // Check if the product is already in the cart
    dispatch(addToCart(product));

    Toast.show({
      type: "success",
      text1: `${name} added to cart`,
      text2: "Go to your cart to complete order",
    });
  };

  return (
    <View style={styles.container}>
      <Image
        source={{
          uri: image
            ? image
            : "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
        }}
        style={styles.image}
        resizeMode="contain"
      />
      <View style={styles.card} />
      <Text style={styles.title}>
        {name.length > 15 ? name.substring(0, 15 - 3) + "..." : name}
      </Text>
      <Text style={styles.price}>ETB {price}</Text>
      {countInStock > 0 ? (
        <View style={{ marginBottom: 60 }}>
          <EasyButton
            primary
            onPress={handleAddToCart}
            medium
          >
            <Text style={{ color: "white" }}>Add +</Text>
          </EasyButton>
        </View>
      ) : (
        <Text style={{ marginTop: 20 }}>Currently Unavailable</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width / 2 - 20,
    height: width / 1.7,
    padding: 10,
    borderRadius: 10,
    marginTop: 55,
    marginBottom: 5,
    marginLeft: 10,
    alignItems: "center",
    elevation: 8,
    backgroundColor: "white",
  },
  image: {
    width: width / 2 - 20 - 10,
    height: width / 2 - 20 - 30,
    backgroundColor: "transparent",
    position: "absolute",
    top: -45,
    borderRadius: 10,
  },
  card: {
    marginBottom: 10,
    height: width / 2 - 90,
    backgroundColor: "transparent",
    width: width / 2 - 20 - 10,
    borderRadius: 10,
    elevation: 10,
  },
  title: {
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  price: {
    fontSize: 20,
    color: "orange",
    marginTop: 10,
  },
});

export default ProductCard;
