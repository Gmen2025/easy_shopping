import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Text,
} from "react-native";

const CategoriesFilter = (props) => {
  return (
    <ScrollView
      bounces={true}
      horizontal={true}
      style={styles.scrollView}
    >
      {/* "All" Category */}
      <TouchableOpacity
        key="all"
        onPress={() => {
          props.categoryFilter("all");
          props.setActive(-1);
        }}
        style={styles.touchableOpacity}
      >
        <Text
          style={[
            styles.chip,
            props.active === -1 ? styles.active : styles.inactive,
            props.active === -1 ? styles.activeText : styles.inactiveText,
          ]}
        >
          All
        </Text>
      </TouchableOpacity>

      {/* Dynamic Categories */}
      {props.categories.map((item) => (
        <TouchableOpacity
          key={item._id}
          onPress={() => {
            props.categoryFilter(item.name);
            props.setActive(props.categories.indexOf(item));
          }}
          style={styles.touchableOpacity}
        >
          <Text
            style={[
              styles.chip,
              props.active === props.categories.indexOf(item)
                ? styles.active
                : styles.inactive,
              props.active === props.categories.indexOf(item)
                ? styles.activeText
                : styles.inactiveText,
            ]}
          >
            {item.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: "#f3f6fb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexShrink:1, //Prevents horizontal overflow
  },
  touchableOpacity: {
    marginRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    fontSize: 13,
    fontWeight: "700",
    overflow: "hidden",
  },
  active: {
    backgroundColor: "#0f3f79",
    borderWidth: 1,
    borderColor: "#0f3f79",
  },
  inactive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7dce5",
  },
  activeText: {
    color: "#ffffff",
  },
  inactiveText: {
    color: "#334155",
  },
});

export default CategoriesFilter;