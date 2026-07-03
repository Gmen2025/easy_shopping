import React, { useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../Context/store/Auth";
import Input from "../../Shared/Form/Input";
import FormContainer from "../../Shared/Form/FormContainer";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";

const BankAccountSettings = (props) => {
  const context = useContext(AuthContext);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      fetchBankAccountInfo();
    }, [])
  );

  const fetchBankAccountInfo = async () => {
    setFetching(true);
    try {
      const response = await axios.get(`${baseUrl}settings/bank-account`);
      console.log('Bank account response:', response.data);
      if (response.data.success) {
        setBankName(response.data.bankName || "");
        setAccountNumber(response.data.accountNumber || "");
        setAccountHolderName(response.data.accountHolderName || "");
        setBankCode(response.data.bankCode || "");
        setAdditionalInfo(response.data.additionalInfo || "");
      }
    } catch (error) {
      console.error("Error fetching bank account info:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.response?.data?.message || "Failed to load bank account information",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountHolderName.trim()) {
      Alert.alert(
        "Required Fields",
        "Bank Name, Account Number, and Account Holder Name are required."
      );
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Authentication token not found",
        });
        return;
      }

      const response = await axios.put(
        `${baseUrl}settings/bank-account`,
        {
          bankName,
          accountNumber,
          accountHolderName,
          bankCode,
          additionalInfo,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Bank account information updated successfully",
        });
      }
    } catch (error) {
      console.error("Error saving bank account info:", error);
      console.error("Error response:", error.response?.data);
      const errorMessage = error.response?.data?.message || error.message || "Failed to save changes";
      Toast.show({
        type: "error",
        text1: "Error",
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <FormContainer title="Bank Account Settings">
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </FormContainer>
    );
  }

  return (
    <FormContainer title="Bank Account Settings">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="bank" size={40} color="#8a6c09" />
          <Text style={styles.headerTitle}>Bank Account Information</Text>
          <Text style={styles.headerSubtitle}>
            Manage the bank account details shown to customers during transactions
          </Text>
        </View>

        {/* Bank Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank Details</Text>

          <Text style={styles.fieldLabel}>Bank Name</Text>
          <Input
            id="bankName"
            value={bankName}
            onChangeText={setBankName}
            placeholder="e.g., Commercial Bank of Ethiopia"
          />

          <Text style={styles.fieldLabel}>Bank Code</Text>
          <Input
            id="bankCode"
            value={bankCode}
            onChangeText={setBankCode}
            placeholder="e.g., CBE or SWIFT code (optional)"
          />

          <Text style={styles.fieldLabel}>Account Number</Text>
          <Input
            id="accountNumber"
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="e.g., 1234567890"
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Account Holder Name</Text>
          <Input
            id="accountHolderName"
            value={accountHolderName}
            onChangeText={setAccountHolderName}
            placeholder="e.g., Easy Shopping PLC"
          />

          <Text style={styles.fieldLabel}>Additional Information</Text>
          <Input
            id="additionalInfo"
            value={additionalInfo}
            onChangeText={setAdditionalInfo}
            placeholder="Any additional info (optional)"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Icon name="info-circle" size={20} color="#1d72d6" />
          <Text style={styles.infoText}>
            This information will be displayed to customers when they select Bank Transfer as their payment method during checkout.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <EasyButton
            primary
            large
            onPress={handleSave}
            loading={loading}
            style={styles.saveButton}
          >
            <Icon name="save" size={16} color="white" style={{ marginRight: 8 }} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#8a6c09",
    marginTop: 12,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#5a6c7d",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8a6c09",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#e9dfc4",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#eef5ff",
    borderLeftWidth: 4,
    borderLeftColor: "#1d72d6",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    color: "#1d72d6",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  actionButtons: {
    marginTop: 8,
  },
  saveButton: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    paddingVertical: 14,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    color: "#5a6c7d",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default BankAccountSettings;
