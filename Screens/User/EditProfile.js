import React, { useContext, useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { AuthContext } from "../../Context/store/Auth";
import Input from "../../Shared/Form/Input";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import FormContainer from "../../Shared/Form/FormContainer";
import { Picker } from "@react-native-picker/picker";
import Toast from "react-native-toast-message";

const countries = require("../../assets/data/countries.json");

import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";

const EditProfile = (props) => {
  const context = useContext(AuthContext);
  //console.log("EditProfile context user:", context.user);
  const user = context.user || {};
  //const [name, setName] = useState(user.name || "");
  //const [phone, setPhone] = useState(user.phone || "");
  //const [email, setEmail] = useState(user.user || "");
  const [address, setAddress] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    // Prefill from first order if available
    const fetchFirstOrder = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(
          `${baseUrl}orders/get/userorders/${user._id}`,
          config
        );
        const orders = res.data;
        if (orders && orders.length > 0) {
          const firstOrder = orders[0];
          //console.log("First order found:", firstOrder);
          setAddress(firstOrder.shippingAddress1 || "");
          setAddress2(firstOrder.shippingAddress2 || "");
          setCity(firstOrder.city || "");
          setZip(firstOrder.zip || "");
          setCountry(firstOrder.country || "");
        } else {
          // fallback to user profile fields if no orders
          setAddress(user.shippingAddress1 || "");
          setAddress2(user.shippingAddress2 || "");
          setCity(user.city || "");
          setZip(user.zip || "");
          setCountry(user.country || "");
        }
      } catch (err) {
        // fallback to user profile fields if error
        setAddress(user.shippingAddress1 || "");
        setAddress2(user.shippingAddress2 || "");
        setCity(user.city || "");
        setZip(user.zip || "");
        setCountry(user.country || "");
      }
    };

    if (user._id) {
      fetchFirstOrder();
    }
  }, [user]);

  // Add other fields as needed

  const handleSave = () => {
    // Implement save logic (API call to update user profile)
    const updatedUser = {
      address,
      address2,
      city,
      zip,
      country,
    };
    console.log("Updated user data to save:", updatedUser);
    // Example API call: add Toast messages for success/error
    axios
      .put(`${baseUrl}users/${user._id}`, updatedUser)
      .then((res) => {
        Toast.show({
          type: "success",
          text1: "Profile updated successfully",
        });
      })
      .catch((err) => {
        Toast.show({
          type: "error",
          text1: "Error updating profile",
          text2: err.message,
        });
      });

    // After saving, navigate back
    props.navigation.goBack();
  };

  return (
    <FormContainer title="Edit Profile">
      {/* <Input
        id="name"
        value={name}
        onChangeText={setName}
        placeholder="Name"
      />
      <Input
        id="phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone"
        keyboardType="phone-pad"
      />
      <Input
        id="email"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
      /> */}
      <Input
        id="address"
        value={address}
        onChangeText={setAddress}
        placeholder="Address 1"
      />
      <Input
        id="address2"
        value={address2}
        onChangeText={setAddress2}
        placeholder="Address 2"
      />
      <Input id="city" value={city} onChangeText={setCity} placeholder="City" />
      <Input
        id="zip"
        value={zip}
        onChangeText={setZip}
        placeholder="Zip"
        keyboardType="numeric"
      />
      <Text style={{ marginTop: 10, fontWeight: "bold", fontSize: 20 }}>
        Country
      </Text>
      <Picker
        selectedValue={country}
        onValueChange={(itemValue) => setCountry(itemValue)}
        style={{ marginBottom: 10, marginTop: -2, width: 250 }}
        mode="dropdown"
      >
        <Picker.Item label="Select a country..." value="" />
        {countries.map((c) => (
          <Picker.Item key={c.code} label={c.name} value={c.name} />
        ))}
      </Picker>
      <View style={styles.buttnGroup}>
        <EasyButton primary large onPress={handleSave}>
          <Text style={{ color: "white" }}>Save</Text>
        </EasyButton>
      </View>
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  buttnGroup: {
    width: "80%",
    margin: 10,
    alignItems: "center",
  },
});

export default EditProfile;
