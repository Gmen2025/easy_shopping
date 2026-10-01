import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Icon from "react-native-vector-icons/FontAwesome";
import Input from "../../Shared/Form/Input";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import baseUrl from "../../assets/common/baseUrl";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

const AssignRoles = () => {
  const [email, setEmail] = useState("");
  const [submittingRole, setSubmittingRole] = useState("");

  const assignRole = async (roleType) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert("Email required", "Enter the user's email address first.");
      return;
    }

    setSubmittingRole(roleType);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.post(
        `${baseUrl}users/admin/assign-role`,
        { email: trimmedEmail, roleType, databaseName: currentDb },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-database-name": currentDb,
          },
        }
      );
      Alert.alert("Role assigned", response?.data?.message || "The role was assigned successfully.");
      setEmail("");
    } catch (error) {
      Alert.alert(
        "Assignment failed",
        error?.response?.data?.message || "Unable to assign the role right now."
      );
    } finally {
      setSubmittingRole("");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Icon name="user-plus" size={36} color="#1a237e" />
        <Text style={styles.headerTitle}>Assign Driver / Store Owner</Text>
        <Text style={styles.headerSubtitle}>
          Enter the email of an existing registered user to grant them driver or store owner access.
        </Text>
      </View>

      <Text style={styles.fieldLabel}>User Email Address</Text>
      <Input
        placeholder="user@example.com"
        value={email}
        name={email}
        id={"assign-email"}
        onChangeText={(text) => setEmail(text.toLowerCase())}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <EasyButton
        onPress={() => assignRole("driver")}
        style={styles.driverButton}
        disabled={!!submittingRole}
      >
        <Text style={styles.buttonText}>
          {submittingRole === "driver" ? "Assigning..." : "Assign as Driver"}
        </Text>
      </EasyButton>

      <EasyButton
        onPress={() => assignRole("store_owner")}
        style={styles.storeOwnerButton}
        disabled={!!submittingRole}
      >
        <Text style={styles.buttonText}>
          {submittingRole === "store_owner" ? "Assigning..." : "Assign as Store Owner"}
        </Text>
      </EasyButton>
    </ScrollView>
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
    fontSize: 22,
    fontWeight: "700",
    color: "#1a237e",
    marginTop: 12,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#5a6c7d",
    marginTop: 8,
    textAlign: "center",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  driverButton: {
    marginTop: 20,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    elevation: 4,
  },
  storeOwnerButton: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default AssignRoles;
