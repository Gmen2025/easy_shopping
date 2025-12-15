import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import Error from "../../Shared/Error";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";

const { width: screenWidth } = Dimensions.get('window');

const ResetPassword = (props) => {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
    error: "",
    isLoading: false,
    tokenValid: null, // null, true, false
  });

  const resetToken = props.route.params?.token;

  useEffect(() => {
    if (!resetToken) {
      setFormData({ ...formData, tokenValid: false, error: "Invalid reset link" });
      return;
    }

    // Verify token validity
    verifyResetToken();
  }, [resetToken]);

  const verifyResetToken = async () => {
    try {
      const response = await axios.get(`${baseUrl}users/verify-reset-token?token=${resetToken}`);
      
      if (response.status === 200) {
        setFormData({ ...formData, tokenValid: true });
      }
    } catch (error) {
      setFormData({ 
        ...formData, 
        tokenValid: false, 
        error: error.response?.data?.message || "Invalid or expired reset link" 
      });
    }
  };

  const handlePasswordChange = (text) => {
    setFormData({ ...formData, password: text, error: "" });
  };

  const handleConfirmPasswordChange = (text) => {
    setFormData({ ...formData, confirmPassword: text, error: "" });
  };

  const handleResetPassword = async () => {
    // Clear previous errors
    setFormData({ ...formData, error: "" });

    // Validate inputs
    if (!formData.password || !formData.confirmPassword) {
      setFormData({ ...formData, error: "Please fill in all fields" });
      return;
    }

    if (formData.password.length < 6) {
      setFormData({ ...formData, error: "Password must be at least 6 characters long" });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormData({ ...formData, error: "Passwords do not match" });
      return;
    }

    // Set loading state
    setFormData({ ...formData, isLoading: true, error: "" });

    try {
      const response = await axios.post(`${baseUrl}users/reset-password`, {
        token: resetToken,
        password: formData.password,
      });

      if (response.status === 200) {
        setFormData({ ...formData, isLoading: false });
        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Password reset successful",
          text2: "You can now login with your new password",
        });
        
        // Navigate to login after a short delay
        setTimeout(() => {
          props.navigation.navigate("Login");
        }, 1500);
      }
    } catch (error) {
      setFormData({ ...formData, isLoading: false });
      const errorMessage = error.response?.data?.message || "Failed to reset password";
      setFormData({ ...formData, error: errorMessage });
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Reset failed",
        text2: errorMessage,
      });
    }
  };

  const renderContent = () => {
    if (formData.tokenValid === null) {
      return (
        <View style={styles.container}>
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </View>
      );
    }

    if (formData.tokenValid === false) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorTitle}>Invalid Reset Link</Text>
          <Text style={styles.errorText}>
            {formData.error || "This password reset link is invalid or has expired."}
          </Text>
          <View style={styles.buttonContainer}>
            <EasyButton
              onPress={() => props.navigation.navigate("ForgotPassword")}
              tertiary
              large
              style={styles.button}
            >
              <Text style={{ color: "white" }}>Request New Reset Link</Text>
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
      );
    }

    return (
      <View style={styles.formContainer}>
        <Text style={styles.instructionText}>
          Enter your new password below. Make sure it's at least 6 characters long.
        </Text>
        
        <Input
          id="password"
          placeholder="New Password"
          name="password"
          value={formData.password}
          onChangeText={handlePasswordChange}
          secureTextEntry={true}
        />
        
        <Input
          id="confirmPassword"
          placeholder="Confirm New Password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          secureTextEntry={true}
        />
        
        {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword ? (
          <Text style={styles.validationError}>Passwords do not match</Text>
        ) : formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword ? (
          <Text style={styles.validationSuccess}>✓ Passwords match</Text>
        ) : null}
        
        {formData.error ? <Error message={formData.error} /> : null}
        
        <View style={styles.buttonContainer}>
          <EasyButton
            onPress={handleResetPassword}
            tertiary
            large
            disabled={formData.isLoading}
            style={styles.button}
          >
            <Text style={{ color: "white" }}>
              {formData.isLoading ? "Resetting..." : "Reset Password"}
            </Text>
          </EasyButton>
          
          <EasyButton
            onPress={() => props.navigation.navigate("Login")}
            large
            style={styles.button}
          >
            <Text style={{ color: "black" }}>Cancel</Text>
          </EasyButton>
        </View>
      </View>
    );
  };

  return (
    <FormContainer title="Reset Password">
      {renderContent()}
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: Math.min(screenWidth * 0.9, 400),
    padding: 20,
    alignItems: "center",
    alignSelf: "center",
  },
  formContainer: {
    width: "100%",
    maxWidth: Math.min(screenWidth * 0.9, 400),
    alignItems: "center",
    paddingHorizontal: 20,
    alignSelf: "center",
  },
  instructionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
    color: "#666",
  },
  loadingText: {
    fontSize: 18,
    textAlign: "center",
    color: "#8a6c09",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "red",
    marginBottom: 20,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
    color: "#666",
  },
  validationError: {
    color: "red",
    fontSize: 12,
    alignSelf: "flex-start",
    marginLeft: "10%",
    marginTop: -10,
    marginBottom: 10,
    width: "80%",
  },
  validationSuccess: {
    color: "green",
    fontSize: 12,
    alignSelf: "flex-start",
    marginLeft: "10%",
    marginTop: -10,
    marginBottom: 10,
    width: "80%",
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

export default ResetPassword;