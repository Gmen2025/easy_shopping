import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import getImageUrl from "../../assets/common/getImageUrl";
import { useCurrency } from "../../assets/common/currency";

var { width } = Dimensions.get("window");

const ListItem = (props) => {
  const { item } = props;
  const { formatPrice } = useCurrency();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View>
      {/* Action modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Image
                source={{ uri: getImageUrl(item) }}
                style={styles.modalImage}
                resizeMode="cover"
              />
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalProductName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.modalProductBrand}>{item.brand}</Text>
                <Text style={styles.modalProductPrice}>{formatPrice(item.price)}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <Icon name="times" size={16} color="#757575" />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.modalDivider} />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.editBtn]}
                onPress={() => {
                  setModalVisible(false);
                  props.navigation.navigate("ProductForm", { item, title: "Edit Product" });
                }}
              >
                <Icon name="edit" size={16} color="#fff" />
                <Text style={styles.modalActionText}>Edit Product</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.deleteBtn]}
                onPress={() => {
                  setModalVisible(false);
                  props.delete(item._id);
                }}
              >
                <Icon name="trash" size={16} color="#fff" />
                <Text style={styles.modalActionText}>Delete Product</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Row */}
      <TouchableOpacity
        onPress={() => props.navigation.navigate("ProductDetail", { item })}
        onLongPress={() => setModalVisible(true)}
        style={[
          styles.row,
          { backgroundColor: props.index % 2 === 0 ? "#f8f9ff" : "#fff" },
        ]}
      >
        <Image
          source={{ uri: getImageUrl(item) }}
          resizeMode="cover"
          style={styles.image}
        />
        <Text style={styles.cell} numberOfLines={1}>{item.brand}</Text>
        <Text style={styles.cell} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cell} numberOfLines={1}>{item.category.name}</Text>
        <Text style={[styles.cell, styles.priceCell]}>{formatPrice(item.price)}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  image: {
    width: width / 7,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  cell: {
    fontSize: 12,
    color: "#333",
    width: width / 6,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  priceCell: {
    color: "#1a237e",
    fontWeight: "700",
  },
  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: width * 0.82,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  modalImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  modalHeaderText: {
    flex: 1,
  },
  modalProductName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  modalProductBrand: {
    fontSize: 12,
    color: "#757575",
    marginTop: 2,
  },
  modalProductPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a237e",
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 16,
  },
  modalActions: {
    padding: 16,
    gap: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
  },
  editBtn: {
    backgroundColor: "#1a237e",
    marginRight: 6,
  },
  deleteBtn: {
    backgroundColor: "#c62828",
    marginLeft: 6,
  },
  modalActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

export default ListItem;
