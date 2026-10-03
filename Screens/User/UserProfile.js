import React, { useContext, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import OrderCard from "../../Shared/OrderCard";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import Icon from 'react-native-vector-icons/FontAwesome';

import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthContext } from "../../Context/store/Auth";

const UserProfile = (props) => {
  const context = useContext(AuthContext);
  const privacyPolicyUrl = "https://gmen2025.github.io/easy_shopping/privacy.html";
  const accountDeletionUrl = "https://gmen2025.github.io/easy_shopping/account-deletion.html";
  const supportPhoneNumber = "251954141473";
  const supportTelegramNumber = "@BettyT58";
  const supportTelegramUsername = supportTelegramNumber.replace("@", "");
  const whatsappUrl = `https://wa.me/${supportPhoneNumber}`;
  const telegramWebUrls = [
    `https://t.me/${supportTelegramUsername}`,
    `https://telegram.me/${supportTelegramUsername}`,
    `https://t.me/+${supportPhoneNumber}`,
  ];

  const openTelegramLink = async () => {
    for (const url of telegramWebUrls) {
      try {
        await Linking.openURL(url);
        return;
      } catch (error) {
        // Continue to next fallback
      }
    }

    const deepLinkUrls = [
      `tg://resolve?domain=${supportTelegramUsername}`,
      `tg://msg?to=${supportTelegramUsername}`,
      `tg://resolve?phone=${supportPhoneNumber}`,
    ];

    for (const url of deepLinkUrls) {
      try {
        await Linking.openURL(url);
        return;
      } catch (error) {
        // Continue to next fallback
      }
    }

    Toast.show({
      type: "error",
      text1: "Unable to open Telegram",
      text2: "Please verify Telegram username or browser availability.",
    });
  };

  const [orders, setOrders] = useState();

  const openExternalLink = async (url) => {
    try {
      const isWebUrl = url.startsWith("http://") || url.startsWith("https://");
      const finalUrl = isWebUrl
        ? `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`
        : url;
      await Linking.openURL(finalUrl);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Unable to open link",
        text2: "Please try again in a moment.",
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      const currentUserId = context.user?._id;

      if (!context.isAuthenticated || !currentUserId) {
        return;
      }

      let isActive = true;

      const fetchOrders = async () => {
        try {
          const savedToken = await AsyncStorage.getItem("token");
          if (!savedToken) {
            if (isActive) setOrders([]);
            return;
          }

          const res = await axios.get(`${baseUrl}orders`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });

          const data = res.data;
          const userOrders = data.filter(
            (order) => order.user && order.user._id === currentUserId
          );

          if (isActive) {
            setOrders(userOrders);
          }
        } catch (error) {
          if (error?.response?.status === 401) {
            await AsyncStorage.removeItem("token");
            context.logout();
            return;
          }

          console.log("Orders data error: ", error);
          if (isActive) {
            setOrders([]);
          }
        }
      };

      fetchOrders();

      return () => {
        isActive = false;
        setOrders();
      };
    }, [context.isAuthenticated, context.user?._id])
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Icon name="user-circle" size={64} color="#8a6c09" />
          </View>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Profile Info Card */}
        <View style={styles.card}>
          <View style={styles.profileItem}>
            <Icon name="user" size={16} color="#8a6c09" style={styles.profileIcon} />
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>{context.user ? context.user.name : "—"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.profileItem}>
            <Icon name="envelope" size={16} color="#8a6c09" style={styles.profileIcon} />
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{context.user?.email || "—"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.profileItem}>
            <Icon name="phone" size={16} color="#8a6c09" style={styles.profileIcon} />
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileLabel}>Phone</Text>
              <Text style={styles.profileValue}>{context.user ? context.user.phone : "—"}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <EasyButton
            onPress={() => props.navigation.navigate("EditProfile")}
            secondary
            large
            style={styles.actionButton}
          >
            <Icon name="edit" size={16} color="#1f2937" style={{ marginRight: 8 }} />
            <Text style={styles.darkButtonText}>Edit Profile</Text>
          </EasyButton>

          <EasyButton
            onPress={() => props.navigation.navigate("ServiceRequests")}
            tertiary
            large
            style={styles.actionButton}
          >
            <Icon name="wrench" size={16} color="#1f2937" style={{ marginRight: 8 }} />
            <Text style={styles.darkButtonText}>My Service Requests</Text>
          </EasyButton>
        </View>

        {/* My Orders Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="shopping-bag" size={18} color="#8a6c09" />
            <Text style={styles.sectionTitle}>My Orders</Text>
          </View>

          {orders && orders.length > 0 ? (
            <View style={styles.ordersList}>
              {orders.map((order, index) => (
                <View
                  key={`order-${order?._id || "no-id"}-${index}`}
                  style={styles.orderItemWrapper}
                >
                  <OrderCard {...order} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="inbox" size={36} color="#a0aec0" />
              <Text style={styles.emptyStateText}>No orders yet</Text>
              <Text style={styles.emptyStateSubtext}>Start shopping to see your orders here</Text>
            </View>
          )}
        </View>

        {/* Privacy & Account Links */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="shield" size={18} color="#8a6c09" />
            <Text style={styles.sectionTitle}>Privacy & Account</Text>
          </View>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => openExternalLink(privacyPolicyUrl)}
          >
            <Icon name="file-text-o" size={16} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Policy</Text>
              <Text style={styles.contactValue}>Privacy Policy</Text>
            </View>
            <Icon name="external-link" size={14} color="#a0aec0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => openExternalLink(accountDeletionUrl)}
          >
            <Icon name="user-times" size={16} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Account</Text>
              <Text style={styles.contactValue}>Account Deletion</Text>
            </View>
            <Icon name="external-link" size={14} color="#a0aec0" />
          </TouchableOpacity>
        </View>

        {/* Help & Support Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="headphones" size={18} color="#8a6c09" />
            <Text style={styles.sectionTitle}>Help & Support</Text>
          </View>
          <Text style={styles.supportSubtitle}>Need assistance? Contact us:</Text>
          
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('mailto:girmahalie2026@gmail.com')}
          >
            <Icon name="envelope" size={16} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>girmahalie2026@gmail.com</Text>
            </View>
            <Icon name="chevron-right" size={14} color="#a0aec0" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('tel:+251954141473')}
          >
            <Icon name="phone" size={16} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>+251 954 141 473</Text>
            </View>
            <Icon name="chevron-right" size={14} color="#a0aec0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => openExternalLink(whatsappUrl)}
          >
            <Icon name="whatsapp" size={16} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactValue}>Chat on WhatsApp</Text>
            </View>
            <Icon name="chevron-right" size={14} color="#a0aec0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={openTelegramLink}
          >
            <Icon name="telegram" size={16} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Telegram</Text>
              <Text style={styles.contactValue}>Message on Telegram</Text>
            </View>
            <Icon name="chevron-right" size={14} color="#a0aec0" />
          </TouchableOpacity>

          <Text style={styles.supportHours}>
            <Icon name="clock-o" size={13} color="#8a6c09" /> Support Hours: Mon-Sat, 9 AM - 6 PM
          </Text>
        </View>

        {/* Sign Out Button */}
        <EasyButton
          tertiary
          large
          onPress={() => {
            context.logout();
            setOrders([]);
            props.navigation.navigate("Home");
          }}
          style={styles.signOutButton}
        >
          <Icon name="sign-out" size={16} color="#1f2937" style={{ marginRight: 8 }} />
          <Text style={styles.darkButtonText}>Sign Out</Text>
        </EasyButton>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    backgroundColor: '#fff',
    borderRadius: 50,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 10,
    letterSpacing: -0.3,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  profileIcon: {
    marginRight: 14,
  },
  profileTextContainer: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  profileValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  actionButtons: {
    marginBottom: 20,
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
  },
  darkButtonText: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 8,
  },
  ordersList: {
    gap: 10,
  },
  orderItemWrapper: {
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginTop: 10,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  supportSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8a6c09',
  },
  contactLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8a6c09',
  },
  supportHours: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
});

export default UserProfile;