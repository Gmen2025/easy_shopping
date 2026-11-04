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
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { apiRequest, storeRequest } from "../../assets/common/storefront";
import { catalogNotificationWarning } from "../../assets/common/catalog";

var { width } = Dimensions.get("window");

const CategoryItem = ({ item, onDelete, onEdit, canEdit, saving }) => (
  <View style={styles.categoryCard}>
    <View style={styles.categoryIcon}>
      <Icon name="tag" size={14} color="#8a6c09" />
    </View>
    <Text style={styles.categoryName}>{item.name}</Text>
    {canEdit ? <>
    <TouchableOpacity style={styles.deleteBtn} disabled={saving} onPress={() => onEdit(item)}>
      <Icon name="pencil" size={14} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.deleteBtn} disabled={saving} onPress={() => onDelete(item._id)}>
      <Icon name="trash" size={14} color="#fff" />
    </TouchableOpacity>
    </> : null}
  </View>
);

const Categories = ({ route }) => {
  const ownerStoreId = route?.params?.ownerStoreId;
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");
  const request = (id, options) => ownerStoreId ?
    storeRequest(`me/locations/${ownerStoreId}/categories${id ? `/${id}` : ""}`, options) :
    apiRequest("categories", id || "", options);
  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await apiRequest("categories", "");
      const entries = Array.isArray(response) ? response : response?.categories;
      if (!Array.isArray(entries)) throw new Error("The shared category list could not be verified. Please retry.");
      setCategories(entries);
    } catch (failure) { setError(failure.response?.data?.message || failure.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
  }, []);

  const addCategory = async () => {
    if (saving) return;
    if (!categoryName.trim()) { setError("Enter a category name."); return; }
    setSaving(true); setError("");
    try {
      const result = await request(editId, { method: editId ? "put" : "post", data: { name: categoryName.trim() } });
      setCategoryName(""); setEditId("");
      await load();
      const warning = catalogNotificationWarning(result);
      Alert.alert(warning ? "Saved with notification warning" : "Saved", warning || "Category ready to use.");
    } catch (failure) { setError(failure.response?.data?.message || failure.message); }
    finally { setSaving(false); }
  };

  const deleteCategory = (id) => {
    Alert.alert("Delete category?", "A category used by products cannot be deleted. Reassign those products first.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setSaving(true); setError("");
        try {
          const result = await request(id, { method: "delete" });
          setCategories((current) => current.filter((entry) => entry._id !== id));
          if (editId === id) { setEditId(""); setCategoryName(""); }
          const warning = catalogNotificationWarning(result);
          Alert.alert(warning ? "Deleted with notification warning" : "Deleted", warning || "Category removed.");
        } catch (failure) { setError(failure.response?.data?.message || failure.message); }
        finally { setSaving(false); }
      } },
    ]);
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

      {ownerStoreId ? <Text style={{ padding: 14 }}>Company and store categories are shared. You can rename or delete only categories created by this location. Admin can manage all categories.</Text> : null}
      {error ? <TouchableOpacity onPress={load}><Text accessibilityRole="alert" style={{ color: "#b91c1c", padding: 14 }}>{error} Tap to reload.</Text></TouchableOpacity> : null}
      {/* Add category bar */}
      <View style={styles.addBar}>
        <View style={styles.inputWrapper}>
          <Icon name="plus" size={13} color="#9e9e9e" style={{ marginRight: 8 }} />
          <TextInput
            value={categoryName}
            editable={!saving}
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
          disabled={saving || !categoryName.trim()}
        >
          <Text style={styles.addBtnText}>{saving ? "Saving..." : editId ? "Save" : "Add"}</Text>
        </TouchableOpacity>
      </View>

      {editId ? <TouchableOpacity disabled={saving} onPress={() => { setEditId(""); setCategoryName(""); }}><Text>Cancel category edit</Text></TouchableOpacity> : null}
      {/* List */}
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="large" color="#8a6c09" />
        </View>
      ) : (
        <FlatList
          data={categories}
          renderItem={({ item }) => (
            <CategoryItem item={item} onDelete={deleteCategory} saving={saving}
              canEdit={!ownerStoreId || String(item.createdByStore?._id || item.createdByStore || "") === ownerStoreId}
              onEdit={(entry) => { setEditId(entry._id); setCategoryName(entry.name); }} />
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
    backgroundColor: "#8a6c09",
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
    backgroundColor: "goldenrod",
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
    backgroundColor: "#e9dfc4",
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
