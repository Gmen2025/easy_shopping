import React from "react";
import { Text, View } from "react-native";
import { Button } from "react-native-paper";

export default function UsaRestrictedScreen({ navigation }) {
  return <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: "700" }}>USA storefront access is limited</Text>
    <Text>New shopping is available to administrators and approved verified testers. Your existing orders and payments remain available in your account.</Text>
    <Button mode="contained" onPress={() => navigation.navigate("User")}>Open account and orders</Button>
  </View>;
}
