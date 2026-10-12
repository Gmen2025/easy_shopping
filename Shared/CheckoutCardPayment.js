import React, { useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Button } from "react-native-paper";
import Constants from "expo-constants";

const stripeModule = (() => {
  if (Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient") return null;
  try { return require("@stripe/stripe-react-native"); }
  catch (error) { console.warn("Checkout card module unavailable:", error.message); return null; }
})();
const publishableKey = Constants.expoConfig?.extra?.stripePublishableKey || process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
export const canPayByCard = Boolean(stripeModule && publishableKey.startsWith("pk_"));
export const nativeCardAvailable = Boolean(stripeModule);

function CardEntry({ pay, disabled, label, paymentKey }) {
  const { confirmPayment } = stripeModule.useStripe();
  const [complete, setComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const running = useRef(false);
  const CardField = stripeModule.CardField;
  const submit = async () => {
    if (running.current) return;
    running.current = true;
    setProcessing(true);
    try {
      await stripeModule.initStripe({ publishableKey: paymentKey || publishableKey });
      await pay(confirmPayment);
    } catch (error) {
      console.error("Card checkout initialization failed:", error.message);
      Alert.alert("Card payment unavailable", "Unable to initialize card payment. Check this checkout's payment status before retrying.");
    } finally {
      if (paymentKey && publishableKey.startsWith("pk_")) {
        try { await stripeModule.initStripe({ publishableKey }); }
        catch (error) { console.error("Default card configuration restore failed:", error.message); Alert.alert("Card configuration", "Restart the app before using another card checkout."); }
      }
      setProcessing(false);
      running.current = false;
    }
  };
  return <View>
    <CardField postalCodeEnabled style={{ height: 55, marginVertical: 12 }}
      cardStyle={{ backgroundColor: "#ffffff", textColor: "#111827" }}
      onCardChange={(card) => setComplete(card.complete)} />
    <Button mode="contained" disabled={disabled || processing || !complete} onPress={submit}>{label}</Button>
  </View>;
}
export default function CheckoutCardPayment({ publishableKey: paymentKey, ...props }) {
  if (!stripeModule) return null;
  return <CardEntry label="Pay combined total" paymentKey={paymentKey} {...props} />;
}
