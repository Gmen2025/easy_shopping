import React, { useContext, useEffect, useState } from "react";
import { View, Text, TextInput, Linking } from "react-native";
import { AuthContext } from "../../Context/store/Auth";
import {
  AuthPage, AuthBrand, AuthButton, BackButton, VerificationCode, authStyles as styles,
} from "../../Shared/AuthUI";
import { authErrorMessage, resendSecondsRemaining } from "../../assets/common/authFlow";
import { PRIVACY_URL, TERMS_URL } from "../../assets/common/legalLinks";

const Login = ({ navigation }) => {
  const auth = useContext(AuthContext);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const challenge = auth.twoFactorChallenge;

  useEffect(() => {
    setCode("");
    setBackup(false);
    setError("");
    setResendAt(Date.now() + (challenge?.resendAfterSeconds ?? 60) * 1000);
  }, [challenge?.challengeId]);

  useEffect(() => {
    const update = () => setRemaining(resendSecondsRemaining(resendAt));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const openLegalLink = async (url, title) => {
    try {
      await Linking.openURL(url);
    } catch (linkError) {
      setError(`Unable to open the ${title}. Please try again.`);
    }
  };

  const signIn = () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email address and password.");
      return;
    }
    auth.login(email, password);
  };

  const resend = async () => {
    setResending(true);
    setError("");
    try {
      const result = await auth.resendTwoFactor();
      setResendAt(Date.now() + (result.resendAfterSeconds ?? 60) * 1000);
    } catch (resendError) {
      setError(authErrorMessage(resendError));
    } finally {
      setResending(false);
    }
  };

  if (challenge) return (
    <AuthPage>
      <BackButton disabled={auth.loading || resending} onPress={() => { auth.cancelLogin(); setCode(""); }} />
      <AuthBrand />
      <Text style={styles.title}>Two-Factor Authentication</Text>
      <Text style={styles.subtitle}>{backup ? "Enter one of your saved backup codes." :
        challenge.method === "email" ? `We sent a 6-digit code to your email${challenge.destination ? `\n${challenge.destination}` : "."}` :
          "Enter the 6-digit code from your authenticator app."}</Text>
      <VerificationCode value={code} onChangeText={setCode} backup={backup} disabled={auth.loading} />
      {typeof challenge.deliveryError === "string" && !!challenge.deliveryError &&
        <Text accessibilityRole="alert" style={styles.error}>{challenge.deliveryError}</Text>}
      {!!(error || auth.error) && <Text accessibilityRole="alert" style={styles.error}>{error || auth.error}</Text>}
      {challenge.method === "email" && !backup && <AuthButton secondary
        title={remaining ? `Resend code (${remaining}s)` : "Resend code"}
        disabled={remaining > 0 || auth.loading} busy={resending} onPress={resend} />}
      <AuthButton title="Verify" busy={auth.loading} disabled={resending || (backup ? !code.trim() : code.length !== 6)}
        onPress={() => { setError(""); auth.verifyTwoFactor(code.trim(), backup); }} />
      <AuthButton secondary disabled={auth.loading || resending}
        title={backup ? "Use Verification Code" : "Use Backup Code"}
        onPress={() => { setBackup(!backup); setCode(""); setError(""); }} />
    </AuthPage>
  );

  return (
    <AuthPage>
      {emailMode && <BackButton onPress={() => { setEmailMode(false); setError(""); }} />}
      <AuthBrand />
      <Text style={[styles.title, { fontSize: 20 }]}>Welcome Back!</Text>
      <Text style={styles.subtitle}>Sign in to continue to your account</Text>
      {emailMode ? <View>
        <Text style={styles.label}>Email Address</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com"
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
          accessibilityLabel="Email address" editable={!auth.loading} />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Enter your password"
          secureTextEntry autoCapitalize="none" autoComplete="current-password" accessibilityLabel="Password"
          editable={!auth.loading} onSubmitEditing={signIn} />
        <AuthButton title="Sign In" busy={auth.loading} onPress={signIn} icon="envelope-o" />
        <Text accessibilityRole="link" style={styles.link} onPress={() => navigation.navigate("ForgotPassword")}>Forgot Password?</Text>
      </View> : <AuthButton title="Continue with Email" icon="envelope-o" disabled={auth.loading}
        onPress={() => setEmailMode(true)} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 20 }}>
        <View style={{ height: 1, backgroundColor: "#DCE5F0", flex: 1 }} />
        <Text style={{ color: "#45608A" }}>or</Text>
        <View style={{ height: 1, backgroundColor: "#DCE5F0", flex: 1 }} />
      </View>
      <AuthButton title="Continue with Google" icon="google" disabled={auth.loading}
        style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D9E2EF" }}
        onPress={() => { setError(""); auth.loginWithSocial("google"); }} />
      <AuthButton title="Continue with Apple" icon="apple" disabled={auth.loading}
        style={{ backgroundColor: "#10141D" }} textStyle={{ color: "#FFFFFF" }}
        onPress={() => { setError(""); auth.loginWithSocial("apple"); }} />
      <AuthButton title="Continue with Facebook" icon="facebook-official" disabled={auth.loading}
        style={{ backgroundColor: "#0866FF" }} textStyle={{ color: "#FFFFFF" }}
        onPress={() => { setError(""); auth.loginWithSocial("facebook"); }} />
      {auth.loading && !emailMode && <Text style={styles.subtitle}>Completing sign-in...</Text>}
      {!!(error || auth.error) && <Text accessibilityRole="alert" style={styles.error}>{error || auth.error}</Text>}
      <Text style={[styles.subtitle, { marginTop: 18, marginBottom: 0 }]}>
        Review our Terms of Service and how we handle your information.
      </Text>
      <Text accessibilityRole="link" onPress={() => openLegalLink(PRIVACY_URL, "Privacy Policy")} style={styles.link}>Privacy Policy</Text>
      <Text accessibilityRole="link" onPress={() => openLegalLink(TERMS_URL, "Terms of Service")} style={styles.link}>Terms of Service</Text>
      <Text style={[styles.subtitle, { marginTop: 16, marginBottom: 2 }]}>
        Don't have an account?{" "}
        <Text accessibilityRole="link" onPress={() => navigation.navigate("Register")} style={{ color: "#997300", fontWeight: "700" }}>Sign Up</Text>
      </Text>
      <Text accessibilityRole="link" onPress={() => navigation.navigate("Home")} style={styles.link}>Continue as Guest</Text>
    </AuthPage>
  );
};

export default Login;
