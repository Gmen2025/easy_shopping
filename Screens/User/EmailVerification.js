import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import FormContainer from "../../Shared/Form/FormContainer";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";

const EmailVerification = (props) => {
  const [verificationStatus, setVerificationStatus] = useState("verifying"); // "verifying", "success", "error"
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Get verification token from route params
    const token = props.route.params?.token;
    
    if (!token) {
      setVerificationStatus("error");
      setErrorMessage("Invalid verification link");
      return;
    }

    // Verify the email
    verifyEmail(token);
  }, []);

  const verifyEmail = async (token) => {
    try {
      const response = await axios.post(`${baseUrl}users/verify-email`, {
        token: token
      });

      if (response.status === 200) {
        setVerificationStatus("success");
        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Email verified successfully",
          text2: "You can now login to your account",
        });
      }
    } catch (error) {
      setVerificationStatus("error");
      setErrorMessage(error.response?.data?.message || "Verification failed");
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Verification failed",
        text2: error.response?.data?.message || "Please try again",
      });
    }
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case "verifying":
        return (
          <View style={styles.container}>
            <Text style={styles.title}>Verifying Email...</Text>
            <Text style={styles.text}>Please wait while we verify your email address.</Text>
          </View>
        );
      
      case "success":
        return (
          <View style={styles.container}>
            <Text style={styles.successTitle}>✓ Email Verified!</Text>
            <Text style={styles.text}>
              Your email has been successfully verified. You can now login to your account.
            </Text>
            <EasyButton
              onPress={() => props.navigation.navigate("Login")}
              tertiary
              large
              style={styles.button}
            >
              <Text style={{ color: "white" }}>Go to Login</Text>
            </EasyButton>
          </View>
        );
      
      case "error":
        return (
          <View style={styles.container}>
            <Text style={styles.errorTitle}>Verification Failed</Text>
            <Text style={styles.text}>{errorMessage}</Text>
            <View style={styles.buttonContainer}>
              <EasyButton
                onPress={() => props.navigation.navigate("Register")}
                secondary
                large
                style={styles.button}
              >
                <Text style={{ color: "white" }}>Back to Registration</Text>
              </EasyButton>
              <EasyButton
                onPress={() => props.navigation.navigate("Login")}
                tertiary
                large
                style={styles.button}
              >
                <Text style={{ color: "white" }}>Go to Login</Text>
              </EasyButton>
            </View>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <FormContainer title="Email Verification">
      {renderContent()}
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "green",
    marginBottom: 20,
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "red",
    marginBottom: 20,
    textAlign: "center",
  },
  text: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 24,
  },
  button: {
    marginBottom: 10,
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
  },
});

export default EmailVerification;