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
  TextInput,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import TrafficLight from "../../Shared/StyledComponenets/TrafficLight";
import Toast from "react-native-toast-message";
import getImageUrl from "../../assets/common/getImageUrl";
import { useCurrency } from "../../assets/common/currency";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import baseUrl from "../../assets/common/baseUrl";
import axios from "axios";
import { useStoreCart, storeRequest } from "../../assets/common/storefront";
import useCatalogPricing from "../../assets/common/useCatalogPricing";
import { getCatalogSettings, getNearestStoreProduct, parseCatalogCoordinates } from "../../assets/common/catalog";
import ReviewPanel from "../../Shared/ReviewPanel";

const { width } = Dimensions.get("window");

const SingleProduct = (props) => {
  const { formatPrice } = useCurrency();
  const [item, setItem] = useState(props.route.params.item);
  const [imageIndex, setImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [availabality, setAvailability] = useState(null);
  const [availabiltyText, setAvailabilityText] = useState("");
  const pricing = useCatalogPricing();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [retry, setRetry] = useState(0);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    setItem(props.route.params.item);
    setImageIndex(0);
  }, [props.route.params.item]);

  const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value.$oid || value._id || "";
    return "";
  };
  const nearestMode = !item?.storefrontId && pricing.enabled === true;
  const quoteKey = `${normalizeId(item?._id)}:${coordinates?.latitude}:${coordinates?.longitude}`;
  const currentQuote = nearestMode && quote?.key === quoteKey ? quote.data : null;
  const pricedItem = item?.storefrontId || pricing.enabled === false ? item : currentQuote?.product;
  const pricingReady = Boolean(pricedItem);

  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuoteError("");
    setQuoteLoading(false);
    if (nearestMode && coordinates && item?._id) {
      setQuoteLoading(true);
      getNearestStoreProduct(normalizeId(item._id), coordinates)
        .then((data) => { if (active) setQuote({ key: quoteKey, data }); })
        .catch((failure) => {
          if (active) setQuoteError(failure.response?.data?.message || failure.message);
        })
        .finally(() => { if (active) setQuoteLoading(false); });
    }
    return () => { active = false; };
  }, [nearestMode, coordinates, item?._id, quoteKey, retry]);

  const useCoordinates = () => {
    setQuoteError("");
    try { setCoordinates(parseCatalogCoordinates(latitude, longitude)); }
    catch (failure) { setQuoteError(failure.message); }
  };
  const useCurrentLocation = async () => {
    setLocating(true);
    setCoordinates(null);
    setQuoteError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Location access was denied. Allow location access or enter coordinates below.");
      const result = await Location.getCurrentPositionAsync({});
      const point = parseCatalogCoordinates(result.coords.latitude, result.coords.longitude);
      setLatitude(String(point.latitude)); setLongitude(String(point.longitude));
      setCoordinates(point);
    } catch (failure) { setQuoteError(failure.message || "Unable to get your location. Enter coordinates below."); }
    finally { setLocating(false); }
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
    if (!pricedItem) {
      setAvailability(null);
      setAvailabilityText("Select a location to check stock");
      return;
    }

    if(pricedItem.countInStock == 0) {
      setAvailability(<TrafficLight unavailable></TrafficLight>);
      setAvailabilityText("Unavailable");
    } else if (pricedItem.countInStock <= 5) {
      setAvailability(<TrafficLight limited></TrafficLight>);
      setAvailabilityText("Limited Stock");
    }else {
      setAvailability(<TrafficLight available></TrafficLight>);
      setAvailabilityText("Available");
    }
    if (!item) {
      console.error("Item is undefined. Ensure it is passed correctly.");
    }

  }, [pricedItem]);

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      if (!item) {
        return;
      }

      try {
        const response = item.storefrontId
          ? { data: (await storeRequest(`directory/${item.storefrontId}/products`)).products }
          : await axios.get(`${baseUrl}products`);
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

  const addStoreProduct = useStoreCart();
  const stockCount = Number(pricedItem?.countInStock || 0);
  const handleAddToCart = async () => {
    if (!pricingReady || adding) return;
    setAdding(true);
    try {
    if (!item.storefrontId && (await getCatalogSettings()).nearestStorePricingEnabled !== pricing.enabled) {
      await pricing.reload();
      throw new Error("Catalog pricing changed. Check this product's updated price before adding it.");
    }
    if (pricedItem && stockCount > 0) {
      const databaseName = await getDatabaseNameFromStorage();
      const product = {
        id: pricedItem._id,
        name: pricedItem.name,
        price: pricedItem.price,
        image: galleryImages[0] || item.image,
        countInStock: pricedItem.countInStock,
        databaseName,
        storefrontId: pricedItem.storefrontId || null,
        storefrontName: currentQuote?.store.name || pricedItem.storefrontName,
        inventoryManaged: pricedItem.inventoryManaged || false,
      };
      if (!addStoreProduct(product)) return;
      Toast.show({
        type: "success",
        text1: `${item.name} added to cart`,
        text2: "Go to your cart to complete order",
      });
    } else {
      console.error("Item is undefined. Cannot add to cart.");
    }
    } catch (failure) {
      Toast.show({ type: "error", text1: "Unable to add product", text2: failure.response?.data?.message || failure.message });
    } finally { setAdding(false); }
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
          {pricingReady ? <Text style={styles.stockCountText}>{stockCount} left in stock</Text> : null}
          <Text style={styles.description}>
            {item.description || "No Description Available"}
          </Text>
          {!item.storefrontId && pricing.error ? <TouchableOpacity onPress={pricing.reload}>
            <Text accessibilityRole="alert">{pricing.error} Tap to retry.</Text>
          </TouchableOpacity> : null}
          {!item.storefrontId && pricing.enabled === null && !pricing.error ? <ActivityIndicator /> : null}
          {nearestMode ? <View style={{ gap: 10 }}>
            <Text>Choose your location to see the nearest available store's price.</Text>
            <TouchableOpacity disabled={locating || adding} onPress={useCurrentLocation}>
              <Text>{locating ? "Locating..." : "Use my current location"}</Text>
            </TouchableOpacity>
            <TextInput style={styles.locationInput} accessibilityLabel="Customer latitude" placeholder="Latitude (-90 to 90)"
              keyboardType="numbers-and-punctuation" value={latitude} editable={!locating && !adding}
              onChangeText={(value) => { setLatitude(value); setCoordinates(null); }} />
            <TextInput style={styles.locationInput} accessibilityLabel="Customer longitude" placeholder="Longitude (-180 to 180)"
              keyboardType="numbers-and-punctuation" value={longitude} editable={!locating && !adding}
              onChangeText={(value) => { setLongitude(value); setCoordinates(null); }} />
            <TouchableOpacity disabled={locating || adding} onPress={useCoordinates}><Text>Find nearest price</Text></TouchableOpacity>
            {quoteLoading ? <ActivityIndicator /> : null}
            {quoteError ? <TouchableOpacity onPress={() => setRetry((value) => value + 1)}>
              <Text accessibilityRole="alert">{quoteError} {coordinates ? "Tap to retry." : ""}</Text>
            </TouchableOpacity> : null}
            {currentQuote ? <Text>{currentQuote.store.name} - {currentQuote.distanceKm.toFixed(1)} km away</Text> : null}
          </View> : null}
          {pricingReady ? <Text style={styles.price}>
            {typeof pricedItem.price === "number" ? formatPrice(pricedItem.price) : "No Price Available"}
          </Text> : null}
          <View style={styles.buttonContainer}>
            {pricingReady && stockCount > 0 ? (
              <EasyButton disabled={adding || locating} onPress={handleAddToCart} tertiary medium style={styles.addButton}>
                <Text style={styles.addButtonText}>{adding ? "Checking price..." : "Add to Cart"}</Text>
              </EasyButton>
            ) : (
              <Text style={styles.outOfStockText}>{pricingReady ? "Out of stock" : "A verified store price is required before purchase."}</Text>
            )}
          </View>
        </View>

        <View style={styles.relatedCard}>
          <ReviewPanel key={normalizeId(item._id)} product={normalizeId(item._id)} />
          <Text style={styles.relatedTitle}>Related Products</Text>
          {relatedProducts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {relatedProducts.map((relatedItem, index) => (
                <TouchableOpacity
                  key={`related-${normalizeId(relatedItem._id) || "no-id"}-${index}`}
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
                  {item.storefrontId || pricing.enabled === false ? <Text style={styles.relatedPrice}>
                    {formatPrice(relatedItem.price || 0)}
                  </Text> : null}
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
  locationInput: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 },
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
  stockCountText: {
    color: "#1f7a45",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
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
  outOfStockText: {
    color: "#c0392b",
    fontWeight: "700",
    fontSize: 14,
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
