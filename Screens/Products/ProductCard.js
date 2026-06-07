import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
} from "react-native";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import { useDispatch } from "react-redux";
import { addToCart } from "../../store/cartSlice"; // Adjust the import path as necessary
import getImageUrl from "../../assets/common/getImageUrl";
import { useCurrency } from "../../assets/common/currency";

var { width } = Dimensions.get("window");

const ProductCard = (props) => {
  const { name, price, image, countInStock } = props;
  const imageUrl = getImageUrl(props);
  const dispatch = useDispatch(); // Import the action to add items to the cart
  const { formatPrice } = useCurrency();

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
      <View style={styles.imageWrap}>
      <Image
        source={{
          uri: imageUrl,
        }}
        style={styles.image}
        resizeMode="cover"
      />
      </View>
      <View style={styles.stockRow}>
        <Text
          style={[
            styles.stockBadge,
            countInStock > 0 ? styles.stockIn : styles.stockOut,
          ]}
        >
          {countInStock > 0 ? "In Stock" : "Out of Stock"}
        </Text>
      </View>
      <Text style={styles.title}>
        {name.length > 32 ? name.substring(0, 29) + "..." : name}
      </Text>
      <Text style={styles.price}>{formatPrice(price)}</Text>
      {countInStock > 0 ? (
        <View style={styles.buttonWrap}>
          <EasyButton
            primary
            onPress={handleAddToCart}
            medium
            style={styles.addButton}
          >
            <Text style={styles.addText}>Add to Cart</Text>
          </EasyButton>
        </View>
      ) : (
        <Text style={styles.unavailableText}>Currently unavailable</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width / 2 - 20,
    minHeight: width / 1.38,
    // height: 150,
    padding: 10,
    borderRadius: 14,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 10,
    alignItems: "flex-start",
    elevation: 3,
    borderWidth: 1,
    borderColor: "#dce3ef",
    backgroundColor: "white",
  },
  imageWrap: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#eef3fa",
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  stockRow: {
    width: "100%",
    marginTop: 10,
  },
  stockBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: "700",
  },
  stockIn: {
    backgroundColor: "#e9f9ef",
    color: "#1f7a45",
  },
  stockOut: {
    backgroundColor: "#fdebec",
    color: "#c0392b",
  },
  title: {
    marginTop: 8,
    fontWeight: "multi",
    fontSize: 10,
    color: "#333",
    minHeight: 38,
  },
  price: {
    fontSize: 10,
    color: "#8a6c09",
    fontWeight: "700",
  },
  buttonWrap: {
    marginTop: 8,
    width: "100%",
    alignItems: "flex-end",
  },
  addButton: {
    borderRadius: 10,
    paddingVertical: 4,
  },
  addText: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  unavailableText: {
    marginTop: 2,
    color: "#7a8699",
    fontWeight: "multi",
  },
});

export default ProductCard;
