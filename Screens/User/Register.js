import React, { useState } from "react";
import { View, Text, StyleSheet, Button, Dimensions } from "react-native";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import Error from "../../Shared/Error";
import Toast from "react-native-toast-message";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scrollview";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";

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
    <FormContainer title={formData.registrationStep === "verificationSent" ? "Verify Email" : "Register"}>
      {formData.registrationStep === "verificationSent" ? (
        // Email verification screen
        <View style={styles.verificationContainer}>
          <Text style={styles.verificationTitle}>Check Your Email</Text>
          <Text style={styles.verificationText}>
            We've sent a verification link to:
          </Text>
          <Text style={styles.emailText}>{formData.email}</Text>
          <Text style={styles.verificationText}>
            Please click the link in your email to verify your account and complete registration.
          </Text>
          
          <View style={styles.verificationActions}>
            <EasyButton 
              onPress={resendVerificationEmail} 
              secondary 
              large
              disabled={formData.isRegistering}
              style={styles.button}
            >
              <Text style={{ color: "white" }}>
                {formData.isRegistering ? "Sending..." : "Resend Email"}
              </Text>
            </EasyButton>
            
            <EasyButton
              onPress={() => setFormData({ ...formData, registrationStep: "form" })}
              tertiary
              large
              style={styles.button}
            >
              <Text style={{ color: "white" }}>Back to Registration</Text>
            </EasyButton>
            
            <EasyButton
              onPress={() => props.navigation.navigate("Login")}
              large
              style={styles.button}
            >
              <Text style={{ color: "black" }}>Go to Login</Text>
            </EasyButton>
          </View>
        </View>
      ) : (
        // Registration form
        <View style={styles.formContainer}>
      <Input
        id="name"
        placeholder="Name"
        name="name"
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
      />
      <Input
        id="email"
        placeholder="Email"
        name="email"
        value={formData.email}
        onChangeText={handleEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {formData.emailError ? (
        <Text style={styles.validationError}>{formData.emailError}</Text>
      ) : formData.email.length > 0 && validateEmail(formData.email) ? (
        <Text style={styles.validationSuccess}>✓ Valid email address</Text>
      ) : null}
      <Input
        id="password"
        placeholder="Password"
        name="password"
        secureTextEntry={true}
        value={formData.password}
        onChangeText={(text) => setFormData({ ...formData, password: text })}
      />
      <Input
        id="confirmPassword"
        placeholder="Confirm Password"
        name="confirmPassword"
        secureTextEntry={true}
        value={formData.confirmPassword}
        onChangeText={(text) =>
          setFormData({ ...formData, confirmPassword: text })
        }
      />
      {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword ? (
        <Text style={styles.validationError}>Passwords do not match</Text>
      ) : formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword ? (
        <Text style={styles.validationSuccess}>✓ Passwords match</Text>
      ) : null}
      <Input
        id="phone"
        placeholder="Phone Number"
        name="phone"
        keyboardType="numeric"
        value={formData.phone}
        onChangeText={(text) => setFormData({ ...formData, phone: text })}
      />
      <View style={styles.buttnGroup}>
        {formData.error ? <Error message={formData.error} /> : null}
      </View>
      <View style={styles.buttonContainer}>
        <EasyButton 
          onPress={() => register()} 
          tertiary 
          large
          disabled={formData.isRegistering}
          style={styles.button}
        >
          <Text style={{ color: "white" }}>
            {formData.isRegistering ? "Registering..." : "Register"}
          </Text>
        </EasyButton>
      </View>
      <View style={styles.buttonContainer}>
        <EasyButton
          tertiary
          large
          onPress={() => props.navigation.navigate("Login")}
          style={styles.button}
        >
          <Text style={{ color: "white" }}>Back to Login</Text>
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
  buttnGroup: {
    width: "80%",
    maxWidth: 300,
    margin: 10,
    alignItems: "center",
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
  verificationContainer: {
    width: "100%",
    maxWidth: Math.min(screenWidth * 0.9, 400),
    padding: 20,
    alignItems: "center",
    alignSelf: "center",
  },
  buttonContainer: {
    width: "80%",
    maxWidth: 300,
    marginVertical: 5,
    alignItems: "center",
  },
  button: {
    width: "100%",
    minWidth: 200,
  },
  verificationTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  verificationText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
    lineHeight: 24,
  },
  emailText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#8a6c09",
    marginBottom: 20,
    textAlign: "center",
  },
  verificationActions: {
    marginTop: 30,
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
});

export default Register;

