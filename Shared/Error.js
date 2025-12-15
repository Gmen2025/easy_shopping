import React from "react";
import { View, Text, StyleSheet } from "react-native";

const Error = (props) => {
  return <Text style={styles.errorText}>{props.message}</Text>;
};
const styles = StyleSheet.create({
  errorText: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 10,
    padding: 10,
    backgroundColor: "#f8d7da",
    borderColor: "#f5c6cb",
    borderWidth: 1,
  },
});

export default Error;
