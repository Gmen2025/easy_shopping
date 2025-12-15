import React, { useState } from "react";
import {
  View,
  Text,
  Button,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import EasyButton from "../../../Shared/StyledComponenets/EasyButton";

import { useCheckout } from "../../../Context/store/CheckoutContext";


import { useSelector } from "react-redux";




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

  const handleConfirm = () => {
  if (!selected) {
    Alert.alert('Error', 'Please select a payment method');
    return;
  }

  if (selected === 3 && !card) {
    Alert.alert('Error', 'Please select a card type');
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
      //props.navigation.navigate("StripePayment", { order: orderWithPayment });
      Alert.alert('Info', 'Card Payment integration is coming soon! \n Please choose another method.');
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
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Select Payment Method</Text>
        {methods.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={styles.radioContainer}
            onPress={() => setSelected(m.value)}
          >
            <View style={styles.radioCircle}>
              {selected === m.value && <View style={styles.selectedRb} />}
            </View>
            <Text style={styles.radioText}>{m.name}</Text>
          </TouchableOpacity>
        ))}

        {selected === 3 && (
          <>
            <Text style={[styles.title, { marginTop: 20 }]}>
              Select Card Type
            </Text>
            {paymentCards.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={styles.radioContainer}
                onPress={() => setCard(c.value)}
              >
                <View style={styles.radioCircle}>
                  {card === c.value && <View style={styles.selectedRb} />}
                </View>
                <Text style={styles.radioText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* <View style={{ marginTop: 30 }}> */}
          <EasyButton style={{ marginTop: 30 }} contained tertiary onPress={handleConfirm}>
            <Text style={{ color: 'black', fontWeight: 'bold' }}>Confirm Payment</Text>
          </EasyButton>
        {/* </View> */}
      </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  radioContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2e86de",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  selectedRb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2e86de",
  },
  radioText: {
    fontSize: 16,
  },
  cardField: {
    width: "100%",
    height: 50,
    marginVertical: 30,
  },
  payButton: {
    marginTop:10,
  }
});

export default Payment;
