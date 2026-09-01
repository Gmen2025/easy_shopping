import React, {useContext, useState} from 'react'
import { View, StyleSheet, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Card, Divider, Avatar } from 'react-native-paper';
import EasyButton from '../../../Shared/StyledComponenets/EasyButton';

import { useDispatch } from 'react-redux';
import { clearCart } from '../../../store/cartSlice'; // Uncomment if you have a clearCart action in your Redux store
import { AuthContext } from "../../../Context/store/Auth";
import Toast from "react-native-toast-message"
import axios from "axios";
import baseUrl from '../../../assets/common/baseUrl'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCheckout } from '../../../Context/store/CheckoutContext'; // Import the useCheckout hook
import { useCurrency } from '../../../assets/common/currency';
import { deductInventoryFromOrder, validateOrderStock } from '../../../assets/common/inventory';



const width = Dimensions.get('window').width; // Get the width of the device screen


const Confirm = (props) => {
    const { order: contextOrder } = useCheckout();
  const { formatPrice } = useCurrency();
    //const finalOrder = route.params;
    const context = useContext(AuthContext);

    // Get order from route params or context
    const order = props.route?.params?.order || contextOrder;
    
    const dispatch = useDispatch(); // Initialize the Redux dispatch function
    const [submitting, setSubmitting] = useState(false);

    // If you need to clear the cart, you can call this function
    const handlePlaceOrder = async() => {
      if (submitting) return;

      if (!order || !Array.isArray(order.orderItems) || order.orderItems.length === 0) {
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "No order data",
          text2: "Please go back and complete checkout again.",
        });
        return;
      }

      setSubmitting(true);
      try {
        const token = await AsyncStorage.getItem("token");
        const stockValidation = await validateOrderStock({
          orderItems: order.orderItems,
          token,
        });

        if (!stockValidation.ok) {
          Toast.show({
            topOffset: 60,
            type: "error",
            text1: "Reduce item quantity",
            text2: stockValidation.message || "Some items exceed available stock.",
          });
          return;
        }

        //const orderInfo = order.order;
        const orderItem = {
          ...order,
          user: context.user?._id,
          pickupStore: order.pickupStore || null,
          pickupStoreName: order.pickupStoreName || order.pickupStore?.name || null,
          storeLocation: order.storeLocation || null,
          customerLocation: order.customerLocation || null,
          pickupStoreId: order.pickupStoreId || order.pickupStore?._id || order.pickupStore?.id || null,
          storeId: order.storeId || order.pickupStore?._id || order.pickupStore?.id || null,
          storeAssignment: order.storeAssignment || null,
          storeAssignmentStatus: order.storeAssignmentStatus || "assigned",
          orderItems: order.orderItems.map((item) => ({
            product: item._id || item.id,
            quantity: item.quantity || 1,
          })),
          paymentMethod: order.paymentMethod,
          methodName: order.methodName,
          cardType: order.cardType,
          bankName: order.bankName,
          transferReference: order.transferReference,
          senderName: order.senderName,
        };

        console.log("Order to submit: ", orderItem);
        const res = await axios.post(`${baseUrl}orders`, orderItem, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 45000,
        });

        if (res.status == 200 || res.status == 201) {
          const inventoryResult = await deductInventoryFromOrder({
            orderItems: order.orderItems,
            token,
          });

          if (!inventoryResult.ok) {
            Toast.show({
              topOffset: 60,
              type: "info",
              text1: "Order placed",
              text2: "Some stock counts could not be updated",
            });
          }

          Toast.show({
            topOffset: 60,
            type: "success",
            text1: "Order placed",
            text2: "Thank you for your purchase",
          });
          dispatch(clearCart()); // Clear the cart after placing the order
          const createdOrder = res.data?.order || res.data;
          if (order.deliveryMode === "SAME_DAY" && createdOrder?._id) {
            props.navigation.navigate("User", {
              screen: "OrderTracking",
              params: { orderId: createdOrder._id, order: createdOrder },
            });
          } else {
            props.navigation.navigate("CartHome");
          }
        }
      } catch (error) {
        console.log("Order submit error:", error.response?.data || error.message);
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Order could not be placed",
          text2:
            error.response?.data?.message ||
            "Please check your connection and try again",
        });
      } finally {
        setSubmitting(false);
      }
    };

    if (!order) {
    return (
      <View style={[styles.container, styles.centeredEmpty]}>
        <Text style={styles.emptyText}>No order data available</Text>
        <EasyButton
          tertiary
          large
          onPress={() => props.navigation.navigate("Shipping")}
          style={styles.emptyButton}
        >
          <Text style={styles.emptyPrimaryText}>Start Checkout</Text>
        </EasyButton>
      </View>
    );
  }

    return (
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Review and Confirm</Text>
          <Text style={styles.headerSubtitle}>
            Verify your shipping details and items before placing the order.
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.confirmTitle}>
                Order Confirmation
              </Text>
              <Text variant="bodyLarge" style={styles.label}>
                Shipping Address:
              </Text>
              <Text>Address: {order.address || order.shippingAddress1}</Text>
              {order.address2 || order.shippingAddress2 ? (
                <Text>
                  Address2: {order.address2 || order.shippingAddress2}
                </Text>
              ) : null}
              <Text>City: {order.city}</Text>
              <Text>Zip Code: {order.zip}</Text>
              <Text>{order.country}</Text>
              <Text variant="bodyLarge" style={styles.label}>
                Phone:
              </Text>
              <Text>{order.phone}</Text>
              <Divider style={{ marginVertical: 10 }} />
              
              <Text variant="bodyLarge" style={styles.label}>
                Payment Method:
              </Text>
              <Text style={styles.paymentMethodText}>{order.methodName || order.method || "Not specified"}</Text>
              {order.cardType && (
                <Text style={styles.detailText}>Card Type: {order.cardType}</Text>
              )}
              {order.bankName && (
                <>
                  <Text style={styles.bankDetailLabel}>Bank Transfer Information:</Text>
                  <View style={styles.bankDetailsContainer}>
                    <Text style={styles.detailText}>Bank Name: <Text style={styles.detailValue}>{order.bankName}</Text></Text>
                    <Text style={styles.detailText}>Sender Name: <Text style={styles.detailValue}>{order.senderName}</Text></Text>
                    <Text style={styles.detailText}>Transfer Reference: <Text style={styles.detailValue}>{order.transferReference}</Text></Text>
                  </View>
                </>
              )}

              <Divider style={{ marginVertical: 10 }} />

              <Text variant="bodyLarge" style={styles.label}>
                Order Items:
              </Text>
              {Array.isArray(order.orderItems) &&
              order.orderItems.length > 0 ? (
                order.orderItems.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Avatar.Image
                      size={40}
                      source={{
                        uri: item.image || "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
                      }}
                      style={styles.thumbnail}
                    />
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>X: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>
                      {formatPrice(item.price?.toFixed ? item.price : Number(item.price || 0))}
                    </Text>
                  </View>
                ))
              ) : (
                <Text>No items in this order.</Text>
              )}
              <Text variant="bodyLarge" style={styles.label}>
                Total Price:
              </Text>
              <Text style={styles.totalText}>
                {formatPrice(
                  Array.isArray(order.orderItems)
                  ? order.orderItems
                      .reduce(
                        (sum, item) => sum + item.price * (item.quantity || 1),
                        0
                      )
                  : 0
                )}
              </Text>
            </Card.Content>
            <Card.Actions style={{ justifyContent: "space-between" }}>
              <EasyButton
                style={[styles.actionButton, styles.actionButtonLeft]}
                secondary
                large
                disabled={submitting}
                onPress={() => props.navigation.navigate("Shipping")}
              >
                <Text style={styles.actionSecondaryText}>Back</Text>
              </EasyButton>
              <EasyButton
                style={[styles.actionButton, styles.actionButtonRight, submitting && { opacity: 0.7 }]}
                tertiary
                disabled={submitting}
                onPress={handlePlaceOrder}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <Text style={styles.actionPrimaryText}>Place Order</Text>
                )}
              </EasyButton>
            </Card.Actions>
          </Card>
        </ScrollView>
        <View style={{ height: 10 }} />
      </View>
    );       
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centeredEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 14,
    textAlign: 'center',
  },
  emptyButton: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  emptyPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  headerCard: {
    backgroundColor: 'goldenrod',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 18,
  },
  scrollContent: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  card: {
    width: width * 0.92,
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 40,
  },
  confirmTitle: {
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10,
  },
  bankDetailLabel: {
    fontWeight: 'bold',
    marginTop: 10,
    color: '#2E7D32',
    fontSize: 14,
  },
  bankDetailsContainer: {
    backgroundColor: '#f0f7f0',
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
    padding: 12,
    marginTop: 8,
    borderRadius: 4,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d72d6',
    marginTop: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginVertical: 4,
  },
  detailValue: {
    fontWeight: '600',
    color: '#152642',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemName: {
    flex: 2,
    fontSize: 15,
  },
  itemQty: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
  },
  itemPrice: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '700',
  },
  thumbnail: {
    marginRight: 8,
    backgroundColor: '#eee',
  },
  totalText: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  actionPrimaryText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  actionSecondaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  actionButton: {
    borderRadius: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  actionButtonLeft: {
    marginLeft: 10,
  },
  actionButtonRight: {
    marginRight: 10,
  },
});

export default Confirm;
