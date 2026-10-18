import React from "react";
import { Text, View } from "react-native";
import { Switch, TextInput } from "react-native-paper";
import { rideOptions } from "../assets/common/rides";
import { styles } from "./DeliveryCheckout";

const rateFields = [["baseFare", "Base fare"], ["distanceRate", "Rate per mile (USA) / km (Ethiopia)"], ["minuteRate", "Rate per minute"]];

export const normalizeRideRates = (rates = {}) => Object.fromEntries(rideOptions.map(({ key }) => [key, {
  enabled: false, ...Object.fromEntries(rateFields.map(([field]) => [field, ""])), ...rates[key],
}]));

export default function RideVehiclePricing({ rates, onChange, disabled }) {
  const update = (key, patch) => onChange({ ...rates, [key]: { ...rates[key], ...patch } });
  return <View>
    <Text style={styles.heading}>Passenger car pricing: Economy & Comfort</Text>
    <Text>These prices are used by customers comparing passenger rides, not product deliveries.
      Set separate rates for Economy cars, Comfort cars and Vans. Disabled options cannot be newly requested.</Text>
    {rideOptions.map((option) => <View key={option.key} style={styles.card}>
      <Text style={styles.heading}>{option.name} pricing</Text>
      <Switch disabled={disabled} value={rates[option.key].enabled}
        onValueChange={(enabled) => update(option.key, { enabled })} />
      {rateFields.map(([field, label]) => <TextInput key={field} label={`${option.name} ${label}`}
        keyboardType="decimal-pad" disabled={disabled || !rates[option.key].enabled}
        value={String(rates[option.key][field] ?? "")}
        onChangeText={(value) => update(option.key, { [field]: value })} />)}
    </View>)}
  </View>;
}
