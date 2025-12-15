import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Dimensions,
} from "react-native";
import baseUrl from "../../assets/common/baseUrl";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";

var { width } = Dimensions.get("window");

const Item = (props) => {
  return (
    <View style={styles.item}>
      <Text>{props.item.name}</Text>
      <EasyButton 
        danger 
        medium
        onPress={() => props.delete(props.item._id) }
        >
        <Text style={{ color: "white", fontWeight:"bold" }}>Delete</Text>
      </EasyButton>
    </View>
  );
}

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState();
  const [token, setToken] = useState();

  useEffect(() => {
    AsyncStorage.getItem("token")
      .then((res) => {
        setToken(res);
      })
      .catch((error) => console.log(error));

    axios
      .get(`${baseUrl}categories`)
      .then((res) => setCategories(res.data))
      .catch((error) => alert("Error to load categories"));

    return () => {
      setCategories([]);
      setToken();
    };

    }, []);

    const addCategory = () => {

      const category = {
        name: categoryName
      };

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      };

      axios.post(`${baseUrl}categories`, category, config)
        .then((res) => {
          setCategories([...categories, res.data]);
        })
        .catch((error) => alert("Error to load category"));

        setCategoryName("");
    }

    const deleteCategory = (id) => {

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }

      axios
      .delete(`${baseUrl}categories/${id}`, config)
      .then((res) => {
        const newCategories = categories.filter((item) => item._id !== id);
        setCategories(newCategories);
      })
      .catch((error) => alert("Error to delete category"))
    }

  return (
    <View style={{ position: "relative", height: "100%", padding: 5 }}>
       <View style={styles.topBar}>
        <View>
          <Text>Add Category</Text>
        </View>
        <View style={{ width: width / 2 }}>
          <TextInput
            value={categoryName}
            style={styles.input}
            onChangeText={(text) => setCategoryName(text)}
          />
        </View>
        <View>
          <EasyButton tertiary medium onPress={() => addCategory()}>
            <Text style={{ color: "white", fontWeight: "bold" }}>Submit</Text>
          </EasyButton>
        </View>
      </View>
      <View style={{ marginBottom: 10, marginTop:60 }}>
        <FlatList
          data={categories}
          renderItem={({ item, index }) => (
            <Item item={item} index={index} delete={deleteCategory}>{item.name}</Item>
          )}
          keyExtractor={(item) => item._id}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: "white",
    width: width,
    height: 60,
    padding: 5,
    position: "absolute",
    top: 0,
    left: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
  },
  item: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 1,
    padding: 5,
    margin: 5,
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 5,
  }
});

export default Categories;
