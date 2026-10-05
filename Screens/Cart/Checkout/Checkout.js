import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome5";
import { Picker } from "@react-native-picker/picker";
import FormContainer from "../../../Shared/Form/FormContainer";
import Input from "../../../Shared/Form/Input";
import { AuthContext } from "../../../Context/store/Auth";
import Toast from "react-native-toast-message";
import EasyButton from "../../../Shared/StyledComponenets/EasyButton";

const countries = require("../../../assets/data/countries.json");
import { useSelector } from "react-redux";
import axios from "axios";
import baseUrl from "../../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveDeliveryLocation } from "../../../assets/common/deliveryLocation";
import { getShippingAddressText } from "../../../assets/common/orderTracking";
import { validateOrderStock } from "../../../assets/common/inventory";
import { buildStoreAssignmentPayload } from "../../../assets/common/stores";
import {
  getDeliverySettings,
  estimateDeliveryDistanceKm,
  getDeliveryPricingDistance,
} from "../../../assets/common/delivery";
import {
  getCurrencyConfigForDatabase,
  useCurrency,
} from "../../../assets/common/currency";
import { getDatabaseNameFromStorage } from "../../../assets/common/databaseConfig";

const DELIVERY_MODE_OPTIONS = [
  {
    value: "SAME_DAY",
    label: "Same Day Delivery",
    desc: "Fastest option available",
    icon: "shipping-fast",
  },
  {
    value: "NEXT_DAY",
    label: "Next Day Delivery",
    desc: "Arrives tomorrow",
    icon: "calendar-day",
  },
  {
    value: "SCHEDULED",
    label: "Scheduled Delivery",
    desc: "Choose your delivery day",
    icon: "clock",
  },
];

const getUpcomingDeliveryDays = () =>
  Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    date.setHours(12, 0, 0, 0);

    const value = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      value,
      label: date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    };
  });

const DELIVERY_FEE_DEFAULTS = {
  SAME_DAY: { base: 9, perKm: 1, premium: 4 },
  NEXT_DAY: { base: 4, perKm: 0.6 },
  SCHEDULED: { base: 5, perKm: 0.75 },
};

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

const estimateDeliveryFee = (
  deliveryMode,
  distanceKm,
  scheduledForDate,
  config = {},
  databaseName
) => {
  const distance = getDeliveryPricingDistance(distanceKm, databaseName) || 0;

  if (deliveryMode === "SAME_DAY") {
    const base = config.sameDayBase ?? DELIVERY_FEE_DEFAULTS.SAME_DAY.base;
    const perKm = config.sameDayPerKm ?? DELIVERY_FEE_DEFAULTS.SAME_DAY.perKm;
    const premium =
      config.sameDayPremium ?? DELIVERY_FEE_DEFAULTS.SAME_DAY.premium;
    return roundCurrency(base + premium + distance * perKm);
  }

  if (deliveryMode === "NEXT_DAY") {
    const base = config.nextDayBase ?? DELIVERY_FEE_DEFAULTS.NEXT_DAY.base;
    const perKm = config.nextDayPerKm ?? DELIVERY_FEE_DEFAULTS.NEXT_DAY.perKm;
    return roundCurrency(base + distance * perKm);
  }

  const base = config.scheduledBase ?? DELIVERY_FEE_DEFAULTS.SCHEDULED.base;
  const perKm = config.scheduledPerKm ?? DELIVERY_FEE_DEFAULTS.SCHEDULED.perKm;
  const hour =
    scheduledForDate instanceof Date && !Number.isNaN(scheduledForDate.getTime())
      ? scheduledForDate.getHours()
      : -1;
  const peakSurcharge =
    hour >= 17 && hour <= 20 ? config.scheduledPeakSurcharge ?? 1.5 : 0;
  const offPeakDiscount =
    hour >= 10 && hour <= 15 ? -(config.scheduledOffPeakDiscount ?? 0.5) : 0;
  return roundCurrency(base + distance * perKm + peakSurcharge + offPeakDiscount);
};

function Checkout(props) {
  const context = useContext(AuthContext);
  const cartItems = useSelector((state) => state.cart.cartItems);
  const [token, setToken] = useState();
  const { formatPrice } = useCurrency();

  const [orderItems, setOrderItems] = useState([]);
  const [address, setAddress] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [user, setUser] = useState();
  const [deliveryMode, setDeliveryMode] = useState("SAME_DAY");
  const [scheduledDate, setScheduledDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryConfig, setDeliveryConfig] = useState({});

  useEffect(() => {
    let isCurrent = true;
    getDeliverySettings({ token }).then((settings) => {
      if (isCurrent && settings?.deliveryConfig) {
        setDeliveryConfig(settings.deliveryConfig);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [token]);

  useEffect(() => {
    if (context.isAuthenticated && context.user) {
      setUser(context.user.sub);

      AsyncStorage.getItem("token").then((res) => {
        setToken(res);

        const config = {
          headers: {
            Authorization: `Bearer ${res}`,
          },
        };

        if (context.user?._id) {
          axios
            .get(`${baseUrl}orders/get/userorders/${context.user._id}`, config)
            .then((orderRes) => {
              const orders = orderRes.data;
              if (orders && orders.length > 0) {
                const firstOrder = orders[0];
                setAddress(firstOrder.shippingAddress1 || "");
                setAddress2(firstOrder.shippingAddress2 || "");
                setCity(firstOrder.city || "");
                setZip(firstOrder.zip || "");
                setCountry(firstOrder.country || "");
                setPhone(firstOrder.phone || "");
              } else if (context.user?._id) {
                axios
                  .get(`${baseUrl}users/${context.user._id}`, config)
                  .then((res) => {
                    const data = res.data;
                    if (data) {
                      setAddress(data.street || "");
                      setAddress2(data.shippingAddress2 || "");
                      setCity(data.city || "");
                      setZip(data.zip || "");
                      setCountry(data.country || "");
                      setPhone(data.phone || "");
                    }
                  })
                  .catch((error) => console.log("User data error: ", error));
              }
            })
            .catch((error) => console.log("User data error: ", error));
        }
      });
    } else {
      props.navigation.navigate("CartHome");
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Please login to checkout",
        text2: "",
      });
    }

    setOrderItems(cartItems);

    return () => {
      setOrderItems([]);
    };
  }, [cartItems]);

  const calculateItemsSubtotal = (items) => {
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  const parseScheduledDate = () => {
    if (deliveryMode !== "SCHEDULED" || !scheduledDate.trim()) {
      return null;
    }
    const [year, month, day] = scheduledDate.split("-").map(Number);
    const parsed = new Date(year, month - 1, day, 12);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getEstimatedDeliveryFee = () =>
    estimateDeliveryFee(
      deliveryMode,
      0,
      parseScheduledDate(),
      deliveryConfig
    );

  const calculateTotal = (items) =>
    calculateItemsSubtotal(items) + getEstimatedDeliveryFee();

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!address || !city || !zip || !country || !phone) {
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Please fill in all required fields",
        text2: "",
      });
      return;
    }

    const scheduledForDate = parseScheduledDate();

    if (deliveryMode === "SCHEDULED") {
      if (!scheduledDate.trim() || !scheduledForDate) {
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Please choose a valid scheduled delivery date/time",
          text2: "",
        });
        return;
      }
      if (scheduledForDate.getTime() <= Date.now()) {
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Scheduled delivery must be a future date/time",
          text2: "",
        });
        return;
      }
    }

    if (!orderItems || orderItems.length === 0) {
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Your cart is empty",
        text2: "Add items to your cart before checking out",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const stockValidation = await validateOrderStock({
        orderItems,
        token,
      });

      if (!stockValidation.ok) {
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: stockValidation.unverified?.length
            ? "Could not verify stock"
            : "Reduce item quantity",
          text2:
            stockValidation.message || "Some items exceed available stock.",
        });
        return;
      }

      let latestDeliverySettings;
      try {
        latestDeliverySettings = await getDeliverySettings({
          token,
          allowCached: false,
        });
      } catch (error) {
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Delivery pricing is unavailable",
          text2: "Please try again in a moment.",
        });
        return;
      }

      if (!latestDeliverySettings?.deliveryConfig) {
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Delivery pricing is unavailable",
          text2: "Please try again in a moment.",
        });
        return;
      }

      const latestDeliveryConfig = latestDeliverySettings.deliveryConfig;
      setDeliveryConfig(latestDeliveryConfig);

      const shippingAddressText = getShippingAddressText({
        address1: address, address2, city, zip, country,
      });
      const customerLocation = await resolveDeliveryLocation(shippingAddressText, country);
      const storeAssignment = await buildStoreAssignmentPayload(customerLocation, token);

      const googleDistanceKm = await estimateDeliveryDistanceKm({
        destinationAddress: shippingAddressText,
        storeId: storeAssignment.storeId,
        customerLocation,
        token,
      });

      const normalizedDistanceKm = googleDistanceKm;
      const selectedDatabaseName = await getDatabaseNameFromStorage();
      const deliveryFee = estimateDeliveryFee(
        deliveryMode,
        normalizedDistanceKm,
        scheduledForDate,
        latestDeliveryConfig,
        selectedDatabaseName
      );
      const currencyCode =
        getCurrencyConfigForDatabase(selectedDatabaseName).code;

      let order = {
        _id: `temp_order_${Date.now()}`,
        orderId: `ORDER_${Date.now()}`,
        shippingAddress1: address,
        shippingAddress2: address2,
        status: "1",
        city,
        zip,
        country,
        phone,
        orderItems: orderItems.map((item) => ({
          ...item,
          _id: item._id || item.id,
          quantity: item.quantity || 1,
        })),
        user: user || context.user?._id,
        dateOrdered: Date.now(),
        itemsSubtotal: calculateItemsSubtotal(orderItems),
        deliveryMode,
        deliveryDistanceKm: normalizedDistanceKm,
        deliveryFee,
        currency: currencyCode,
        scheduledFor:
          deliveryMode === "SCHEDULED" ? scheduledForDate.toISOString() : null,
        scheduledDeliveryDate:
          deliveryMode === "SCHEDULED" ? scheduledForDate.toISOString() : null,
        totalPrice: calculateItemsSubtotal(orderItems) + deliveryFee,
        ...storeAssignment,
        pickupStoreName: storeAssignment.pickupStoreName || "Nearby Store",
        customerLocation,
        customerLocationSource: "shipping-address",
        paymentMethod: null,
        methodName: null,
        cardType: null,
        paymentStatus: "pending",
      };

      props.navigation.navigate("Payment", { order });
    } catch (error) {
      console.warn("Checkout confirm failed:", error);
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Something went wrong",
        text2: error?.message || "Please check your connection and try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <FormContainer title="Checkout">
        
        {/* Shipping Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="map-marker-alt" size={16} color="#3b82f6" />
            <Text style={styles.cardTitle}>Shipping Address</Text>
          </View>

          <Input
            placeholder="Address Line 1 *"
            name="Shipping address 1"
            value={address}
            onChangeText={(text) => setAddress(text)}
          />
          <Input
            placeholder="Address Line 2 (Optional)"
            name="Shipping address 2"
            value={address2}
            onChangeText={(text) => setAddress2(text)}
          />
          <Input
            placeholder="City *"
            name="city"
            value={city}
            onChangeText={(text) => setCity(text)}
          />
          <Input
            placeholder="Zip / Postal Code *"
            name="zip"
            value={zip}
            onChangeText={(text) => setZip(text)}
            keyboardType="numeric"
          />
          <Input
            placeholder="Phone Number *"
            name="phone"
            value={phone}
            keyboardType="numeric"
            onChangeText={(text) => setPhone(text)}
          />

          <Text style={styles.inputLabel}>Country *</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={country}
              onValueChange={(itemValue) => setCountry(itemValue)}
              style={styles.picker}
              mode="dropdown"
            >
              <Picker.Item label="Select a country..." value="" color="#9ca3af" />
              {countries.map((c) => (
                <Picker.Item key={c.code} label={c.name} value={c.name} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Delivery Options Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="truck" size={16} color="#3b82f6" />
            <Text style={styles.cardTitle}>Delivery Speed</Text>
          </View>

          {DELIVERY_MODE_OPTIONS.map((option) => {
            const isSelected = deliveryMode === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.deliveryOption,
                  isSelected && styles.deliveryOptionSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => setDeliveryMode(option.value)}
              >
                <Icon
                  name={option.icon}
                  size={18}
                  color={isSelected ? "#2563eb" : "#6b7280"}
                  style={styles.optionIcon}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.optionDesc}>{option.desc}</Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleSelected,
                  ]}
                >
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {deliveryMode === "SCHEDULED" ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Delivery day *</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={scheduledDate}
                  onValueChange={(day) => setScheduledDate(day)}
                  style={styles.picker}
                  mode="dropdown"
                >
                  <Picker.Item
                    label="Select a delivery day..."
                    value=""
                    color="#9ca3af"
                  />
                  {getUpcomingDeliveryDays().map((day) => (
                    <Picker.Item
                      key={day.value}
                      label={day.label}
                      value={day.value}
                    />
                  ))}
                </Picker>
              </View>
              <Text style={styles.optionDesc}>
                Choose a day in the next 14 days.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="receipt" size={16} color="#3b82f6" />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatPrice(calculateItemsSubtotal(orderItems))}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Est. Delivery Fee</Text>
            <Text style={styles.summaryValue}>
              {formatPrice(getEstimatedDeliveryFee())}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalValue}>
              {formatPrice(calculateTotal(orderItems))}
            </Text>
          </View>

          <Text style={styles.disclaimerText}>
            * Final delivery fee calculated at confirmation based on exact distance to the store.
          </Text>
        </View>

        {/* Submit Button */}
        <EasyButton
          style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
          primary
          large
          disabled={isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.submitButtonText}>Processing…</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Proceed to Payment</Text>
          )}
        </EasyButton>

      </FormContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 20,
    backgroundColor: "#f9fafb",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginLeft: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginTop: 10,
    marginBottom: 4,
  },
  pickerWrapper: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
    overflow: "hidden",
  },
  picker: {
    width: "100%",
    height: 50,
  },
  deliveryOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  deliveryOptionSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  optionIcon: {
    marginRight: 12,
    width: 24,
    textAlign: "center",
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  optionLabelSelected: {
    color: "#1d4ed8",
  },
  optionDesc: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  radioCircle: {
    height: 18,
    width: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: "#2563eb",
  },
  radioDot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#4b5563",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2563eb",
  },
  disclaimerText: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 8,
    lineHeight: 15,
  },
  submitButton: {
    marginTop: 10,
    backgroundColor: "#ebcd25",
    borderRadius: 10,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  submitButtonText: {
    color: "#070101f9",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 8,
  },
});

export default Checkout;
