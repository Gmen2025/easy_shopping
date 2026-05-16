import React, { useState, useEffect, useMemo } from "react";
import {
  Image,
  View,
  StyleSheet,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import TrafficLight from "../../Shared/StyledComponenets/TrafficLight";
import Toast from "react-native-toast-message";
import { useDispatch } from "react-redux";
import { addToCart } from "../../store/cartSlice"; // Adjust the import path as necessary
import getImageUrl from "../../assets/common/getImageUrl";
import { useCurrency } from "../../assets/common/currency";
import baseUrl from "../../assets/common/baseUrl";
import axios from "axios";

const { width } = Dimensions.get("window");

const SingleProduct = (props) => {
  const { formatPrice } = useCurrency();
  const [item, setItem] = useState(props.route.params.item);
  const [imageIndex, setImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [availabality, setAvailability] = useState(null);
  const [availabiltyText, setAvailabilityText] = useState("");

  const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value.$oid || value._id || "";
    return "";
  };

  const galleryImages = useMemo(() => {
    if (!item) {
      return [];
    }

    const sources = [];
    if (Array.isArray(item.images)) {
      sources.push(...item.images);
    }
    if (item.image) {
      sources.push(item.image);
    }

    if (sources.length === 0) {
      sources.push(item);
    }

    const normalized = sources
      .map((source) => getImageUrl(source))
      .filter(Boolean);

    return [...new Set(normalized)];
  }, [item]);

  useEffect(() => {
    if (!item) {
      return;
    }

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

  }, [item]);

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      if (!item) {
        return;
      }

      try {
        const response = await axios.get(`${baseUrl}products`);
        const fetchedProducts = Array.isArray(response.data)
          ? response.data
          : response.data.products;

        const currentProductId = normalizeId(item._id);
        const currentCategoryId = normalizeId(item.category?._id || item.category);

        const related = (fetchedProducts || [])
          .filter((product) => {
            const productId = normalizeId(product._id);
            const productCategoryId = normalizeId(
              product.category?._id || product.category
            );

            return (
              productId &&
              productId !== currentProductId &&
              currentCategoryId &&
              productCategoryId === currentCategoryId
            );
          })
          .slice(0, 10);

        setRelatedProducts(related);
      } catch (error) {
        console.log("Failed to load related products:", error.message);
        setRelatedProducts([]);
      }
    };

    fetchRelatedProducts();
  }, [item]);

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
        image: galleryImages[0] || item.image,
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

  if (!item) {
    return (
      <View style={styles.emptyStateWrap}>
        <Text style={styles.emptyStateText}>Product is not available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageCard}>
          <View style={styles.imageClipBox}>
            <FlatList
              data={galleryImages}
              keyExtractor={(uri, index) => `${uri}-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const currentIndex = Math.round(
                  event.nativeEvent.contentOffset.x / (width - 24)
                );
                setImageIndex(currentIndex);
              }}
              renderItem={({ item: imageUri }) => (
                <Image
                  source={{ uri: imageUri }}
                  resizeMode="cover"
                  style={styles.image}
                />
              )}
            />
          </View>
          {galleryImages.length > 1 && (
            <View style={styles.sliderDotsRow}>
              {galleryImages.map((_, idx) => (
                <View
                  key={`dot-${idx}`}
                  style={[
                    styles.sliderDot,
                    imageIndex === idx && styles.sliderDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.name}>{item.name || "No Name Available"}</Text>
          <Text style={styles.brand}>{item.brand || "Unbranded"}</Text>
          <View style={styles.availabilityContainer}>
            <View style={ styles.availability }>
              <Text style={styles.availabilityText}>Availability: {availabiltyText}</Text>
              {availabality}
            </View>
          </View>
          <Text style={styles.description}>
            {item.description || "No Description Available"}
          </Text>
          <Text style={styles.price}>
            {typeof item.price === "number" ? formatPrice(item.price) : "No Price Available"}
          </Text>
          <View style={styles.buttonContainer}>
            <EasyButton onPress={handleAddToCart} tertiary medium style={styles.addButton}>
              <Text style={styles.addButtonText}>Add to Cart</Text>
            </EasyButton>
          </View>
        </View>

        <View style={styles.relatedCard}>
          <Text style={styles.relatedTitle}>Related Products</Text>
          {relatedProducts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {relatedProducts.map((relatedItem) => (
                <TouchableOpacity
                  key={normalizeId(relatedItem._id)}
                  style={styles.relatedItem}
                  onPress={() => {
                    setItem(relatedItem);
                    setImageIndex(0);
                  }}
                >
                  <Image
                    source={{ uri: getImageUrl(relatedItem) }}
                    style={styles.relatedImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.relatedName} numberOfLines={2}>
                    {relatedItem.name || "Unnamed Product"}
                  </Text>
                  <Text style={styles.relatedPrice}>
                    {formatPrice(relatedItem.price || 0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.relatedEmptyText}>No related products found.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 32,
  },
  imageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce3ef",
    overflow: "visible",
  },
  imageClipBox: {
    borderRadius: 14,
    overflow: "hidden",
  },
  image: {
    width: width - 24,
    height: 280,
    backgroundColor: "#eef3fa",
  },
  sliderDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 8,
  },
  sliderDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#c5cae9",
    marginHorizontal: 4,
  },
  sliderDotActive: {
    width: 18,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#8a6c09",
  },
  detailsCard: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 14,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    textAlign: "left",
    marginBottom: 4,
  },
  brand: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  description: {
    fontSize: 15,
    color: "#475569",
    marginVertical: 10,
    lineHeight: 22,
  },
  price: {
    fontSize: 24,
    color: "#8a6c09",
    marginTop: 6,
    fontWeight: "700",
  },
  buttonContainer: {
    alignSelf: "flex-end",
    marginTop: 10,
  },
  availabilityContainer: {
    alignItems: "flex-start",
    marginTop: 10,
  },
  availability: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  availabilityText: {
    marginRight: 10,
    color: "#334155",
    fontWeight: "600",
  },
  addButton: {
    borderRadius: 10,
    paddingVertical: 4,
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  relatedCard: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 14,
  },
  relatedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  relatedItem: {
    width: 140,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce3ef",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  relatedImage: {
    width: "100%",
    height: 96,
    backgroundColor: "#eef3fa",
  },
  relatedName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    paddingHorizontal: 8,
    paddingTop: 8,
    minHeight: 42,
  },
  relatedPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8a6c09",
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 4,
  },
  relatedEmptyText: {
    color: "#64748b",
    fontSize: 14,
  },
  emptyStateWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f6fb",
  },
  emptyStateText: {
    color: "#475569",
    fontSize: 16,
  },
});

export default SingleProduct;
