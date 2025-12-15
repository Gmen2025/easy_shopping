import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Text,
} from "react-native";
import { Badge } from "react-native-paper";

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
        <Badge
          style={[
            styles.center,
            props.active === -1 ? styles.active : styles.inactive,
          ]}
        >
          <Text style={styles.badgeText}>All</Text>
        </Badge>
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
          <Badge
            style={[
              styles.center,
              props.active === props.categories.indexOf(item) ? styles.active : styles.inactive,
            ]}
          >
            <Text style={styles.badgeText}>{item.name}</Text>
          </Badge>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: "#f2f2f2",
    padding: 10,
    flexShrink:1, //Prevents horizontal overflow
  },
  touchableOpacity: {
    marginHorizontal: 5,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
    height: 30,
  },
  active: {
    backgroundColor: "#857d22ff",
  },
  inactive: {
    backgroundColor: "#ebe7a0ff",
  },
  badgeText: {
    fontSize: 15,
    color: "#000000ff",
  },
});

export default CategoriesFilter;