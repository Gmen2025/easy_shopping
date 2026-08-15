import React, { useState } from "react";
import { View, Text, StyleSheet, Button, Dimensions, ScrollView, Switch } from "react-native";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import Error from "../../Shared/Error";
import Toast from "react-native-toast-message";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scrollview";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Icon from "react-native-vector-icons/FontAwesome";

import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";

const { width: screenWidth } = Dimensions.get('window');

const Register = (props) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    error: "",
    emailError: "",
    isRegistering: false,
    becomeDriver: false,
    registrationStep: "form", // "form", "verificationSent", "verifying"
  });

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Phone validation function
  const validatePhone = (phone) => {
    const phoneRegex = /^[0-9]{10,15}$/; // 10-15 digits
    return phoneRegex.test(phone);
  };

  // Handle email input with real-time validation
  const handleEmailChange = (text) => {
    const lowercaseEmail = text.toLowerCase();
    setFormData({ ...formData, email: lowercaseEmail });
    
    // Real-time email validation
    if (lowercaseEmail.length > 0 && !validateEmail(lowercaseEmail)) {
      setFormData(prev => ({ ...prev, email: lowercaseEmail, emailError: "Invalid email format" }));
    } else {
      setFormData(prev => ({ ...prev, email: lowercaseEmail, emailError: "" }));
    }
  };

  const register = () => {
    // Clear previous errors
    setFormData({ ...formData, error: "" });

    // Check if all fields are filled
    if (
      formData.email === "" ||
      formData.name === "" ||
      formData.phone === "" ||
      formData.password === "" ||
      formData.confirmPassword === ""
    ) {
      setFormData({ ...formData, error: "Please fill in all fields" });
      return;
    }

    // Validate email format
    if (!validateEmail(formData.email)) {
      setFormData({ ...formData, error: "Please enter a valid email address" });
      return;
    }

    // Validate phone number
    if (!validatePhone(formData.phone)) {
      setFormData({ ...formData, error: "Please enter a valid phone number (10-15 digits)" });
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setFormData({ ...formData, error: "Password must be at least 6 characters long" });
      return;
    }

    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      setFormData({ ...formData, error: "Passwords do not match" });
      return;
    }

    // Validate name (no numbers or special characters except spaces)
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(formData.name)) {
      setFormData({ ...formData, error: "Name should only contain letters and spaces" });
      return;
    }

    // Set loading state
    setFormData({ ...formData, isRegistering: true, error: "" });

    let user = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      isAdmin: false,
      requireEmailVerification: true,
    };

    if (formData.becomeDriver) {
      user = {
        ...user,
        isDriver: true,
        is_driver: true,
        role: "driver",
        userType: "driver",
        driverRole: "driver",
      };
    }

    axios
      .post(`${baseUrl}users/register`, user)
      .then((res) => {
        setFormData({ ...formData, isRegistering: false });
        if (res.status == 200 || res.status == 201) {
          setFormData({ ...formData, registrationStep: "verificationSent" });
          Toast.show({
            topOffset: 60,
            type: "success",
            text1: "Registration successful",
            text2: "Please check your email for verification link",
          });
        }
      })
      .catch((error) => {
        setFormData({ ...formData, isRegistering: false });
        console.log("Registration error:", error.response?.data);
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Registration failed",
          text2: error.response?.data?.message || "Please try again",
        });
      });
  };

  // Resend verification email
  const resendVerificationEmail = () => {
    setFormData({ ...formData, isRegistering: true });
    
    axios
      .post(`${baseUrl}users/resend-verification`, { email: formData.email })
      .then((res) => {
        setFormData({ ...formData, isRegistering: false });
        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Verification email sent",
          text2: "Please check your email",
        });
      })
      .catch((error) => {
        setFormData({ ...formData, isRegistering: false });
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Failed to resend email",
          text2: "Please try again",
        });
      });
  };

  return (
    <FormContainer title="">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled"> 
       {formData.registrationStep === "verificationSent" ? (
          // Email verification screen
          <View style={styles.verificationContainer}>
            <Icon name="envelope-open" size={48} color="#8a6c09" style={{ marginBottom: 16 }} />
            <Text style={styles.verificationTitle}>Verify Your Email</Text>
            <Text style={styles.verificationText}>
              We've sent a verification link to:
            </Text>
            <Text style={styles.emailText}>{formData.email}</Text>
            <Text style={styles.verificationText}>
              Click the link in your email to verify your account and complete registration.
            </Text>
            
            <View style={styles.verificationActions}>
              <EasyButton 
                onPress={resendVerificationEmail} 
                secondary 
                large
                disabled={formData.isRegistering}
                style={styles.button}
              >
                <Text style={styles.buttonText}>
                  {formData.isRegistering ? "Sending..." : "Resend Email"}
                </Text>
              </EasyButton>
              
              <EasyButton
                onPress={() => setFormData({ ...formData, registrationStep: "form" })}
                tertiary
                large
                style={styles.button}
              >
                <Text style={styles.buttonText}>Back to Registration</Text>
              </EasyButton>
              
              <EasyButton
                onPress={() => props.navigation.navigate("Login")}
                style={styles.loginLink}
              >
                <Text style={styles.loginLinkText}>Already verified? Go to Login</Text>
              </EasyButton>
            </View>
          </View>
        ) : (
           // Registration form
          <View style={styles.formContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Icon name="user-plus" size={40} color="#8a6c09" />
              <Text style={styles.headerTitle}>Create Account</Text>
              <Text style={styles.headerSubtitle}>Join Easy Shopping today</Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formFields}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <Input
                id="name"
                placeholder="John Doe"
                name="name"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />

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
              {formData.emailError ? (
                <Text style={styles.validationError}>✗ {formData.emailError}</Text>
              ) : formData.email.length > 0 && validateEmail(formData.email) ? (
                <Text style={styles.validationSuccess}>✓ Valid email address</Text>
              ) : null}

              <Text style={styles.fieldLabel}>Password</Text>
              <Input
                id="password"
                placeholder="Min 6 characters"
                name="password"
                secureTextEntry={true}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
              />

              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <Input
                id="confirmPassword"
                placeholder="Re-enter password"
                name="confirmPassword"
                secureTextEntry={true}
                value={formData.confirmPassword}
                onChangeText={(text) =>
                  setFormData({ ...formData, confirmPassword: text })
                }
              />
              {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword ? (
                <Text style={styles.validationError}>✗ Passwords do not match</Text>
              ) : formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword ? (
                <Text style={styles.validationSuccess}>✓ Passwords match</Text>
              ) : null}

              <Text style={styles.fieldLabel}>Phone Number</Text>
              <Input
                id="phone"
                placeholder="123-456-7890"
                name="phone"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
              />

              <View style={styles.driverOptionRow}>
                <View style={styles.driverOptionTextWrap}>
                  <Text style={styles.fieldLabel}>Register as Driver</Text>
                  <Text style={styles.driverHint}>Enable delivery-driver access and delivery requests.</Text>
                </View>
                <Switch
                  value={formData.becomeDriver}
                  onValueChange={(value) => setFormData({ ...formData, becomeDriver: value })}
                  trackColor={{ false: "#d7d7d7", true: "#8a6c09" }}
                  thumbColor={formData.becomeDriver ? "#fff" : "#f4f3f4"}
                />
              </View>

              {/* Error Messages */}
            {formData.error ? <Error message={formData.error} /> : null}

            {/* Buttons */}
            <View style={styles.actionSection}>
              <EasyButton 
                onPress={() => register()} 
                tertiary 
                large
                disabled={formData.isRegistering}
                style={styles.registerButton}
              >
                <Text style={styles.buttonText}>
                  {formData.isRegistering ? "Creating Account..." : "Create Account"}
                </Text>
              </EasyButton>

              <EasyButton
                tertiary
                large
                onPress={() => props.navigation.navigate("Login")}
                style={styles.alternateButton}
              >
                <Text style={styles.buttonText}>Back to Login</Text>
              </EasyButton>
            </View>
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
    fontSize: 28,
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
  formFields: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  driverOptionRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  storeFormSection: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9f5eb',
  },
  driverOptionTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  driverHint: {
    fontSize: 12,
    color: '#5a6c7d',
    marginTop: 4,
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
  actionSection: {
    marginTop: 24,
    width: '100%',
    gap: 10,
  },
  registerButton: {
    width: '100%',
    borderRadius: 8,
    elevation: 4,
    marginBottom: 0,
  },
  alternateButton: {
    width: '100%',
    borderRadius: 8,
    elevation: 4,
    marginBottom: 0,
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  verificationContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  verificationTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#8a6c09',
    marginBottom: 16,
    textAlign: 'center',
  },
  verificationText: {
    fontSize: 15,
    color: '#5a6c7d',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8a6c09',
    marginVertical: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  verificationActions: {
    marginTop: 32,
    width: '100%',
  },
  button: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 4,
  },
  loginLink: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loginLinkText: {
    color: '#8a6c09',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  buttnGroup: {
    marginVertical: 12,
  },
  buttonContainer: {
    marginBottom: 12,
  },
});

export default Register;

