import React, { useContext, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../Context/store/Auth";
import { createStore } from "../../assets/common/stores";

const RoleSetupScreen = (props) => {
  const { user } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    storeName: "",
    storeAddress: "",
    storeCity: "",
    storeCountry: "",
    storePhone: "",
    vehicleMake: "",
    vehicleModel: "",
    vehiclePlate: "",
    vehicleColor: "",
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const token = await AsyncStorage.getItem("token");

    if (!token) {
      Alert.alert("Sign in required", "Please sign in again before completing your setup.");
      return;
    }

    setSaving(true);

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const hasStoreDetails = Boolean(
        formData.storeName || formData.storeAddress || formData.storeCity || formData.storeCountry || formData.storePhone
      );
      const hasVehicleDetails = Boolean(
        formData.vehicleMake || formData.vehicleModel || formData.vehiclePlate || formData.vehicleColor
      );

      let completed = false;

      if (hasStoreDetails) {
        await createStore(
          {
            name: formData.storeName,
            address: formData.storeAddress,
            city: formData.storeCity,
            country: formData.storeCountry,
            phone: formData.storePhone,
            ownerName: user?.name || "",
            ownerEmail: user?.email || "",
          },
          token
        );
        completed = true;
      }

      if (hasVehicleDetails) {
        try {
          await axios.put(
            `${baseUrl}users/profile`,
            {
              vehicle: {
                make: formData.vehicleMake,
                model: formData.vehicleModel,
                plateNumber: formData.vehiclePlate,
                color: formData.vehicleColor,
              },
            },
            config
          );
          completed = true;
        } catch (profileError) {
          await AsyncStorage.setItem(
            "pendingRoleSetup",
            JSON.stringify({
              vehicle: {
                make: formData.vehicleMake,
                model: formData.vehicleModel,
                plateNumber: formData.vehiclePlate,
                color: formData.vehicleColor,
              },
            })
          );
        }
      }

      if (!completed) {
        Alert.alert("Nothing to save", "Please add a store or vehicle detail before continuing.");
        setSaving(false);
        return;
      }

      Alert.alert("Setup complete", "Your store and vehicle details have been saved.");
      props.navigation.navigate("User Profile");
    } catch (error) {
      const message = error?.response?.data?.message || "Unable to save your setup details right now.";
      Alert.alert("Setup failed", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormContainer title="">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Icon name="truck" size={40} color="#8a6c09" />
          <Text style={styles.headerTitle}>Complete your setup</Text>
          <Text style={styles.headerSubtitle}>Register a store and/or your vehicle for deliveries.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store details</Text>
          <Text style={styles.fieldLabel}>Store Name</Text>
          <Input value={formData.storeName} onChangeText={(text) => handleChange("storeName", text)} placeholder="My Shop" />

          <Text style={styles.fieldLabel}>Address</Text>
          <Input value={formData.storeAddress} onChangeText={(text) => handleChange("storeAddress", text)} placeholder="Addis Ababa" />

          <Text style={styles.fieldLabel}>City</Text>
          <Input value={formData.storeCity} onChangeText={(text) => handleChange("storeCity", text)} placeholder="Addis Ababa" />

          <Text style={styles.fieldLabel}>Country</Text>
          <Input value={formData.storeCountry} onChangeText={(text) => handleChange("storeCountry", text)} placeholder="Ethiopia" />

          <Text style={styles.fieldLabel}>Phone</Text>
          <Input value={formData.storePhone} onChangeText={(text) => handleChange("storePhone", text)} placeholder="0912345678" keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle details</Text>
          <Text style={styles.fieldLabel}>Make</Text>
          <Input value={formData.vehicleMake} onChangeText={(text) => handleChange("vehicleMake", text)} placeholder="Toyota" />

          <Text style={styles.fieldLabel}>Model</Text>
          <Input value={formData.vehicleModel} onChangeText={(text) => handleChange("vehicleModel", text)} placeholder="Corolla" />

          <Text style={styles.fieldLabel}>Plate Number</Text>
          <Input value={formData.vehiclePlate} onChangeText={(text) => handleChange("vehiclePlate", text)} placeholder="AA 1234" />

          <Text style={styles.fieldLabel}>Color</Text>
          <Input value={formData.vehicleColor} onChangeText={(text) => handleChange("vehicleColor", text)} placeholder="White" />
        </View>

        <EasyButton onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save setup"}</Text>
        </EasyButton>
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
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a237e",
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#5a6c7d",
    marginTop: 6,
    textAlign: "center",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a237e",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default RoleSetupScreen;
