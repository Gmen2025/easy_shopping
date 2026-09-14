import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/FontAwesome";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

export default function Payouts() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [dbName, setDbName] = useState("E_Shopping");
  const [processingBatch, setProcessingBatch] = useState(false);

  // Modal state for approving/marking as paid or rejecting
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState("paid"); // "paid" or "rejected"
  const [referenceInput, setReferenceInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      setDbName(currentDb);
      const response = await axios.get(`${baseUrl}stores/admin/payouts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-database-name": currentDb,
        },
      });
      setPayouts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      Alert.alert("Unable to load payouts", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPayouts();
    }, [loadPayouts])
  );

  const openActionModal = (payout, action) => {
    setSelectedPayout(payout);
    setActionType(action);
    setReferenceInput(payout.reference || (action === "paid" ? `TXN-${Date.now()}` : ""));
    setNotesInput(payout.adminNotes || "");
    setModalVisible(true);
  };

  const handleUpdatePayout = async () => {
    if (!selectedPayout) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const targetDb = selectedPayout.databaseName || dbName;
      const response = await axios.put(
        `${baseUrl}stores/admin/payouts/${selectedPayout._id || selectedPayout.id}`,
        {
          databaseName: targetDb,
          status: actionType,
          reference: referenceInput.trim(),
          adminNotes: notesInput.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-database-name": targetDb,
          },
        }
      );

      if (response.data?.success) {
        setPayouts((prev) =>
          prev.map((p) =>
            (p._id || p.id) === (selectedPayout._id || selectedPayout.id)
              ? { ...p, ...response.data.payout }
              : p
          )
        );
        setModalVisible(false);
        Alert.alert("Success", `Payout marked as ${actionType}.`);
      }
    } catch (error) {
      Alert.alert("Action failed", error?.response?.data?.message || "Could not update payout status.");
    } finally {
      setSubmitting(false);
    }
  };

  const triggerWeeklyBatch = () => {
    const isUSA = dbName.toUpperCase().includes("USA");
    const currency = isUSA ? "USD" : "ETB";

    Alert.alert(
      "Process Weekly Batch Payouts",
      `Calculate available balances and generate weekly settlement payouts for all active stores in ${isUSA ? "USA (USD)" : "Ethiopia (ETB)"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Process Settlements",
          onPress: async () => {
            setProcessingBatch(true);
            try {
              const token = await AsyncStorage.getItem("token");
              const response = await axios.post(
                `${baseUrl}stores/admin/payouts/batch-weekly`,
                {
                  databaseName: dbName,
                  status: "paid",
                  adminNotes: `Weekly platform settlement processed on ${new Date().toLocaleDateString()}`,
                },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "x-database-name": dbName,
                  },
                }
              );

              if (response.data?.success) {
                Alert.alert(
                  "Weekly Settlements Completed",
                  response.data.message || `Processed ${response.data.totalPayouts} payouts.`
                );
                loadPayouts();
              }
            } catch (error) {
              Alert.alert(
                "Batch Settlement Failed",
                error?.response?.data?.message || "Unable to complete weekly batch settlement."
              );
            } finally {
              setProcessingBatch(false);
            }
          },
        },
      ]
    );
  };

  const filteredPayouts = payouts.filter((item) => {
    if (activeTab === "pending") return item.status === "pending" || item.status === "processing";
    if (activeTab === "paid") return item.status === "paid";
    if (activeTab === "early") return item.payoutType === "early_request";
    if (activeTab === "weekly") return item.payoutType === "weekly";
    return true;
  });

  const pendingCount = payouts.filter(
    (p) => p.status === "pending" || p.status === "processing"
  ).length;

  const renderPayoutItem = ({ item }) => {
    const isPending = item.status === "pending" || item.status === "processing";
    const isPaid = item.status === "paid";
    const isRejected = item.status === "rejected";
    const isEarly = item.payoutType === "early_request";
    const currency = item.currency || (dbName.toUpperCase().includes("USA") ? "USD" : "ETB");
    const formattedAmount = currency === "USD" ? `$${Number(item.amount).toFixed(2)}` : `${Number(item.amount).toFixed(2)} ETB`;
    const storeName = item.store?.name || "Unknown Store";
    const storeAccount = item.accountDetails || item.store?.bankAccount || item.store?.phone || "No account details";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.storeName}>{storeName}</Text>
            <Text style={styles.storeDetail}>{item.store?.phone || item.store?.email || ""}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.amountText}>{formattedAmount}</Text>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: isEarly ? "#fef3c7" : "#e0e7ff" },
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: isEarly ? "#92400e" : "#3730a3" },
                ]}
              >
                {isEarly ? "⚡ Early Request" : "📅 Weekly Settlement"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payout Account:</Text>
          <Text style={styles.infoValue}>{storeAccount}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <View
            style={[
              styles.statusBadge,
              isPaid
                ? styles.statusPaid
                : isRejected
                ? styles.statusRejected
                : styles.statusPending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isPaid
                  ? styles.statusTextPaid
                  : isRejected
                  ? styles.statusTextRejected
                  : styles.statusTextPending,
              ]}
            >
              {item.status ? item.status.toUpperCase() : "PENDING"}
            </Text>
          </View>
        </View>

        {item.reference ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reference Code:</Text>
            <Text style={styles.infoValue}>{item.reference}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Requested:</Text>
          <Text style={styles.infoValue}>
            {item.dateRequested ? new Date(item.dateRequested).toLocaleString() : "N/A"}
          </Text>
        </View>

        {item.dateProcessed ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Processed:</Text>
            <Text style={styles.infoValue}>
              {new Date(item.dateProcessed).toLocaleString()}
            </Text>
          </View>
        ) : null}

        {item.adminNotes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>Note: {item.adminNotes}</Text>
          </View>
        ) : null}

        {isPending ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.payBtn]}
              onPress={() => openActionModal(item, "paid")}
            >
              <Icon name="check-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Approve & Mark Paid</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => openActionModal(item, "rejected")}
            >
              <Icon name="times-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Banner with Stats & Weekly Batch Trigger */}
      <View style={styles.topBanner}>
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>Store Payout Settlements</Text>
          <Text style={styles.bannerSubtitle}>
            Region: {dbName.toUpperCase().includes("USA") ? "USA (USD)" : "Ethiopia (ETB)"} • {pendingCount} Pending
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.batchBtn, processingBatch && { opacity: 0.6 }]}
          onPress={triggerWeeklyBatch}
          disabled={processingBatch}
        >
          {processingBatch ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="calendar-check-o" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.batchBtnText}>Run Weekly Batch</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        {[
          { key: "all", label: "All" },
          { key: "pending", label: `Pending (${pendingCount})` },
          { key: "early", label: "Early ⚡" },
          { key: "weekly", label: "Weekly 📅" },
          { key: "paid", label: "Paid" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : (
        <FlatList
          data={filteredPayouts}
          keyExtractor={(item) => String(item._id || item.id)}
          renderItem={renderPayoutItem}
          contentContainerStyle={filteredPayouts.length ? styles.list : styles.emptyList}
          onRefresh={loadPayouts}
          refreshing={loading}
          ListEmptyComponent={
            <Text style={styles.empty}>No payouts matching this filter.</Text>
          }
        />
      )}

      {/* Modal for Approving / Rejecting */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {actionType === "paid" ? "Approve & Mark Paid" : "Reject Payout Request"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Store: {selectedPayout?.store?.name || "Store"} • Amount:{" "}
              {selectedPayout?.amount} {selectedPayout?.currency || ""}
            </Text>

            <Text style={styles.inputLabel}>
              {actionType === "paid"
                ? "Transaction Reference (Telebirr Txn / Bank Ref / Stripe Wire):"
                : "Rejection Reason / Reference:"}
            </Text>
            <TextInput
              style={styles.textInput}
              value={referenceInput}
              onChangeText={setReferenceInput}
              placeholder="e.g. TXN-948274 or PO-SETTLE"
            />

            <Text style={styles.inputLabel}>Admin Notes (Optional):</Text>
            <TextInput
              style={[styles.textInput, { height: 70 }]}
              value={notesInput}
              onChangeText={setNotesInput}
              placeholder="Add payment notes or transfer confirmation details"
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setModalVisible(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  actionType === "paid" ? styles.payBtn : styles.rejectBtn,
                ]}
                onPress={handleUpdatePayout}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnText}>
                    {actionType === "paid" ? "Confirm Payment" : "Confirm Reject"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBanner: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerInfo: { flex: 1, marginRight: 10 },
  bannerTitle: { color: "#e6c20eff", fontSize: 17, fontWeight: "800" },
  bannerSubtitle: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  batchBtn: {
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  batchBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 6,
    backgroundColor: "#f1f5f9",
  },
  tabActive: { backgroundColor: "#0f766e" },
  tabText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  list: { padding: 14 },
  emptyList: { padding: 24, alignItems: "center" },
  empty: { color: "#64748b", fontSize: 14, textAlign: "center", marginTop: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  storeName: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  storeDetail: { fontSize: 12, color: "#64748b", marginTop: 2 },
  amountText: { fontSize: 17, fontWeight: "800", color: "#0f766e" },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  infoLabel: { fontSize: 12, color: "#64748b", fontWeight: "500" },
  infoValue: { fontSize: 12, color: "#334155", fontWeight: "600", flexShrink: 1, textAlign: "right" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusPending: { backgroundColor: "#fef3c7" },
  statusPaid: { backgroundColor: "#dcfce7" },
  statusRejected: { backgroundColor: "#fee2e2" },
  statusText: { fontSize: 11, fontWeight: "800" },
  statusTextPending: { color: "#b45309" },
  statusTextPaid: { color: "#15803d" },
  statusTextRejected: { color: "#b91c1c" },
  notesBox: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  notesText: { fontSize: 11, color: "#475569", fontStyle: "italic" },
  actionRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 8,
  },
  payBtn: { backgroundColor: "#059669" },
  rejectBtn: { backgroundColor: "#dc2626" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: "#64748b", marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#334155", marginTop: 8, marginBottom: 4 },
  textInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  modalButtons: { flexDirection: "row", marginTop: 18, gap: 10 },
  modalBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtn: { backgroundColor: "#e2e8f0" },
  modalCancelText: { color: "#334155", fontWeight: "700", fontSize: 13 },
});