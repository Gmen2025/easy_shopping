import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Button,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { Searchbar } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import ListItem from "./ListItem";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";

import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";

var { height, width } = Dimensions.get("window");

const ListHeader = () => {
  return (
    <View style={styles.listHeader}>
      <Text style={styles.headerItem}>Image</Text>
      <Text style={styles.headerItem}>Brand</Text>
      <Text style={styles.headerItem}>Name</Text>
      <Text style={styles.headerItem}>Category</Text>
      <Text style={styles.headerItem}>Price</Text>
    </View>
  );
};

const Products = (props) => {
  const [productList, setProductList] = useState();
  const [productFilter, setProductFilter] = useState();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState();
  const [search, setSearch] = useState("");

  useFocusEffect(
    //useCallback is used to prevent the function from being called multiple times unnecessarily
    // It will only be recreated if any of its dependencies change
    useCallback(() => {
      // Fetch the token from AsyncStorage
      AsyncStorage.getItem("token")
        .then((res) => {
          setToken(res);
        })
        .catch((error) => console.log(error));

      // Fetch products from the API
      axios
        .get(`${baseUrl}products`)
        .then((res) => {
          const fetchedProducts = Array.isArray(res.data)
            ? res.data
            : res.data.products;
          setProductList(fetchedProducts || []);
          setProductFilter(fetchedProducts || []);
          setLoading(false); // Set loading to false after fetching products
        })
        .catch((error) => {
          console.log("Api call error");
        });

      return () => {
        setProductList(); // Cleanup function to reset productList when component unmounts
        setProductFilter(); // Cleanup function to reset productFilter when component unmounts
        setLoading(true); // Reset loading state
      };
    }, [])
  );

  const deleteProduct = (id) => {
    axios
      .delete(`${baseUrl}products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const newProductList = productFilter.filter((item) => item._id !== id);
        setProductFilter(newProductList);
        setProductList(newProductList);
      })
      .catch((error) => console.log("Api delete error: ", error));
  };

  return (
    <View style={styles.mainContainer}>
      {/* Header  */}
      {/* Search Bar  */}
      <View style={styles.buttonContainer}>
        <EasyButton
          tertiary
          medium
          onPress={() => props.navigation.navigate("Orders")}
        >
          <Icon name="shopping-bag" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "bold" }}>
            Orders
          </Text>
        </EasyButton>
        <EasyButton
          tertiary
          medium
          onPress={() => props.navigation.navigate("ProductForm")}
        >
          <Icon name="plus" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "bold" }}>
            Products
          </Text>
        </EasyButton>
        <EasyButton
          tertiary
          medium
          onPress={() => props.navigation.navigate("Categories")}
        >
          <Icon name="plus" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "bold" }}>
            Categories
          </Text>
        </EasyButton>
      </View>
      <View
        style={{
          margin: 10,
        }}
      >
        <Searchbar
          placeholder="Type Here..."
          onChangeText={(text) => {
            setSearch(text);
            if (text) {
              const newProductList = productList.filter((item) => {
                const itemData = item.name ? item.name.toUpperCase() : "";
                const textData = text.toUpperCase();
                return itemData.indexOf(textData) > -1;
              });
              setProductFilter(newProductList);
            } else {
              setProductFilter(productList);
            }
          }}
          value={search}
          style={{ backgroundColor: "lightgray" }} // Use style for background
        />
      </View>
      {/* Product List  */}
      <View style={{ marginBottom: 200 }}>
        {loading ? (
          <View style={styles.spinner}>
            <ActivityIndicator size="large" color="blue" />
          </View>
        ) : (
          <FlatList
            data={productFilter}
            ListHeaderComponent={ListHeader}
            stickyHeaderIndices={[0]} // Make the header sticky
            ListFooterComponent={<View style={{ marginBottom: 60 }} />} // Add space at the bottom
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            numColumns={1}
            renderItem={({ item, index }) => (
              <View style={styles.container}>
                <ListItem
                  item={item}
                  navigation={props.navigation}
                  index={index}
                  delete={deleteProduct}
                />
              </View>
            )}
            keyExtractor={(item) => item._id}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "blue",
    margin: 3,
  },
  spinner: {
    height: height / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  listHeader: {
    flexDirection: "row",
    padding: 5,
    width: width,
    backgroundColor: "orange",
  },
  headerItem: {
    margin: 3,
    fontWeight: "bold",
    width: width / 6,
    textAlign: "center",
  },
  mainContainer: {
    marginBottom: 20,
    backgroundColor: "white",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    margin: 5,
  }
});

export default Products;
