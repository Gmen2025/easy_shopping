import React from "react";
import {
  View,
  Image,
  StyleSheet,
  Text,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from "react-native";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import { useNavigation } from "@react-navigation/native";
import getImageUrl from "../../assets/common/getImageUrl";
import { useCurrency } from "../../assets/common/currency";

var { width } = Dimensions.get("window");

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

const buildSearchKey = (item, index) => {
  const id = extractId(item?._id) || extractId(item?.id) || "no-id";
  return `search-${id}-${index}`;
};

const SearchedProducts = (props) => {
  const navigation = useNavigation(); // Access the navigation object
  const { productsFiltered = [], topContent = null } = props;
  const { formatPrice } = useCurrency();

  // productsFiltered is an array of products that match the search criteria
  return (
    <View style={styles.screen}>
      <FlatList
        data={productsFiltered}
        keyExtractor={(item, index) => buildSearchKey(item, index)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <>
            {topContent}
            <EasyButton
              secondary
              medium
              style={styles.backButton}
              onPress={props.clearSearchScreen}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </EasyButton>
          </>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyStateWrap}>
            <Text style={styles.emptyStateText}>No products match the selected criteria</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate("Product Detail", { item: item })}
          >
            <View style={styles.productContainer}>
              <Image
                source={{
                  uri: getImageUrl(item),
                }}
                style={styles.productImage}
                resizeMode="cover"
              />
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productDescription} numberOfLines={2}>
                  {item.description || "No description available"}
                </Text>
                <Text style={styles.productPrice}>{formatPrice(item.price || 0)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  listContent: {
    paddingBottom: 20,
  },
  backButton: {
    alignSelf: "flex-end",
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 4,
  },
  backButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },
  productContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce3ef",
    backgroundColor: "#ffffff",
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eef3fa",
  },
  productDetails: {
    marginLeft: 12,
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  productDescription: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 3,
  },
  productPrice: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#8a6c09",
  },
  emptyStateWrap: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    color: "#64748b",
    fontSize: 15,
    textAlign: "center",
  },
});

export default SearchedProducts;
// The SearchedProducts component is a functional component that receives productsFiltred as props and returns
// a view that displays the filtered products. The view contains a Content component from ReactNative that displays
// a list of products if productsFiltred is not empty. If productsFiltred is empty, a message is displayed indicating
// that no products match the selected criteria.
