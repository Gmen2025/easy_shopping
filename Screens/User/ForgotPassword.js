import React, { useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import Error from "../../Shared/Error";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";

const { width: screenWidth } = Dimensions.get('window');

const ForgotPassword = (props) => {
  const [formData, setFormData] = useState({
    email: "",
    error: "",
    isLoading: false,
    step: "email", // "email", "emailSent"
  });

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (text) => {
    const lowercaseEmail = text.toLowerCase();
    setFormData({ ...formData, email: lowercaseEmail, error: "" });
  };

  const handleForgotPassword = async () => {
    // Clear previous errors
    setFormData({ ...formData, error: "" });

    // Validate email
    if (!formData.email) {
      setFormData({ ...formData, error: "Please enter your email address" });
      return;
    }

    if (!validateEmail(formData.email)) {
      setFormData({ ...formData, error: "Please enter a valid email address" });
      return;
    }

    // Set loading state
    setFormData({ ...formData, isLoading: true, error: "" });

    try {
      const response = await axios.post(`${baseUrl}users/forgot-password`, {
        email: formData.email,
      });

      if (response.status === 200) {
        setFormData({
          ...formData,
          isLoading: false,
          step: "emailSent",
        });
        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Reset email sent",
          text2: "Please check your email for password reset instructions",
        });
      }
    } catch (error) {
      setFormData({ ...formData, isLoading: false });
      const errorMessage = error.response?.data?.message || "Failed to send reset email";
      setFormData({ ...formData, error: errorMessage });
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Reset failed",
        text2: errorMessage,
      });
    }
  };

  const resendResetEmail = async () => {
    setFormData({ ...formData, isLoading: true });
    
    try {
      await axios.post(`${baseUrl}users/forgot-password`, {
        email: formData.email,
      });
      
      setFormData({ ...formData, isLoading: false });
      Toast.show({
        topOffset: 60,
        type: "success",
        text1: "Reset email sent",
        text2: "Please check your email",
      });
    } catch (error) {
      setFormData({ ...formData, isLoading: false });
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Failed to resend",
        text2: "Please try again",
      });
    }
  };

  return (
    <FormContainer title={formData.step === "emailSent" ? "Check Your Email" : "Forgot Password"}>
      {formData.step === "emailSent" ? (
        // Email sent confirmation screen
        <View style={styles.confirmationContainer}>
          <Text style={styles.confirmationTitle}>Reset Email Sent</Text>
          <Text style={styles.confirmationText}>
            We've sent password reset instructions to:
          </Text>
          <Text style={styles.emailText}>{formData.email}</Text>
          <Text style={styles.confirmationText}>
            Please check your email and follow the instructions to reset your password.
          </Text>
          
          <View style={styles.buttonContainer}>
            <EasyButton 
              onPress={resendResetEmail} 
              secondary 
              large
              disabled={formData.isLoading}
              style={styles.button}
            >
              <Text style={{ color: "white" }}>
                {formData.isLoading ? "Sending..." : "Resend Email"}
              </Text>
            </EasyButton>
            
            <EasyButton
              onPress={() => setFormData({ ...formData, step: "email" })}
              tertiary
              large
              style={styles.button}
            >
              <Text style={{ color: "white" }}>Try Different Email</Text>
            </EasyButton>
            
            <EasyButton
              onPress={() => props.navigation.navigate("Login")}
              large
              style={styles.button}
            >
              <Text style={{ color: "black" }}>Back to Login</Text>
            </EasyButton>
          </View>
        </View>
      ) : (
        // Email input form
        <View style={styles.formContainer}>
          <Text style={styles.instructionText}>
            Enter your email address and we'll send you instructions to reset your password.
          </Text>
          
          <Input
            id="email"
            placeholder="Email Address"
            name="email"
            value={formData.email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          {formData.error ? <Error message={formData.error} /> : null}
          
          <View style={styles.buttonContainer}>
            <EasyButton
              onPress={handleForgotPassword}
              tertiary
              large
              disabled={formData.isLoading}
              style={styles.button}
            >
              <Text style={{ color: "white" }}>
                {formData.isLoading ? "Sending..." : "Send Reset Email"}
              </Text>
            </EasyButton>
            
            <EasyButton
              onPress={() => props.navigation.navigate("Login")}
              large
              style={styles.button}
            >
              <Text style={{ color: "#8a6c09", textDecorationLine: "underline" }}>Back to Login</Text>
            </EasyButton>
          </View>
        </View>
      )}
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  formContainer: {
    width: "100%",
    maxWidth: Math.min(screenWidth * 0.9, 400),
    alignItems: "center",
    paddingHorizontal: 20,
    alignSelf: "center",
  },
  confirmationContainer: {
    width: "100%",
    maxWidth: Math.min(screenWidth * 0.9, 400),
    padding: 20,
    alignItems: "center",
    alignSelf: "center",
  },
  instructionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
    color: "#666",
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#8a6c09",
  },
  confirmationText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
    lineHeight: 24,
    color: "#666",
  },
  emailText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#8a6c09",
    marginBottom: 20,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 20,
  },
  button: {
    width: "80%",
    maxWidth: 300,
    marginVertical: 5,
  },
});

export default ForgotPassword;