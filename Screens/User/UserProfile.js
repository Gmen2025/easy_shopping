import React, { useContext, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Button,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OrderCard from "../../Shared/OrderCard";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import { useDispatch } from 'react-redux';
import { clearCart } from '../../store/cartSlice';
import Icon from 'react-native-vector-icons/FontAwesome';

import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage"; //Store data in the device

import { AuthContext } from "../../Context/store/Auth";
import UserOrderDisplay from "../../Shared/UserOrderDisplay";

const UserProfile = (props) => {
  const context = useContext(AuthContext);
  const dispatch = useDispatch();
  const privacyPolicyUrl = "https://gmen2025.github.io/easy_shopping/privacy.html";
  const accountDeletionUrl = "https://gmen2025.github.io/easy_shopping/account-deletion.html";

  const [orders, setOrders] = useState();

  const openExternalLink = async (url) => {
    try {
      const cacheBustedUrl = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
      await Linking.openURL(cacheBustedUrl);
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

      //console.log("UserProfile mounted, isAuthenticated:", context.isAuthenticated);
      //console.log("Fetching user profile for:", context);
      //console.log("Context.user value: ", context.user);

      if (!context.isAuthenticated || !currentUserId) {
        //  the Login screen replaces the current screen
        // and the user cannot go back to the previous screen
        // with the back button.
        props.navigation.navigate("Login");
        return;
      }

      let isActive = true;

      const fetchOrders = async () => {
        try {
          const savedToken = await AsyncStorage.getItem("token");
          if (!savedToken) {
            if (isActive) {
              setOrders([]);
            }
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
            props.navigation.navigate("Login");
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="user-circle" size={56} color="#8a6c09" />
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Profile Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileItem}>
            <Icon name="user" size={18} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>{context.user ? context.user.name : "—"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.profileItem}>
            <Icon name="envelope" size={18} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{context.user ? context.user.user : "—"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.profileItem}>
            <Icon name="phone" size={18} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileLabel}>Phone</Text>
              <Text style={styles.profileValue}>{context.user ? context.user.phone : "—"}</Text>
            </View>
          </View>
        </View>

        {/* Privacy & Account Links */}
        <View style={styles.supportSection}>
          <View style={styles.sectionHeader}>
            <Icon name="shield" size={20} color="#8a6c09" />
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
            <Icon name="external-link" size={14} color="#888" />
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
            <Icon name="external-link" size={14} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <EasyButton
            onPress={() => props.navigation.navigate("EditProfile")}
            secondary
            large
            style={styles.editButton}
          >
            <Icon name="edit" size={16} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Edit Profile</Text>
          </EasyButton>

          {/* <EasyButton
            tertiary
            large
            onPress={() => props.navigation.navigate("ResetPassword")}
            style={styles.passwordButton}
          >
            <Icon name="key" size={16} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Change Password</Text>
          </EasyButton> */}
        </View>

        {/* My Orders Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="shopping-bag" size={20} color="#8a6c09" />
            <Text style={styles.sectionTitle}>My Orders</Text>
          </View>

          {orders && orders.length > 0 ? (
            <View style={styles.ordersList}>
              {orders.map((order) => (
                <View key={order._id} style={styles.orderItemWrapper}>
                  <OrderCard {...order} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="inbox" size={40} color="#888" />
              <Text style={styles.emptyStateText}>No orders yet</Text>
              <Text style={styles.emptyStateSubtext}>Start shopping to see your orders here</Text>
            </View>
          )}
        </View>

        {/* Help & Support Section */}
        <View style={styles.supportSection}>
          <View style={styles.sectionHeader}>
            <Icon name="headphones" size={20} color="#8a6c09" />
            <Text style={styles.sectionTitle}>Help & Support</Text>
          </View>
          <Text style={styles.supportSubtitle}>Need assistance? Contact us:</Text>
          
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('mailto:girma.m.halie19@gmail.com')}
          >
            <Icon name="envelope" size={16} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>girma.m.halie19@gmail.com</Text>
            </View>
            <Icon name="chevron-right" size={14} color="#888" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('tel:+251910588929')}
          >
            <Icon name="phone" size={16} color="#8a6c09" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>+251 910 588 929</Text>
            </View>
            <Icon name="chevron-right" size={14} color="#888" />
          </TouchableOpacity>

          <Text style={styles.supportHours}>
            <Icon name="clock-o" size={14} color="#8a6c09" /> Support Hours: Mon-Sat, 9 AM - 6 PM
          </Text>
        </View>

        {/* Sign Out Button */}
        <EasyButton
          tertiary
          large
          onPress={() => {
            dispatch(clearCart());
            context.logout();
            setOrders([]);
            props.navigation.navigate("Home");
          }}
          style={styles.signOutButton}
        >
          <Icon name="sign-out" size={16} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </EasyButton>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  profileCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  profileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  profileValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  actionButtons: {
    marginBottom: 24,
  },
  editButton: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    elevation: 4,
  },
  passwordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  ordersList: {
    gap: 12,
  },
  orderItemWrapper: {
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
  },
  supportSection: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  supportSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8a6c09',
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8a6c09',
  },
  supportHours: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: '#e53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    elevation: 4,
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  order: {
    marginTop: 10,
    alignItem: 'center',
    marginBottom: 10,
  },
  orderDetails: {
    marginTop: 20,
    borderStyle: 'solid',
    borderRadius: 20,
    borderColor: 'grey',
    borderWidth: 5,
  },
});

export default UserProfile;
