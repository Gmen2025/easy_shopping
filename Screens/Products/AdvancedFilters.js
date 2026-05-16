import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

const AdvancedFilters = ({
  visible,
  filters,
  brands,
  onFilterChange,
  onReset,
  onToggle,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
      <Text style={styles.title}>Advanced Filters</Text>

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Min Price</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="0"
            value={filters.minPrice}
            onChangeText={(value) => onFilterChange("minPrice", value)}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Max Price</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="10000"
            value={filters.maxPrice}
            onChangeText={(value) => onFilterChange("maxPrice", value)}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Brand</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={filters.brand}
            onValueChange={(value) => onFilterChange("brand", value)}
          >
            <Picker.Item label="All brands" value="all" />
            {brands.map((brand) => (
              <Picker.Item key={brand} label={brand} value={brand} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Minimum Rating</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={filters.minRating}
            onValueChange={(value) => onFilterChange("minRating", value)}
          >
            <Picker.Item label="Any rating" value="all" />
            <Picker.Item label="1+" value="1" />
            <Picker.Item label="2+" value="2" />
            <Picker.Item label="3+" value="3" />
            <Picker.Item label="4+" value="4" />
            <Picker.Item label="5" value="5" />
          </Picker>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Sort By</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={filters.sortBy}
            onValueChange={(value) => onFilterChange("sortBy", value)}
          >
            <Picker.Item label="Relevance" value="relevance" />
            <Picker.Item label="Price: Low to High" value="priceAsc" />
            <Picker.Item label="Price: High to Low" value="priceDesc" />
            <Picker.Item label="Top Rated" value="ratingDesc" />
            <Picker.Item label="Name: A to Z" value="nameAsc" />
          </Picker>
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>In Stock Only</Text>
        <Switch
          value={filters.inStockOnly}
          onValueChange={(value) => onFilterChange("inStockOnly", value)}
          trackColor={{ false: "#b0b0b0", true: "#b8d5f5" }}
          thumbColor={filters.inStockOnly ? "#8a6c09" : "#f4f3f4"}
        />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.resetButton} onPress={onReset}>
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={onToggle}>
          <Text style={styles.applyButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce3ef",
    maxHeight: 420,
  },
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    paddingBottom: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#333",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfField: {
    width: "48%",
  },
  field: {
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#334155",
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#d7dce5",
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d7dce5",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  switchRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resetButton: {
    backgroundColor: "#d9534f",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: "49%",
    alignItems: "center",
  },
  resetButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  applyButton: {
    backgroundColor: "goldenrod",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: "49%",
    alignItems: "center",
  },
  applyButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default AdvancedFilters;
