import React, { useEffect, useRef, useState } from "react";
import { Alert, Image, ScrollView, Share, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { useDispatch, useSelector } from "react-redux";
import CardPayment, { canPayByCard, nativeCardAvailable } from "../../../Shared/CheckoutCardPayment";
import { cartItemKey } from "../../../assets/common/cartIdentity";
import { storeRequest } from "../../../assets/common/storefront";
import { getDatabaseNameFromStorage, sanitizeDatabaseName } from "../../../assets/common/databaseConfig";
import { beginCheckout, completeCheckout } from "../../../store/cartSlice";
import { useCurrency } from "../../../assets/common/currency";
import { CargoSummary, CheckoutHeader, DeliverySummary, DeliveryWindow, PackageMeasurements, styles as sharedStyles, checkoutStyles } from "../../../Shared/DeliveryCheckout";
import AddressSearchInput from "../../../Shared/AddressSearchInput";
import { addressText, isEthiopia } from "../../../assets/common/rides";
import { exchangeRequest, rateIsActive, usdAmount, usdText, usdInactiveMessage, birrAmount, etbText, exportInactiveMessage } from "../../../assets/common/exchangeRate";
import usePaymentAvailability from "../../../assets/common/usePaymentAvailability";
import { PAYMENT_UNAVAILABLE } from "../../../assets/common/paymentSettings";
import { deliveryMethodOptions, deliveryModeLabel, getDeliverySettings } from "../../../assets/common/delivery";
import { calculateDeliveryPricing, selectDeliveryVehicle } from "../../../assets/common/deliveryPricing";

const ADDRESS_FIELDS = [
  ["label", "Address label"], ["address1", "Street address"], ["address2", "Apartment / unit (optional)"],
  ["city", "City"], ["zip", "Postal code"], ["country", "Country"], ["phone", "Recipient phone"],
];
const blankAddress = () => Object.fromEntries(ADDRESS_FIELDS.map(([key]) => [key, ""]));
const locatedFields = ["address1", "city", "zip", "country"];
const styles = { ...sharedStyles, ...checkoutStyles };
const getUpcomingDeliveryDays = () =>
  Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    date.setHours(12, 0, 0, 0);
    return {
      value: [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")].join("-"),
      label: date.toLocaleDateString(undefined, {
        weekday: "long", month: "short", day: "numeric",
      }),
    };
  });

const MultiDeliveryCheckout = ({ navigation, route }) => {
  const items = useSelector((state) => state.cart.cartItems);
  const dispatch = useDispatch();
  const { formatPrice } = useCurrency();
  const [database, setDatabase] = useState("");
  const availability = usePaymentAvailability();
  const [saved, setSaved] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [editor, setEditor] = useState(null);
  const [allocations, setAllocations] = useState({});
  const [deliveryMode, setDeliveryMode] = useState("STANDARD");
  const [deliveryConfig, setDeliveryConfig] = useState(null);
  const [step, setStep] = useState(1);
  const [scheduledDate, setScheduledDate] = useState("");
  const [quote, setQuote] = useState(null);
  const [group, setGroup] = useState(null);
  const [selections, setSelections] = useState({});
  const [method, setMethod] = useState("bank");
  const [banks, setBanks] = useState([]);
  const [bankId, setBankId] = useState("");
  const [reference, setReference] = useState("");
  const [sender, setSender] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exchange, setExchange] = useState(null);
  const region = useRef("");
  const running = useRef(false);
  const scroll = useRef(null);
  const resumeId = route.params?.groupId;
  const serviceId = route.params?.serviceId;
  const service = Boolean(serviceId || group?.kind === "service" || quote?.kind === "service");
  const paymentCurrency = route.params?.paymentCurrency || (/usa/i.test(database) ? "usd" : "etb");
  const converted = service || (paymentCurrency === "usd" && database && !/usa/i.test(database));
  const international = Boolean(group?.international || quote?.international || (/usa/i.test(database) && paymentCurrency === "etb"));
  const availableCard = converted ? nativeCardAvailable && exchange?.cardAvailable : canPayByCard;
  const cashAvailable = Boolean(database) && !service && !international && !converted &&
    !quote?.exchangeRate && availability.methods?.cash === true;

  const run = async (action) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const db = await getDatabaseNameFromStorage();
      if (region.current && region.current !== db) throw new Error("The region changed. Reopen this checkout in its original shopping region.");
      region.current = db;
      await action();
    }
    catch (failure) {
      const message = failure.response?.data?.message || failure.message || "Unable to complete checkout.";
      setError(message);
      Alert.alert("Checkout needs attention", message);
    } finally { running.current = false; setBusy(false); }
  };
  const showGroup = async (result, purchased = true) => {
    setGroup(result);
    if (purchased && result.kind !== "service" && (result.status === "placed" || result.international && result.status === "bank_review")) dispatch(completeCheckout({ id: result._id,
      items: result.cart.map((line) => ({ key: line.key, quantity: line.quantity })) }));
  };
  const load = () => run(async () => {
    const db = await getDatabaseNameFromStorage();
    setDatabase(db);
    if (resumeId) {
      const result = await storeRequest(`checkouts/${resumeId}`);
      await showGroup(result, false);
      return;
    }
    if (serviceId) {
      const [result, policy, accounts] = await Promise.all([
        storeRequest(`service-checkouts/${serviceId}`, { method: "post" }), exchangeRequest(),
        storeRequest("delivery-bank-accounts?currency=USD"),
      ]);
      setExchange(policy); setBanks(accounts); setBankId(accounts[0]?._id || "");
      if (result.status === "quote") { setQuote(result); setStep(3); }
      else await showGroup(result, false);
      return;
    }
    const currency = route.params?.paymentCurrency || (/usa/i.test(db) ? "usd" : "etb");
    const exportPurchase = /usa/i.test(db) && currency === "etb";
    if (exportPurchase || (currency === "usd" && !/usa/i.test(db))) {
      const policy = await exchangeRequest();
      setExchange(policy);
      if (!rateIsActive(policy)) throw new Error(policy.message || (exportPurchase ? exportInactiveMessage : usdInactiveMessage));
    }
    const [current, existing, accounts, settings] = await Promise.all([
      storeRequest("delivery-current-address"), storeRequest("delivery-addresses"),
      storeRequest(exportPurchase ? "delivery-bank-accounts?currency=ETB" :
        currency === "usd" && !/usa/i.test(db) ? "delivery-bank-accounts?currency=USD" : "delivery-bank-accounts"),
      getDeliverySettings({ allowCached: false }),
    ]);
    if (!settings?.deliveryConfig) throw new Error("Delivery methods could not be loaded. Reload checkout before continuing.");
    setDeliveryConfig(settings.deliveryConfig);
    const initial = { ...current, ...(exportPurchase && !isEthiopia(current.country) ?
      { address1: "", address2: "", city: "", zip: "", country: "Ethiopia", phone: current.phone || "" } : {}), id: "current" };
    setAddresses([initial]);
    setSaved(exportPurchase ? existing.filter((entry) => isEthiopia(entry.country)) : existing);
    setBanks(accounts);
    setBankId(accounts[0]?._id || "");
    setAllocations(Object.fromEntries(items.map((item) => [cartItemKey(item), { current: String(item.quantity) }])));
  });
  useEffect(() => { load(); }, [resumeId, serviceId]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step, group?.status]);

  const invalidate = () => { setQuote(null); setSelections({}); };
  const updateAllocation = (key, addressId, quantity) => {
    invalidate();
    setAllocations((previous) => ({ ...previous, [key]: { ...previous[key], [addressId]: quantity } }));
  };
  const changeDeliveryMode = (value) => {
    setDeliveryMode(value);
    invalidate();
  };
  const changeScheduledDate = (value) => {
    setScheduledDate(value);
    invalidate();
  };
  const continueAddresses = () => run(async () => {
    if (editor) throw new Error("Save or discard address edits before continuing.");
    if (!items.length || !deliveryConfig) throw new Error("Reload checkout to load your cart and delivery methods.");
    for (const item of items) {
      const assigned = addresses.map((address) => Number(allocations[cartItemKey(item)]?.[address.id] || 0));
      if (assigned.some((quantity) => !Number.isSafeInteger(quantity) || quantity < 0) ||
          assigned.reduce((sum, quantity) => sum + quantity, 0) !== item.quantity) {
        throw new Error(`Allocate all ${item.quantity} units of ${item.name} exactly once using whole quantities.`);
      }
    }
    const used = addresses.filter((address) => items.some((item) => Number(allocations[cartItemKey(item)]?.[address.id]) > 0));
    if (used.some((address) => ADDRESS_FIELDS.some(([key]) => key !== "address2" &&
        !(key === "zip" && isEthiopia(address.country)) && !address[key]?.trim()))) {
      throw new Error("Complete every selected delivery address and recipient phone before continuing.");
    }
    setStep(2);
  });
  const getScheduledFor = () => {
    if (deliveryMode !== "SCHEDULED") return null;
    const [year, month, day] = scheduledDate.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12);
    if (!scheduledDate || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
    return date.toISOString();
  };
  const saveAddress = (persist) => run(async () => {
    const address = { ...editor };
    if (isEthiopia(address.country)) address.zip = "";
    if (ADDRESS_FIELDS.some(([key]) => key !== "address2" && !(key === "zip" && isEthiopia(address.country)) &&
        !address[key]?.trim())) throw new Error("Complete all required address fields.");
    if (persist) {
      const stored = await storeRequest(address._id ? `delivery-addresses/${address._id}` : "delivery-addresses", {
        method: address._id ? "put" : "post", data: address,
      });
      address._id = stored._id;
      setSaved((previous) => [...previous.filter((entry) => entry._id !== stored._id), stored]);
    }
    setAddresses((previous) => previous.some((entry) => entry.id === address.id)
      ? previous.map((entry) => entry.id === address.id ? address : entry) : [...previous, address]);
    setEditor(null);
    invalidate();
  });
  const deleteSavedAddress = (address) => Alert.alert(
    "Delete saved address?",
    `Remove "${address.label}" from your saved addresses? Existing orders and addresses selected for this checkout will not change.`,
    [
      { text: "Keep address", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => run(async () => {
        await storeRequest(`delivery-addresses/${address._id}`, { method: "delete" });
        setSaved((previous) => previous.filter((entry) => entry._id !== address._id));
        setAddresses((previous) => previous.map((entry) => {
          if (entry._id !== address._id) return entry;
          const { _id, ...unsaved } = entry;
          return unsaved;
        }));
        setEditor((previous) => {
          if (previous?._id !== address._id) return previous;
          const { _id, ...unsaved } = previous;
          return unsaved;
        });
      }) },
    ]
  );
  const requestQuote = () => run(async () => {
    if (!items.length) throw new Error("Your cart is empty.");
    const scheduledFor = getScheduledFor();
    if (deliveryMode === "SCHEDULED" && !scheduledFor) {
      throw new Error("Choose a valid future date for scheduled delivery.");
    }
    const currentDb = await getDatabaseNameFromStorage();
    if (currentDb !== database || items.some((item) => sanitizeDatabaseName(item.databaseName || item.dbName) !== database)) throw new Error("The region changed. Return to the cart and restart checkout.");
    const cart = items.map((item) => ({ key: cartItemKey(item), product: item._id || item.id,
      quantity: item.quantity, price: item.price, storefrontId: item.storefrontId || null }));
    const split = cart.flatMap((line) => addresses.map((address) => ({
      key: line.key, addressId: address.id, quantity: Number(allocations[line.key]?.[address.id] || 0),
    })).filter((entry) => entry.quantity !== 0));
    const usedIds = new Set(split.map((entry) => entry.addressId));
    const result = await storeRequest("checkouts/quote", { method: "post", timeout: 120000,
      data: { cart, addresses: addresses.filter((address) => usedIds.has(address.id)), allocations: split,
        paymentCurrency, deliveryMode, scheduledFor } });
    setQuote(result);
    dispatch(beginCheckout({ id: result._id }));
    setSelections(Object.fromEntries(result.deliveries.map((delivery) => [delivery.key, delivery.vehicle])));
  });
  const reserveCheckout = () => run(async () => {
    const expiresAt = new Date(quote.expiresAt).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      invalidate(); setStep(service ? 3 : 2);
      throw new Error("This quote expired. Calculate a new quote before placing your order.");
    }
    if (!methods.some((option) => option.value === method)) throw new Error(availability.error || PAYMENT_UNAVAILABLE);
    if (quote.deliveries.some((delivery) => !selections[delivery.key])) throw new Error("Choose a vehicle for every delivery before continuing.");
    if (!service && (items.some((item) => !quote.cart.some((line) => line.key === cartItemKey(item) && line.quantity === item.quantity)) ||
        items.length !== quote.cart.length)) throw new Error("Your cart changed. Request a fresh quote.");
    const result = await storeRequest(`checkouts/${quote._id}/prepare`, { method: "post", timeout: 60000, data: {
      method, bankAccountId: bankId,
      deliveryMode, scheduledFor: getScheduledFor(),
      selections: quote.deliveries.map((delivery) => ({ key: delivery.key, vehicle: selections[delivery.key] })),
    } });
    await showGroup(result);
  });
  const finish = () => run(async () => {
    await showGroup(await storeRequest(`checkouts/${group._id}/confirm`, {
      method: "post", data: { reference, sender }, timeout: 60000,
    }));
  });
  const pay = (confirmPayment) => run(async () => {
    const payment = await storeRequest(`checkouts/${group._id}/payment`, { method: "post", timeout: 60000 });
    if (payment.group.status === "placed") { await showGroup(payment.group); return; }
    const result = await confirmPayment(payment.clientSecret, { paymentMethodType: "Card" });
    if (result.error) throw new Error(`${result.error.message} This checkout keeps the same payment attempt. Check its payment status before retrying.`);
    await showGroup(await storeRequest(`checkouts/${group._id}/confirm`, { method: "post", timeout: 60000 }));
  });
  const needsVehicleSelection = quote?.deliveries.some((delivery) => !selections[delivery.key]);
  const pricing = calculateDeliveryPricing(quote?.deliveries || [], selections);
  const selectedFee = pricing.deliveryFee;
  const previewTotal = (quote?.itemsSubtotal || 0) + selectedFee + (quote?.international?.shippingFee || 0);
  const methods = [
    { value: "bank", label: "Bank Transfer", description: "Verified by Admin after submitting your reference" },
    ...(!quote?.international && (/usa/i.test(database) || quote?.exchangeRate) && availableCard
      ? [{ value: "card", label: "Credit / Debit Card", description: "Secure card payment" }] : []),
    ...(cashAvailable ? [{ value: "cash", label: "Cash on Delivery", description: "Pay separately when each delivery arrives" }] : []),
  ].filter((option) => availability.methods?.[option.value] === true);
  const placed = group?.status === "placed";
  const shareOrder = () => run(async () => {
    await Share.share({ message: `Addu Genet Eshop order #${group._id}\nStatus: ${group.status}\nPayment: ${group.paymentStatus || "pending"}` });
  });

  return <ScrollView ref={scroll} style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <CheckoutHeader step={group ? 3 : Math.min(step, 3)}
      title={group ? placed ? "Order confirmation" : "Checkout status" : service ? "Service payment" :
        ["", "Delivery Address", "Choose Delivery Method", "Payment Method", "Order Summary"][step]}
      disabled={busy} onBack={() => {
        if (group || service || step === 1) navigation.goBack();
        else setStep(step - 1);
      }} />
    {busy ? <View style={styles.card} accessibilityLiveRegion="polite">
      <ActivityIndicator color="#b39100" />
      <Text style={styles.heading}>Processing your checkout...</Text>
      <Text style={checkoutStyles.note}>Waiting for the server to verify this request. Please do not submit another payment.</Text>
    </View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!addresses.length && !group && !quote ? <Button disabled={busy} onPress={load}>Reload checkout</Button> : null}
    {group ? <>
      {placed ? <View style={checkoutStyles.successPanel}>
        <Text style={checkoutStyles.successTitle}>Order Placed Successfully!</Text>
        <Text style={checkoutStyles.note}>{group.paymentStatus === "completed" ? "Your payment is confirmed." :
          group.paymentMethod === "cash" ? "Pay on each delivery. No online payment was taken." :
            "Your bank payment is pending Admin verification. Do not pay twice."}</Text>
        <Text selectable style={styles.heading}>Order #{String(group._id).toUpperCase()}</Text>
      </View> : group.status === "bank_review" ? <View style={styles.card}>
        <Text style={styles.heading}>Transfer submitted for review</Text>
        <Text>Your order is not confirmed for fulfillment until Admin verifies funds. Do not send another payment.</Text>
      </View> : null}
      <DeliverySummary group={group} />
      {group.status === "awaiting_payment" ? <View style={styles.card}>
        <Text style={styles.heading}>{service ? "Payment reserved until " : "Stock held until "}{new Date(group.expiresAt).toLocaleString()}</Text>
        <Text>Resume this checkout after an interrupted payment. Do not create a second payment.</Text>
        {group.paymentMethod === "card" ? <>
          {(group.exchangeRate ? nativeCardAvailable && group.stripePublishableKey : canPayByCard) ? <CardPayment pay={pay} disabled={busy} publishableKey={group.stripePublishableKey} /> :
            <Text style={styles.error}>Card payment needs a development/production build and a Stripe publishable key. It is unavailable in Expo Go.</Text>}
          <Button disabled={busy} onPress={finish}>Check payment / finish checkout</Button>
        </> : group.paymentMethod === "bank" ? <>
          <Text>Transfer the combined total to this account, then submit the reference before the stock hold expires.</Text>
          <Text>{group.bankAccount?.bankName} - {group.bankAccount?.accountHolderName}</Text>
          <Text selectable>{group.bankAccount?.accountNumber} {group.bankAccount?.bankCode}</Text>
          <Text>Bank payments remain pending until Admin verifies the funds. If the hold expires after you send funds, contact support; do not pay again.</Text>
          <TextInput label="Transfer sender" value={sender} onChangeText={setSender} />
          <TextInput label="Transfer reference" value={reference} onChangeText={setReference} />
          <Button mode="contained" disabled={busy} onPress={finish}>Submit transfer reference</Button>
        </> : <Button disabled={busy} onPress={finish}>Finish checkout</Button>}
        <Button disabled={busy} onPress={() => Alert.alert("Cancel unpaid checkout?", "If card payment already succeeded it will be recovered instead of cancelled. Contact support before cancelling a bank checkout if funds were sent.", [
          { text: "Keep checkout", style: "cancel" },
          { text: "Cancel reservation", style: "destructive", onPress: () => run(async () => {
            await showGroup(await storeRequest(`checkouts/${group._id}/cancel`, { method: "post", timeout: 60000 }));
          }) },
        ])}>Cancel unpaid reservation</Button>
      </View> : null}
      <Button disabled={busy} mode="contained" style={checkoutStyles.primary} labelStyle={checkoutStyles.primaryLabel}
        onPress={() => navigation.navigate("DeliveryCheckouts", { groupId: group._id })}>{service ? "View service payment" : "View individual deliveries"}</Button>
      {placed ? <Button disabled={busy} icon="share-variant" onPress={shareOrder}>Share order</Button> : null}
      {placed && !service ? <Button disabled={busy}
        onPress={() => navigation.navigate("Home")}>Continue shopping</Button> : null}
      <Button disabled={busy} onPress={() => service ? navigation.goBack() : navigation.navigate("CartHome")}>{service ? "Back to services" : "Return to cart"}</Button>
    </> : <>
      {service ? <View style={styles.card}>
        <Text style={styles.title}>Service USD checkout</Text>
        <Text>Accept and pay the Admin's birr quote in US dollars. Fulfillment stays in Ethiopia. No passenger rides or cash payments.</Text>
        <Button disabled={busy} onPress={load}>Refresh service quote / payment status</Button>
      </View> : <>
      {step === 1 ? <>
      <Text style={styles.heading}>Delivery addresses & quantities</Text>
      {international ? <Text>Enter Ethiopian recipient addresses. US stores deliver to the consolidation hub; Admin manages international shipping. Birr bank transfer only, verified before fulfillment. Import duties/customs are excluded.</Text> : null}
      {converted ? <Text>Pay in USD; all delivery addresses and pickups must be in Ethiopia.</Text> : null}
      <Text>Allocate each unit to one address. Pickup stores are selected from price-matching stock near that destination. Storefront items stay within that store's branch family.</Text>
      {addresses.map((address) => <View style={styles.card} key={address.id}>
        <Text style={styles.heading}>{address.label}</Text>
        <Text>{addressText({ ...address, zip: isEthiopia(address.country) ? "" : address.zip })}</Text>
        <Text>{address.phone}</Text>
        <Button disabled={busy} onPress={() => setEditor({ ...address })}>Edit address</Button>
        <Button disabled={busy} onPress={() => {
          invalidate();
          setAllocations(Object.fromEntries(items.map((item) => [cartItemKey(item), { [address.id]: String(item.quantity) }])));
        }}>Send all items here</Button>
      </View>)}
      {saved.length ? <Picker selectedValue="" enabled={!busy} onValueChange={(value) => {
        const address = saved.find((entry) => entry._id === value);
        if (address && !addresses.some((entry) => entry.id === value)) {
          setAddresses((previous) => [...previous, { ...address, id: value }]);
          invalidate();
        }
      }}>
        <Picker.Item label="Add a saved address..." value="" />
        {saved.map((address) => <Picker.Item key={address._id} label={address.label} value={address._id} />)}
      </Picker> : null}
      {saved.length ? <View style={styles.card}>
        <Text style={styles.heading}>Saved delivery addresses</Text>
        {saved.map((address) => <View key={address._id}>
          <Text>{address.label}: {addressText(address)}</Text>
          <Button disabled={busy} onPress={() => deleteSavedAddress(address)}>Delete saved address</Button>
        </View>)}
      </View> : null}
      <Button disabled={busy || addresses.length >= 10} onPress={() => setEditor({ ...blankAddress(),
        country: international || !/usa/i.test(database) ? "Ethiopia" : "USA", id: `address-${Date.now()}` })}>Add another delivery address</Button>
      {editor ? <View style={styles.card}>
        <AddressSearchInput key={editor.id} label="Search delivery address" disabled={busy}
          selectedText={editor.placeId ? editor.formattedAddress || addressText(editor) : ""}
          onSelect={(place) => setEditor((previous) => ({ ...previous, ...place,
            id: previous.id, _id: previous._id, label: previous.label, phone: previous.phone,
            address2: previous.address2, zip: isEthiopia(place.country) ? "" : place.zip || "" }))} />
        {ADDRESS_FIELDS.filter(([key]) => !(key === "zip" && isEthiopia(editor.country))).map(([key, label]) =>
          <TextInput key={key} label={label} value={editor[key] || ""} disabled={busy}
            onChangeText={(value) => setEditor((previous) => ({ ...previous, [key]: value,
              ...(locatedFields.includes(key) ? { placeId: undefined, formattedAddress: undefined, location: undefined } : {}) }))}
            style={styles.input} />)}
        <Button disabled={busy} onPress={() => saveAddress(false)}>Use this address</Button>
        <Button disabled={busy} onPress={() => saveAddress(true)}>Save address & use</Button>
        <Button disabled={busy} onPress={() => setEditor(null)}>Discard edits</Button>
      </View> : null}
      {items.map((item) => {
        const key = cartItemKey(item);
        const total = addresses.reduce((sum, address) => sum + Number(allocations[key]?.[address.id] || 0), 0);
        return <View key={key} style={styles.card}>
          <View style={checkoutStyles.row}>
            {item.image ? <Image source={{ uri: item.image }} style={{ width: 52, height: 64, resizeMode: "contain" }} /> : null}
            <Text style={[styles.heading, { flex: 1 }]}>{item.name} - {item.quantity} units</Text>
          </View>
          <Text>{item.storefrontName || (item.storefrontId ? `Store ${item.storefrontId}` : "Main catalog")} | {formatPrice(item.price)} each</Text>
          <PackageMeasurements size={item.packageSize} />
          {addresses.map((address) => <TextInput key={address.id} label={`Quantity for ${address.label}`}
            disabled={busy}
            keyboardType="number-pad" value={allocations[key]?.[address.id] || ""}
            onChangeText={(value) => updateAllocation(key, address.id, value)} style={styles.input} />)}
          <Text style={total === item.quantity ? styles.success : styles.error}>Allocated {total} / {item.quantity}</Text>
        </View>;
      })}
      <Button mode="contained" style={checkoutStyles.primary} labelStyle={checkoutStyles.primaryLabel}
        disabled={busy || !items.length || Boolean(editor) || !deliveryConfig}
        onPress={continueAddresses}>Save & continue to delivery</Button>
      </> : null}
      {step === 2 ? <>
      <View style={styles.card}>
        <Text style={styles.heading}>Delivery speed (applies to all deliveries)</Text>
        {deliveryMethodOptions(deliveryConfig || {}).map((option) => <TouchableOpacity key={option.value}
          accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: deliveryMode === option.value, disabled: busy }}
          disabled={busy} onPress={() => changeDeliveryMode(option.value)}
          style={[checkoutStyles.option, deliveryMode === option.value && checkoutStyles.selectedOption]}>
          <View style={[checkoutStyles.radio, deliveryMode === option.value && checkoutStyles.radioSelected]}>
            {deliveryMode === option.value ? <View style={checkoutStyles.radioDot} /> : null}
          </View>
          <View style={checkoutStyles.optionBody}><Text style={styles.heading}>{option.label}</Text>
            <Text style={checkoutStyles.note}>{option.description}</Text>
          </View>
        </TouchableOpacity>)}
        <Text style={checkoutStyles.note}>Business days are Monday-Friday, excluding weekends. Holidays are not currently excluded. Route and vehicle fees are calculated below.</Text>
        {international ? <Text style={checkoutStyles.note}>These speeds cover the US delivery to the consolidation hub only, not arrival in Ethiopia.</Text> : null}
        {deliveryMode === "SCHEDULED" ? <Picker selectedValue={scheduledDate} enabled={!busy}
          accessibilityLabel="Scheduled delivery date" onValueChange={changeScheduledDate}>
          <Picker.Item label="Choose a delivery date..." value="" />
          {getUpcomingDeliveryDays().map((day) =>
            <Picker.Item key={day.value} label={day.label} value={day.value} />)}
        </Picker> : null}
      </View>
      <Button mode="contained" style={checkoutStyles.primary} labelStyle={checkoutStyles.primaryLabel}
        disabled={busy || !items.length || Boolean(editor) || !deliveryConfig} onPress={requestQuote}>Calculate routes & recommend vehicles</Button>
      </> : null}
      </>}
      {quote && step > 1 ? <>
        {step === 2 || service ? <>
        <Text>Quote expires {new Date(quote.expiresAt).toLocaleTimeString()}.</Text>
        {quote.storeRoutes?.map((route) => <View key={route.storeId} style={styles.card}>
          <Text style={styles.heading}>Delivery route from {route.storeName}</Text>
          <Text>One base fee and speed surcharge per store, plus the road route from this store through its drop-offs.
            Separate stores are charged separately. Driver travel to pickup and batching detours do not add customer charges.</Text>
          <Text>Store route: {(/usa/i.test(database) ? route.distanceKm / 1.609344 : route.distanceKm).toFixed(2)} {/usa/i.test(database) ? "mi" : "km"}</Text>
          {route.stops.map((stop, index) => <Text key={stop.key}>{index + 1}. {stop.type === "pickup" ? "Pickup" : "Drop-off"}: {stop.name}</Text>)}
        </View>)}
        {quote.cartRoute ? <View style={styles.card}>
          <Text style={styles.heading}>One delivery route for your complete cart</Text>
          <Text>Billable road distance: {(/usa/i.test(database) ? quote.cartRoute.distanceKm / 1.609344 : quote.cartRoute.distanceKm).toFixed(2)} {/usa/i.test(database) ? "mi" : "km"}.
            One base fee and delivery-speed surcharge for the entire route.</Text>
          <Text>Driver travel to the first pickup and detours for other customers are not charged.
            Your reserved fee stays fixed. All pickups for your complete cart must finish before any drop-off begins.</Text>
          {quote.cartRoute.stops.map((stop, index) => <Text key={stop.key}>{index + 1}. {stop.type === "pickup" ? "Pickup" : "Drop-off"}: {stop.name}</Text>)}
        </View> : null}
        <Text>Delivery speed: {deliveryModeLabel(deliveryMode)}
          {deliveryMode === "SCHEDULED" && scheduledDate
            ? ` - ${getUpcomingDeliveryDays().find((day) => day.value === scheduledDate)?.label || scheduledDate}`
            : ""}</Text>
        {quote.deliveries.map((delivery) => <View key={delivery.key} style={styles.card}>
          <Text style={styles.heading}>Pickup: {delivery.store.name}</Text>
          <Text selectable>Store ID: {delivery.store._id}</Text>
          <Text>{delivery.store.address}</Text>
          <Text>{quote.international ? "US consolidation hub" : "Deliver to"}: {delivery.address.label} - {delivery.address.address1}, {delivery.address.city}</Text>
          {delivery.lines.map((line) => <View key={line.product}>
            <Text>{line.quantity} x {line.name}</Text>
            <PackageMeasurements size={line.packageSize} />
          </View>)}
          {!quote.cartRoute ? <Text>Road distance: {(/usa/i.test(database) ? delivery.distanceKm / 1.609344 : delivery.distanceKm).toFixed(2)} {/usa/i.test(database) ? "mi" : "km"}</Text> : null}
          {delivery.defaultFallback ? <Text>Queued for the default store after purchase, even if it is offline. The store must claim and prepare it before dispatch.</Text> : null}
          {delivery.pricingGroup?.kind === "store-route" ? <Text>
            This drop-off's delivery share: {formatPrice(pricing.byKey[delivery.key].deliveryFee)}.
            Complete route from this store: {formatPrice(pricing.byKey[delivery.key].sharedFee)}. Additional drop-offs extend this store's route, not a second base fee.
          </Text> : quote.cartRoute ? <Text>Allocated share of the single cart route fee: {formatPrice(pricing.byKey[delivery.key].deliveryFee)}.
            This is not an additional store delivery charge.</Text> : delivery.pricingGroup ? <Text>
            {pricing.byKey[delivery.key].storeCount > 1
              ? `Shared delivery fee: ${formatPrice(pricing.byKey[delivery.key].sharedFee)} for ${pricing.byKey[delivery.key].storeCount} nearby stores using the same vehicle type, priced from ${pricing.byKey[delivery.key].storeName}. This store's share: ${formatPrice(pricing.byKey[delivery.key].deliveryFee)}.`
              : `Delivery fee for this store: ${formatPrice(pricing.byKey[delivery.key].deliveryFee)} (once for all its products).`}
          </Text> : null}
          <CargoSummary cargo={delivery.cargo} />
          {delivery.requiresVehicleSelection || !delivery.vehicle ? <Text>Some packaged measurements are not available currently.
            Choose a vehicle manually. Full load capacity cannot be verified; available options account for known measurements.</Text> :
            <Text>Recommended: {delivery.vehicle}. Choose a suitable upgrade below.</Text>}
          <Text style={styles.heading}>Delivery vehicle</Text>
          {/usa/i.test(database) ? <Text>{delivery.vehicleOptions.some((option) => option.type === "car")
            ? "Choose Car below for car delivery. The selected vehicle updates the delivery fee and driver requirement."
            : "Car delivery is unavailable for this load or disabled in USA vehicle settings. Choose one of the suitable vehicles below."}</Text> : null}
          <Picker selectedValue={selections[delivery.key] || ""} enabled={!busy}
            accessibilityLabel={`Delivery vehicle for ${delivery.store.name}`}
            onValueChange={(value) => setSelections((previous) => selectDeliveryVehicle(quote.deliveries, previous, delivery, value))}>
            {delivery.requiresVehicleSelection || !delivery.vehicle ? <Picker.Item label="Choose a vehicle..." value="" /> : null}
            {delivery.vehicleOptions.map((option) => <Picker.Item key={option.type} label={`${option.type === "car" ? "Car" : option.type} - ${formatPrice(option.fee)}${delivery.pricingGroup?.kind === "store-route" ? " complete store route" : quote.cartRoute ? " entire cart route" : delivery.pricingGroup ? " before nearby-store sharing" : ""}`} value={option.type} />)}
          </Picker>
        </View>)}
        <DeliveryWindow value={quote} />
        </> : null}
        <View style={styles.card}>
          <Text>Products: {formatPrice(quote.itemsSubtotal)} | Delivery{needsVehicleSelection ? " estimate from" : ""}: {formatPrice(selectedFee)}</Text>
          {quote.international ? <Text>International shipping: {formatPrice(quote.international.shippingFee)}. Charged once per recipient shipment, including final address delivery.</Text> : null}
          <Text style={styles.heading}>Combined total{needsVehicleSelection ? " estimate from" : ""}: {formatPrice(previewTotal)}</Text>
          {quote.exchangeRate ? <>
            <Text style={styles.heading}>{quote.international ? "Birr" : "USD"} payment estimate: {quote.international ?
              etbText(birrAmount(previewTotal, quote.exchangeRate.birrPerUsd)) : usdText(usdAmount(previewTotal, quote.exchangeRate.birrPerUsd))}</Text>
            <Text>1 USD = {quote.exchangeRate.birrPerUsd} ETB. Applied {new Date(quote.exchangeRate.appliedAt).toLocaleString()} ({quote.exchangeRate.source}).</Text>
            <Text>The rate must still be current when you continue. The server locks the final payment amount after vehicle upgrades.</Text>
            {quote.international ? <Text>{quote.international.customsNotice}</Text> : null}
          </> : null}
          {step === 2 && !service ? <Button mode="contained" style={checkoutStyles.primary} labelStyle={checkoutStyles.primaryLabel}
            disabled={busy || needsVehicleSelection} onPress={() => setStep(3)}>Continue to payment</Button> : null}
          {step === 3 ? <>
          {availability.error ? <Text accessibilityRole="alert" style={styles.error}>{availability.error}</Text> :
            !availability.methods ? <Text>Loading payment methods...</Text> :
              !methods.length ? <Text accessibilityRole="alert" style={styles.error}>{PAYMENT_UNAVAILABLE}</Text> : null}
          {methods.map((option) => <TouchableOpacity key={option.value} accessibilityRole="radio"
            accessibilityLabel={option.label} accessibilityState={{ checked: method === option.value, disabled: busy }}
            disabled={busy} onPress={() => setMethod(option.value)}
            style={[checkoutStyles.option, method === option.value && checkoutStyles.selectedOption]}>
            <View style={[checkoutStyles.radio, method === option.value && checkoutStyles.radioSelected]}>
              {method === option.value ? <View style={checkoutStyles.radioDot} /> : null}
            </View>
            <View style={checkoutStyles.optionBody}><Text style={styles.heading}>{option.label}</Text>
              <Text style={checkoutStyles.note}>{option.description}</Text></View>
          </TouchableOpacity>)}
          {method === "bank" && availability.methods?.bank ? <Picker selectedValue={bankId} enabled={!busy} onValueChange={setBankId}>
            <Picker.Item label="Select bank account..." value="" />
            {banks.map((bank) => <Picker.Item key={bank._id} label={`${bank.bankName} - ${bank.accountHolderName}`} value={bank._id} />)}
          </Picker> : null}
          {!quote.international && (/usa/i.test(database) || quote.exchangeRate) && !availableCard ? <Text style={styles.error}>Card payment needs a native build and matching configured Stripe keys. USD requires the dedicated Ethiopia USD merchant.</Text> : null}
          {method === "bank" && !banks.length ? <Text style={styles.error}>Admin must configure a bank account, or choose another available payment method.</Text> : null}
          <Button mode="contained" style={checkoutStyles.primary} labelStyle={checkoutStyles.primaryLabel}
            disabled={busy || !methods.some((option) => option.value === method) || needsVehicleSelection || (method === "bank" && !bankId)}
            onPress={() => setStep(4)}>Review order</Button>
          </> : null}
          {step === 4 ? <>
            {!methods.some((option) => option.value === method) ? <Text accessibilityRole="alert" style={styles.error}>{availability.error || PAYMENT_UNAVAILABLE}</Text> : null}
            <Text style={styles.heading}>Delivery Method</Text>
            <Text>{service ? "Service quote" : deliveryModeLabel(quote.deliveryMode || deliveryMode)}</Text>
            <DeliveryWindow value={quote} />
            {!service ? <Button disabled={busy} onPress={() => setStep(2)}>Change delivery method</Button> : null}
            <Text style={styles.heading}>Payment Method</Text>
            <Text>{methods.find((option) => option.value === method)?.label || method}</Text>
            {method === "bank" ? <Text>{banks.find((bank) => bank._id === bankId)?.bankName}</Text> : null}
            <Button disabled={busy} onPress={() => setStep(3)}>Change payment method</Button>
            {quote.deliveries.map((delivery) => <View key={delivery.key} style={styles.card}>
              <Text style={styles.heading}>{delivery.address.label}</Text>
              <Text>{addressText(delivery.address)}</Text><Text>{delivery.address.phone}</Text>
              <Text>Pickup: {delivery.store.name} | Vehicle: {selections[delivery.key]}</Text>
              {delivery.lines.map((line) => {
                const item = items.find((entry) => (entry._id || entry.id) === line.product);
                return <View key={line.product} style={checkoutStyles.row}>
                  {item?.image ? <Image source={{ uri: item.image }} style={{ width: 36, height: 48, resizeMode: "contain" }} /> : null}
                  <Text style={{ flex: 1 }}>{line.quantity} x {line.name}</Text>
                  {Number.isFinite(line.price) ? <Text>{formatPrice(line.price * line.quantity)}</Text> : null}
                </View>;
              })}
            </View>)}
            {!service ? <Button disabled={busy} onPress={() => setStep(1)}>Change addresses & quantities</Button> : null}
            <Text style={checkoutStyles.note}>The combined total includes the server-quoted charges. Stock, prices and payment eligibility are verified when you continue.</Text>
            <Button mode="contained" style={checkoutStyles.primary} labelStyle={checkoutStyles.primaryLabel}
              disabled={busy || !methods.some((option) => option.value === method) || needsVehicleSelection || (method === "bank" && !bankId)}
              onPress={reserveCheckout}>{service ? "Accept quote & continue in USD" : "Place order & continue"}</Button>
          </> : null}
          <Text>{quote.international ? "ETB bank transfer only. Submit your transfer reference before the hold expires. Stores cannot fulfill until Admin verifies funds. After submission the reservation stays held for Admin review." :
            service ? "The Admin service quote is locked when you continue. Submitted or paid service payments require support review for cancellation/refund." :
            quote.exchangeRate ? "All stock is reserved together. Pay one locked USD total by card or USD bank transfer; there is no cash option." :
              "All stock is reserved together. An unavailable line cancels the entire reservation attempt. Cash is collected separately on each delivery."}</Text>
        </View>
      </> : null}
    </>}
    <Button disabled={busy} onPress={() => navigation.navigate("DeliveryCheckouts")}>Recover an existing checkout</Button>
  </ScrollView>;
};

export default MultiDeliveryCheckout;
