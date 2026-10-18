import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Text,
  View,
  Image,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome5";
import getImageUrl from "../../assets/common/getImageUrl";

const CategoriesFilter = (props) => {
  const getCategoryId = (category) => {
    const rawId = category?._id;
    if (!rawId) {
      return "no-id";
    }

    if (typeof rawId === "string") {
      return rawId;
    }

    if (typeof rawId === "object") {
      return rawId.$oid || rawId._id || "no-id";
    }

    return String(rawId);
  };

  return (
    <ScrollView
      bounces={true}
      horizontal={true}
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      {/* "All" Category */}
      <TouchableOpacity
        key="all"
        onPress={() => {
          props.categoryFilter("all");
          props.setActive(-1);
        }}
        style={styles.touchableOpacity}
        accessibilityRole="button"
        accessibilityLabel="All categories"
        accessibilityState={{ selected: props.active === -1 }}
      >
        <View style={[styles.circle, props.active === -1 && styles.active]}>
          <Icon name="th-large" size={26} color="#111111" />
        </View>
        <Text style={styles.label}>All</Text>
      </TouchableOpacity>

      {/* Dynamic Categories */}
      {props.categories.map((item, index) => {
        const product = (props.products || []).find((entry) =>
          getCategoryId({ _id: entry.category?._id || entry.category }) === getCategoryId(item));
        const artwork = item.image || product;
        return (
        <TouchableOpacity
          key={`category-${getCategoryId(item)}-${index}`}
          onPress={() => {
            props.categoryFilter(item.name);
            props.setActive(index);
          }}
          style={styles.touchableOpacity}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          accessibilityState={{ selected: props.active === index }}
        >
          <View style={[styles.circle, props.active === index && styles.active]}>
            {artwork ? <Image source={{ uri: getImageUrl(artwork) }} style={styles.image} resizeMode="contain" />
              : <Icon name="shopping-bag" size={26} color="#111111" />}
          </View>
          <Text style={styles.label} numberOfLines={2}>{item.name}</Text>
        </TouchableOpacity>
      ); })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: "#FFFFFF",
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 10,
  },
  touchableOpacity: {
    width: 78,
    alignItems: "center",
  },
  circle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#FFF0AD",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  image: { width: 50, height: 50 },
  label: { fontSize: 11, lineHeight: 15, color: "#111827", textAlign: "center", marginTop: 6 },
  active: {
    borderColor: "#D5A900",
    backgroundColor: "#FFE15B",
  },
});

export default CategoriesFilter;