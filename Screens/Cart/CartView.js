import React, {useContext, useState, useCallback} from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { Button, Avatar } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { addToCart, removeFromCart, clearCart, deductQuantity } from '../../store/cartSlice';
import { AuthContext } from '../../Context/store/Auth';
import EasyButton from '../../Shared/StyledComponenets/EasyButton';
import { useCurrency } from '../../assets/common/currency';
import { cartItemKey } from '../../assets/common/cartIdentity';
import { storeRequest, getStorefrontScope } from '../../assets/common/storefront';
import { getDatabaseNameFromStorage, sanitizeDatabaseName } from '../../assets/common/databaseConfig';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { exchangeRequest, rateIsActive, usdAmount, usdText, usdInactiveMessage, birrAmount, etbText, exportInactiveMessage } from '../../assets/common/exchangeRate';
import { CheckoutHeader } from '../../Shared/DeliveryCheckout';
//import { CheckoutProvider } from '../../Context/store/CheckoutContext'; // Import the CheckoutProvider

// products data
//const products = require('../../assets/data/products.json'); // Import the products data



const CartView = (props) => {

  const context = useContext(AuthContext);


  const cartItems = useSelector((state) => state.cart.cartItems);
  const dispatch = useDispatch();
  const { formatPrice, currencySymbol } = useCurrency();
  const [checking, setChecking] = useState(false);
  const [regionReady, setRegionReady] = useState(false);
  const [paymentCurrency, setPaymentCurrency] = useState("etb");
  const [exchange, setExchange] = useState(null);
  const [database, setDatabase] = useState("");
  const [exchangeError, setExchangeError] = useState("");
  useFocusEffect(useCallback(() => {
    let mounted = true;
    setRegionReady(false);
    const load = async () => {
      try {
        const db = await getDatabaseNameFromStorage();
        if (!mounted) return;
        setDatabase(db);
        setPaymentCurrency(/usa/i.test(db) ? "usd" : "etb");
        setRegionReady(true);
        setExchange(null); setExchangeError("");
        if (context.isAuthenticated) {
          const result = await exchangeRequest();
          if (mounted) setExchange(result);
        }
      } catch (error) {
        if (mounted) setExchangeError(error.response?.data?.message || "Could not load cross-currency checkout status. Native-currency checkout remains available.");
      }
    };
    load();
    return () => { mounted = false; };
  }, [context.isAuthenticated]));

  // Access the cart items from the Redux store
  const productsData = cartItems.map((cartItem) => ({
        ...cartItem,
        _id: cartItem._id || cartItem.id,
      }));

  //console.log('cartItems:', cartItems.map(i => i.id));
  //console.log('products:', products.map(p => p._id));
  //console.log('products:', products);
  //console.log('cartItems full:', cartItems);


  

  const handleClearCart = () => {
    Alert.alert("Clear your cart?", "Remove all items from this cart?", [
      { text: "Keep items", style: "cancel" },
      { text: "Clear cart", style: "destructive", onPress: () => dispatch(clearCart()) },
    ]);
  };

  const handleDeductQuantity = (item) => {
    dispatch(deductQuantity({ cartKey: cartItemKey(item) }));
  };
  const checkout = async () => {
    if (checking || !regionReady || !database) return;
    setChecking(true);
    try {
      const database = await getDatabaseNameFromStorage();
      if (cartItems.some((item) => sanitizeDatabaseName(item.databaseName || item.dbName) !== database)) {
        throw new Error("Your cart contains products from another region. Switch back or clear the cart before checking out.");
      }
      const config = await storeRequest("delivery-config");
      const exportPurchase = /usa/i.test(database) && paymentCurrency === "etb";
      if (exportPurchase || (!/usa/i.test(database) && paymentCurrency === "usd")) {
        const latest = await exchangeRequest();
        setExchange(latest);
        if (!rateIsActive(latest)) throw new Error(latest.message || (exportPurchase ? exportInactiveMessage : usdInactiveMessage));
        if (!config.enabled) throw new Error("Admin must enable inventory and vehicle checkout before cross-currency product purchases.");
        if (exportPurchase && !(await storeRequest("international-shipping-config")).enabled) throw new Error("US-to-Ethiopia international shipping is not enabled.");
      }
      if (config.enabled) props.navigation.push("MultiDeliveryCheckout", { paymentCurrency });
      else {
        getStorefrontScope(cartItems);
        props.navigation.navigate("Checkout");
      }
    } catch (error) { Alert.alert("Checkout unavailable", error.response?.data?.message || error.message); }
    finally { setChecking(false); }
  };

return (
  <View style={styles.container}>
    <FlatList
      data={productsData}
      ListHeaderComponent={<>
    <View style={{ paddingHorizontal: 16 }}>
      <CheckoutHeader step={0} onBack={() => props.navigation.goBack()} title={`Your Cart (${productsData.length})`} />
    </View>
    {productsData.length ? <Button disabled={checking} onPress={handleClearCart}>Clear cart</Button> : null}
    {context.isAuthenticated ? <Button onPress={() => props.navigation.navigate("DeliveryCheckouts")}>My multi-delivery checkouts</Button> : null}
      </>}
      ListEmptyComponent={
      <View style={styles.emptyCart}>
        <Text style={styles.emptyText}>Your cart is empty</Text>
      </View>
      }
        renderItem={({ item }) => {
          const quantity = item.quantity;
          return (
            <View style={styles.rowItem}>
              <Avatar.Image
                size={60}
                source={{
                  uri:
                    item.image ||
                    "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
                }}
                style={styles.avatar}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.storefrontId ? <Text>{item.storefrontName || `Store ${item.storefrontId}`}</Text> : <Text>Main catalog</Text>}
                <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
                <View style={styles.quantity}>
                  <Button compact disabled={checking} accessibilityLabel={`Decrease ${item.name} quantity`}
                    onPress={() => handleDeductQuantity(item)}>-</Button>
                  <Text>{quantity}</Text>
                  <Button compact disabled={checking} accessibilityLabel={`Increase ${item.name} quantity`}
                    onPress={() => dispatch(addToCart(item))}>+</Button>
                </View>
              </View>
              <View style={styles.actions}>
                <Button compact icon="delete-outline" disabled={checking} accessibilityLabel={`Remove ${item.name}`}
                  onPress={() => dispatch(removeFromCart({ cartKey: cartItemKey(item) }))}>Remove</Button>
                <Text style={styles.lineTotal}>{formatPrice(item.price * quantity)}</Text>
              </View>
            </View>
          );
        }}
        keyExtractor={cartItemKey}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={productsData.length > 0 ? (
      <View style={{ padding: 10 }}>
        {database && context.isAuthenticated ? <>
          <Text>{/usa/i.test(database) ? "Pay USD for US delivery, or birr to ship approved US products to Ethiopia. Products only; shipping is added." :
            "Pay for Ethiopia deliveries in birr or US dollars. Rides are not included."}</Text>
          <Picker selectedValue={paymentCurrency} enabled={regionReady && !checking} onValueChange={setPaymentCurrency}>
            <Picker.Item label={/usa/i.test(database) ? "Pay birr & ship to Ethiopia (ETB)" : "Pay in birr (ETB)"} value="etb" />
            <Picker.Item label={/usa/i.test(database) ? "Pay USD & deliver in USA" : "Pay in US dollars (USD)"} value="usd" />
          </Picker>
          {exchangeError ? <Text style={{ color: "#b91c1c" }}>{exchangeError}</Text> : null}
          {paymentCurrency === (/usa/i.test(database) ? "etb" : "usd") ? rateIsActive(exchange) ? <>
            <Text>Products estimate: {/usa/i.test(database) ?
              etbText(birrAmount(productsData.reduce((sum, item) => sum + item.price * item.quantity, 0), exchange.birrPerUsd)) :
              usdText(usdAmount(productsData.reduce((sum, item) => sum + item.price * item.quantity, 0), exchange.birrPerUsd))}. Shipping / route fees are added at checkout.</Text>
            <Text>1 USD = {exchange.birrPerUsd} ETB. Rate applied {new Date(exchange.appliedAt).toLocaleString()}.</Text>
          </> : <Text style={{ color: "#b91c1c" }}>{exchange?.active ?
            (/usa/i.test(database) ? exportInactiveMessage : usdInactiveMessage) : exchange?.message ||
              (/usa/i.test(database) ? exportInactiveMessage : usdInactiveMessage)}</Text> : null}
        </> : null}
        <Text style={{ color: "#596579", marginVertical: 6 }}>Delivery fees are calculated after choosing addresses, delivery speed and vehicles. Only server-confirmed charges apply.</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", marginVertical: 8 }}>
          Products subtotal: {currencySymbol}
          {productsData
            .reduce((total, item) => {
              return total + item.price * item.quantity;
            }, 0)
            .toFixed(2)}
        </Text>
        <View style={{ height: 60 }}>
          {context.isAuthenticated ? (
            <EasyButton
              mode="contained"
              tertiary
              disabled={checking || !regionReady}
              onPress={checkout}
              style={{ marginVertical: 10, backgroundColor: "#ffdb00", borderRadius: 10 }}
            >
              <Text style={{ color: '#030501' }}>{checking ? "Checking availability..." :
                regionReady ? "Proceed to Checkout" : "Loading shopping region..."}</Text>
            </EasyButton>
          ) : (
            <EasyButton
              mode="contained"
              tertiary
              onPress={() => props.navigation.navigate("User", { screen: "Login" })}
              style={{ margin: 10 }}
            >
              <Text style={{ color: '#030501' }}>Proceed to Login</Text>
            </EasyButton>
          )}
        </View>
      </View>
    ) : null}
    />
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    padding: 10,
    elevation: 2,
  },
  appbarTitle: {
    color: '#e6c20eff', 
  },
  avatar: {
    marginRight: 10,
    backgroundColor: '#eee',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemPrice: {
    fontSize: 14,
    color: 'gray',
  },
  actions: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  quantity: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  lineTotal: { fontWeight: "800", fontSize: 15, color: "#101820", marginTop: 10 },
  listContent: {
    paddingBottom: 20,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: 'gray',
  },
});

export default CartView;
