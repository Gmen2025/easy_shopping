import React, { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { useDispatch, useSelector } from "react-redux";
import CardPayment, { canPayByCard, nativeCardAvailable } from "../../../Shared/CheckoutCardPayment";
import { cartItemKey } from "../../../assets/common/cartIdentity";
import { storeRequest } from "../../../assets/common/storefront";
import { getDatabaseNameFromStorage, sanitizeDatabaseName } from "../../../assets/common/databaseConfig";
import { beginCheckout, completeCheckout } from "../../../store/cartSlice";
import { useCurrency } from "../../../assets/common/currency";
import { CargoSummary, DeliverySummary, PackageMeasurements, styles } from "../../../Shared/DeliveryCheckout";
import AddressSearchInput from "../../../Shared/AddressSearchInput";
import { addressText, isEthiopia } from "../../../assets/common/rides";
import { exchangeRequest, rateIsActive, usdAmount, usdText, usdInactiveMessage, birrAmount, etbText, exportInactiveMessage } from "../../../assets/common/exchangeRate";

const ADDRESS_FIELDS = [
  ["label", "Address label"], ["address1", "Street address"], ["address2", "Apartment / unit (optional)"],
  ["city", "City"], ["zip", "Postal code"], ["country", "Country"], ["phone", "Recipient phone"],
];
const blankAddress = () => Object.fromEntries(ADDRESS_FIELDS.map(([key]) => [key, ""]));
const locatedFields = ["address1", "city", "zip", "country"];
const MultiDeliveryCheckout = ({ navigation, route }) => {
  const items = useSelector((state) => state.cart.cartItems);
  const dispatch = useDispatch();
  const { formatPrice } = useCurrency();
  const [database, setDatabase] = useState("");
  const [saved, setSaved] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [editor, setEditor] = useState(null);
  const [allocations, setAllocations] = useState({});
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
  const resumeId = route.params?.groupId;
  const serviceId = route.params?.serviceId;
  const service = Boolean(serviceId || group?.kind === "service" || quote?.kind === "service");
  const paymentCurrency = route.params?.paymentCurrency || (/usa/i.test(database) ? "usd" : "etb");
  const converted = service || (paymentCurrency === "usd" && database && !/usa/i.test(database));
  const international = Boolean(group?.international || quote?.international || (/usa/i.test(database) && paymentCurrency === "etb"));
  const availableCard = converted ? nativeCardAvailable && exchange?.cardAvailable : canPayByCard;

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
      if (result.status === "quote") setQuote(result);
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
    const [current, existing, accounts] = await Promise.all([
      storeRequest("delivery-current-address"), storeRequest("delivery-addresses"),
      storeRequest(exportPurchase ? "delivery-bank-accounts?currency=ETB" :
        currency === "usd" && !/usa/i.test(db) ? "delivery-bank-accounts?currency=USD" : "delivery-bank-accounts"),
    ]);
    const initial = { ...current, ...(exportPurchase && !isEthiopia(current.country) ?
      { address1: "", address2: "", city: "", zip: "", country: "Ethiopia", phone: current.phone || "" } : {}), id: "current" };
    setAddresses([initial]);
    setSaved(exportPurchase ? existing.filter((entry) => isEthiopia(entry.country)) : existing);
    setBanks(accounts);
    setBankId(accounts[0]?._id || "");
    setAllocations(Object.fromEntries(items.map((item) => [cartItemKey(item), { current: String(item.quantity) }])));
  });
  useEffect(() => { load(); }, [resumeId, serviceId]);

  const invalidate = () => { setQuote(null); setSelections({}); };
  const updateAllocation = (key, addressId, quantity) => {
    invalidate();
    setAllocations((previous) => ({ ...previous, [key]: { ...previous[key], [addressId]: quantity } }));
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
  const requestQuote = () => run(async () => {
    if (!items.length) throw new Error("Your cart is empty.");
    const currentDb = await getDatabaseNameFromStorage();
    if (currentDb !== database || items.some((item) => sanitizeDatabaseName(item.databaseName || item.dbName) !== database)) throw new Error("The region changed. Return to the cart and restart checkout.");
    const cart = items.map((item) => ({ key: cartItemKey(item), product: item._id || item.id,
      quantity: item.quantity, price: item.price, storefrontId: item.storefrontId || null }));
    const split = cart.flatMap((line) => addresses.map((address) => ({
      key: line.key, addressId: address.id, quantity: Number(allocations[line.key]?.[address.id] || 0),
    })).filter((entry) => entry.quantity !== 0));
    const usedIds = new Set(split.map((entry) => entry.addressId));
    const result = await storeRequest("checkouts/quote", { method: "post", timeout: 120000,
      data: { cart, addresses: addresses.filter((address) => usedIds.has(address.id)), allocations: split, paymentCurrency } });
    setQuote(result);
    dispatch(beginCheckout({ id: result._id }));
    setSelections(Object.fromEntries(result.deliveries.map((delivery) => [delivery.key, delivery.vehicle])));
  });
  const reserveCheckout = () => run(async () => {
    if (quote.deliveries.some((delivery) => !selections[delivery.key])) throw new Error("Choose a vehicle for every delivery before continuing.");
    if (!service && (items.some((item) => !quote.cart.some((line) => line.key === cartItemKey(item) && line.quantity === item.quantity)) ||
        items.length !== quote.cart.length)) throw new Error("Your cart changed. Request a fresh quote.");
    const result = await storeRequest(`checkouts/${quote._id}/prepare`, { method: "post", timeout: 60000, data: {
      method, bankAccountId: bankId,
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
  const selectedFee = quote?.deliveries.reduce((sum, delivery) => sum +
    (delivery.vehicleOptions.find((option) => option.type === selections[delivery.key])?.fee ?? delivery.deliveryFee ?? 0), 0) || 0;
  const previewTotal = (quote?.itemsSubtotal || 0) + selectedFee + (quote?.international?.shippingFee || 0);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!addresses.length && !group && !quote ? <Button disabled={busy} onPress={load}>Reload checkout</Button> : null}
    {group ? <>
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
      <Button onPress={() => navigation.navigate("DeliveryCheckouts", { groupId: group._id })}>{service ? "View service payment" : "View individual deliveries"}</Button>
      <Button onPress={() => service ? navigation.goBack() : navigation.navigate("CartHome")}>{service ? "Back to services" : "Return to cart"}</Button>
    </> : <>
      {service ? <View style={styles.card}>
        <Text style={styles.title}>Service USD checkout</Text>
        <Text>Accept and pay the Admin's birr quote in US dollars. Fulfillment stays in Ethiopia. No passenger rides or cash payments.</Text>
        <Button disabled={busy} onPress={load}>Refresh service quote / payment status</Button>
      </View> : <>
      <Text style={styles.title}>Delivery addresses & quantities</Text>
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
          <Text style={styles.heading}>{item.name} - {item.quantity} units</Text>
          <Text>{item.storefrontName || (item.storefrontId ? `Store ${item.storefrontId}` : "Main catalog")} | {formatPrice(item.price)} each</Text>
          <PackageMeasurements size={item.packageSize} />
          {addresses.map((address) => <TextInput key={address.id} label={`Quantity for ${address.label}`}
            keyboardType="number-pad" value={allocations[key]?.[address.id] || ""}
            onChangeText={(value) => updateAllocation(key, address.id, value)} style={styles.input} />)}
          <Text style={total === item.quantity ? styles.success : styles.error}>Allocated {total} / {item.quantity}</Text>
        </View>;
      })}
      <Button mode="contained" disabled={busy || !items.length || Boolean(editor)} onPress={requestQuote}>Calculate routes & recommend vehicles</Button>
      </>}
      {quote ? <>
        <Text>Quote expires {new Date(quote.expiresAt).toLocaleTimeString()}.</Text>
        {quote.deliveries.map((delivery) => <View key={delivery.key} style={styles.card}>
          <Text style={styles.heading}>Pickup: {delivery.store.name}</Text>
          <Text selectable>Store ID: {delivery.store._id}</Text>
          <Text>{delivery.store.address}</Text>
          <Text>{quote.international ? "US consolidation hub" : "Deliver to"}: {delivery.address.label} - {delivery.address.address1}, {delivery.address.city}</Text>
          {delivery.lines.map((line) => <View key={line.product}>
            <Text>{line.quantity} x {line.name}</Text>
            <PackageMeasurements size={line.packageSize} />
          </View>)}
          <Text>Road distance: {(/usa/i.test(database) ? delivery.distanceKm / 1.609344 : delivery.distanceKm).toFixed(2)} {/usa/i.test(database) ? "mi" : "km"}</Text>
          <CargoSummary cargo={delivery.cargo} />
          {delivery.requiresVehicleSelection || !delivery.vehicle ? <Text>Some packaged measurements are not available currently.
            Choose a vehicle manually. Full load capacity cannot be verified; available options account for known measurements.</Text> :
            <Text>Recommended: {delivery.vehicle}. Choose a suitable upgrade below.</Text>}
          <Picker selectedValue={selections[delivery.key] || ""} enabled={!busy}
            onValueChange={(value) => setSelections((previous) => ({ ...previous, [delivery.key]: value }))}>
            {delivery.requiresVehicleSelection || !delivery.vehicle ? <Picker.Item label="Choose a vehicle..." value="" /> : null}
            {delivery.vehicleOptions.map((option) => <Picker.Item key={option.type} label={`${option.type} - ${formatPrice(option.fee)}`} value={option.type} />)}
          </Picker>
        </View>)}
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
          <Picker selectedValue={method} enabled={!busy} onValueChange={setMethod}>
            <Picker.Item label="Bank transfer" value="bank" />
            {quote.international ? null : /usa/i.test(database) || quote.exchangeRate
              ? availableCard ? <Picker.Item label="Card" value="card" /> : null
              : <Picker.Item label="Cash on delivery" value="cash" />}
          </Picker>
          {method === "bank" ? <Picker selectedValue={bankId} enabled={!busy} onValueChange={setBankId}>
            <Picker.Item label="Select bank account..." value="" />
            {banks.map((bank) => <Picker.Item key={bank._id} label={`${bank.bankName} - ${bank.accountHolderName}`} value={bank._id} />)}
          </Picker> : null}
          {!quote.international && (/usa/i.test(database) || quote.exchangeRate) && !availableCard ? <Text style={styles.error}>Card payment needs a native build and matching configured Stripe keys. USD requires the dedicated Ethiopia USD merchant.</Text> : null}
          {method === "bank" && !banks.length ? <Text style={styles.error}>Admin must configure a bank account, or choose another available payment method.</Text> : null}
          <Button mode="contained" disabled={busy || needsVehicleSelection || (method === "bank" && !bankId)} onPress={reserveCheckout}>{service ? "Accept quote & continue in USD" : "Reserve all deliveries & continue"}</Button>
          <Text>{quote.international ? "ETB bank transfer only. Submit your transfer reference before the hold expires. Stores cannot fulfill until Admin verifies funds. After submission the reservation stays held for Admin review." :
            service ? "The Admin service quote is locked when you continue. Submitted or paid service payments require support review for cancellation/refund." :
            quote.exchangeRate ? "All stock is reserved together. Pay one locked USD total by card or USD bank transfer; there is no cash option." :
              "All stock is reserved together. An unavailable line cancels the entire reservation attempt. Cash is collected separately on each delivery."}</Text>
        </View>
      </> : null}
    </>}
    <Button onPress={() => navigation.navigate("DeliveryCheckouts")}>Recover an existing checkout</Button>
  </ScrollView>;
};

export default MultiDeliveryCheckout;
