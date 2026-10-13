import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TextInput } from "react-native-paper";
import { newPlacesSession, placeAddress, searchPlaces } from "../assets/common/rides";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;

const AddressSearchInput = ({ label, disabled, selectedText, onSelect }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const session = useRef(newPlacesSession());
  const latest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_CHARS) { setSuggestions([]); setSearching(false); return undefined; }
    const request = ++latest.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(text, session.current);
        if (request === latest.current) { setSuggestions(results); setError(results.length ? "" : "No matching places. Try a nearby landmark or fill in the fields below."); }
      } catch (failure) {
        if (request === latest.current) { setSuggestions([]); setError(failure.response?.data?.message || "Address search failed. Fill in the fields below."); }
      } finally {
        if (request === latest.current) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = async (suggestion) => {
    latest.current++;
    setSuggestions([]); setSearching(true); setError("");
    try {
      const address = await placeAddress(suggestion.placeId, session.current);
      onSelect(address);
      setQuery("");
    } catch (failure) {
      setError(failure.response?.data?.message || "Unable to use that place. Choose another suggestion.");
    } finally {
      session.current = newPlacesSession();
      setSearching(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TextInput
        label={label}
        value={query}
        disabled={disabled}
        onChangeText={(text) => { setQuery(text); setError(""); }}
        placeholder="Type a street, building or landmark"
        autoCorrect={false}
      />
      {searching ? <ActivityIndicator size="small" style={styles.spinner} /> : null}
      {suggestions.length ? (
        <View style={styles.list}>
          {suggestions.map((suggestion) => (
            <TouchableOpacity key={suggestion.placeId} style={styles.row} disabled={disabled}
              accessibilityRole="button" onPress={() => choose(suggestion)}>
              <Text style={styles.main}>{suggestion.mainText}</Text>
              {suggestion.secondaryText ? <Text style={styles.secondary}>{suggestion.secondaryText}</Text> : null}
            </TouchableOpacity>
          ))}
          <Text style={styles.attribution}>Powered by Google</Text>
        </View>
      ) : null}
      {selectedText ? <Text style={styles.selected}>✓ Map location: {selectedText}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  spinner: { marginTop: 6 },
  list: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6, backgroundColor: "#fff", marginTop: 2 },
  row: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e7eb" },
  main: { fontSize: 14, color: "#111827", fontWeight: "600" },
  secondary: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  attribution: { fontSize: 10, color: "#9ca3af", textAlign: "right", padding: 4 },
  selected: { fontSize: 12, color: "#047857", marginTop: 6 },
  error: { fontSize: 12, color: "#b91c1c", marginTop: 6 },
});

export default AddressSearchInput;
