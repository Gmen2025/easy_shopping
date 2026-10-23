import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Switch, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import QRCode from "react-native-qrcode-svg";
import { securityRequest } from "../../assets/common/authApi";
import { authErrorMessage } from "../../assets/common/authFlow";
import {
  AuthPage, AuthBrand, AuthButton, BackButton, VerificationCode, authStyles as styles,
} from "../../Shared/AuthUI";

export default function SecuritySettings({ navigation }) {
  const [security, setSecurity] = useState(null);
  const [step, setStep] = useState("settings");
  const [method, setMethod] = useState("authenticator");
  const [setup, setSetup] = useState(null);
  const [operationChallenge, setOperationChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [savedCodes, setSavedCodes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if ((step === "success" || step === "recoveryCodes") && !savedCodes) {
      event.preventDefault();
      Alert.alert("Save your backup codes", "Please store your backup codes safely and confirm before leaving this screen.");
    }
  }), [navigation, step, savedCodes]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setBusy(true);
    securityRequest("security")
      .then((data) => { if (active) setSecurity(data); })
      .catch((requestError) => { if (active) setError(authErrorMessage(requestError)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []));

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (requestError) {
      setError(authErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (step === "settings") navigation.goBack();
    else {
      setStep("settings");
      setSetup(null);
      setCode("");
      setBackup(false);
      setError("");
      setOperationChallenge(null);
    }
  };

  const startSetup = () => run(async () => {
    const result = await securityRequest("2fa/setup", { method });
    setSetup(result);
    setCode("");
    setStep("confirm");
  });

  const showCodes = (result, nextStep) => {
    if (!Array.isArray(result.backupCodes) || result.backupCodes.length === 0) {
      throw new Error("The server did not return recovery codes. Open Security Settings to generate new codes.");
    }
    setBackupCodes(result.backupCodes);
    setSavedCodes(false);
    setStep(nextStep);
    setCode("");
    setBackup(false);
  };

  const enable = () => run(async () => {
    const result = await securityRequest("2fa/enable", { setupId: setup.setupId, code });
    setSecurity((previous) => ({ ...previous, enabled: true, method,
      backupCodesRemaining: result.backupCodes?.length || 0 }));
    setSetup(null);
    showCodes(result, "success");
  });

  const startSensitiveAction = (target) => run(async () => {
    setOperationChallenge(null);
    setCode("");
    setBackup(false);
    setStep(target);
    if (security.method === "email") {
      setOperationChallenge(await securityRequest("2fa/send-code", {}));
    }
  });

  const confirmSensitiveAction = () => run(async () => {
    const payload = { code: code.trim(), useBackupCode: backup,
      ...(operationChallenge?.challengeId ? { challengeId: operationChallenge.challengeId } : {}) };
    if (step === "disable") {
      await securityRequest("2fa/disable", payload);
      setSecurity((previous) => ({ ...previous, enabled: false, method: null, backupCodesRemaining: 0 }));
      setStep("settings");
      setCode("");
    } else {
      const result = await securityRequest("2fa/recovery", payload);
      setSecurity((previous) => ({ ...previous, backupCodesRemaining: result.backupCodes?.length || 0 }));
      showCodes(result, "recoveryCodes");
    }
  });

  const codeValid = backup ? !!code.trim() : code.length === 6;
  const isCodesStep = step === "success" || step === "recoveryCodes";
  return (
    <AuthPage>
      {!isCodesStep && <BackButton disabled={busy} onPress={goBack} />}
      {step === "settings" && <>
        <Text style={styles.title}>Security Settings</Text>
        <View style={[styles.card, styles.row, { marginTop: 24 }]}>
          <Icon name="shield" size={32} color={security?.enabled ? "#049D49" : "#9E7800"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Two-Factor Authentication</Text>
            <Text style={{ color: "#45608A", lineHeight: 20 }}>
              {security ? security.enabled ? `Enabled with ${security.method === "email" ? "email" : "an authenticator app"}.` :
                "Add an extra layer of account security." : "Loading security settings..."}
            </Text>
          </View>
          <Switch accessibilityLabel="Two-factor authentication"
            value={!!security?.enabled} disabled={busy || !security}
            trackColor={{ false: "#D9E2EF", true: "#FFDA00" }}
            onValueChange={() => security.enabled ? startSensitiveAction("disable") : setStep("setup")} />
        </View>
        {security?.enabled ? <>
          <AuthButton title="Recovery Options" secondary icon="key" disabled={busy}
            onPress={() => startSensitiveAction("recovery")} />
          <Text style={styles.subtitle}>{security.backupCodesRemaining ?? 0} backup codes remaining.
            {"\n"}Generate new codes only if you can safely store them.</Text>
        </> : <AuthButton title="Set Up Two-Factor Authentication" disabled={busy || !security}
          onPress={() => setStep("setup")} />}
        <View style={styles.card}>
          <Text style={styles.label}>Sign-in Providers</Text>
          <Text style={{ color: "#45608A", lineHeight: 22 }}>
            {security?.providers?.length ? security.providers.map((provider) =>
              typeof provider === "string" ? provider : provider.provider).join(", ") :
              "No social provider is linked to this account."}
          </Text>
        </View>
        <View style={[styles.card, { backgroundColor: "#EEF4FA" }]}>
          <Text style={{ color: "#45608A", lineHeight: 22 }}>
            {security?.enabled ? "Your account is protected with two-factor authentication. Keep your backup codes somewhere safe." :
              "After setup, a verification code will be required when you sign in. Backup codes help if you lose access to your second factor."}
          </Text>
        </View>
      </>}
      {step === "setup" && <>
        <AuthBrand security />
        <Text style={styles.title}>Two-Factor Authentication</Text>
        <Text style={styles.subtitle}>Add an extra layer of security to your account.</Text>
        {[
          { id: "authenticator", icon: "shield", title: "Authenticator App",
            description: "Use Google Authenticator, Authy, or a similar app." },
          { id: "email", icon: "envelope-o", title: "Email",
            description: "Receive codes at your verified email address." },
        ].map((item) => <Pressable key={item.id} accessibilityRole="radio"
          aria-checked={method === item.id}
          accessibilityState={{ checked: method === item.id, disabled: busy }} disabled={busy}
          onPress={() => setMethod(item.id)}
          style={[styles.card, styles.row, method === item.id && { borderColor: "#D3AC00" }]}>
          <Icon name={item.icon} size={27} color="#101522" />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{item.title}</Text>
            <Text style={{ color: "#45608A", lineHeight: 21 }}>{item.description}</Text>
          </View>
          <Icon name={method === item.id ? "dot-circle-o" : "circle-o"} size={22}
            color={method === item.id ? "#C99D00" : "#93A5C1"} />
        </Pressable>)}
        <AuthButton title="Continue to Verification" busy={busy} onPress={startSetup} />
      </>}
      {step === "confirm" && setup && <>
        <AuthBrand security />
        <Text style={styles.title}>Verify Your Setup</Text>
        {method === "authenticator" ? <>
          <Text style={styles.subtitle}>Scan this QR code in your authenticator app, or enter the setup key manually.</Text>
          {!!setup.otpauthUri && <View style={{ alignItems: "center", marginBottom: 20 }}>
            <QRCode value={setup.otpauthUri} size={190} />
          </View>}
          <Text selectable style={[styles.card, { textAlign: "center", color: "#17243B" }]}>{setup.secret}</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code generated by your app.</Text>
        </> : <Text style={styles.subtitle}>Enter the 6-digit code sent to {setup.destination || "your email address"}.</Text>}
        <VerificationCode value={code} onChangeText={setCode} disabled={busy} />
        <AuthButton title="Enable 2FA" busy={busy} disabled={!codeValid} onPress={enable} />
        <Text style={styles.subtitle}>Setup expires automatically. If the code expires, go back and start setup again.</Text>
      </>}
      {(step === "disable" || step === "recovery") && <>
        <AuthBrand security />
        <Text style={styles.title}>{step === "disable" ? "Disable Two-Factor Authentication" : "Generate Backup Codes"}</Text>
        <Text style={styles.subtitle}>{step === "disable" ? "Confirm your current second factor to disable protection." :
          "Confirm your current second factor. New backup codes will replace all previous codes."}
          {"\n\n"}{backup ? "Enter a saved backup code." : security?.method === "email" ?
            "Enter the code sent to your email." : "Enter a current code from your authenticator app."}</Text>
        <VerificationCode value={code} onChangeText={setCode} backup={backup} disabled={busy} />
        <AuthButton title={step === "disable" ? "Confirm Disable" : "Generate New Codes"}
          busy={busy} disabled={!codeValid} onPress={confirmSensitiveAction} />
        <AuthButton title={backup ? "Use Verification Code" : "Use Backup Code"} secondary disabled={busy}
          onPress={() => { setBackup(!backup); setCode(""); }} />
      </>}
      {isCodesStep && <>
        <View style={{ alignItems: "center", marginTop: 40, marginBottom: 28 }}>
          <View style={{ backgroundColor: "#D4F3DF", padding: 20, borderRadius: 70 }}>
            <Icon name="check-circle" size={72} color="#00A844" />
          </View>
        </View>
        <Text style={styles.title}>{step === "success" ? "Two-Factor Authentication Enabled!" : "New Backup Codes"}</Text>
        <Text style={styles.subtitle}>Your account is now more secure. Save these single-use backup codes somewhere safe.
          They will not be shown again.</Text>
        <View style={styles.card}>
          {backupCodes.map((item) => <Text selectable key={item}
            style={{ textAlign: "center", fontSize: 17, lineHeight: 30, color: "#17243B" }}>{item}</Text>)}
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: savedCodes }}
          aria-checked={savedCodes}
          onPress={() => setSavedCodes(!savedCodes)} style={[styles.row, { padding: 12, marginBottom: 12 }]}>
          <Icon name={savedCodes ? "check-square-o" : "square-o"} size={24} color="#796000" />
          <Text style={{ flex: 1, color: "#17243B" }}>I have saved my backup codes.</Text>
        </Pressable>
        <AuthButton title="Continue" disabled={!savedCodes} onPress={() => {
          setBackupCodes([]); setStep("settings"); setError("");
        }} />
      </>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {step === "settings" && !security && <AuthButton title="Retry" busy={busy}
        onPress={() => run(async () => setSecurity(await securityRequest("security")))} />}
    </AuthPage>
  );
}
