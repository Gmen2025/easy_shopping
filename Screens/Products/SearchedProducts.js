import React, { useEffect } from "react";
import {
  View,
  Image,
  StyleSheet,
  Content,
  Body,
  Text,
  Dimensions,
  Button,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from "react-native";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import { useNavigation } from "@react-navigation/native";

var { width } = Dimensions.get("window");
var { height } = Dimensions.get("window");

const SearchedProducts = (props) => {
  const navigation = useNavigation(); // Access the navigation object
  const { productsFiltered = [] } = props;

  // productsFiltered is an array of products that match the search criteria
  return (
    <View style={{ width: width, height: height - 300 }}>
      <EasyButton
        tertiary
        medium
        style={{ alignSelf: "flex-end", margin: 10 }}
        onPress={props.clearSearchScreen} //calls a prop function to clear the search screen
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Back</Text>
      </EasyButton>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {productsFiltered.length > 0 ? (
          productsFiltered.map((item) => (
            <TouchableOpacity
              key={item._id}
              onPress={
                () => navigation.navigate("Product Detail", { item: item }) // Navigate to Product Detail screen means SingleProduct component
              }
            >
              <View style={styles.productContainer}>
                <Image
                  source={{
                    uri: item.image
                      ? item.image
                      : "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
                  }}
                  style={styles.productImage}
                />
                <View style={styles.productDetails}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productDescription}>
                    {item.description}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text>No products match the selected criteria</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  productContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 5,
  },
  productDetails: {
    marginLeft: 10,
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  productDescription: {
    fontSize: 14,
    color: "gray",
  },
});

export default SearchedProducts;
// The SearchedProducts component is a functional component that receives productsFiltred as props and returns
// a view that displays the filtered products. The view contains a Content component from ReactNative that displays
// a list of products if productsFiltred is not empty. If productsFiltred is empty, a message is displayed indicating
// that no products match the selected criteria.
