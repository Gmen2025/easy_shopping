import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "../assets/common/baseUrl";
import { normalizeStoreLogo } from "../assets/common/storeLogo";
import CloudinaryUploader from "./CloudinaryUploader";
import StoreLogo from "./StoreLogo";

export default function StoreLogoField({ name, value, onChange, disabled, onBusyChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const chooseLogo = async () => {
    if (disabled || guard.current) return;
    guard.current = true;
    setBusy(true); setError(""); onBusyChange(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Photo permission is required to select a logo. Allow photo access or enter an HTTPS image URL.");
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85,
      });
      if (selection.canceled || !mounted.current) return;
      const asset = selection.assets?.[0];
      if (!asset?.uri) throw new Error("No logo image was selected. Please try again.");
      const mimeType = asset.mimeType || (/\.png$/i.test(asset.uri) ? "image/png" : /\.webp$/i.test(asset.uri) ? "image/webp" : "image/jpeg");
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("Choose a JPEG, PNG or WebP logo image.");
      if (asset.fileSize > 5 * 1024 * 1024) throw new Error("Logo images must be 5 MB or smaller.");
      const token = await AsyncStorage.getItem("token");
      const folder = "eshop/stores";
      const signature = await CloudinaryUploader.getSignature(`${baseUrl.replace(/\/$/, "")}/cloudinary/sign`, { folder }, { token });
      const uploaded = await CloudinaryUploader.uploadToCloudinary(asset.uri, signature, {
        folder, fileType: mimeType, fileName: asset.fileName || `store-logo.${mimeType.split("/")[1]}`,
      });
      if (!uploaded.secure_url) throw new Error("The image server did not return a secure logo URL. Please retry.");
      const logo = normalizeStoreLogo(uploaded.secure_url);
      if (mounted.current) onChange(logo);
    } catch (failure) {
      if (mounted.current) setError(failure.message || "Logo upload failed. Please retry.");
    } finally {
      guard.current = false;
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };
  return <View style={styles.field}>
    <Text style={styles.label}>Store logo (optional)</Text>
    <StoreLogo name={name} logo={value} />
    <Text>Without a logo, customers see initials from the registered store name.</Text>
    <TextInput style={styles.input} accessibilityLabel="Logo image URL (optional)" placeholder="https://... (optional)"
      autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={500} value={value}
      editable={!disabled && !busy} onChangeText={(logo) => { setError(""); onChange(logo); }} />
    <TouchableOpacity style={styles.button} accessibilityRole="button" disabled={disabled || busy} onPress={chooseLogo}>
      <Text>{busy ? "Uploading logo..." : "Choose logo image"}</Text>
    </TouchableOpacity>
    {busy ? <ActivityIndicator accessibilityLabel="Uploading store logo" /> : null}
    {value ? <TouchableOpacity style={styles.button} accessibilityRole="button" disabled={disabled || busy}
      onPress={() => { setError(""); onChange(""); }}><Text>Remove logo / use initials</Text></TouchableOpacity> : null}
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    <Text>JPEG, PNG or WebP, up to 5 MB. Save the form to apply the logo.</Text>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 10, marginVertical: 12 },
  label: { fontWeight: "700", color: "#1f2937" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, backgroundColor: "#fff" },
  button: { padding: 12, borderRadius: 8, backgroundColor: "#fff4ce", alignItems: "center" },
  error: { color: "#b91c1c" },
});
