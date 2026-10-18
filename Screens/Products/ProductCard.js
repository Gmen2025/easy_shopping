import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome5";
import Toast from "react-native-toast-message";
import getImageUrl from "../../assets/common/getImageUrl";
import { useCurrency } from "../../assets/common/currency";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { useStoreCart } from "../../assets/common/storefront";

const ProductCard = (props) => {
  const { name, price, image, countInStock } = props;
  const imageUrl = getImageUrl(props);
  const addStoreProduct = useStoreCart();
  const { formatPrice } = useCurrency();
  const stockCount = Number(countInStock || 0);
  const rating = Number(props.rating);
  const reviewCount = Number(props.numReviews);

  const handleAddToCart = async (event) => {
    event?.stopPropagation?.();
    const databaseName = await getDatabaseNameFromStorage();
    const product = {
      _id: props._id,
      name: name,
      price: price,
      image: image,
      countInStock: countInStock,
      databaseName,
      storefrontId: props.storefrontId || null,
      inventoryManaged: props.inventoryManaged || false,
    };

    if (!addStoreProduct(product)) return;

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
          resizeMode="contain"
        />
      </View>

      <View style={styles.stockRow}>
        <Text
          style={[
            styles.stockBadge,
            stockCount > 0 ? styles.stockIn : styles.stockOut,
          ]}
        >
          {stockCount > 0 ? `${stockCount} left` : "Out of Stock"}
        </Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {name}
      </Text>
      {Number.isFinite(rating) && rating > 0 ? <View style={styles.ratingRow}>
        <Icon name="star" solid size={12} color="#F2BD00" />
        <Text style={styles.ratingText}>{rating.toFixed(1)}{Number.isFinite(reviewCount) && reviewCount > 0 ? ` (${reviewCount})` : ""}</Text>
      </View> : null}

      <Text style={styles.price}>{formatPrice(price)}</Text>

      {stockCount > 0 ? (
        <View style={styles.buttonWrap}>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
            onPress={handleAddToCart}
            accessibilityRole="button"
            accessibilityLabel={`Add ${name} to cart`}
          >
            <Icon name="shopping-cart" size={12} color="#111111" />
            <Text style={styles.addText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.unavailableText}>Currently unavailable</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flex: 1,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 6,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  imageWrap: {
    width: "100%",
    height: 125,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  stockRow: {
    width: "100%",
    marginTop: 10,
  },
  stockBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "700",
  },
  stockIn: {
    backgroundColor: "#DCFCE7",
    color: "#15803D",
  },
  stockOut: {
    backgroundColor: "#FEE2E2",
    color: "#B91C1C",
  },
  title: {
    marginTop: 8,
    fontWeight: "600",
    fontSize: 13,
    color: "#111827",
    minHeight: 36,
    lineHeight: 18,
  },
  price: {
    fontSize: 18,
    color: "#000000",
    fontWeight: "800",
    marginTop: 4,
  },
  buttonWrap: {
    marginTop: 10,
    width: "100%",
  },
  addButton: {
    backgroundColor: "#FFDA0A",
    borderRadius: 20,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  ratingText: { fontSize: 11, color: "#64748B" },
  addText: {
    color: "#030501",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  unavailableText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default ProductCard;