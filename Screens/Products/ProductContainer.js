import react, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Text,
  Icon,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import baseUrl from "../../assets/common/baseUrl";
import axios from "axios";

import { Searchbar } from "react-native-paper";
import ProductList from "./ProductList";
import SearchedProducts from "./SearchedProducts";
import Banner from "../../Shared/Banner";
import CategoriesFilter from "./CategoriesFilter";

//loading static resources
//const data = require("../../assets/data/products.json");
//const productsCategories = require("../../assets/data/categories.json");

var { width } = Dimensions.get("window");
var { height } = Dimensions.get("window");

const ProductContainer = (props) => {
  //initializing the state variables
  const [products, setProducts] = useState([]);
  const [productsFiltered, setProductsFiltered] = useState([]);
  const [focus, setFocus] = useState();
  const [categories, setCategories] = useState([]);
  const [productsCtg, setProductsCtg] = useState([]);
  const [active, setActive] = useState();
  const [initialState, setInitialState] = useState([]);
  const [loading, setLoading] = useState(true);
  

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
        setProducts(fetchedProducts || []);
        setProductsFiltered(fetchedProducts || []);
        setProductsCtg(fetchedProducts || []);
        setInitialState(fetchedProducts || []); // Store the initial state of products
        setLoading(false); // Set loading to false after fetching products
      })
      .catch((err) => {
        console.log("API call error: ", err);
        console.log("url is: ", `${baseUrl}products`);
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
      setProductsFiltered([]);
      setFocus();
      setCategories([]);
      setActive();
      setInitialState([]);
    };
    }, 
    [],
  )
  ))

  //search product method
  const searchProduct = (text) => {
    setProductsFiltered(
      products.filter((i) => i.name.toLowerCase().includes(text.toLowerCase()))
    );
  };

  const openList = () => {
    setFocus(true);
  };

  const clearSearch = () => {
    setProductsFiltered([]);
  };

  //Categories filter method
  const changeCtg = (ctg) => {
    if (ctg === "all") {
      setProductsCtg(initialState); // Reset to the initial state
      setActive(-1); // Set active to -1 for "All" category
    } else {
      const categoryValue = categories.find((item) => item.name === ctg);
      const categoryId = categoryValue._id;
      const filteredProducts = products.filter(
        (item) => item.category?._id === categoryId
      );
      setProductsCtg(filteredProducts); // Update products based on the selected category
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
            <Searchbar
              placeholder="Search"
              value={productsFiltered} //value of the search bar
              clearIcon={productsFiltered ? "close" : null} //conditionally render the clear icon
              onClear={clearSearch} //Handle clear action
              onChangeText={(text) => searchProduct(text)}
              onSubmitEditing={openList} //Handle submit action
            />
            {focus == true ? (
              <SearchedProducts
                productsFiltered={productsFiltered}
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
                      productsCtg={productsCtg}
                      active={active}
                      setActive={setActive}
                    />
                  </View>
                  {Array.isArray(productsCtg) && productsCtg.length > 0 ? (
                    <FlatList
                      data={productsCtg}
                      renderItem={({ item }) => (
                        <ProductList
                          item={item}
                          navigation={props.navigation}
                        />
                      )}
                      keyExtractor={(item, index) =>
                        item._id?.$oid || index.toString()
                      }
                      numColumns={2} // Display items in two columns
                      columnWrapperStyle={{ justifyContent: "space-between" }} // Style for rows
                      contentContainerStyle={styles.flatListContent}
                    />
                  ) : (
                    <View style={[styles.center, { height: "40%" }]}>
                      <Text>No Products Found Now</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      ) : (
        <View style={[styles.center, { height: "100%" }]}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Loading Products...</Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "white",
  },
  container: {
    flex: 1, // Ensure the container takes up the full screen
    flexWrap: "wrap",
    backgroundColor: "gainsboro",
  },
  listContainer: {
    width: width,
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "gainsboro",
  },
  flatListContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ProductContainer;
