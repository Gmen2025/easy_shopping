import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "../../assets/common/baseUrl";

export default function TestingAccessSettings({ database }) {
  const [region, setRegion] = useState("E_Shopping");
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const guard = useRef(false);
  const selected = database || region;
  const request = useCallback(async (data) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Sign in as Admin to manage tester access.");
    const response = await axios({
      url: `${baseUrl}settings/testing-access`, method: data ? "put" : "get", data, timeout: 20000,
      headers: { "x-database-name": selected, Authorization: `Bearer ${token}` },
    });
    if (!Array.isArray(response.data?.emails) || response.data.emails.some((email) => typeof email !== "string")) {
      throw new Error("Tester access could not be verified. Please retry.");
    }
    return response.data.emails.join("\n");
  }, [selected]);
  useEffect(() => {
    let active = true;
    setBusy(true); setLoaded(false); setEmails(""); setError(""); setNotice("");
    request().then((value) => { if (active) { setEmails(value); setLoaded(true); } })
      .catch((failure) => { if (active) setError(failure.response?.data?.message || failure.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [request, revision]);
  const save = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError(""); setNotice("");
    try {
      setEmails(await request({ emails: emails.split(/[,;\n]/).map((email) => email.trim()).filter(Boolean) }));
      setNotice("Regional tester list saved. Remove an email to revoke tester access.");
    } catch (failure) { setError(failure.response?.data?.message || failure.message); }
    finally { guard.current = false; setBusy(false); }
  };
  return <View style={{ gap: 12 }}>
    <Text style={{ fontSize: 20, fontWeight: "700" }}>Approved testers</Text>
    {!database ? <Picker accessibilityLabel="Tester access region" selectedValue={region} enabled={!busy}
      onValueChange={setRegion}>
      <Picker.Item label="Ethiopia" value="E_Shopping" />
      <Picker.Item label="USA" value="E_ShopUSA" />
    </Picker> : null}
    <Text>One list per region, shared by disabled services and maintenance mode. Testers must sign in with an existing verified email. This does not grant Admin permissions or access to anyone else's financial records.</Text>
    <TextInput label="Tester emails (one per line)" multiline autoCapitalize="none" autoCorrect={false}
      value={emails} disabled={busy} onChangeText={setEmails} />
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
    <Button disabled={busy || !loaded} onPress={save}>Save tester list</Button>
    <Button disabled={busy} onPress={() => setRevision((value) => value + 1)}>Reload tester list</Button>
  </View>;
}
