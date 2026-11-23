import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { Button } from "react-native-paper";
import Constants from "expo-constants";
import stripeModule from "../assets/common/stripe";

const defaultKey = Constants.expoConfig?.extra?.stripePublishableKey ||
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
let stripeInitialization = Promise.resolve();

function initializeStripe(action) {
  const next = stripeInitialization.then(action, action);
  stripeInitialization = next;
  return next;
}

function Element({ amount, currency, createIntent, onCompleted, onProcessingChange, disabled, label }) {
  const callbacks = useRef({ createIntent, onCompleted, onProcessingChange });
  callbacks.current = { createIntent, onCompleted, onProcessingChange };
  const attempt = useRef(null);
  const running = useRef(false);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);

  const intentConfig = useMemo(() => ({
    mode: { amount, currencyCode: currency.toUpperCase() },
    paymentMethodTypes: ["card"],
    confirmationTokenConfirmHandler: async (_token, callback) => {
      try {
        const payment = await callbacks.current.createIntent();
        if (!payment?.clientSecret) throw new Error("The payment service returned no client secret.");
        attempt.current = payment;
        callback({ clientSecret: payment.clientSecret });
      } catch (error) {
        const message = error.response?.data?.message || error.message || "Unable to prepare payment.";
        callback({ error: { code: "Failed", message, localizedMessage: message } });
      }
    },
  }), [amount, currency]);
  const config = useMemo(() => ({
    merchantDisplayName: "AdduGenet EShop",
    returnURL: "addugeneteshop://stripe-redirect",
    allowsDelayedPaymentMethods: false,
  }), []);
  const { embeddedPaymentElementView, paymentOption, confirm, loadingError, isLoaded } =
    stripeModule.useEmbeddedPaymentElement(intentConfig, config);

  const submit = async () => {
    if (running.current || completed) return;
    running.current = true;
    setProcessing(true);
    callbacks.current.onProcessingChange?.(true);
    try {
      const result = await confirm();
      if (result.status === "completed") {
        setCompleted(true);
        await callbacks.current.onCompleted(attempt.current);
      } else if (result.status === "failed") {
        Alert.alert("Payment needs attention", `${result.error?.message || "Payment failed."} Check this payment's status before retrying.`);
      }
    } catch (error) {
      Alert.alert("Payment needs attention", `${error.response?.data?.message || error.message || "Unable to complete payment."} Check this payment's status before retrying.`);
    } finally {
      running.current = false;
      setProcessing(false);
      callbacks.current.onProcessingChange?.(false);
    }
  };

  return <View>
    {loadingError ? <Text accessibilityRole="alert">Unable to load payment form: {loadingError.message}</Text> : null}
    <View style={{ opacity: isLoaded ? 1 : 0 }} pointerEvents={processing || completed ? "none" : "auto"}>
      {embeddedPaymentElementView}
    </View>
    {!loadingError && !isLoaded ? <ActivityIndicator /> : null}
    <Button mode="contained" disabled={disabled || processing || completed || !isLoaded || !paymentOption || Boolean(loadingError)} onPress={submit}>
      {processing ? "Processing..." : label}
    </Button>
  </View>;
}

export default function EmbeddedStripePayment({ publishableKey, amount, currency, ...props }) {
  const key = publishableKey || defaultKey;
  const [readyKey, setReadyKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let initialized = false;
    setReadyKey("");
    setError("");
    const initialize = async () => {
      try {
        await initializeStripe(async () => {
          if (!active) return;
          await stripeModule.initStripe({ publishableKey: key, urlScheme: "addugeneteshop" });
          if (!active && key !== defaultKey && defaultKey.startsWith("pk_")) {
            await stripeModule.initStripe({ publishableKey: defaultKey, urlScheme: "addugeneteshop" });
          } else if (active) {
            initialized = true;
            setReadyKey(key);
          }
        });
      } catch (failure) {
        if (active) setError(failure.message || "Unable to initialize Stripe.");
        else console.error("Stripe configuration restore failed:", failure.message);
      }
    };
    if (stripeModule?.useEmbeddedPaymentElement && typeof key === "string" && key.startsWith("pk_")) initialize();
    else setError("Stripe payment is unavailable in this build or the publishable key is missing.");
    return () => {
      active = false;
      if (initialized && key !== defaultKey && defaultKey.startsWith("pk_")) {
        initializeStripe(() => stripeModule.initStripe({ publishableKey: defaultKey, urlScheme: "addugeneteshop" })).catch((failure) => {
          console.error("Stripe configuration restore failed:", failure.message);
          Alert.alert("Card configuration", "Restart the app before using another card checkout.");
        });
      }
    };
  }, [key]);

  if (!Number.isSafeInteger(amount) || amount <= 0 || typeof currency !== "string" || !/^[a-z]{3}$/i.test(currency)) {
    return <Text accessibilityRole="alert">The payment amount or currency is invalid. Reload this checkout.</Text>;
  }
  if (error) return <Text accessibilityRole="alert">{error}</Text>;
  if (readyKey !== key) return <ActivityIndicator />;
  return <Element key={`${key}-${amount}-${currency}`} amount={amount} currency={currency} {...props} />;
}
