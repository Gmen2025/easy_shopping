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
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Icon from "react-native-vector-icons/FontAwesome";
import Error from "../../Shared/Error";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "../../assets/common/baseUrl";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";

const ProductForm = (props) => {
  const [pickerValue, setPickerValue] = useState("");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState();
  const [image, setImage] = useState();
  const [mainImage, setMainImage] = useState();
  const [token, setToken] = useState();
  const [error, setError] = useState("");
  const [countInStock, setCountInStock] = useState("");
  const [rating, setRating] = useState(0);
  const [isFeatured, setIsFeatured] = useState(false);
  const [richDescription, setRichDescription] = useState("");
  const [numReviews, setNumReviews] = useState(0);
  const [item, setItem] = useState(null);

  console.log("Image state:", image); // Debugging line

  useEffect(() => {
    if (!props.route.params) {
      setItem(null);
      setMainImage(null);
      setImage(null);
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
      setMainImage(item.image);
      setImage(item.image ? { uri: item.image } : null); // Always set image as object with uri
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

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      console.log("New image selected:", result.assets[0]);
      setMainImage(result.assets[0].uri);
      setImage(result.assets[0]);
    }
  };

  const addProduct = () => {
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

  let formData = new FormData();

  // Check if we're editing and if a new image was selected
  const isEditing = item !== null;
  const hasNewImage = image && image.uri && !image.uri.startsWith('http');

  console.log("Is editing:", isEditing);
  console.log("Has new image:", hasNewImage);
  console.log("Image object:", image);

  // Only append image if it's a new local image (not editing with existing server image)
  if (hasNewImage) {
    const newImageUri = "file:///" + image.uri.split("file:/").join("");
    
    formData.append("image", {
      uri: newImageUri,
      type: "image/jpeg",
      name: newImageUri.split("/").pop(),
    });
  } else if (!isEditing) {
    // If adding new product, image is required
    setError("Please select an image");
    return;
  }
  // If editing and no new image selected, don't append image (keep existing)

  formData.append("brand", brand);
  formData.append("name", name);
  formData.append("price", price);
  formData.append("description", description);
  formData.append("category", category);
  formData.append("countInStock", countInStock);
  formData.append("rating", rating);
  formData.append("richDescription", stripHtmlTags(richDescription));
  formData.append("numReviews", numReviews);
  formData.append("isFeatured", isFeatured);

  const config = {
    headers: {
      "Content-Type": "multipart/form-data",
      Authorization: `Bearer ${token}`,
    },
  };

  if (isEditing) {
    // Edit product
    console.log("Editing product with ID:", item._id);
    
    axios
      .put(`${baseUrl}products/${item._id}`, formData, config)
      .then((res) => {
        if (res.status == 200 || res.status == 201) {
          Toast.show({
            topOffset: 60,
            type: "success",
            text1: "Product edited successfully",
            text2: "",
          });
          setTimeout(() => {
            props.navigation.navigate("Products");
          }, 500);
        }
      })
      .catch((err) => {
        console.log("Product edit error:", err.response?.data || err.message);
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Something went wrong",
          text2: "Please try again",
        });
      });
  } else {
    // Add product
    console.log("Adding new product");
    
    axios
      .post(`${baseUrl}products`, formData, config)
      .then((res) => {
        if (res.status == 200 || res.status == 201) {
          Toast.show({
            topOffset: 60,
            type: "success",
            text1: "Product added successfully",
            text2: "",
          });
          setTimeout(() => {
            props.navigation.navigate("Products");
          }, 500);
        }
      })
      .catch((err) => {
        console.log("Product add error:", err.response?.data || err.message);
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Something went wrong",
          text2: "Please try again",
        });
      });
  }
};

  return (
    <FormContainer title={"Add Product"}>
      <View style={styles.imageContainer}>
        <Image style={styles.image} source={{ uri: mainImage }} />
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          <Icon name={"camera"} size={30} color={"#fff"} />
        </TouchableOpacity>
      </View>
      <View style={styles.label}>
        <Text>Brand</Text>
      </View>
      <Input
        placeholder={"Brand"}
        name={"brand"}
        id={"brand"}
        value={brand}
        onChangeText={(text) => setBrand(text)}
      />
      <View style={styles.label}>
        <Text>Name</Text>
      </View>
      <Input
        placeholder={"Name"}
        name={"name"}
        id={"name"}
        value={name}
        onChangeText={(text) => setName(text)}
      />
      <View style={styles.label}>
        <Text>Price</Text>
      </View>
      <Input
        placeholder={"Price"}
        name={"price"}
        id={"price"}
        value={price}
        keyboardType={"numeric"}
        onChangeText={(text) => setPrice(text)}
      />
      <View style={styles.label}>
        <Text>Description</Text>
      </View>
      <Input
        placeholder={"Description"}
        name={"description"}
        id={"description"}
        value={description}
        onChangeText={(text) => setDescription(text)}
      />
      <View style={styles.label}>
        <Text>Count in Stock</Text>
      </View>
      <Input
        placeholder={"Stock"}
        name={"Stock"}
        id={"stock"}
        value={countInStock}
        keyboardType={"numeric"}
        onChangeText={(text) => setCountInStock(text)}
      />
      <View style={styles.label}>
        <Text>Rating</Text>
      </View>
      <Input
        placeholder={"Rating"}
        name={"rating"}
        id={"rating"}
        value={rating}
        keyboardType={"numeric"}
        onChangeText={(text) => setRating(text)}
      />
      <View style={styles.label}>
        <Text>Rich Description</Text>
      </View>
      <Input
        placeholder={"Rich Description"}
        name={"richDescription"}
        id={"richDescription"}
        value={richDescription}
        onChangeText={(text) => setRichDescription(text)}
      />
      <View style={styles.label}>
        <Text>Number of Reviews</Text>
      </View>
      <Input
        placeholder={"Number of Reviews"}
        name={"numReviews"}
        id={"numReviews"}
        value={numReviews}
        keyboardType={"numeric"}
        onChangeText={(text) => setNumReviews(text)}
      />
      <View style={styles.label}>
        <Text>Is Featured</Text>
      </View>
      <Input
        placeholder={"Is Featured (true/false)"}
        name={"isFeatured"}
        id={"isFeatured"}
        value={isFeatured.toString()}
        onChangeText={(text) => setIsFeatured(text.toLowerCase())}
      />
      <View style={styles.inputContainer}>
        <Picker
          selectedValue={pickerValue}
          style={
            Platform.OS === "android"
              ? {
                  height: 50,
                  width: "100%",
                  color: "#007aff",
                  backgroundColor: "white",
                }
              : { height: 50, marginTop: -80, marginBottom: 10, width: "100%" }
          }
          onValueChange={(itemValue) => {
            setPickerValue(itemValue);
            setCategory(itemValue);
          }}
        >
          <Picker.Item label="Select Category" value="" />
          {categories
            ? categories.map((c) => {
                return <Picker.Item label={c.name} value={c._id} key={c._id} />;
              })
            : null}
        </Picker>
      </View>
      {error ? <Error message={error} /> : null}
      <View>
        <EasyButton
          style={styles.buttonContainer}
          large
          primary
          onPress={() => addProduct()}
        >
          <Text style={styles.buttonText}>Submit</Text>
        </EasyButton>
      </View>
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  label: {
    width: "80%",
    marginTop: 10,
    fontSize: 16,
    color: "grey",
  },
  inputContainer: {
    marginBottom: 5,
    marginTop: 50,
    width: "80%",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingBottom: 50,
    backgroundColor: "white",
  },
  buttonContainer: {
    marginTop: 30,
    marginBottom: 30,
    // width: "80%",
    // justifyContent: "center",
    // alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 18,
  },
  imageContainer: {
    width: 200,
    height: 200,
    borderStyle: "solid",
    borderColor: "#7a2d2dff",
    borderRadius: 100,
    justifyContent: "center",
    padding: 0,
    //Android shadow
    //elevation: 2,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 100,
    borderStyle: "solid",
    borderColor: "lightgrey",
    borderWidth: 4,
  },
  imagePicker: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "darkslategrey",
    padding: 8,
    borderRadius: 100,
    elevation: 20,
  },
});

export default ProductForm;
