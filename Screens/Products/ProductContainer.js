import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Text,
  Image,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import baseUrl from "../../assets/common/baseUrl";
import { getWithRetry, isServiceUnavailableError } from "../../assets/common/requestRetry";

import { Searchbar } from "react-native-paper";
import ProductList from "./ProductList";
import SearchedProducts from "./SearchedProducts";
import CategoriesFilter from "./CategoriesFilter";
import AdvancedFilters from "./AdvancedFilters";
import getImageUrl from "../../assets/common/getImageUrl";
import Icon from "react-native-vector-icons/FontAwesome5";

if (Platform.OS === "android" && !global.nativeFabricUIManager && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ProductContainer = (props) => {
  const { width: screenWidth } = useWindowDimensions();
  const columns = screenWidth >= 700 ? 4 : 2;
  const listRef = useRef(null);
  const [productsOffset, setProductsOffset] = useState(0);
  const [bannerFailed, setBannerFailed] = useState(false);
  const promoGraphicUrl =
    "https://res.cloudinary.com/dvzt34adj/image/upload/v1783614600/addugeneteshopgraphics_egtaee.png";

  const defaultAdvancedFilters = {
    minPrice: "",
    maxPrice: "",
    brand: "all",
    minRating: "all",
    inStockOnly: false,
    sortBy: "relevance",
  };

  const [products, setProducts] = useState([]);
  const [focus, setFocus] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [categories, setCategories] = useState([]);
  const [active, setActive] = useState(-1);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(defaultAdvancedFilters);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const extractId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value.$oid || value._id || "";
    return "";
  };

  const buildProductKey = (item, index, prefix = "product") => {
    const id = extractId(item?._id) || extractId(item?.id) || "no-id";
    return `${prefix}-${id}-${index}`;
  };

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      setFocus(false);
      setActive(-1);
      setLoadError("");

      const loadCatalog = async () => {
        if (mounted) setLoading(true);

        try {
          const [productsRes, categoriesRes] = await Promise.all([
            getWithRetry(`${baseUrl}products`, {}, { retries: 2, delayMs: 1200 }),
            getWithRetry(`${baseUrl}categories`, {}, { retries: 1, delayMs: 800 }),
          ]);

          if (!mounted) return;

          const fetchedProducts = Array.isArray(productsRes.data)
            ? productsRes.data
            : productsRes.data.products;
          const normalizedProducts = (fetchedProducts || []).map((product) => ({
            ...product,
            image: getImageUrl(product),
          }));
          setProducts(normalizedProducts);

          const fetchedCategories = Array.isArray(categoriesRes.data)
            ? categoriesRes.data
            : categoriesRes.data.categories;
          setCategories(fetchedCategories || []);
          setLoadError("");
        } catch (err) {
          if (!mounted) return;

          if (isServiceUnavailableError(err)) {
            setLoadError("Server is waking up. Please retry in a few seconds.");
          } else {
            setLoadError("Could not load products right now. Please try again.");
          }
        } finally {
          if (mounted) setLoading(false);
        }
      };

      loadCatalog();

      return () => {
        mounted = false;
        setProducts([]);
        setFocus(false);
        setSearchKeyword("");
        setCategories([]);
        setActive(-1);
        setSelectedCategoryId(null);
        setShowAdvancedFilters(false);
        setAdvancedFilters(defaultAdvancedFilters);
        setLoadError("");
      };
    }, [])
  );

  const searchProduct = (text) => {
    setSearchKeyword(text);
  };

  const openList = () => {
    setFocus(true);
  };

  const clearSearch = () => {
    setSearchKeyword("");
    setFocus(false);
  };

  const toggleAdvancedFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAdvancedFilters((prev) => !prev);
  };

  const handleAdvancedFilterChange = (key, value) => {
    setAdvancedFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetAdvancedFilters = () => {
    setAdvancedFilters(defaultAdvancedFilters);
  };

  const availableBrands = useMemo(() => {
    return [...new Set(products.map((item) => item.brand).filter(Boolean))].sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let currentProducts = [...products];

    if (selectedCategoryId) {
      currentProducts = currentProducts.filter((item) => {
        const categoryId = extractId(item.category?._id || item.category);
        return categoryId === selectedCategoryId;
      });
    }

    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword) {
      currentProducts = currentProducts.filter((item) => {
        const searchable = [item.name, item.description, item.brand]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(keyword);
      });
    }

    const minPrice = parseFloat(advancedFilters.minPrice);
    if (!Number.isNaN(minPrice)) {
      currentProducts = currentProducts.filter(
        (item) => Number(item.price || 0) >= minPrice
      );
    }

    const maxPrice = parseFloat(advancedFilters.maxPrice);
    if (!Number.isNaN(maxPrice)) {
      currentProducts = currentProducts.filter(
        (item) => Number(item.price || 0) <= maxPrice
      );
    }

    if (advancedFilters.brand !== "all") {
      currentProducts = currentProducts.filter(
        (item) => item.brand === advancedFilters.brand
      );
    }

    const minRating = parseFloat(advancedFilters.minRating);
    if (!Number.isNaN(minRating)) {
      currentProducts = currentProducts.filter(
        (item) => Number(item.rating || 0) >= minRating
      );
    }

    if (advancedFilters.inStockOnly) {
      currentProducts = currentProducts.filter(
        (item) => Number(item.countInStock || 0) > 0
      );
    }

    if (advancedFilters.sortBy === "priceAsc") {
      currentProducts.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (advancedFilters.sortBy === "priceDesc") {
      currentProducts.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (advancedFilters.sortBy === "ratingDesc") {
      currentProducts.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    } else if (advancedFilters.sortBy === "nameAsc") {
      currentProducts.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    }

    return currentProducts;
  }, [products, selectedCategoryId, searchKeyword, advancedFilters]);

  const featuredProducts = useMemo(() => {
    const rankedProducts = [...products]
      .filter((item) => {
        const featuredValue = item?.isFeatured;
        const isFeatured =
          featuredValue === true ||
          featuredValue === 1 ||
          String(featuredValue).toLowerCase() === "true";

        return isFeatured && Number(item.countInStock || 0) > 0;
      })
      .sort((a, b) => {
        const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        return Number(b.price || 0) - Number(a.price || 0);
      });

    return rankedProducts;
  }, [products]);

  const changeCtg = (ctg) => {
    if (ctg === "all") {
      setSelectedCategoryId(null);
      setActive(-1);
    } else {
      const categoryValue = categories.find((item) => item.name === ctg);
      if (!categoryValue) return;

      const categoryId = extractId(categoryValue._id);
      setSelectedCategoryId(categoryId);
      const categoryIndex = categories.findIndex(
        (category) => category.name === ctg
      );
      setActive(categoryIndex);
    }
  };

  const showAllProducts = () => {
    clearSearch();
    changeCtg("all");
    resetAdvancedFilters();
    listRef.current?.scrollToOffset({ offset: productsOffset, animated: true });
  };

  const renderTopContent = (showCategories = false) => (
    <>
      <Searchbar
        placeholder="Search for products, brands and more..."
        placeholderTextColor="#6B7280"
        value={searchKeyword}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
        iconColor="#111827"
        clearIcon={searchKeyword ? "close" : null}
        onClear={clearSearch}
        onChangeText={(text) => searchProduct(text)}
        onFocus={openList}
        onSubmitEditing={openList}
      />
      <View style={styles.shoppingActions}>
        {[
          { title: "Ride", detail: "Book a ride", icon: "car", open: () => props.navigation.navigate("RideBooking") },
          { title: "Store", detail: "Find nearby stores", icon: "store", open: () => props.navigation.navigate("Stores") },
          { title: "Service Request", detail: "Book a technician", icon: "wrench", open: () => props.navigation.navigate("Service Request") },
        ].map((service) => (
          <TouchableOpacity key={service.title} style={styles.serviceAction} accessibilityRole="button"
            accessibilityLabel={service.title} onPress={service.open}>
            <Icon name={service.icon} size={screenWidth >= 700 ? 32 : 22} color="#111111" />
            <View style={styles.serviceCopy}>
              <Text style={[styles.serviceActionText, screenWidth < 500 && { fontSize: 12 }]}>{service.title}</Text>
              <Text style={[styles.serviceDetail, screenWidth < 500 && { fontSize: 9 }]}>{service.detail}</Text>
            </View>
            {screenWidth >= 700 ? <Icon name="chevron-right" size={12} color="#111111" /> : null}
          </TouchableOpacity>
        ))}
      </View>
      {showCategories ? <>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="View all categories" onPress={() => changeCtg("all")}>
            <Text style={styles.viewAll}>View All  &gt;</Text>
          </TouchableOpacity>
        </View>
        <CategoriesFilter categories={categories} products={products} categoryFilter={changeCtg}
          active={active} setActive={setActive} />
        <View style={styles.promo}>
          <View style={styles.promoCopy}>
            <Text style={[styles.promoTitle, screenWidth < 500 && { fontSize: 18, lineHeight: 22 }]}>Get Your Favorite Products Delivered</Text>
            <Text style={styles.promoDetail}>Bringing Ethiopia and the USA closer.</Text>
            <TouchableOpacity style={styles.shopButton} accessibilityRole="button" onPress={showAllProducts}>
              <Text style={styles.shopButtonText}>Shop Now  &gt;</Text>
            </TouchableOpacity>
          </View>
          {!bannerFailed ? <Image source={{ uri: promoGraphicUrl }} style={[styles.promoImage, screenWidth < 500 && { width: "42%" }]}
            resizeMode="contain" accessibilityLabel="Addu Genet Ethiopia and USA shopping"
            onError={() => { setBannerFailed(true); console.warn("Storefront promotional image could not be loaded."); }} />
            : <Icon name="shopping-bag" size={64} color="#796400" style={styles.promoFallback} />}
        </View>
      </> : null}
      <TouchableOpacity
        style={styles.advancedToggle}
        activeOpacity={0.85}
        onPress={toggleAdvancedFilters}
      >
        <View style={styles.advancedToggleInner}>
          <Text style={styles.advancedToggleText}>Filter & sort</Text>
          <Icon name="sliders-h" size={14} color="#111827" />
        </View>
      </TouchableOpacity>
      <AdvancedFilters
        visible={showAdvancedFilters}
        filters={advancedFilters}
        brands={availableBrands}
        onFilterChange={handleAdvancedFilterChange}
        onReset={resetAdvancedFilters}
        onToggle={() => setShowAdvancedFilters(false)}
      />
      {showCategories && featuredProducts.length > 0 ? (
        <View style={styles.featuredSection}>
          <Text style={styles.featuredTitle}>Featured Products</Text>
          <FlatList
            horizontal
            data={featuredProducts}
            keyExtractor={(item, index) => buildProductKey(item, index, "featured")}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.featuredCard} accessibilityRole="button"
                onPress={() => props.navigation.navigate("Product Detail", { item })}>
                <Image source={{ uri: item.image }} style={styles.featuredImage} resizeMode="contain" />
                <Text numberOfLines={2} style={styles.featuredName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}
      <View style={styles.sectionHeading} onLayout={(event) => setProductsOffset(event.nativeEvent.layout.y)}>
        <View>
          <Text style={styles.sectionTitle}>{selectedCategoryId || searchKeyword || showAdvancedFilters ? "Your Products" : "Popular Products"}</Text>
          <Text style={styles.resultMeta}>{filteredProducts.length} products found</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="View all products" onPress={showAllProducts}>
          <Text style={styles.viewAll}>View All  &gt;</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <>
      {!loading ? (
        <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
          <View style={styles.container}>
            {focus ? (
              <SearchedProducts
                productsFiltered={filteredProducts}
                topContent={renderTopContent(false)}
                clearSearchScreen={() => {
                  setFocus(false);
                }}
              />
            ) : (
              <View style={styles.listContainer}>
                <FlatList
                  ref={listRef}
                  key={`catalog-${columns}`}
                  data={Array.isArray(filteredProducts) ? filteredProducts : []}
                  renderItem={({ item }) => (
                    <ProductList
                      item={item}
                      navigation={props.navigation}
                      columns={columns}
                    />
                  )}
                  keyExtractor={(item, index) =>
                    buildProductKey(item, index, "catalog")
                  }
                  numColumns={columns}
                  columnWrapperStyle={{ gap: 10, paddingHorizontal: 12 }}
                  contentContainerStyle={styles.flatListContent}
                  ListHeaderComponent={renderTopContent(true)}
                  ListFooterComponent={<View style={styles.benefits}>
                    {[
                      { icon: "shield-alt", title: "Secure Payment", detail: "Shop with confidence" },
                      { icon: "shipping-fast", title: "Delivery", detail: "Track your order" },
                      { icon: "headset", title: "Customer Support", detail: "Here to help" },
                    ].map((benefit) => <View key={benefit.title} style={styles.benefit}>
                      <Icon name={benefit.icon} size={22} color="#111111" />
                      <View style={styles.benefitCopy}><Text style={styles.benefitTitle}>{benefit.title}</Text>
                        <Text style={styles.benefitDetail}>{benefit.detail}</Text></View>
                    </View>)}
                  </View>}
                  ListEmptyComponent={(
                    <View style={[styles.center, { height: 180 }]}>
                      <Text style={styles.emptyText}>No products available right now</Text>
                    </View>
                  )}
                />
              </View>
            )}
          </View>
        </SafeAreaView>
      ) : (
        <View style={[styles.center, { height: "100%", backgroundColor: "#FAFAFA" }]}>
          <ActivityIndicator size="large" color="#0F172A" />
          <Text style={styles.loadingText}>Loading Products...</Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  searchbar: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 0,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchInput: {
    fontSize: 14,
    color: "#111827",
  },
  listContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flatListContent: {
    paddingBottom: 32,
  },
  serviceAction: {
    flex: 1,
    backgroundColor: "#FFDA0A",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    minHeight: 76,
  },
  serviceActionText: {
    color: "#030501",
    fontSize: 14,
    fontWeight: "700",
  },
  serviceCopy: { flexGrow: 1, flexShrink: 1 },
  serviceDetail: { fontSize: 10, color: "#292400", marginTop: 3 },
  shoppingActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 14,
  },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 12, marginTop: 18, marginBottom: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#111111" },
  viewAll: { fontSize: 12, color: "#111827", paddingVertical: 8 },
  promo: { marginHorizontal: 12, marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: "#FFDD24", flexDirection: "row", alignItems: "center", overflow: "hidden" },
  promoCopy: { flex: 1 },
  promoTitle: { fontSize: 23, lineHeight: 27, fontWeight: "800", color: "#111111" },
  promoDetail: { fontSize: 12, lineHeight: 17, color: "#292400", marginTop: 8 },
  shopButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#292400", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  shopButtonText: { fontSize: 12, fontWeight: "700", color: "#111111" },
  promoImage: { width: "48%", aspectRatio: 1.55, marginLeft: 10, borderRadius: 8 },
  promoFallback: { marginHorizontal: 20 },
  benefits: { margin: 12, padding: 14, backgroundColor: "#FFFAEB", borderRadius: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  benefit: { flex: 1, minWidth: 90, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  benefitCopy: { flexShrink: 1 },
  benefitTitle: { fontSize: 11, fontWeight: "700", color: "#111827" },
  benefitDetail: { fontSize: 10, color: "#64748B", marginTop: 3 },
  advancedToggle: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  advancedToggleInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  advancedToggleText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  featuredSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  featuredTitle: {
    marginHorizontal: 14,
    marginBottom: 10,
    color: "#000000",
    fontSize: 18,
    fontWeight: "800",
  },
  featuredCard: {
    width: 125,
    padding: 8,
    marginBottom: 10,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  featuredImage: {
    width: "100%",
    height: 80,
  },
  featuredName: { fontSize: 12, color: "#111827", marginTop: 6 },
  resultMeta: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 11,
  },
  errorBanner: {
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "600",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingText: {
    color: "#111827",
    marginTop: 12,
    fontWeight: "600",
    fontSize: 15,
  },
});

export default ProductContainer;