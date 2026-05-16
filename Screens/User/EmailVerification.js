import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import FormContainer from "../../Shared/Form/FormContainer";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import Icon from "react-native-vector-icons/FontAwesome";

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
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.center}>
              <Icon name="spinner" size={48} color="#8a6c09" />
              <Text style={styles.title}>Verifying Email...</Text>
              <Text style={styles.text}>Please wait while we verify your email address.</Text>
            </View>
          </ScrollView>
        );
      
      case "success":
        return (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.center}>
              <Icon name="check-circle" size={56} color="#4caf50" />
              <Text style={styles.successTitle}>Email Verified!</Text>
              <Text style={styles.text}>
                Your email has been successfully verified. You can now login to your account.
              </Text>
              <EasyButton
                onPress={() => props.navigation.navigate("Login")}
                tertiary
                large
                style={styles.button}
              >
                <Icon name="sign-in" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Go to Login</Text>
              </EasyButton>
            </View>
          </ScrollView>
        );
      
      case "error":
        return (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.center}>
              <Icon name="exclamation-circle" size={56} color="#e53935" />
              <Text style={styles.errorTitle}>Verification Failed</Text>
              <Text style={styles.text}>{errorMessage}</Text>
              <View style={styles.actionButtons}>
                <EasyButton
                  onPress={() => props.navigation.navigate("Register")}
                  secondary
                  large
                  style={styles.secondaryButton}
                >
                  <Icon name="redo" size={16} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>Back to Registration</Text>
                </EasyButton>
                <EasyButton
                  onPress={() => props.navigation.navigate("Login")}
                  tertiary
                  large
                  style={styles.button}
                >
                  <Icon name="sign-in" size={16} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>Go to Login</Text>
                </EasyButton>
              </View>
            </View>
          </ScrollView>
        );
      
      default:
        return null;
    }
  };

  return (
    <FormContainer title="">
      {renderContent()}
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 40,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#8a6c09',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4caf50',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#e53935',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
    color: '#5a6c7d',
  },
  actionButtons: {
    width: '100%',
    gap: 12,
  },
  button: {
    marginTop: 12,
    borderRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
});

export default EmailVerification;