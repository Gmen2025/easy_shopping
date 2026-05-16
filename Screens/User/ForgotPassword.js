import React, { useState } from "react";
import { View, Text, StyleSheet, Dimensions, ScrollView } from "react-native";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import Error from "../../Shared/Error";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import Icon from "react-native-vector-icons/FontAwesome";

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
    <FormContainer title="">
      <ScrollView contentContainerStyle={styles.container}>
        {formData.step === "emailSent" ? (
          // Email sent confirmation screen
          <View style={styles.confirmationContainer}>
            <Icon name="envelope-open-o" size={56} color="#8a6c09" />
            <Text style={styles.confirmationTitle}>Check Your Email</Text>
            <Text style={styles.confirmationText}>
              We've sent password reset instructions to:
            </Text>
            <Text style={styles.emailText}>{formData.email}</Text>
            <Text style={styles.confirmationText}>
              Please check your email and follow the link to reset your password.
            </Text>
            
            <View style={styles.actionButtons}>
              <EasyButton 
                onPress={resendResetEmail} 
                secondary 
                large
                disabled={formData.isLoading}
                style={styles.resendButton}
              >
                <Icon name="repeat" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>
                  {formData.isLoading ? "Sending..." : "Resend Email"}
                </Text>
              </EasyButton>
              
              <EasyButton
                onPress={() => setFormData({ ...formData, step: "email" })}
                tertiary
                large
                style={styles.changeEmailButton}
              >
                <Icon name="arrow-left" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Try Different Email</Text>
              </EasyButton>
              
              <EasyButton
                onPress={() => props.navigation.navigate("Login")}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Back to Login</Text>
              </EasyButton>
            </View>
          </View>
        ) : (
          // Email input form
          <View style={styles.formContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Icon name="lock" size={40} color="#8a6c09" />
              <Text style={styles.headerTitle}>Reset Password</Text>
              <Text style={styles.headerSubtitle}>We'll send you a reset link</Text>
            </View>

            <Text style={styles.instructionText}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
            
            <Text style={styles.fieldLabel}>Email Address</Text>
            <Input
              id="email"
              placeholder="you@example.com"
              name="email"
              value={formData.email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            {formData.error ? <Error message={formData.error} /> : null}
            
            <View style={styles.actionButtons}>
              <EasyButton
                onPress={handleForgotPassword}
                tertiary
                large
                disabled={formData.isLoading}
                style={styles.submitButton}
              >
                <Icon name="paper-plane" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>
                  {formData.isLoading ? "Sending..." : "Send Reset Email"}
                </Text>
              </EasyButton>
              
              <EasyButton
                onPress={() => props.navigation.navigate("Login")}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>Back to Login</Text>
              </EasyButton>
            </View>
          </View>
        )}
      </ScrollView>
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  formContainer: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#8a6c09',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#5a6c7d',
    marginTop: 6,
  },
  instructionText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    color: '#5a6c7d',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  confirmationContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  confirmationTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#8a6c09',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 15,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 22,
    color: '#5a6c7d',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8a6c09',
    marginVertical: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actionButtons: {
    marginTop: 28,
    width: '100%',
  },
  submitButton: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendButton: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeEmailButton: {
    marginBottom: 12,
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
  backButton: {
    paddingVertical: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  backButtonText: {
    color: '#8a6c09',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  loginButton: {
    paddingVertical: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#8a6c09',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
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