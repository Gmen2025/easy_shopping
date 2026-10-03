// import React from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   Image,
//   useWindowDimensions,
// } from "react-native";
// import EasyButton from "../../Shared/StyledComponenets/EasyButton";
// import Toast from "react-native-toast-message";
// import { useDispatch } from "react-redux";
// import { addToCart } from "../../store/cartSlice"; // Adjust the import path as necessary
// import getImageUrl from "../../assets/common/getImageUrl";
// import { useCurrency } from "../../assets/common/currency";
// import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

// const ProductCard = (props) => {
//   const { name, price, image, countInStock } = props;
//   const imageUrl = getImageUrl(props);
//   const dispatch = useDispatch(); // Import the action to add items to the cart
//   const { formatPrice } = useCurrency();
//   const stockCount = Number(countInStock || 0);
//   const { width, height } = useWindowDimensions();
//   const shortestSide = Math.min(width, height);
//   const isTablet = shortestSide >= 600;
//   const cardWidth = isTablet ? width / 2 - 28 : width / 2 - 20;

//   const handleAddToCart = async () => {
//     const databaseName = await getDatabaseNameFromStorage();
//     const product = {
//       _id: props._id, // Assuming each product has a unique id
//       name: name,
//       price: price,
//       image: image,
//       countInStock: countInStock,
//       databaseName,
//     };

//     // Check if the product is already in the cart
//     dispatch(addToCart(product));

//     Toast.show({
//       type: "success",
//       text1: `${name} added to cart`,
//       text2: "Go to your cart to complete order",
//     });
//   };

//   return (
//     <View style={[styles.container, { width: cardWidth }]}>
//       <View style={styles.imageWrap}>
//       <Image
//         source={{
//           uri: imageUrl,
//         }}
//         style={styles.image}
//         resizeMode="cover"
//       />
//       </View>
//       <View style={styles.stockRow}>
//         <Text
//           style={[
//             styles.stockBadge,
//             stockCount > 0 ? styles.stockIn : styles.stockOut,
//           ]}
//         >
//           {stockCount > 0 ? `${stockCount} left` : "Out of Stock"}
//         </Text>
//       </View>
//       <Text style={styles.title}>
//         {name.length > 32 ? name.substring(0, 29) + "..." : name}
//       </Text>
//       <Text style={styles.price}>{formatPrice(price)}</Text>
//       {stockCount > 0 ? (
//         <View style={styles.buttonWrap}>
//           <EasyButton
//             primary
//             onPress={handleAddToCart}
//             medium
//             style={styles.addButton}
//           >
//             <Text style={styles.addText}>Add to Cart</Text>
//           </EasyButton>
//         </View>
//       ) : (
//         <Text style={styles.unavailableText}>Currently unavailable</Text>
//       )}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     padding: 10,
//     borderRadius: 14,
//     marginTop: 12,
//     marginBottom: 8,
//     marginLeft: 8,
//     alignItems: "flex-start",
//     elevation: 3,
//     borderWidth: 1,
//     borderColor: "#dce3ef",
//     backgroundColor: "white",
//   },
//   imageWrap: {
//     width: "100%",
//     height: 120,
//     borderRadius: 10,
//     overflow: "hidden",
//     backgroundColor: "#eef3fa",
//   },
//   image: {
//     width: "100%",
//     height: "100%",
//     backgroundColor: "transparent",
//   },
//   stockRow: {
//     width: "100%",
//     marginTop: 10,
//   },
//   stockBadge: {
//     alignSelf: "flex-start",
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 8,
//     fontSize: 11,
//     fontWeight: "700",
//   },
//   stockIn: {
//     backgroundColor: "#e9f9ef",
//     color: "#1f7a45",
//   },
//   stockOut: {
//     backgroundColor: "#fdebec",
//     color: "#c0392b",
//   },
//   title: {
//     marginTop: 8,
//     fontWeight: "multi",
//     fontSize: 10,
//     color: "#333",
//     minHeight: 30,
//   },
//   price: {
//     fontSize: 10,
//     color: "#8a6c09",
//     fontWeight: "700",
//   },
//   buttonWrap: {
//     marginTop: 6,
//     width: "100%",
//     alignItems: "flex-end",
//   },
//   addButton: {
//     borderRadius: 10,
//     paddingVertical: 4,
//   },
//   addText: {
//     color: "white",
//     fontWeight: "700",
//     fontSize: 13,
//     letterSpacing: 0.2,
//   },
//   unavailableText: {
//     marginTop: 2,
//     color: "#7a8699",
//     fontWeight: "multi",
//   },
// });

// export default ProductCard;













import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import { useDispatch } from "react-redux";
import { addToCart } from "../../store/cartSlice"; // Adjust the import path as necessary
import getImageUrl from "../../assets/common/getImageUrl";
import { useCurrency } from "../../assets/common/currency";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

const ProductCard = (props) => {
  const { name, price, image, countInStock } = props;
  const imageUrl = getImageUrl(props);
  const dispatch = useDispatch();
  const { formatPrice } = useCurrency();
  const stockCount = Number(countInStock || 0);
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isTablet = shortestSide >= 600;
  const cardWidth = isTablet ? width / 2 - 28 : width / 2 - 20;

  const handleAddToCart = async () => {
    const databaseName = await getDatabaseNameFromStorage();
    const product = {
      _id: props._id,
      name: name,
      price: price,
      image: image,
      countInStock: countInStock,
      databaseName,
    };

    dispatch(addToCart(product));

    Toast.show({
      type: "success",
      text1: `${name} added to cart`,
      text2: "Go to your cart to complete order",
    });
  };

  return (
    <View style={[styles.container, { width: cardWidth }]}>
      <View style={styles.imageWrap}>
        <Image
          source={{
            uri: imageUrl,
          }}
          style={styles.image}
          resizeMode="cover"
        />
      </View>

      <View style={styles.stockRow}>
        <Text
          style={[
            styles.stockBadge,
            stockCount > 0 ? styles.stockIn : styles.stockOut,
          ]}
        >
          {stockCount > 0 ? `${stockCount} left` : "Out of Stock"}
        </Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {name}
      </Text>

      <Text style={styles.price}>{formatPrice(price)}</Text>

      {stockCount > 0 ? (
        <View style={styles.buttonWrap}>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
            onPress={handleAddToCart}
          >
            <Text style={styles.addText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.unavailableText}>Currently unavailable</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 6,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  imageWrap: {
    width: "100%",
    height: 125,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  stockRow: {
    width: "100%",
    marginTop: 10,
  },
  stockBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "700",
  },
  stockIn: {
    backgroundColor: "#DCFCE7",
    color: "#15803D",
  },
  stockOut: {
    backgroundColor: "#FEE2E2",
    color: "#B91C1C",
  },
  title: {
    marginTop: 8,
    fontWeight: "600",
    fontSize: 13,
    color: "#111827",
    minHeight: 36,
    lineHeight: 18,
  },
  price: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "800",
    marginTop: 4,
  },
  buttonWrap: {
    marginTop: 10,
    width: "100%",
  },
  addButton: {
    backgroundColor: "#0F172A",
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  addText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  unavailableText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default ProductCard;