import React, { useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
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
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [formData, setFormData] = useState({
    bankName: "",
    accountNumber: "",
    accountHolderName: "",
    bankCode: "",
    additionalInfo: "",
  });

  useFocusEffect(
    React.useCallback(() => {
      fetchBankAccounts();
    }, [])
  );

  const fetchBankAccounts = async () => {
    setFetching(true);
    try {
      const response = await axios.get(`${baseUrl}settings/bank-account`);
      console.log("Bank accounts response:", response.data);
      if (response.data.success) {
        setBankAccounts(response.data.bankAccounts || []);
      }
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      console.error("Error response status:", error.response?.status);
      console.error("Error response data:", error.response?.data);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.response?.data?.message || error.message || "Failed to load bank accounts",
      });
    } finally {
      setFetching(false);
    }
  };

  const openAddModal = () => {
    setEditingBank(null);
    setFormData({
      bankName: "",
      accountNumber: "",
      accountHolderName: "",
      bankCode: "",
      additionalInfo: "",
    });
    setModalVisible(true);
  };

  const openEditModal = (bank) => {
    setEditingBank(bank);
    setFormData({
      bankName: bank.bankName || "",
      accountNumber: bank.accountNumber || "",
      accountHolderName: bank.accountHolderName || "",
      bankCode: bank.bankCode || "",
      additionalInfo: bank.additionalInfo || "",
    });
    setModalVisible(true);
  };

  const validateForm = () => {
    if (!formData.bankName.trim()) {
      Alert.alert("Error", "Bank Name is required");
      return false;
    }
    if (!formData.accountNumber.trim()) {
      Alert.alert("Error", "Account Number is required");
      return false;
    }
    if (!formData.accountHolderName.trim()) {
      Alert.alert("Error", "Account Holder Name is required");
      return false;
    }
    return true;
  };

  const handleSaveBank = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Authentication token not found",
        });
        setLoading(false);
        return;
      }

      const payload = {
        action: editingBank ? "update" : "add",
        bankAccount: {
          ...(editingBank && { _id: editingBank._id }),
          bankName: formData.bankName.trim(),
          accountNumber: formData.accountNumber.trim(),
          accountHolderName: formData.accountHolderName.trim(),
          bankCode: formData.bankCode.trim(),
          additionalInfo: formData.additionalInfo.trim(),
        },
      };

      const response = await axios.put(`${baseUrl}settings/bank-account`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: `Bank account ${editingBank ? "updated" : "added"} successfully`,
        });
        setBankAccounts(response.data.bankAccounts || []);
        setModalVisible(false);
      }
    } catch (error) {
      console.error("Error saving bank account:", error);
      console.error("Error response:", error.response?.data);
      const errorMessage =
        error.response?.data?.message || error.message || "Failed to save changes";
      Toast.show({
        type: "error",
        text1: "Error",
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBank = (bank) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete the bank account for ${bank.bankName}?`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Delete",
          onPress: async () => {
            await performDeleteBank(bank);
          },
          style: "destructive",
        },
      ]
    );
  };

  const performDeleteBank = async (bank) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Authentication token not found",
        });
        setLoading(false);
        return;
      }

      const response = await axios.put(
        `${baseUrl}settings/bank-account`,
        {
          action: "delete",
          bankAccount: { _id: bank._id },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Bank account deleted successfully",
        });
        setBankAccounts(response.data.bankAccounts || []);
      }
    } catch (error) {
      console.error("Error deleting bank account:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.response?.data?.message || "Failed to delete bank account",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderBankCard = ({ item }) => (
    <View style={styles.bankCard}>
      <View style={styles.bankCardHeader}>
        <View style={styles.bankCardTitleContainer}>
          <Icon name="bank" size={24} color="#2E7D32" />
          <View style={styles.bankCardTitle}>
            <Text style={styles.bankCardName}>{item.bankName}</Text>
            <Text style={styles.bankCardSubtitle}>{item.accountHolderName}</Text>
          </View>
        </View>
        <View style={styles.bankCardActions}>
          <EasyButton
            onPress={() => openEditModal(item)}
            style={styles.editButton}
          >
            <Icon name="pencil" size={16} color="white" />
          </EasyButton>
          <EasyButton
            onPress={() => handleDeleteBank(item)}
            style={styles.deleteButton}
          >
            <Icon name="trash" size={16} color="white" />
          </EasyButton>
        </View>
      </View>

      <View style={styles.bankCardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Account Number:</Text>
          <Text style={styles.detailValue}>{item.accountNumber}</Text>
        </View>
        {item.bankCode && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bank Code:</Text>
            <Text style={styles.detailValue}>{item.bankCode}</Text>
          </View>
        )}
        {item.additionalInfo && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Additional Info:</Text>
            <Text style={styles.detailValue}>{item.additionalInfo}</Text>
          </View>
        )}
      </View>
    </View>
  );

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
          <Text style={styles.headerTitle}>Bank Accounts</Text>
          <Text style={styles.headerSubtitle}>
            Manage the bank account details shown to customers during transactions
          </Text>
        </View>

        {/* Bank Accounts List */}
        <View style={styles.listContainer}>
          {bankAccounts.length > 0 ? (
            <FlatList
              data={bankAccounts}
              renderItem={renderBankCard}
              keyExtractor={(item) => item._id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Icon name="inbox" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No bank accounts added yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add your first bank account to enable bank transfers
              </Text>
            </View>
          )}
        </View>

        {/* Add Bank Button */}
        <View style={styles.addButtonContainer}>
          <EasyButton
            primary
            large
            onPress={openAddModal}
            style={styles.addButton}
          >
            <Icon name="plus" size={18} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Add Bank Account</Text>
          </EasyButton>
        </View>

        {/* Add/Edit Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingBank ? "Edit Bank Account" : "Add Bank Account"}
                </Text>
                <EasyButton onPress={() => setModalVisible(false)} style={styles.closeButton}>
                  <Icon name="close" size={20} color="white" />
                </EasyButton>
              </View>

              <ScrollView contentContainerStyle={styles.formContainer}>
                <Text style={styles.fieldLabel}>Bank Name *</Text>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChangeText={(text) =>
                    setFormData({ ...formData, bankName: text })
                  }
                  placeholder="e.g., Commercial Bank of Ethiopia"
                />

                <Text style={styles.fieldLabel}>Account Number *</Text>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChangeText={(text) =>
                    setFormData({ ...formData, accountNumber: text })
                  }
                  placeholder="e.g., 1234567890"
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>Account Holder Name *</Text>
                <Input
                  id="accountHolderName"
                  value={formData.accountHolderName}
                  onChangeText={(text) =>
                    setFormData({ ...formData, accountHolderName: text })
                  }
                  placeholder="e.g., Easy Shopping PLC"
                />

                <Text style={styles.fieldLabel}>Bank Code (Optional)</Text>
                <Input
                  id="bankCode"
                  value={formData.bankCode}
                  onChangeText={(text) =>
                    setFormData({ ...formData, bankCode: text })
                  }
                  placeholder="e.g., CBE or SWIFT code"
                />

                <Text style={styles.fieldLabel}>Additional Information (Optional)</Text>
                <Input
                  id="additionalInfo"
                  value={formData.additionalInfo}
                  onChangeText={(text) =>
                    setFormData({ ...formData, additionalInfo: text })
                  }
                  placeholder="Any additional info (reference, instructions, etc.)"
                  multiline
                  numberOfLines={4}
                />

                <View style={styles.formActions}>
                  <EasyButton
                    onPress={() => setModalVisible(false)}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </EasyButton>
                  <EasyButton
                    primary
                    onPress={handleSaveBank}
                    loading={loading}
                    style={styles.saveButton}
                  >
                    <Text style={styles.buttonText}>
                      {editingBank ? "Update" : "Add"} Bank
                    </Text>
                  </EasyButton>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  header: {
    backgroundColor: "goldenrod",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 24,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 12,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#d0d8e8",
    textAlign: "center",
  },
  listContainer: {
    marginBottom: 24,
  },
  bankCard: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dce3ef",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  bankCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bankCardTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  bankCardTitle: {
    marginLeft: 12,
    flex: 1,
  },
  bankCardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#152642",
    marginBottom: 2,
  },
  bankCardSubtitle: {
    fontSize: 13,
    color: "#6a7380",
  },
  bankCardActions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#1d72d6",
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#E74C3C",
  },
  bankCardDetails: {
    borderTopWidth: 1,
    borderTopColor: "#dce3ef",
    paddingTop: 12,
  },
  detailRow: {
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6a7380",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: "#152642",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#152642",
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#6a7380",
    textAlign: "center",
  },
  addButtonContainer: {
    marginBottom: 20,
  },
  addButton: {
    borderRadius: 12,
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingTop: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "goldenrod",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  closeButton: {
    padding: 4,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 6,
  },
  formContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#152642",
    marginBottom: 8,
    marginTop: 12,
  },
  formActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dce3ef",
    borderRadius: 12,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: "#152642",
    fontWeight: "700",
    fontSize: 14,
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
  },
});

export default BankAccountSettings;
