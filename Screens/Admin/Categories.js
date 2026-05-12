import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import baseUrl from "../../assets/common/baseUrl";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

var { width } = Dimensions.get("window");

const CategoryItem = ({ item, onDelete }) => (
  <View style={styles.categoryCard}>
    <View style={styles.categoryIcon}>
      <Icon name="tag" size={14} color="#1a237e" />
    </View>
    <Text style={styles.categoryName}>{item.name}</Text>
    <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item._id)}>
      <Icon name="trash" size={14} color="#fff" />
    </TouchableOpacity>
  </View>
);

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [token, setToken] = useState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("token")
      .then((res) => setToken(res))
      .catch((error) => console.log(error));

    axios
      .get(`${baseUrl}categories`)
      .then((res) => {
        setCategories(res.data);
        setLoading(false);
      })
      .catch(() => {
        alert("Error loading categories");
        setLoading(false);
      });

    return () => {
      setCategories([]);
      setToken();
    };
  }, []);

  const addCategory = () => {
    if (!categoryName.trim()) return;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    axios
      .post(`${baseUrl}categories`, { name: categoryName.trim() }, config)
      .then((res) => {
        setCategories([...categories, res.data]);
        setCategoryName("");
      })
      .catch(() => alert("Error adding category"));
  };

  const deleteCategory = (id) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    axios
      .delete(`${baseUrl}categories/${id}`, config)
      .then(() => setCategories(categories.filter((item) => item._id !== id)))
      .catch(() => alert("Error deleting category"));
  };

  return (
    <View style={styles.container}>
      {/* Navy header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Categories</Text>
        <Text style={styles.headerSubtitle}>
          {categories.length} {categories.length === 1 ? "category" : "categories"}
        </Text>
      </View>

      {/* Add category bar */}
      <View style={styles.addBar}>
        <View style={styles.inputWrapper}>
          <Icon name="plus" size={13} color="#9e9e9e" style={{ marginRight: 8 }} />
          <TextInput
            value={categoryName}
            style={styles.input}
            placeholder="New category name…"
            placeholderTextColor="#bdbdbd"
            onChangeText={(text) => setCategoryName(text)}
            onSubmitEditing={addCategory}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity
          style={[styles.addBtn, !categoryName.trim() && styles.addBtnDisabled]}
          onPress={addCategory}
          disabled={!categoryName.trim()}
        >
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="large" color="#1a237e" />
        </View>
      ) : (
        <FlatList
          data={categories}
          renderItem={({ item }) => (
            <CategoryItem item={item} onDelete={deleteCategory} />
          )}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="tags" size={40} color="#c5cae9" />
              <Text style={styles.emptyText}>No categories yet</Text>
            </View>
          }
          ListFooterComponent={<View style={{ marginBottom: 80 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },
  header: {
    backgroundColor: "#1a237e",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  addBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 14,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    paddingVertical: 4,
  },
  addBtn: {
    backgroundColor: "#1a237e",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addBtnDisabled: {
    backgroundColor: "#c5cae9",
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    gap: 10,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#e8eaf6",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  deleteBtn: {
    backgroundColor: "#c62828",
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    color: "#9e9e9e",
    fontSize: 15,
    marginTop: 12,
  },
});

export default Categories;
