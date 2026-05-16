import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import Icon from "react-native-vector-icons/FontAwesome";
import Error from "../../Shared/Error";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "../../assets/common/baseUrl";
import axios from "axios";
import CloudinaryUploader from "../../Shared/CloudinaryUploader";
import * as ImagePicker from "expo-image-picker";
import getImageUrl from "../../assets/common/getImageUrl";

const FieldLabel = ({ label }) => (
  <View style={{ width: '90%', marginTop: 12, marginBottom: 2 }}>
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {label}
    </Text>
  </View>
);

const ProductForm = (props) => {
  const [pickerValue, setPickerValue] = useState("");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState();
  const [selectedImages, setSelectedImages] = useState([]);
  const [token, setToken] = useState();
  const [error, setError] = useState("");
  const [countInStock, setCountInStock] = useState("");
  const [rating, setRating] = useState(0);
  const [isFeatured, setIsFeatured] = useState(false);
  const [richDescription, setRichDescription] = useState("");
  const [numReviews, setNumReviews] = useState(0);
  const [item, setItem] = useState(null);

  useEffect(() => {
    if (!props.route.params) {
      setItem(null);
      setSelectedImages([]);
      setBrand("");
      setName("");
      setPrice("");
      setDescription("");
      setCategory("");
      setCountInStock("");
      setRating(0);
      setRichDescription("");
      setNumReviews(0);
      setPickerValue("");
    } else {
      const { item } = props.route.params;
      setItem(item);
      // Build selectedImages from item.images array or fallback single image
      const existingUrls = [];
      if (Array.isArray(item.images) && item.images.length > 0) {
        item.images.forEach(img => {
          if (typeof img === 'string' && img.trim()) existingUrls.push({ uri: img.trim(), isNew: false });
        });
      } else {
        const fallback = getImageUrl(item);
        if (fallback) existingUrls.push({ uri: fallback, isNew: false });
      }
      setSelectedImages(existingUrls);
      setBrand(item.brand);
      setName(item.name);
      setPrice(item.price ? item.price.toString() : "");
      setDescription(item.description);
      setCategory(item.category._id);
      setCountInStock(item.countInStock ? item.countInStock.toString() : "");
      setRating(item.rating ? item.rating.toString() : "");
      setRichDescription(item.richDescription ? item.richDescription : "");
      setNumReviews(item.numReviews ? item.numReviews.toString() : "");
      setIsFeatured(item.isFeatured || false);
      setPickerValue(item.category._id);
      console.log("Editing item:", item); // Debugging line
    }

    AsyncStorage.getItem("token")
      .then((res) => setToken(res))
      .catch((err) => console.log(err));

    // Get Categories
    axios
      .get(`${baseUrl}categories`)
      .then((res) => setCategories(res.data))
      .catch(() => setError("Failed to load categories"));

    //Image Picker
    (async () => {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          alert("Sorry, we need camera roll permissions to make this work!");
        }
      }
    })();

    return () => {
      setCategories();
    };
  }, []);

  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const newImgs = result.assets.map(a => ({ uri: a.uri, isNew: true }));
      setSelectedImages(prev => [...prev, ...newImgs]);
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const addProduct = async () => {
  if (
    brand === "" ||
    name === "" ||
    price === "" ||
    description === "" ||
    category === "" ||
    countInStock === ""
  ) {
    setError("Please fill in the form correctly");
    return; // Exit the function if validation fails
  }

  // Function to strip HTML tags from a string
  const stripHtmlTags = (str) => {
    if (!str) return "";
    return str.replace(/<[^>]*>/g, "");
  };

  const isEditing = item !== null;

  if (!isEditing && selectedImages.length === 0) {
    setError('Please select at least one image');
    return;
  }

  // Upload new images to Cloudinary, keep existing URLs as-is
  const uploadedUrls = [];
  const signUrl = `${baseUrl.replace(/\/$/, '')}/sign`;

  for (const img of selectedImages) {
    if (!img.isNew) {
      uploadedUrls.push(img.uri);
      continue;
    }
    try {
      const localUri = img.uri.startsWith('file://') ? img.uri : 'file:///' + img.uri.split('file:/').join('');
      const sig = await CloudinaryUploader.getSignature(signUrl, { folder: 'mobile_uploads' }, { token });
      const uploadRes = await CloudinaryUploader.uploadToCloudinary(localUri, sig, { folder: 'mobile_uploads' });
      uploadedUrls.push(uploadRes.secure_url || uploadRes.url);
    } catch (err) {
      const errorMessage = String(err?.message || err || '');
      const serverNotConfigured = errorMessage.toLowerCase().includes('cloudinary not configured on server');
      Toast.show({
        topOffset: 60,
        type: 'error',
        text1: serverNotConfigured ? 'Server image upload not configured' : 'Image upload failed',
        text2: serverNotConfigured ? 'Please set Cloudinary env vars on backend and try again' : 'Please try again',
      });
      return;
    }
  }

  // Prepare JSON payload
  const payload = {
    brand,
    name,
    price,
    description,
    category,
    countInStock,
    rating,
    richDescription: stripHtmlTags(richDescription),
    numReviews,
    isFeatured,
    image: uploadedUrls[0] || '',
    images: uploadedUrls,
  };

  const config = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };

  if (isEditing) {
    // Edit product
    console.log('Editing product with ID:', item._id);
    try {
      const res = await axios.put(`${baseUrl}products/${item._id}`, payload, config);
      if (res.status === 200 || res.status === 201) {
        Toast.show({ topOffset: 60, type: 'success', text1: 'Product edited successfully' });
        setTimeout(() => props.navigation.navigate('Products'), 500);
      }
    } catch (err) {
      console.log('Product edit error:', err.response?.data || err.message);
      Toast.show({ topOffset: 60, type: 'error', text1: 'Something went wrong', text2: 'Please try again' });
    }
  } else {
    // Add product
    console.log('Adding new product');
    try {
      const res = await axios.post(`${baseUrl}products`, payload, config);
      if (res.status === 200 || res.status === 201) {
        Toast.show({ topOffset: 60, type: 'success', text1: 'Product added successfully' });
        setTimeout(() => props.navigation.navigate('Products'), 500);
      }
    } catch (err) {
      console.log('Product add error:', err.response?.data || err.message);
      Toast.show({ topOffset: 60, type: 'error', text1: 'Something went wrong', text2: 'Please try again' });
    }
  }
  };

  const isEditing = item !== null;

  return (
    <FormContainer title={isEditing ? "Edit Product" : "Add Product"}>
      {/* Multi-image section */}
      <View style={styles.imagesSection}>
        <Text style={styles.imagesSectionLabel}>Product Images</Text>
        <View style={styles.thumbnailRow}>
          {selectedImages.map((img, index) => (
            <View key={index} style={styles.thumbnailWrapper}>
              <Image source={{ uri: img.uri }} style={styles.thumbnail} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(index)}>
                <Icon name="times" size={12} color="#fff" />
              </TouchableOpacity>
              {index === 0 && <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Main</Text></View>}
            </View>
          ))}
          <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
            <Icon name="camera" size={24} color="#8a6c09" />
            <Text style={styles.addImageText}>Add</Text>
          </TouchableOpacity>
        </View>
        {selectedImages.length === 0 && (
          <Text style={styles.noImageHint}>No images selected. Tap Add to choose images.</Text>
        )}
      </View>
      {/* Section: Basic Info */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
      </View>
      <FieldLabel label="Brand" />
      <Input placeholder={"Brand"} name={"brand"} id={"brand"} value={brand} onChangeText={(text) => setBrand(text)} />
      <FieldLabel label="Product Name" />
      <Input placeholder={"Name"} name={"name"} id={"name"} value={name} onChangeText={(text) => setName(text)} />
      <FieldLabel label="Price" />
      <Input placeholder={"Price"} name={"price"} id={"price"} value={price} keyboardType={"numeric"} onChangeText={(text) => setPrice(text)} />
      <FieldLabel label="Description" />
      <Input placeholder={"Description"} name={"description"} id={"description"} value={description} onChangeText={(text) => setDescription(text)} />
      <FieldLabel label="Rich Description" />
      <Input placeholder={"Rich Description"} name={"richDescription"} id={"richDescription"} value={richDescription} onChangeText={(text) => setRichDescription(text)} />

      {/* Section: Inventory */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Inventory & Stats</Text>
      </View>
      <FieldLabel label="Count in Stock" />
      <Input placeholder={"Stock"} name={"Stock"} id={"stock"} value={countInStock} keyboardType={"numeric"} onChangeText={(text) => setCountInStock(text)} />
      <FieldLabel label="Rating" />
      <Input placeholder={"Rating (0–5)"} name={"rating"} id={"rating"} value={rating} keyboardType={"numeric"} onChangeText={(text) => setRating(text)} />
      <FieldLabel label="Number of Reviews" />
      <Input placeholder={"Number of Reviews"} name={"numReviews"} id={"numReviews"} value={numReviews} keyboardType={"numeric"} onChangeText={(text) => setNumReviews(text)} />
      <FieldLabel label="Is Featured" />
      <Input placeholder={"true / false"} name={"isFeatured"} id={"isFeatured"} value={isFeatured.toString()} onChangeText={(text) => setIsFeatured(text.toLowerCase())} />
      {/* Section: Category */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Category</Text>
      </View>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={pickerValue}
          style={styles.picker}
          dropdownIconColor="#8a6c09"
          onValueChange={(itemValue) => {
            setPickerValue(itemValue);
            setCategory(itemValue);
          }}
          mode="dropdown"
        >
          <Picker.Item label="Select Category…" value="" color="#9e9e9e" />
          {categories
            ? categories.map((c) => (
                <Picker.Item label={c.name} value={c._id} key={c._id} color="#1a1a1a" />
              ))
            : null}
        </Picker>
      </View>

      {error ? <Error message={error} /> : null}

      <TouchableOpacity style={styles.submitBtn} onPress={() => addProduct()}>
        <Icon name={isEditing ? "save" : "plus-circle"} size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.submitBtnText}>{isEditing ? "Save Changes" : "Add Product"}</Text>
      </TouchableOpacity>
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    width: "90%",
    marginTop: 20,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#8a6c09",
    paddingLeft: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8a6c09",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pickerContainer: {
    width: "90%",
    borderWidth: 1,
    borderColor: "#c5cae9",
    borderRadius: 10,
    backgroundColor: "#fff",
    marginTop: 6,
    marginBottom: 4,
  },
  picker: {
    width: "100%",
    height: Platform.OS === "ios" ? 180 : 54,
    color: "#8a6c09",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8a6c09",
    borderRadius: 12,
    paddingVertical: 15,
    width: "90%",
    marginTop: 28,
    marginBottom: 40,
    elevation: 3,
    shadowColor: "#8a6c09",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  imagesSection: {
    width: '90%',
    marginTop: 16,
    marginBottom: 8,
  },
  imagesSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8a6c09',
    marginBottom: 10,
  },
  thumbnailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  thumbnailWrapper: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'visible',
    position: 'relative',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#e53935',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  mainBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26,35,126,0.75)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  mainBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#8a6c09',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
  },
  addImageText: {
    color: '#8a6c09',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  noImageHint: {
    color: '#9e9e9e',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
});

export default ProductForm;
