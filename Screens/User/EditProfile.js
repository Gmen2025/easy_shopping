import React, { useContext, useState, useEffect } from "react";
import { View, Text, Alert, StyleSheet, ScrollView, Platform } from "react-native";
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
  const currentUserId = user?._id || user?.id || user?.user?._id || user?.user?.id;
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [address, setAddress] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

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
          `${baseUrl}orders/get/userorders/${currentUserId}`,
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

    if (currentUserId) {
      prefillFields();
    }
  }, [currentUserId, user.street, user.apartment, user.city, user.zip, user.country]);

  // Add other fields as needed

  const handleSave = async () => {
    // Implement save logic (API call to update user profile)
    const updatedUser = {
      name,
      email,
      phone,
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
      if (currentUserId) {
        await context.fetchUser(currentUserId, token);
      }

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

  const performDeleteAccount = async () => {
    if (!currentUserId) {
      Toast.show({
        type: "error",
        text1: "Delete failed",
        text2: "User session is missing. Please log in again.",
      });
      return;
    }

    setDeletingAccount(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const deleteEndpoints = [
        `${baseUrl}users/${currentUserId}`,
        `${baseUrl}users/me`,
        `${baseUrl}users/profile`,
      ];

      let deleted = false;
      let lastError = null;

      for (const endpoint of deleteEndpoints) {
        try {
          await axios.delete(endpoint, config);
          deleted = true;
          break;
        } catch (error) {
          lastError = error;
          const status = error?.response?.status;
          const backendMessage = String(error?.response?.data?.message || "").toLowerCase();

          // Some backends return authorization-like responses on unsupported self-delete routes.
          // Continue to the next endpoint until one matches the server's expected contract.
          if (
            status === 401 ||
            status === 403 ||
            backendMessage.includes("only delete your account") ||
            backendMessage.includes("not authorized")
          ) {
            continue;
          }

          if (status === 404 || status === 405) {
            continue;
          }
          throw error;
        }
      }

      if (!deleted) {
        throw lastError || new Error("No matching delete account endpoint found");
      }

      await AsyncStorage.removeItem("token");
      context.logout();

      Toast.show({
        type: "success",
        text1: "Account deleted",
        text2: "Your account has been removed successfully.",
      });

      props.navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "We could not delete your account right now.";

      Toast.show({
        type: "error",
        text1: "Delete failed",
        text2: errorMessage,
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (deletingAccount) {
      return;
    }

    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. Are you sure you want to delete your account?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: performDeleteAccount,
        },
      ]
    );
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

        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <Text style={styles.fieldLabel}>Full Name</Text>
          <Input
            id="name"
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
          />

          <Text style={styles.fieldLabel}>Email Address</Text>
          <Input
            id="email"
            value={email}
            onChangeText={setEmail}
            placeholder="Your email address"
            keyboardType="email-address"
            editable={false}
          />
          <Text style={styles.fieldNote}>Email cannot be changed</Text>

          <Text style={styles.fieldLabel}>Phone Number</Text>
          <Input
            id="phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="Your phone number"
            keyboardType="phone-pad"
          />
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

          <EasyButton
            onPress={confirmDeleteAccount}
            style={[styles.deleteButton, deletingAccount && styles.deleteButtonDisabled]}
          >
            <Text style={styles.deleteButtonText}>
              {deletingAccount ? "Deleting Account..." : "Delete Account"}
            </Text>
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
  fieldNote: {
    fontSize: 11,
    color: '#888888',
    marginTop: -4,
    marginBottom: 12,
    fontStyle: 'italic',
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
  deleteButton: {
    marginTop: 10,
    paddingVertical: 14,
    backgroundColor: '#c0392b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9e2f23',
  },
  deleteButtonDisabled: {
    opacity: 0.65,
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
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttnGroup: {
    width: "80%",
    margin: 10,
    alignItems: "center",
  },
});

export default EditProfile;
