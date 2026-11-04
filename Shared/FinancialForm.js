import React, { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Crypto from "expo-crypto";
import { financeError } from "../assets/common/finance";

export function FinancialButton({ label, onPress, disabled = false, secondary = false }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
    onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </TouchableOpacity>;
}

export function FinancialSelect({ label, value, options, onChange, disabled = false }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.picker}>
      <Picker accessibilityLabel={label} selectedValue={value} onValueChange={onChange} enabled={!disabled}>
        {options.map((option) => <Picker.Item key={option.value} value={option.value} label={option.label} />)}
      </Picker>
    </View>
  </View>;
}

export function FinancialCard({ title, children }) {
  return <View style={styles.card}>
    {title ? <Text style={styles.heading}>{title}</Text> : null}
    {children}
  </View>;
}

export default function FinancialForm({ title, fields, initialValues, onSubmit, onCancel, submitLabel = "Save record", help }) {
  const [values, setValues] = useState(initialValues);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const retry = useRef(null);
  const submit = async () => {
    if (running.current) return;
    setError("");
    const activeFields = fields.filter((field) => !field.showWhen || field.showWhen(values));
    const missing = activeFields.find((field) => field.required && !String(values[field.name] ?? "").trim());
    if (missing) { setError(`${missing.label} is required.`); return; }
    running.current = true;
    setBusy(true);
    try {
      const signature = JSON.stringify(values);
      if (retry.current?.signature !== signature) {
        retry.current = { signature, key: Crypto.randomUUID() };
      }
      await onSubmit(values, retry.current.key);
    } catch (failure) { setError(financeError(failure)); }
    finally { running.current = false; setBusy(false); }
  };
  return <FinancialCard title={title}>
    {help ? <Text style={styles.help}>{help}</Text> : null}
    {fields.filter((field) => !field.showWhen || field.showWhen(values)).map((field) => {
      const options = typeof field.options === "function" ? field.options(values) : field.options;
      const change = (value) => {
        setError("");
        setValues((current) => ({ ...current, [field.name]: value,
          ...(typeof field.reset === "function" ? field.reset(value, current) : field.reset || {}) }));
      };
      return options ? <FinancialSelect key={field.name} label={field.label} value={values[field.name] || ""}
        options={options} disabled={busy} onChange={change} /> :
        <View key={field.name} style={styles.field}>
          <Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text>
          <TextInput accessibilityLabel={field.label} style={styles.input} value={values[field.name] || ""}
            placeholder={field.placeholder || field.label} editable={!busy} maxLength={field.maxLength || 1000}
            multiline={field.multiline} keyboardType={field.money ? "numbers-and-punctuation" : "default"}
            autoCapitalize={field.date ? "none" : "sentences"} onChangeText={change} />
        </View>;
    })}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {busy ? <ActivityIndicator /> : null}
    <FinancialButton label={busy ? "Saving..." : submitLabel} disabled={busy} onPress={submit} />
    <FinancialButton label="Cancel" disabled={busy} secondary onPress={onCancel} />
  </FinancialCard>;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, backgroundColor: "#fff", marginVertical: 8, gap: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  heading: { fontSize: 19, fontWeight: "700", color: "#0f172a" },
  help: { color: "#475569", lineHeight: 21 },
  field: { gap: 5, marginVertical: 5 },
  label: { fontWeight: "600", color: "#334155" },
  input: { borderWidth: 1, borderColor: "#94a3b8", padding: 12, borderRadius: 8, backgroundColor: "#fff", color: "#0f172a" },
  picker: { borderWidth: 1, borderColor: "#94a3b8", borderRadius: 8 },
  button: { padding: 13, borderRadius: 8, backgroundColor: "#facc15", alignItems: "center", marginVertical: 3 },
  secondary: { backgroundColor: "#e2e8f0" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#0f172a", fontWeight: "600", textAlign: "center" },
  error: { color: "#b91c1c", lineHeight: 21 },
});
