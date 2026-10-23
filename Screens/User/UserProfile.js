import React, { useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Icon from "react-native-vector-icons/FontAwesome";
import Toast from "react-native-toast-message";
import OrderCard from "../../Shared/OrderCard";
import { AuthContext } from "../../Context/store/Auth";
import baseUrl from "../../assets/common/baseUrl";
import { filterProfileOrders, getProfileUserOrders } from "../../assets/common/profileOrders";
import { PRIVACY_URL, TERMS_URL, DELETION_URL } from "../../assets/common/legalLinks";

const SUPPORT_EMAIL = "easyshop@addugeneteshop.com";
const SUPPORT_PHONE = "+251954141473";

function ProfileTile({ title, subtitle, icon, color, backgroundColor, onPress, compact, selected }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress} style={({ pressed }) => [
        styles.tile, { backgroundColor, width: compact ? "48%" : "23.5%" },
        selected && { borderColor: color }, pressed && styles.pressed,
      ]}>
      <View style={[styles.tileIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={[styles.tileSubtitle, compact && { fontSize: 12 }]}>{subtitle}</Text>
      <Icon name="angle-right" size={22} color="#152341" style={{ marginTop: 10 }} />
    </Pressable>
  );
}

function SectionHeading({ icon, color, title, subtitle, onPress, expanded }) {
  const content = <>
    <Icon name={icon} color={color} size={32} style={{ width: 40 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.description}>{subtitle}</Text>
    </View>
    {onPress && <Icon name={expanded ? "angle-down" : "angle-right"} size={24} color="#17243B" />}
  </>;
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }}
      onPress={onPress} style={styles.sectionHeading}>{content}</Pressable>
  ) : <View style={styles.sectionHeading}>{content}</View>;
}

function AccountRow({ icon, color, title, subtitle, onPress, last }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.accountRow, !last && styles.rowDivider, pressed && styles.pressed]}>
    <Icon name={icon} size={27} color={color} style={{ width: 38 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.description}>{subtitle}</Text>
    </View>
    <Icon name="angle-right" size={23} color="#17243B" />
  </Pressable>;
}

const UserProfile = ({ navigation }) => {
  const { user, isAuthenticated, logout } = useContext(AuthContext);
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 600 || fontScale > 1.3;
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [orderFilter, setOrderFilter] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const scroll = useRef(null);
  const ordersOffset = useRef(0);
  const orderCardOffset = useRef(0);
  const requestId = useRef(0);
  const userId = user?._id || user?.id;

  const loadOrders = useCallback(async () => {
    const id = ++requestId.current;
    if (!isAuthenticated || !userId) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await axios.get(`${baseUrl}orders`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 20000,
      });
      const result = getProfileUserOrders(response.data, userId);
      if (id === requestId.current) setOrders(result);
    } catch (error) {
      if (id !== requestId.current) return;
      if (error.response?.status === 401) {
        await logout();
        return;
      }
      console.warn("Profile orders could not be loaded:", error.message);
      setOrdersError(error.response?.data?.message || error.message || "Unable to load your orders.");
    } finally {
      if (id === requestId.current) setOrdersLoading(false);
    }
  }, [isAuthenticated, userId, logout]);

  useFocusEffect(useCallback(() => {
    setOrders([]);
    loadOrders();
    return () => { requestId.current += 1; };
  }, [loadOrders]));

  const openLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Toast.show({ type: "error", text1: "Unable to open link",
        text2: "Please check that a compatible app is installed and try again." });
    }
  };

  const openTelegram = async () => {
    const candidates = ["https://t.me/BettyT58", "https://telegram.me/BettyT58", "tg://resolve?domain=BettyT58"];
    for (const url of candidates) {
      try {
        await Linking.openURL(url);
        return;
      } catch (error) {
        // Try the next supported Telegram link.
      }
    }
    Toast.show({ type: "error", text1: "Unable to open Telegram", text2: "Contact @BettyT58 in Telegram." });
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigation.navigate("Home");
    } catch (error) {
      Toast.show({ type: "error", text1: "Sign out failed", text2: "Please try again." });
    } finally {
      setSigningOut(false);
    }
  };

  const showOrders = (filter) => {
    setOrderFilter(filter);
    requestAnimationFrame(() => scroll.current?.scrollTo({
      y: orderCardOffset.current + ordersOffset.current, animated: true,
    }));
  };
  const visibleOrders = filterProfileOrders(orders, orderFilter);
  const orderTiles = [
    { title: "Track Delivery", subtitle: "Real-time tracking of your order", icon: "map-marker",
      color: "#16A34A", backgroundColor: "#F4FBF6", filter: "tracking" },
    { title: "Deliveries", subtitle: "View delivered orders", icon: "truck",
      color: "#008BD8", backgroundColor: "#F3FAFF", filter: "delivered" },
    { title: "Cancellation", subtitle: "Manage eligible delivery cancellations", icon: "times-circle",
      color: "#FA2537", backgroundColor: "#FFF5F6", route: "DeliveryCheckouts" },
    { title: "Payment", subtitle: "View checkout payments and refunds", icon: "credit-card",
      color: "#8319E5", backgroundColor: "#F9F5FF", route: "DeliveryCheckouts" },
  ];

  return (
    <ScrollView ref={scroll} style={styles.screen} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={ordersLoading} onRefresh={loadOrders} tintColor="#B28B00" />}>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit your profile"
        onPress={() => navigation.navigate("EditProfile")} style={styles.profileCard}>
        <View style={[styles.avatar, compact && { width: 66, height: 66 }]}>
          <Icon name="user" size={compact ? 39 : 48} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{user?.name || "My Account"}</Text>
          <View style={styles.detailRow}>
            <Icon name="envelope" size={15} color="#10253F" />
            <Text selectable style={styles.profileDetail}>{user?.email || "Email not provided"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="phone" size={17} color="#10253F" />
            <Text selectable style={styles.profileDetail}>{user?.phone || "Add a phone number"}</Text>
          </View>
        </View>
        <Icon name="angle-right" size={25} color="#17243B" />
      </Pressable>

      <View style={styles.actions}>
        {[
          { title: "Edit Profile", icon: "pencil-square-o", backgroundColor: "#FFD500",
            onPress: () => navigation.navigate("EditProfile") },
          { title: "My Service Requests", icon: "clipboard", backgroundColor: "#FFF8E2",
            onPress: () => navigation.navigate("ServiceRequests") },
          { title: "Sign Out", icon: "sign-out", backgroundColor: "#FF2438", onPress: signOut },
        ].map((action) => <Pressable key={action.title} accessibilityRole="button"
          accessibilityState={{ disabled: signingOut }} disabled={signingOut} onPress={action.onPress}
          style={({ pressed }) => [styles.action, { backgroundColor: action.backgroundColor },
            compact && { flexDirection: "column", paddingHorizontal: 5 }, pressed && styles.pressed]}>
          <Icon name={action.icon} size={compact ? 22 : 26} color={action.title === "Sign Out" ? "#FFFFFF" : "#152341"} />
          <Text style={[styles.actionText, compact && { fontSize: 11 },
            action.title === "Sign Out" && { color: "#FFFFFF" }]}>
            {action.title === "Sign Out" && signingOut ? "Signing out..." : action.title}
          </Text>
        </Pressable>)}
      </View>

      <View style={styles.card} onLayout={(event) => { orderCardOffset.current = event.nativeEvent.layout.y; }}>
        <SectionHeading icon="cube" color="#C49A00" title="Order List" subtitle="View and manage your orders"
          onPress={() => orderFilter ? setOrderFilter(null) : showOrders("all")} expanded={!!orderFilter} />
        <View style={styles.tiles}>
          {orderTiles.map((tile) => <ProfileTile key={tile.title} {...tile} compact={compact}
            selected={!!tile.filter && orderFilter === tile.filter}
            onPress={() => tile.route ? navigation.navigate(tile.route) : showOrders(tile.filter)} />)}
        </View>
        <View onLayout={(event) => { ordersOffset.current = event.nativeEvent.layout.y; }}>
          {!!orderFilter && <View style={styles.orderList}>
            <Text style={styles.rowTitle}>
              {orderFilter === "tracking" ? "Active Deliveries" : orderFilter === "delivered" ? "Delivered Orders" : "Your Orders"}
            </Text>
            <Text style={styles.description}>
              {orderFilter === "tracking" ? "Open Track Order on an order below to see its live delivery status." :
                "Order cards include items, payment details, and available delivery actions."}
            </Text>
            {ordersLoading ? <ActivityIndicator style={{ margin: 20 }} color="#B28B00" /> :
              ordersError ? <View accessibilityRole="alert">
                <Text style={styles.error}>{ordersError}</Text>
                <Pressable accessibilityRole="button" onPress={loadOrders} style={styles.retry}>
                  <Text style={styles.rowTitle}>Retry loading orders</Text>
                </Pressable>
              </View> :
                visibleOrders.length ? visibleOrders.map((order) =>
                  <View key={order._id || order.id} style={{ marginTop: 14 }}><OrderCard {...order} /></View>) :
                  <Text style={styles.empty}>{orderFilter === "tracking" ? "No active deliveries." :
                    orderFilter === "delivered" ? "No delivered orders yet." : "No orders yet. Start shopping to see your orders here."}</Text>}
          </View>}
        </View>
      </View>

      <View style={styles.card}>
        <SectionHeading icon="shield" color="#007BFF" title="Privacy & Account"
          subtitle="Manage your privacy and account settings" />
        <AccountRow title="Security Settings" subtitle="Two-factor authentication and recovery options"
          icon="lock" color="#007BFF" onPress={() => navigation.navigate("SecuritySettings")} />
        <AccountRow title="Privacy Policy" subtitle="Learn how we protect your data"
          icon="file-text-o" color="#007BFF" onPress={() => openLink(PRIVACY_URL)} />
        <AccountRow title="Terms of Service" subtitle="Review the terms for using our services"
          icon="file-text-o" color="#007BFF" onPress={() => openLink(TERMS_URL)} />
        <AccountRow title="Account Deletion" subtitle="Request to delete your account"
          icon="trash" color="#FF2438" last onPress={() => openLink(DELETION_URL)} />
      </View>

      <View style={styles.card}>
        <SectionHeading icon="headphones" color="#16A34A" title="Help & Support" subtitle="We're here to help you" />
        <View style={styles.tiles}>
          <ProfileTile title="Email" subtitle={SUPPORT_EMAIL} icon="envelope" color="#007BFF"
            backgroundColor="#F2F9FF" compact={compact} onPress={() => openLink(`mailto:${SUPPORT_EMAIL}`)} />
          <ProfileTile title="Phone" subtitle="+251 954 141 473" icon="phone" color="#3599F7"
            backgroundColor="#F2F9FF" compact={compact} onPress={() => openLink(`tel:${SUPPORT_PHONE}`)} />
          <ProfileTile title="WhatsApp" subtitle="Chat with us" icon="whatsapp" color="#10B900"
            backgroundColor="#F2FBF4" compact={compact} onPress={() => openLink("https://wa.me/251954141473")} />
          <ProfileTile title="Telegram" subtitle="Message @BettyT58" icon="telegram" color="#00A1DE"
            backgroundColor="#F2F9FF" compact={compact} onPress={openTelegram} />
        </View>
        <Text style={styles.hours}>Support Hours: Mon-Sat, 9 AM - 6 PM</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FCFDFF" },
  content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, paddingBottom: 32, gap: 16 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18,
    backgroundColor: "#FFFBEC", borderWidth: 1, borderColor: "#F3E3AB", borderRadius: 14 },
  avatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: "#C69A00",
    alignItems: "center", justifyContent: "center" },
  name: { color: "#101D40", fontWeight: "800", fontSize: 24, marginBottom: 5 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 5 },
  profileDetail: { flex: 1, color: "#142740", fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, minHeight: 58, borderRadius: 12 },
  actionText: { flexShrink: 1, textAlign: "center", fontSize: 15, fontWeight: "700", color: "#101D40" },
  card: { padding: 14, borderWidth: 1, borderColor: "#DCE7F3", borderRadius: 14, backgroundColor: "#FFFFFF" },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5, marginBottom: 12 },
  sectionTitle: { fontSize: 21, fontWeight: "800", color: "#101D40" },
  description: { fontSize: 13, lineHeight: 20, color: "#50709A", marginTop: 3 },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  tile: { alignItems: "center", paddingVertical: 14, paddingHorizontal: 7, borderWidth: 1,
    borderColor: "#DFE9F3", borderRadius: 11, minHeight: 158 },
  tileIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  tileTitle: { fontSize: 14, fontWeight: "700", color: "#101D40", textAlign: "center" },
  tileSubtitle: { fontSize: 12, color: "#50709A", textAlign: "center", marginTop: 7, lineHeight: 18 },
  accountRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 15 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#E8EEF6" },
  rowTitle: { color: "#101D40", fontSize: 15, fontWeight: "700" },
  hours: { color: "#50709A", fontSize: 12, textAlign: "center", marginTop: 15 },
  orderList: { marginTop: 18, borderTopWidth: 1, borderTopColor: "#E8EEF6", paddingTop: 16 },
  error: { color: "#B91C1C", marginVertical: 14, lineHeight: 21 },
  retry: { padding: 14, backgroundColor: "#FFF8E2", borderRadius: 9 },
  empty: { color: "#50709A", lineHeight: 22, paddingVertical: 24, textAlign: "center" },
  pressed: { opacity: 0.7 },
});

export default UserProfile;
