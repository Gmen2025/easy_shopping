import React, { useEffect, useState, useContext } from "react";
import { View, Text, Button, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome5";
import { Picker } from "@react-native-picker/picker";
import FormContainer from "../../../Shared/Form/FormContainer";
import Input from "../../../Shared/Form/Input";
import { AuthContext } from "../../../Context/store/Auth";
import Toast from "react-native-toast-message";
import EasyButton from "../../../Shared/StyledComponenets/EasyButton";

const countries = require("../../../assets/data/countries.json"); // Assuming you have a countries.json file with country data
import { useSelector } from "react-redux"; // Assuming you are using Redux to manage cart state
import axios from "axios";
import baseUrl from "../../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { validateOrderStock } from "../../../assets/common/inventory";
import { buildStoreAssignmentPayload, haversineDistanceKm } from "../../../assets/common/stores";
import { useCurrency } from "../../../assets/common/currency";

// Delivery options match backend DELIVERY_MODES (helpers/delivery.js) in D:\MERN_COURSE\backend.
const DELIVERY_MODE_OPTIONS = [
  { value: "SAME_DAY", label: "Same day delivery" },
  { value: "NEXT_DAY", label: "Next day delivery" },
  { value: "SCHEDULED", label: "Scheduled delivery" },
];

// Mirrors helpers/delivery.js computeDeliveryFee() defaults so the client estimate matches
// what the backend will charge if its env vars aren't overridden from these defaults.
const DELIVERY_FEE_DEFAULTS = {
  SAME_DAY: { base: 9, perKm: 1, premium: 4 },
  NEXT_DAY: { base: 4, perKm: 0.6 },
  SCHEDULED: { base: 5, perKm: 0.75 },
};

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

const estimateDeliveryFee = (deliveryMode, distanceKm, scheduledForDate) => {
  const distance = Number(distanceKm) || 0;

  if (deliveryMode === "SAME_DAY") {
    const { base, perKm, premium } = DELIVERY_FEE_DEFAULTS.SAME_DAY;
    return roundCurrency(base + premium + distance * perKm);
  }

  if (deliveryMode === "NEXT_DAY") {
    const { base, perKm } = DELIVERY_FEE_DEFAULTS.NEXT_DAY;
    return roundCurrency(base + distance * perKm);
  }

  const { base, perKm } = DELIVERY_FEE_DEFAULTS.SCHEDULED;
  const hour = scheduledForDate instanceof Date && !Number.isNaN(scheduledForDate.getTime()) ? scheduledForDate.getHours() : -1;
  const peakSurcharge = hour >= 17 && hour <= 20 ? 1.5 : 0;
  const offPeakDiscount = hour >= 10 && hour <= 15 ? -0.5 : 0;
  return roundCurrency(base + distance * perKm + peakSurcharge + offPeakDiscount);
};

function Checkout(props) {
  const context = useContext(AuthContext);
  const cartItems = useSelector((state) => state.cart.cartItems); // Accessing cart items from Redux store
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

  useEffect(() => {
    // This is where you can fetch the cart items and set them to orderItems state
    // For example, if you have a Redux store or context, you can dispatch an action to get the cart items
    // setOrderItems(fetchedCartItems);

    // If you want to set default values for the address fields, you can do that here as well
    // setAddress("Default Address");

    console.log("user id from context", context.user?._id);

    if (context.isAuthenticated && context.user) {
      setUser(context.user.sub);

      //API call to get user details
      AsyncStorage.getItem("token").then((res) => {
        setToken(res);

        const config = {
          headers: {
            Authorization: `Bearer ${res}`,
          },
        };

        // Fetch user's orders
        if (context.user?._id) {
          axios
            .get(`${baseUrl}orders/get/userorders/${context.user._id}`, config)
          .then((orderRes) => {
            const orders = orderRes.data;
            if (orders && orders.length > 0) {
              // Prefill from the most recent order
              const firstOrder = orders[0];
              console.log("First order found:", firstOrder);

              setAddress(firstOrder.shippingAddress1 || "");
              setAddress2(firstOrder.shippingAddress2 || "");
              setCity(firstOrder.city || "");
              setZip(firstOrder.zip || "");
              setCountry(firstOrder.country || "");
              setPhone(firstOrder.phone || "");
            } else {
              // If no orders, fallback to user profile
              if (context.user?._id) {
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

    setOrderItems(cartItems); // Assuming cartItems is passed as a prop

    return () => {
      // Cleanup if necessary
      setOrderItems([]);
    };
  }, [cartItems]);

  const calculateItemsSubtotal = (items) => {
    //console.log("Calculating total for items:", items);
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  const parseScheduledDate = () => {
    if (deliveryMode !== "SCHEDULED" || !scheduledDate.trim()) {
      return null;
    }
    const parsed = new Date(scheduledDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // Preview estimate before the customer's location/nearest store is known (distance = 0).
  const getEstimatedDeliveryFee = () => estimateDeliveryFee(deliveryMode, 0, parseScheduledDate());

  const calculateTotal = (items) => calculateItemsSubtotal(items) + getEstimatedDeliveryFee();

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate form fields
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
          text2: stockValidation.message || "Some items exceed available stock.",
        });
        return;
      }

      let customerLocation = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const currentPosition = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("location_timeout")), 8000)
            ),
          ]);
          customerLocation = {
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
          };
        }
      } catch (error) {
        console.warn("Unable to read current location for store assignment:", error);
      }

      const storeAssignment = await buildStoreAssignmentPayload(
        customerLocation || {
          latitude: 8.9806,
          longitude: 38.7578,
        },
        token
      );

      const deliveryDistanceKm = haversineDistanceKm(
        customerLocation || storeAssignment.customerLocation,
        storeAssignment.storeLocation
      );
      const normalizedDistanceKm = Number.isFinite(deliveryDistanceKm) ? deliveryDistanceKm : 0;
      const deliveryFee = estimateDeliveryFee(deliveryMode, normalizedDistanceKm, scheduledForDate);

      // Create order object with proper structure
      let order = {
        _id: `temp_order_${Date.now()}`, // Add temporary ID
        orderId: `ORDER_${Date.now()}`, // Add orderId property
        shippingAddress1: address,
        shippingAddress2: address2,
        status: "1",
        city,
        zip,
        country,
        phone,
        orderItems: orderItems.map((item) => ({
          ...item,
          _id: item._id || item.id, // Ensure _id exists
          quantity: item.quantity || 1,
        })),
        user: user || context.user?._id,
        dateOrdered: Date.now(),
        itemsSubtotal: calculateItemsSubtotal(orderItems),
        deliveryMode,
        deliveryDistanceKm: normalizedDistanceKm,
        deliveryFee,
        scheduledFor: deliveryMode === "SCHEDULED" ? scheduledForDate.toISOString() : null,
        totalPrice: calculateItemsSubtotal(orderItems) + deliveryFee,
        ...storeAssignment,
        pickupStoreName: storeAssignment.pickupStoreName || "Nearby Store",
        customerLocation: storeAssignment.customerLocation || {
          latitude: 8.9806,
          longitude: 38.7578,
        },
        // Add these additional properties that might be expected
        paymentMethod: null,
        methodName: null,
        cardType: null,
        paymentStatus: "pending",
      };

      console.log("Order object being passed:", order);

      props.navigation.navigate("Payment", { order });
    } catch (error) {
      console.warn("Checkout confirm failed:", error);
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Something went wrong",
        text2: "Please check your connection and try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormContainer title="Shipping Address">
      <Input
        placeholder="Shipping Address 1"
        name="Shipping address 1"
        value={address}
        onChangeText={(text) => setAddress(text)}
      />
      <Input
        placeholder="Address 2"
        name="Shipping address 2"
        value={address2}
        onChangeText={(text) => setAddress2(text)}
      />
      <Input
        placeholder="City"
        name="city"
        value={city}
        onChangeText={(text) => setCity(text)}
      />
      <Input
        placeholder="Zip Code"
        name="zip"
        value={zip}
        onChangeText={(text) => setZip(text)}
        keyboardType="numeric"
      />
      <Input
        placeholder="Phone"
        name="phone"
        value={phone}
        keyboardType={"numeric"}
        onChangeText={(text) => setPhone(text)}
      />
      <Text style={{ marginTop: 10, fontWeight: "bold", fontSize: 20 }}>
        Country
      </Text>
      <Picker
        selectedValue={country}
        onValueChange={(itemValue) => setCountry(itemValue)}
        style={{ marginBottom: 10, marginTop: -2, width: 250 }}
        mode="dropdown"
      >
        <Picker.Item label="Select a country..." value="" />
        {countries.map((c) => (
          <Picker.Item key={c.code} label={c.name} value={c.name} />
        ))}
      </Picker>
      <Text style={{ marginTop: 10, fontWeight: "bold", fontSize: 20 }}>
        Delivery
      </Text>
      <Picker
        selectedValue={deliveryMode}
        onValueChange={(itemValue) => setDeliveryMode(itemValue)}
        style={{ marginBottom: 10, marginTop: -2, width: 250 }}
        mode="dropdown"
      >
        {DELIVERY_MODE_OPTIONS.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
      {deliveryMode === "SCHEDULED" ? (
        <Input
          placeholder="Scheduled date/time (e.g. 2026-08-20 14:00)"
          name="scheduledDate"
          value={scheduledDate}
          onChangeText={(text) => setScheduledDate(text)}
        />
      ) : null}
      <Text style={{ marginTop: 10, fontWeight: "bold" }}>
        Estimated delivery fee: {formatPrice(getEstimatedDeliveryFee())}
      </Text>
      <Text style={{ marginTop: 2, fontSize: 12, color: "#6b7280" }}>
        Final fee is calculated at checkout based on distance to the nearest store.
      </Text>
      <Text style={{ marginTop: 4, fontWeight: "bold", fontSize: 16 }}>
        Estimated total: {formatPrice(calculateTotal(orderItems))}
      </Text>
      <EasyButton
        style={{ marginTop: 30, opacity: isSubmitting ? 0.6 : 1 }}
        tertiary
        large
        disabled={isSubmitting}
        onPress={handleSubmit}
      >
        {isSubmitting ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ActivityIndicator color="#000" size="small" />
            <Text style={{ color: "black", fontWeight: "bold", marginLeft: 8 }}>
              Checking…
            </Text>
          </View>
        ) : (
          <Text style={{ color: "black", fontWeight: "bold" }}>Confirm</Text>
        )}
      </EasyButton>
    </FormContainer>
  );
}

export default Checkout;
