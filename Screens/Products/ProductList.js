import React from "react";
import { TouchableOpacity, View, Dimensions, StyleSheet } from "react-native";

import ProductCard from "./ProductCard";

const { width } = Dimensions.get("window");

const ProductList = (props) => {
  const { item } = props;
  return (
    <TouchableOpacity
      style={styles.touchable}
      onPress={() => props.navigation.navigate("Product Detail", { item: item })}
    >
      <View style={styles.wrapper}>
        <ProductCard {...item} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: "50%",
  },
  wrapper: {
    width: width / 2,
    backgroundColor: "transparent",
  },
});

export default ProductList;