import React, { useState, useCallback, useMemo } from "react";
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

if (Platform.OS === "android" && !global.nativeFabricUIManager && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ProductContainer = (props) => {
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const topGraphicHeight = isTablet ? Math.min(screenWidth * 0.42, 320) : 170;
  const featuredSetWidth = screenWidth;
  const featuredCardWidth = isTablet ? (screenWidth - 54) / 2 : (screenWidth - 34) / 2;
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

  const featuredProductSets = useMemo(() => {
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

    const sets = [];
    for (let i = 0; i < rankedProducts.length; i += 4) {
      sets.push(rankedProducts.slice(i, i + 4));
    }

    return sets;
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

  const renderTopContent = (showCategories = false) => (
    <>
      <Image
        source={{ uri: promoGraphicUrl }}
        style={[styles.topGraphic, { width: screenWidth, height: topGraphicHeight }]}
        resizeMode="contain"
      />
      <TouchableOpacity
        style={styles.serviceAction}
        activeOpacity={0.85}
        onPress={() => props.navigation.navigate("Service Request")}
      >
        <Text style={styles.serviceActionText}>Request Machine Service</Text>
      </TouchableOpacity>
      <Searchbar
        placeholder="Search products..."
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
      <TouchableOpacity
        style={styles.advancedToggle}
        activeOpacity={0.85}
        onPress={toggleAdvancedFilters}
      >
        <View style={styles.advancedToggleInner}>
          <Text style={styles.advancedToggleText}>Advanced Filters</Text>
          <Text style={styles.advancedToggleIcon}>{showAdvancedFilters ? "▲" : "▼"}</Text>
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
      {featuredProductSets.length > 0 ? (
        <View style={styles.featuredSection}>
          <Text style={styles.featuredTitle}>FEATURED PRODUCTS</Text>
          <FlatList
            horizontal
            pagingEnabled
            data={featuredProductSets}
            keyExtractor={(_, index) => `featured-set-${index}`}
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            decelerationRate="fast"
            renderItem={({ item: setItems, index: setIndex }) => (
              <View style={[styles.featuredSetScreen, { width: featuredSetWidth }]}>
                <Text style={styles.featuredSetTitle}>Set {setIndex + 1}</Text>
                <View style={styles.featuredGrid}>
                  {setItems.map((item, itemIndex) => (
                    <TouchableOpacity
                      key={buildProductKey(item, itemIndex, `featured-${setIndex}`)}
                      style={[styles.featuredCard, { width: featuredCardWidth, height: isTablet ? 128 : 88 }]}
                      activeOpacity={0.85}
                      onPress={() => props.navigation.navigate("Product Detail", { item })}
                    >
                      <Image
                        source={{ uri: item.image || getImageUrl(item) }}
                        style={styles.featuredImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          />
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}
      <Text style={styles.resultMeta}>{filteredProducts.length} products found</Text>
      {showCategories ? (
        <View style={styles.categoriesContainer}>
          <CategoriesFilter
            categories={categories}
            categoryFilter={changeCtg}
            active={active}
            setActive={setActive}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <>
      {!loading ? (
        <SafeAreaView style={styles.safeArea}>
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
                  data={Array.isArray(filteredProducts) ? filteredProducts : []}
                  renderItem={({ item }) => (
                    <ProductList
                      item={item}
                      navigation={props.navigation}
                    />
                  )}
                  keyExtractor={(item, index) =>
                    buildProductKey(item, index, "catalog")
                  }
                  numColumns={2}
                  columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 10 }}
                  contentContainerStyle={styles.flatListContent}
                  ListHeaderComponent={renderTopContent(true)}
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
    backgroundColor: "#FAFAFA",
  },
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  searchbar: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  topGraphic: {
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  searchInput: {
    fontSize: 14,
    color: "#111827",
  },
  listContainer: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  flatListContent: {
    paddingBottom: 32,
  },
  serviceAction: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: "#eac749ff",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  serviceActionText: {
    color: "#030501",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  advancedToggle: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 12,
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
    fontSize: 14,
    letterSpacing: 0.2,
  },
  advancedToggleIcon: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
  },
  featuredSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  featuredTitle: {
    marginHorizontal: 14,
    marginBottom: 10,
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  featuredSetScreen: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  featuredSetTitle: {
    marginBottom: 8,
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  featuredGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featuredCard: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  resultMeta: {
    marginHorizontal: 14,
    marginTop: 12,
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },
  categoriesContainer: {
    marginTop: 6,
    marginBottom: 8,
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