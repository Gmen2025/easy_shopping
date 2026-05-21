import React, { useState, useEffect } from "react";
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
    verifyResetToken(resetToken);
  }, [resetToken]);

  const verifyResetToken = async (token) => {
    try {
      const response = await axios.get(`${baseUrl}users/verify-reset-token?token=${token}`);
      
      if (response.status === 200) {
        setFormData((prev) => ({ ...prev, tokenValid: true, step: "password" }));
      }
    } catch (error) {
      setFormData((prev) => ({ 
        ...prev, 
        tokenValid: false, 
        error: error.response?.data?.message || "Invalid or expired reset link" 
      }));
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
        token: resetToken || formData.manualToken,
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
        <View style={styles.center}>
          <Icon name="spinner" size={40} color="#8a6c09" />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </View>
      );
    }

    if (formData.tokenValid === false) {
      return (
        <View style={styles.center}>
          <Icon name="exclamation-circle" size={48} color="#e53935" />
          <Text style={styles.errorTitle}>Invalid Reset Link</Text>
          <Text style={styles.errorText}>
            {formData.error || "This password reset link is invalid or has expired."}
          </Text>
          <View style={styles.errorActions}>
            <EasyButton
              onPress={() => props.navigation.navigate("ForgotPassword")}
              tertiary
              large
              style={styles.errorButton}
            >
              <Icon name="refresh" size={16} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Request New Reset Link</Text>
            </EasyButton>
            <EasyButton
              onPress={() => props.navigation.navigate("Login")}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Back to Login</Text>
            </EasyButton>
          </View>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="key" size={40} color="#8a6c09" />
          <Text style={styles.headerTitle}>Create New Password</Text>
          <Text style={styles.headerSubtitle}>Enter a strong password</Text>
        </View>

        <Text style={styles.instructionText}>
          Enter your new password below. Make sure it's at least 6 characters long.
        </Text>
        
        <Text style={styles.fieldLabel}>New Password</Text>
        <Input
          id="password"
          placeholder="Enter new password"
          name="password"
          value={formData.password}
          onChangeText={handlePasswordChange}
          secureTextEntry={true}
        />
        
        <Text style={styles.fieldLabel}>Confirm Password</Text>
        <Input
          id="confirmPassword"
          placeholder="Re-enter password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          secureTextEntry={true}
        />
        
        {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword ? (
          <Text style={styles.validationError}>✗ Passwords do not match</Text>
        ) : formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword ? (
          <Text style={styles.validationSuccess}>✓ Passwords match</Text>
        ) : null}
        
        {formData.error ? <Error message={formData.error} /> : null}
        
        <View style={styles.actionButtons}>
          <EasyButton
            onPress={handleResetPassword}
            tertiary
            large
            disabled={formData.isLoading}
            style={styles.resetButton}
          >
            <Icon name="check" size={16} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>
              {formData.isLoading ? "Resetting..." : "Reset Password"}
            </Text>
          </EasyButton>
          
          <EasyButton
            onPress={() => props.navigation.navigate("Login")}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </EasyButton>
        </View>
      </ScrollView>
    );
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
    paddingTop: 24,
    paddingBottom: 32,
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
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
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  loadingText: {
    fontSize: 16,
    color: '#8a6c09',
    fontWeight: '600',
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e53935',
    marginBottom: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    color: '#5a6c7d',
  },
  validationError: {
    color: '#e53935',
    fontSize: 12,
    fontWeight: '500',
    marginTop: -6,
    marginBottom: 8,
    marginLeft: 4,
  },
  validationSuccess: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '500',
    marginTop: -6,
    marginBottom: 8,
    marginLeft: 4,
  },
  actionButtons: {
    marginTop: 28,
  },
  errorActions: {
    marginTop: 28,
    width: '100%',
  },
  resetButton: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButton: {
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
  cancelButton: {
    paddingVertical: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#8a6c09',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  formContainer: {
    width: "100%",
    maxWidth: Math.min(screenWidth * 0.9, 400),
    alignItems: "center",
    paddingHorizontal: 20,
    alignSelf: "center",
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