import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
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

//loading static resources
//const data = require("../../assets/data/products.json");
//const productsCategories = require("../../assets/data/categories.json");

var { width } = Dimensions.get("window");

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ProductContainer = (props) => {
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

  //initializing the state variables
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
    if (!value) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "object") {
      return value.$oid || value._id || "";
    }

    return "";
  };

  //initializing the products when the applivation is loaded
  useFocusEffect((
    useCallback(() => {
    let mounted = true;

    // Reset state variables
    setFocus(false); //initial value when loaded the application
    setActive(-1);
    setLoadError("");

    const loadCatalog = async () => {
      if (mounted) {
        setLoading(true);
      }

      try {
        const [productsRes, categoriesRes] = await Promise.all([
          getWithRetry(`${baseUrl}products`, {}, { retries: 2, delayMs: 1200 }),
          getWithRetry(`${baseUrl}categories`, {}, { retries: 1, delayMs: 800 }),
        ]);

        if (!mounted) {
          return;
        }

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
        if (!mounted) {
          return;
        }

        if (isServiceUnavailableError(err)) {
          setLoadError("Server is waking up. Please retry in a few seconds.");
        } else {
          setLoadError("Could not load products right now. Please try again.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCatalog();


    return () => {
      mounted = false;
      // cleanup to avoid memory leaks or remaining cach in the browser
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
    }, 
    [],
  )
  ))

  //search product method
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

  //Categories filter method
  const changeCtg = (ctg) => {
    if (ctg === "all") {
      setSelectedCategoryId(null);
      setActive(-1); // Set active to -1 for "All" category
    } else {
      const categoryValue = categories.find((item) => item.name === ctg);
      if (!categoryValue) {
        return;
      }

      const categoryId = extractId(categoryValue._id);
      setSelectedCategoryId(categoryId);
      const categoryIndex = categories.findIndex(
        (category) => category.name === ctg
      );
      setActive(categoryIndex); // Set active to the index of the selected category
    }
  };
  //calls a prop function to clear the search screen
  // This function is passed to the SearchedProducts component to clear the search results 
  // and return to the main product list.
  //clearSearchScreen = () => {setFocus(false);};

  const renderTopContent = (showCategories = false) => (
    <>
      <Image
        source={{ uri: promoGraphicUrl }}
        style={styles.topGraphic}
        resizeMode="contain"
      />
      <Searchbar
        placeholder="Search"
        value={searchKeyword}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
        clearIcon={searchKeyword ? "close" : null}
        onClear={clearSearch}
        onChangeText={(text) => searchProduct(text)}
        onFocus={openList}
        onSubmitEditing={openList}
      />
      <TouchableOpacity
        style={styles.advancedToggle}
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
          <Text style={styles.featuredTitle}>Featured Products</Text>
          <FlatList
            horizontal
            pagingEnabled
            data={featuredProductSets}
            keyExtractor={(_, index) => `featured-set-${index}`}
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            decelerationRate="fast"
            renderItem={({ item: setItems, index: setIndex }) => (
              <View style={styles.featuredSetScreen}>
                <Text style={styles.featuredSetTitle}>Set {setIndex + 1}</Text>
                <View style={styles.featuredGrid}>
                  {setItems.map((item, itemIndex) => (
                    <TouchableOpacity
                      key={extractId(item._id) || `featured-${setIndex}-${itemIndex}`}
                      style={styles.featuredCard}
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
        <View>
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
      {loading == false ? (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {focus == true ? (
              <>
                {renderTopContent(false)}
                <SearchedProducts
                  productsFiltered={filteredProducts}
                  clearSearchScreen={() => {
                    setFocus(false);
                  }}
                />
              </>
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
                    extractId(item._id) || index.toString()
                  }
                  numColumns={2}
                  columnWrapperStyle={{ justifyContent: "space-between" }}
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
        <View style={[styles.center, { height: "100%" }]}>
          <ActivityIndicator size="large" color="#8a6c09" />
          <Text style={styles.loadingText}>Loading Products...</Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  container: {
    flex: 1, // Ensure the container takes up the full screen
    backgroundColor: "#f3f6fb",
  },
  heroHeader: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: "goldenrod",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  heroSubtitle: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
  },
  searchbar: {
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce3ef",
  },
  topGraphic: {
    marginHorizontal: 10,
    borderRadius: 12,
    height: 170,
    width: width - 20,
    backgroundColor: "#e8edf7",
  },
  searchInput: {
    fontSize: 14,
    color: "#1f2937",
  },
  listContainer: {
    width: width,
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f3f6fb",
  },
  flatListContent: {
    paddingHorizontal: 10,
    paddingBottom: 26,
  },
  advancedToggle: {
    marginHorizontal: 10,
    marginTop: 8,
    backgroundColor: "goldenrod",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  advancedToggleInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  advancedToggleText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  advancedToggleIcon: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },
  featuredSection: {
    marginTop: 10,
    marginBottom: 6,
  },
  featuredTitle: {
    marginHorizontal: 12,
    marginBottom: 10,
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  featuredSetScreen: {
    width: width,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  featuredSetTitle: {
    marginBottom: 8,
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  featuredGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featuredCard: {
    width: (width - 34) / 2,
    height: 88,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
    borderWidth: 1,
    borderColor: "#dce3ef",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  resultMeta: {
    marginHorizontal: 12,
    marginTop: 8,
    color: "#5b6778",
    fontSize: 12,
    fontWeight: "600",
  },
  errorBanner: {
    marginHorizontal: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#f4c7c3",
    borderRadius: 10,
    backgroundColor: "#fff1f0",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  errorText: {
    color: "#a73f38",
    fontSize: 12,
    fontWeight: "600",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 15,
  },
  loadingText: {
    color: "#475569",
    marginTop: 8,
    fontWeight: "600",
  },
});

export default ProductContainer;
