import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import EasyButton from "../../../Shared/StyledComponenets/EasyButton";
import { useFocusEffect } from "@react-navigation/native";

import { useCheckout } from "../../../Context/store/CheckoutContext";
import { getDatabaseNameFromStorage } from "../../../assets/common/databaseConfig";




// {name: 'PayPal', value: 4},
// {name: 'Stripe', value: 5},
// {name: 'Google Pay', value: 6},
// {name: 'Apple Pay', value: 7},
// {name: 'Amazon Pay', value: 8},
// {name: 'Crypto Payment', value: 9},
// {name: 'Other', value: 10}
const methods = [
  { name: "Cash on delivery", value: 1 },
  { name: "Bank Transfer", value: 2 },
  { name: "Card Payment", value: 3 },
   { name: "Telebirr", value: 4 },
];

const paymentCards = [
  { name: "Wallet", value: 1 },
  { name: "Visa", value: 2 },
  { name: "MasterCard", value: 3 },
  { name: "Other", value: 4 },
];

//new
const Payment = (props) => {
  const { order } = useCheckout(); // Get the order from the CheckoutContext

  const orderData = order || props.route.params?.order; // Fallback to route params if context is not set

  const [selected, setSelected] = useState();
  const [card, setCard] = useState();
  const [isCardPaymentAvailable, setIsCardPaymentAvailable] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const syncPaymentAvailability = async () => {
        const dbName = await getDatabaseNameFromStorage();
        if (isMounted) {
          setIsCardPaymentAvailable(dbName === "E_ShopUSA");
        }
      };

      syncPaymentAvailability();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!isCardPaymentAvailable && selected === 3) {
      setSelected();
      setCard();
    }
  }, [isCardPaymentAvailable, selected]);

  const visibleMethods = isCardPaymentAvailable
    ? methods
    : methods.filter((method) => method.value !== 3);

  const handleConfirm = () => {
  if (!selected) {
    Alert.alert('Error', 'Please select a payment method');
    return;
  }

  if (selected === 3 && !card) {
    Alert.alert('Error', 'Please select a card type');
    return;
  }

  if (selected === 3 && !isCardPaymentAvailable) {
    Alert.alert('Unavailable', 'Card Payment is available only for USA (E_ShopUSA).');
    return;
  }

  // Handle different payment methods
  const orderWithPayment = {
    ...orderData,
    paymentMethod: selected,
    methodName: methods.find((m) => m.value === selected)?.name,
    cardType: card ? paymentCards.find((c) => c.value === card)?.name : null,
  };

  // Handle different payment methods
  switch (selected) {
    case 3: // Card Payment
      props.navigation.navigate("StripePayment", { order: orderWithPayment });
      break;
    case 4: // Telebirr Payment
      props.navigation.navigate("TelebirrPayment", { order: orderWithPayment });
      break;
    default: // Cash on Delivery, Bank Payment
      props.navigation.navigate("Confirm", { order: orderWithPayment });
      break;
  }
};


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <Text style={styles.title}>Payment</Text>
        <Text style={styles.subtitle}>Choose your preferred payment method to complete checkout.</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        {visibleMethods.map((m) => {
          const isSelected = selected === m.value;
          return (
            <TouchableOpacity
              key={m.value}
              style={[styles.optionRow, isSelected && styles.optionRowActive]}
              onPress={() => setSelected(m.value)}
            >
              <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                {isSelected && <View style={styles.selectedRb} />}
              </View>
              <Text style={[styles.radioText, isSelected && styles.radioTextActive]}>{m.name}</Text>
            </TouchableOpacity>
          );
        })}

        {!isCardPaymentAvailable && (
          <Text style={styles.infoText}>Card payment is available only when USA is selected.</Text>
        )}
      </View>

      {selected === 3 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Card Type</Text>
          {paymentCards.map((c) => {
            const isSelected = card === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                style={[styles.optionRow, isSelected && styles.optionRowActive]}
                onPress={() => setCard(c.value)}
              >
                <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                  {isSelected && <View style={styles.selectedRb} />}
                </View>
                <Text style={[styles.radioText, isSelected && styles.radioTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <EasyButton style={styles.confirmButton} contained tertiary onPress={handleConfirm}>
        <Text style={styles.confirmButtonText}>Confirm Payment</Text>
      </EasyButton>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  contentContainer: {
    padding: 18,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: "goldenrod",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#d0d8e8",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#dce3ef",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#152642",
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fbff",
    borderWidth: 1,
    borderColor: "#d7dce5",
    borderRadius: 12,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionRowActive: {
    borderColor: "#1d72d6",
    backgroundColor: "#eef5ff",
  },
  radioCircle: {
    height: 22,
    width: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#7b8ea7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioCircleActive: {
    borderColor: "#1d72d6",
  },
  selectedRb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1d72d6",
  },
  radioText: {
    fontSize: 16,
    color: "#233349",
    fontWeight: "500",
  },
  radioTextActive: {
    color: "#8a6c09",
    fontWeight: "700",
  },
  confirmButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 4,
  },
  confirmButtonText: {
    color: "#0d0d0d",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  infoText: {
    marginTop: 2,
    color: "#6a7380",
    fontSize: 13,
    lineHeight: 18,
  },
});

export default Payment;
