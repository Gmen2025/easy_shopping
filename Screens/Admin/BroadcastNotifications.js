import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/FontAwesome";
import Toast from "react-native-toast-message";
import axios from "axios";

import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import baseUrl from "../../assets/common/baseUrl";

const BroadcastNotifications = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleBroadcast = async () => {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (!trimmedTitle || !trimmedMessage) {
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Missing fields",
        text2: "Title and message are required",
      });
      return;
    }

    setSending(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.post(
        `${baseUrl}notifications/admin/broadcast`,
        {
          title: trimmedTitle,
          body: trimmedMessage,
          data: {
            type: "admin_broadcast",
            sentAt: new Date().toISOString(),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const sentCount = response?.data?.sent || 0;

      Toast.show({
        topOffset: 60,
        type: sentCount > 0 ? "success" : "info",
        text1: sentCount > 0 ? "Broadcast sent" : "No active recipients",
        text2:
          sentCount > 0
            ? `Delivered to ${sentCount} device(s)`
            : "No registered push tokens were available",
      });

      if (sentCount > 0) {
        setTitle("");
        setMessage("");
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to send broadcast notification";

      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Broadcast failed",
        text2: errorMessage,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroIconWrap}>
          <Icon name="bullhorn" size={24} color="#8a6c09" />
        </View>
        <Text style={styles.title}>Broadcast Notification</Text>
        <Text style={styles.subtitle}>
          Send one message to every customer device with a registered push token.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Notification Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Weekend sale starts now"
          placeholderTextColor="#c2ab63"
          maxLength={80}
        />

        <Text style={styles.label}>Notification Message</Text>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Tap to see new deals and limited offers."
          placeholderTextColor="#c2ab63"
          multiline
          textAlignVertical="top"
          maxLength={240}
        />

        <View style={styles.tipBox}>
          <Icon name="info-circle" size={14} color="#8a6c09" style={styles.tipIcon} />
          <Text style={styles.tipText}>
            Customers only receive remote push if they opened the app on a development or production build and their token is registered.
          </Text>
        </View>

        <EasyButton
          secondary
          onPress={handleBroadcast}
          style={styles.sendButton}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Icon name="send" size={14} color="#ffffff" style={styles.sendIcon} />
              <Text style={styles.sendButtonText}>Send Broadcast</Text>
            </>
          )}
        </EasyButton>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e9dfc4",
  },
  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#8a6c09",
  },
  subtitle: {
    fontSize: 13,
    color: "#5f6b7a",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 19,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e9dfc4",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a6c09",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dde2f0",
    backgroundColor: "#f8f9fc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1a1a1a",
    fontSize: 15,
  },
  messageInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#dde2f0",
    backgroundColor: "#f8f9fc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1a1a1a",
    fontSize: 15,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#eef4ff",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  tipIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  tipText: {
    flex: 1,
    color: "#42526a",
    fontSize: 12,
    lineHeight: 18,
  },
  sendButton: {
    width: "100%",
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "goldenrod",
  },
  sendIcon: {
    marginRight: 8,
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default BroadcastNotifications;