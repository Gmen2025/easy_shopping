import React, { useContext, useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Platform } from "react-native";
import { AuthContext } from "../../Context/store/Auth";
import Input from "../../Shared/Form/Input";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import FormContainer from "../../Shared/Form/FormContainer";
import { Picker } from "@react-native-picker/picker";
import Toast from "react-native-toast-message";
import Icon from "react-native-vector-icons/FontAwesome";

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
    // Prefill from saved user profile first; fall back to most recent order
    const prefillFields = async () => {
      // If user already has saved address fields, use them directly
      if (user.street || user.city || user.zip || user.country) {
        setAddress(user.street || "");
        setAddress2(user.apartment || "");
        setCity(user.city || "");
        setZip(user.zip || "");
        setCountry(user.country || "");
        return;
      }

      // Otherwise try to prefill from the most recent order
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
          setAddress(firstOrder.shippingAddress1 || "");
          setAddress2(firstOrder.shippingAddress2 || "");
          setCity(firstOrder.city || "");
          setZip(firstOrder.zip || "");
          setCountry(firstOrder.country || "");
        }
      } catch (err) {
        // no prefill available
      }
    };

    if (user._id) {
      prefillFields();
    }
  }, [user._id, user.street, user.apartment, user.city, user.zip, user.country]);

  // Add other fields as needed

  const handleSave = async () => {
    // Implement save logic (API call to update user profile)
    const updatedUser = {
      street: address,
      apartment: address2,
      city,
      zip,
      country,
    };
    console.log("Updated user data to save:", updatedUser);
    
    try {
      const token = await AsyncStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const res = await axios.put(`${baseUrl}users/profile`, updatedUser, config);

      // Refresh the in-memory user so screens show the updated values
      await context.fetchUser(user._id, token);

      Toast.show({
        type: "success",
        text1: "Profile updated successfully",
      });

      // After saving, navigate back
      props.navigation.goBack();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error updating profile";
      Toast.show({
        type: "error",
        text1: "Error updating profile",
        text2: errorMessage,
      });
    }
  };

  return (
    <FormContainer title="">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="map-marker" size={40} color="#8a6c09" />
          <Text style={styles.headerTitle}>Update Profile</Text>
          <Text style={styles.headerSubtitle}>Update your information</Text>
        </View>

        {/* Address Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address Details</Text>

          <Text style={styles.fieldLabel}>Address Line 1</Text>
          <Input
            id="address"
            value={address}
            onChangeText={setAddress}
            placeholder="Street address"
          />

          <Text style={styles.fieldLabel}>Address Line 2</Text>
          <Input
            id="address2"
            value={address2}
            onChangeText={setAddress2}
            placeholder="Apartment, suite, etc (optional)"
          />

          <Text style={styles.fieldLabel}>City</Text>
          <Input
            id="city"
            value={city}
            onChangeText={setCity}
            placeholder="City"
          />

          <Text style={styles.fieldLabel}>Postal Code</Text>
          <Input
            id="zip"
            value={zip}
            onChangeText={setZip}
            placeholder="Postal code"
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Country</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={country}
              onValueChange={(itemValue) => setCountry(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="Select a country..." value="" />
              {countries.map((c) => (
                <Picker.Item key={c.code} label={c.name} value={c.name} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <EasyButton
            primary
            large
            onPress={handleSave}
            style={styles.saveButton}
          >
            <Icon name="check" size={16} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Save Changes</Text>
          </EasyButton>

          <EasyButton
            onPress={() => props.navigation.goBack()}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </EasyButton>
        </View>
      </ScrollView>
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#8a6c09',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#5a6c7d',
    marginTop: 6,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8a6c09',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e9dfc4',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pickerContainer: {
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    overflow: Platform.OS === 'ios' ? 'visible' : 'hidden',
    minHeight: Platform.OS === 'ios' ? 160 : 50,
    height: Platform.OS === 'ios' ? 160 : 50,
    justifyContent: 'center',
  },
  picker: {
    height: Platform.OS === 'ios' ? 160 : 50,
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: '500',
  },
  pickerItem: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  actionButtons: {
    marginTop: 8,
  },
  saveButton: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingVertical: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#8a6c09',
    fontSize: 16,
    fontWeight: '600',
  },
  buttnGroup: {
    width: "80%",
    margin: 10,
    alignItems: "center",
  },
});

export default EditProfile;
