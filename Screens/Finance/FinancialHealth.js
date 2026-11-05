import React, { useContext } from "react";
import { Text, View } from "react-native";
import { AuthContext } from "../../Context/store/Auth";
import { FinancialButton } from "../../Shared/FinancialForm";
import FinancialManagement from "./FinancialManagement";

export default function FinancialHealth({ navigation }) {
  const auth = useContext(AuthContext);
  if (!auth.user) return <View style={{ padding: 20, gap: 16 }}>
    <Text>Sign in to track your private personal and business finances.</Text>
    <FinancialButton label="Sign in" onPress={() => navigation.navigate("User", { screen: "Login" })} />
  </View>;
  return <FinancialManagement key={auth.user?._id || auth.user?.id || "guest"} service />;
}
