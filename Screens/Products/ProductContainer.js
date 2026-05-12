import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Text,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import baseUrl from "../../assets/common/baseUrl";
import axios from "axios";

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

const ProductContainer = (props) => {
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
    // Reset state variables
    setFocus(false); //initial value when loaded the application
    setActive(-1);

    // Fetch products from the API
    axios
      .get(`${baseUrl}products`)
      .then((res) => {
        const fetchedProducts = Array.isArray(res.data)
          ? res.data
          : res.data.products;
        const normalizedProducts = (fetchedProducts || []).map((product) => ({
          ...product,
          image: getImageUrl(product),
        }));
        setProducts(normalizedProducts);
        setLoading(false); // Set loading to false after fetching products
      })
      .catch((err) => {
        console.log("API call error: ", err);
        console.log("url is: ", `${baseUrl}products`);
        setLoading(false);
      });

      //Categories API call
      axios
      .get(`${baseUrl}categories`)
      .then((res) => {
        const fetchedCategories = Array.isArray(res.data)
          ? res.data
          : res.data.categories;
        setCategories(fetchedCategories || []);
      }).catch((err) => {
        console.log("API call error: ", err);
      });


    return () => {
      // cleanup to avoid memory leaks or remaining cach in the browser
      setProducts([]);
      setFocus(false);
      setSearchKeyword("");
      setCategories([]);
      setActive(-1);
      setSelectedCategoryId(null);
      setShowAdvancedFilters(false);
      setAdvancedFilters(defaultAdvancedFilters);
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
  
  return (
    <>
      {loading == false ? (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.heroHeader}>
              <Text style={styles.heroTitle}>Discover Products</Text>
              <Text style={styles.heroSubtitle}>Curated picks for your everyday shopping.</Text>
            </View>
            <Searchbar
              placeholder="Search"
              value={searchKeyword}
              style={styles.searchbar}
              inputStyle={styles.searchInput}
              clearIcon={searchKeyword ? "close" : null}
              onClear={clearSearch} //Handle clear action
              onChangeText={(text) => searchProduct(text)}
              onFocus={openList}
              onSubmitEditing={openList} //Handle submit action
            />
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvancedFilters((prev) => !prev)}
            >
              <Text style={styles.advancedToggleText}>
                {showAdvancedFilters ? "Hide Filters" : "Advanced Filters"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.resultMeta}>{filteredProducts.length} products found</Text>
            <AdvancedFilters
              visible={showAdvancedFilters}
              filters={advancedFilters}
              brands={availableBrands}
              onFilterChange={handleAdvancedFilterChange}
              onReset={resetAdvancedFilters}
              onToggle={() => setShowAdvancedFilters(false)}
            />
            {focus == true ? (
              <SearchedProducts
                productsFiltered={filteredProducts}
                clearSearchScreen={() => {
                  setFocus(false);
                }} //calls a prop function to clear the search textinput
              />
            ) : (
              <View style={styles.listContainer}>
                <View>
                  {/* <View>
                    <Banner />
                  </View> */}
                  <View>
                    <CategoriesFilter
                      categories={categories}
                      categoryFilter={changeCtg}
                      active={active}
                      setActive={setActive}
                    />
                  </View>
                  {Array.isArray(filteredProducts) && filteredProducts.length > 0 ? (
                    <FlatList
                      data={filteredProducts}
                      renderItem={({ item }) => (
                        <ProductList
                          item={item}
                          navigation={props.navigation}
                        />
                      )}
                      keyExtractor={(item, index) =>
                        extractId(item._id) || index.toString()
                      }
                      numColumns={2} // Display items in two columns
                      columnWrapperStyle={{ justifyContent: "space-between" }} // Style for rows
                      contentContainerStyle={styles.flatListContent}
                    />
                  ) : (
                    <View style={[styles.center, { height: "40%" }]}>
                      <Text style={styles.emptyText}>No products available right now</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      ) : (
        <View style={[styles.center, { height: "100%" }]}>
          <ActivityIndicator size="large" color="#0f3f79" />
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
    flexWrap: "wrap",
    backgroundColor: "#f3f6fb",
  },
  heroHeader: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: "#0f1f36",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  heroSubtitle: {
    color: "#d2dced",
    fontSize: 13,
    lineHeight: 18,
  },
  searchbar: {
    marginHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce3ef",
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
    backgroundColor: "#0f3f79",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11,
  },
  advancedToggleText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  resultMeta: {
    marginHorizontal: 12,
    marginTop: 8,
    color: "#5b6778",
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
