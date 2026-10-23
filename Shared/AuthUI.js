import React, { useRef } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView,
  Platform, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/FontAwesome";

export const authStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FCFDFF" },
  content: { flexGrow: 1, padding: 24, width: "100%", maxWidth: 460, alignSelf: "center" },
  brand: { alignItems: "center", marginTop: 18, marginBottom: 26 },
  logo: { width: 78, height: 78, borderRadius: 28, backgroundColor: "#FFDA00",
    alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 23, fontWeight: "800", color: "#101522", textAlign: "center", marginBottom: 10 },
  subtitle: { color: "#45608A", fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 20 },
  label: { color: "#17243B", fontWeight: "600", fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#D9E2EF", borderRadius: 10, minHeight: 50,
    padding: 14, color: "#101522", backgroundColor: "#FFFFFF", marginBottom: 16, fontSize: 16 },
  button: { minHeight: 48, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 11,
    backgroundColor: "#FFDA00", flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginBottom: 12, gap: 12 },
  buttonText: { color: "#101522", fontSize: 15, fontWeight: "700", textAlign: "center" },
  secondary: { backgroundColor: "#EDF2F8" },
  link: { color: "#285CC4", textAlign: "center", paddingVertical: 10, fontSize: 14 },
  error: { color: "#AB2020", lineHeight: 21, textAlign: "center", marginBottom: 14 },
  card: { padding: 17, borderWidth: 1, borderColor: "#DCE5F0", borderRadius: 12,
    backgroundColor: "#FFFFFF", marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  back: { alignSelf: "flex-start", padding: 10, marginLeft: -10, marginBottom: 12 },
});

export function AuthPage({ children }) {
  return (
    <SafeAreaView style={authStyles.page} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={authStyles.content}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthBrand({ security = false }) {
  return <View style={authStyles.brand}>
    <View style={authStyles.logo}>
      <Icon name={security ? "shield" : "shopping-bag"} size={45} color="#101522" />
    </View>
    {!security && <Text style={authStyles.title}>Addu Genet Eshop</Text>}
  </View>;
}

export function AuthButton({ title, onPress, disabled, busy, secondary, icon, style, textStyle }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
    disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [authStyles.button, secondary && authStyles.secondary, style,
      (disabled || busy) && { opacity: 0.55 }, pressed && { opacity: 0.8 }]}>
    {busy ? <ActivityIndicator color={textStyle?.color || "#101522"} /> :
      icon ? <Icon name={icon} size={21} color={textStyle?.color || "#101522"} /> : null}
    <Text style={[authStyles.buttonText, textStyle]}>{title}</Text>
  </Pressable>;
}

export function BackButton({ onPress, disabled = false }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityState={{ disabled }}
    accessibilityRole="button" accessibilityLabel="Go back" style={authStyles.back}>
    <Icon name="arrow-left" size={20} color="#101522" />
  </Pressable>;
}

export function VerificationCode({ value, onChangeText, backup = false, disabled = false }) {
  const input = useRef(null);
  if (backup) return <TextInput style={authStyles.input} value={value} onChangeText={onChangeText}
    editable={!disabled} autoCapitalize="none" autoCorrect={false} placeholder="Enter a backup code"
    accessibilityLabel="Backup code" />;
  return <View style={{ marginVertical: 10, marginBottom: 24 }}>
    <Pressable onPress={() => input.current?.focus()} accessible={false}
      style={{ flexDirection: "row", gap: 7, justifyContent: "center" }}>
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={{
        flex: 1, maxWidth: 52, height: 54, borderRadius: 9, borderWidth: 1,
        borderColor: index === value.length ? "#D3AC00" : "#D9E2EF",
        backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
      }}><Text style={{ fontSize: 22, color: "#17243B" }}>{value[index] || ""}</Text></View>)}
    </Pressable>
    <TextInput ref={input} value={value}
      onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, 6))}
      keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
      accessibilityLabel="Six-digit verification code" editable={!disabled}
      caretHidden style={{ position: "absolute", width: "100%", height: 54, opacity: 0.02, color: "transparent" }} />
  </View>;
}
