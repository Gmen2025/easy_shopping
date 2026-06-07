import React, { useContext, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Linking } from "react-native";
import { AuthContext } from "../../Context/store/Auth";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import Error from "../../Shared/Error";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Icon from "react-native-vector-icons/FontAwesome";

const Login = (props) => {
  const { login, loading, isAuthenticated, error: contextError } = useContext(AuthContext);
  const privacyPolicyUrl = "https://gmen2025.github.io/easy_shopping/privacy.html";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");


  useEffect(() => {
    console.log("Login component mounted, isAuthenticated:", isAuthenticated);
    if (isAuthenticated) {
      props.navigation.navigate("User Profile");
    }

    return () => {
      setEmail();
      setPassword();
    }
  }, [isAuthenticated]);

  const handleLogin = () => {
  
    if (email && password) {
      login(email, password);
    } else {
      setError("Please fill in all fields");
    }
  };

  const openPrivacyPolicy = async () => {
    try {
      await Linking.openURL(privacyPolicyUrl);
    } catch (linkError) {
      setError("Unable to open Privacy Policy right now.");
    }
  };

  return (
    <FormContainer title="">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="sign-in" size={40} color="#1a237e" />
          <Text style={styles.headerTitle}>Welcome Back</Text>
          <Text style={styles.headerSubtitle}>Sign in to your account</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Email Address</Text>
          <Input
            placeholder="you@example.com"
            value={email}
            name={email}
            id={"email"}
            onChangeText={(text) => setEmail(text.toLowerCase())}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <Input
            placeholder="Enter your password"
            name={password}
            id={"password"}
            value={password}
            onChangeText={(text) => setPassword(text)}
            autoCapitalize="none"
            secureTextEntry={true}
          />

          {error ? <Error message={error} /> : null}
          {contextError ? <Error message={contextError} /> : null}

          <EasyButton
            onPress={() => handleLogin()}
            style={styles.signInButton}
          >
            <View style={styles.buttonContent}>
              <Icon name="lock" size={15} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.submitButtonText}>{loading ? "Signing in..." : "Sign In"}</Text>
            </View>
          </EasyButton>
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>New to Addu Genet E_Shopping?</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <Text style={styles.actionSectionTitle}>Create your account in seconds</Text>
          <EasyButton
            onPress={() => props.navigation.navigate("Register")}
            style={styles.createAccountButton}
          >
            <View style={styles.buttonContent}>
              <Icon name="user-plus" size={15} color="#1a237e" style={styles.buttonIcon} />
              <Text style={styles.createAccountText}>Create Account</Text>
            </View>
          </EasyButton>

          <EasyButton
            onPress={() => props.navigation.navigate("ForgotPassword")}
            style={styles.forgotButton}
          >
            <Text style={styles.forgotButtonText}>Forgot Password?</Text>
          </EasyButton>

          <EasyButton
            onPress={() => props.navigation.navigate("Home")}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Continue as Guest</Text>
          </EasyButton>

          <Text style={styles.privacyText} onPress={openPrivacyPolicy}>
            Privacy Policy
          </Text>
        </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a237e',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#5a6c7d',
    marginTop: 6,
  },
  formSection: {
    width: '92%',
    alignSelf: 'center',
    marginBottom: 24,
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
  submitButton: {
    marginTop: 24,
    borderRadius: 8,
    elevation: 4,
  },
  signInButton: {
    width: '100%',
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: 'goldenrod',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8a6c09',
    elevation: 5,
    shadowColor: '#8a6c09',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  dividerContainer: {
    width: '92%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#7a8a99',
    fontWeight: '500',
  },
  actionSection: {
    width: '92%',
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: '#f8f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8eaf6',
    padding: 14,
  },
  actionSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#5a6c7d',
    marginBottom: 10,
  },
  createAccountButton: {
    width: '100%',
    marginBottom: 12,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8a6c09',
    elevation: 2,
  },
  createAccountText: {
    color: '#8a6c09',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  forgotButton: {
    width: '100%',
    marginBottom: 12,
    paddingVertical: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  forgotButtonText: {
    color: '#8a6c09',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#8a6c09',
  },
  backButtonText: {
    color: '#8a6c09',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  privacyText: {
    marginTop: 12,
    textAlign: 'center',
    color: '#5a6c7d',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default Login;
