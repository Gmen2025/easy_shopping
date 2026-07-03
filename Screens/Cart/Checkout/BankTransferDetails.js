import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { Text, Card } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import EasyButton from "../../../Shared/StyledComponenets/EasyButton";
import FormContainer from "../../../Shared/Form/FormContainer";
import Input from "../../../Shared/Form/Input";
import axios from "axios";
import baseUrl from "../../../assets/common/baseUrl";
import Icon from "react-native-vector-icons/FontAwesome";

const BankTransferDetails = (props) => {
  const { order } = props.route.params || {};
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);
  const [transferReference, setTransferReference] = useState("");
  const [senderName, setSenderName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        console.log("Fetching bank accounts from:", `${baseUrl}settings/bank-account`);
        const response = await axios.get(`${baseUrl}settings/bank-account`);
        console.log("Bank accounts response:", response.data);
        if (response.data.success && response.data.bankAccounts) {
          setBankAccounts(response.data.bankAccounts);
          // Auto-select first bank if available
          if (response.data.bankAccounts.length > 0) {
            setSelectedBankId(response.data.bankAccounts[0]._id);
            setSelectedBank(response.data.bankAccounts[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching bank accounts:", error);
        console.error("Error response:", error.response?.data);
      } finally {
        setLoading(false);
      }
    };

    fetchBankAccounts();
  }, []);

  const handleBankSelection = (bankId) => {
    setSelectedBankId(bankId);
    const bank = bankAccounts.find((b) => b._id === bankId);
    setSelectedBank(bank);
  };

  const handleConfirm = () => {
    if (!selectedBank) {
      Alert.alert("Error", "Please select a bank account");
      return;
    }

    if (!transferReference.trim()) {
      Alert.alert("Error", "Please enter the transfer reference");
      return;
    }

    if (!senderName.trim()) {
      Alert.alert("Error", "Please enter the sender name");
      return;
    }

    const orderWithBankDetails = {
      ...order,
      bankName: selectedBank.bankName,
      accountNumber: selectedBank.accountNumber,
      accountHolderName: selectedBank.accountHolderName,
      bankCode: selectedBank.bankCode,
      transferReference: transferReference.trim(),
      senderName: senderName.trim(),
    };

    props.navigation.navigate("Confirm", { order: orderWithBankDetails });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.title}>Bank Transfer Details</Text>
          <Text style={styles.subtitle}>
            Select a bank account and provide your transfer information
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Card.Content>
            {/* Bank Selection */}
            {bankAccounts.length > 0 ? (
              <View>
                <Text style={styles.sectionLabel}>Select Bank Account *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedBankId}
                    onValueChange={handleBankSelection}
                    style={styles.picker}
                  >
                    <Picker.Item label="Choose a bank account..." value={null} />
                    {bankAccounts.map((bank) => (
                      <Picker.Item
                        key={bank._id}
                        label={`${bank.bankName} - ${bank.accountHolderName}`}
                        value={bank._id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            ) : null}

            {/* Selected Bank Details Display */}
            {selectedBank ? (
              <View style={styles.bankInfoSection}>
                <View style={styles.bankInfoHeader}>
                  <Icon name="bank" size={20} color="#2E7D32" />
                  <Text style={styles.bankInfoTitle}>Bank Account Details</Text>
                </View>

                <View style={styles.bankInfoBox}>
                  <View style={styles.bankInfoRow}>
                    <Text style={styles.bankInfoLabel}>Bank Name:</Text>
                    <Text style={styles.bankInfoValue}>{selectedBank.bankName}</Text>
                  </View>

                  <View style={styles.bankInfoRow}>
                    <Text style={styles.bankInfoLabel}>Account Holder:</Text>
                    <Text style={styles.bankInfoValue}>{selectedBank.accountHolderName}</Text>
                  </View>

                  <View style={styles.bankInfoRow}>
                    <Text style={styles.bankInfoLabel}>Account Number:</Text>
                    <Text style={[styles.bankInfoValue, styles.accountNumber]}>
                      {selectedBank.accountNumber}
                    </Text>
                  </View>

                  {selectedBank.bankCode && (
                    <View style={styles.bankInfoRow}>
                      <Text style={styles.bankInfoLabel}>Bank Code:</Text>
                      <Text style={styles.bankInfoValue}>{selectedBank.bankCode}</Text>
                    </View>
                  )}

                  {selectedBank.additionalInfo && (
                    <View style={styles.bankInfoRow}>
                      <Text style={styles.bankInfoLabel}>Additional Info:</Text>
                      <Text style={styles.bankInfoValue}>{selectedBank.additionalInfo}</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : bankAccounts.length === 0 ? (
              <View style={styles.noBankInfoAlert}>
                <Icon name="exclamation-circle" size={24} color="#E74C3C" />
                <Text style={styles.noBankInfoText}>
                  No bank accounts are currently available. Please contact support.
                </Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Transfer Reference *</Text>
              <Input
                placeholder="e.g., TRF123456789"
                name="transferReference"
                id="transferReference"
                value={transferReference}
                onChangeText={(text) => setTransferReference(text)}
              />
              <Text style={styles.helperText}>
                Provide a reference number or transaction ID for this transfer
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sender Name *</Text>
              <Input
                placeholder="Your full name"
                name="senderName"
                id="senderName"
                value={senderName}
                onChangeText={(text) => setSenderName(text)}
              />
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>ℹ️ Note</Text>
              <Text style={styles.infoText}>
                Please ensure all information is accurate. We will use this information to verify your bank transfer payment.
              </Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.buttonContainer}>
          <EasyButton
            secondary
            large
            onPress={() => props.navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </EasyButton>
          <EasyButton
            tertiary
            large
            onPress={handleConfirm}
            style={styles.continueButton}
          >
            <Text style={styles.continueButtonText}>Continue to Review</Text>
          </EasyButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: "goldenrod",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#d0d8e8",
  },
  formCard: {
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#dce3ef",
  },
  inputGroup: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#152642",
    marginBottom: 10,
  },
  pickerContainer: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dce3ef",
    borderRadius: 8,
    marginBottom: 20,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  bankInfoSection: {
    marginBottom: 20,
  },
  bankInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bankInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E7D32",
    marginLeft: 8,
  },
  bankInfoBox: {
    backgroundColor: "#f0f9f5",
    borderWidth: 2,
    borderColor: "#2E7D32",
    borderRadius: 8,
    padding: 12,
  },
  bankInfoRow: {
    marginBottom: 10,
  },
  bankInfoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2E7D32",
    marginBottom: 2,
  },
  bankInfoValue: {
    fontSize: 13,
    color: "#152642",
    fontWeight: "500",
  },
  accountNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d72d6",
    letterSpacing: 1,
  },
  noBankInfoAlert: {
    backgroundColor: "#FEE",
    borderWidth: 1,
    borderColor: "#E74C3C",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  noBankInfoText: {
    fontSize: 13,
    color: "#E74C3C",
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#e9dfc4",
    marginVertical: 16,
    fontSize: 14,
    fontWeight: "600",
    color: "#152642",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: "#6a7380",
    marginTop: 6,
    lineHeight: 16,
  },
  infoBox: {
    backgroundColor: "#eef5ff",
    borderLeftWidth: 4,
    borderLeftColor: "#1d72d6",
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1d72d6",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  backButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 4,
  },
  backButtonText: {
    color: "#152642",
    fontWeight: "700",
    fontSize: 14,
  },
  continueButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 4,
  },
  continueButtonText: {
    color: "#0d0d0d",
    fontWeight: "700",
    fontSize: 14,
  },
});

export default BankTransferDetails;
