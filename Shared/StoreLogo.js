import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { storeInitials } from "../assets/common/storeLogo";

export default function StoreLogo({ name, logo, size = 64 }) {
  const [failedLogo, setFailedLogo] = useState(null);
  const source = typeof logo === "string" ? logo.trim() : "";
  const dimensions = { width: size, height: size };
  if (source && source !== failedLogo) return <Image source={{ uri: source }} resizeMode="contain"
    style={[styles.logo, dimensions]} accessibilityLabel={`${name || "Store"} logo`}
    onError={() => setFailedLogo(source)} />;
  return <View style={[styles.logo, styles.placeholder, dimensions]} accessible accessibilityRole="image"
    accessibilityLabel={`${name || "Store"} initials`}>
    <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>{storeInitials(name)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  logo: { borderRadius: 10, backgroundColor: "#fff", flexShrink: 0 },
  placeholder: { backgroundColor: "#fff4ce", alignItems: "center", justifyContent: "center" },
  initials: { color: "#8a6c09", fontWeight: "800" },
});
