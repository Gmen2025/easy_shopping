import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";

import ProductCard from "./ProductCard";

const ProductList = (props) => {
  const { item } = props;
  return (
    <TouchableOpacity
      style={[styles.touchable, { flex: 1 / (props.columns || 2) }]}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}`}
      onPress={() => props.navigation.navigate("Product Detail", { item: item })}
    >
      <ProductCard {...item} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    minWidth: 0,
  },
});

export default ProductList;