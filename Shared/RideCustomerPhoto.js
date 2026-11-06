import React, { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import { Button } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rideRequest } from "../assets/common/rides";
import baseUrl from "../assets/common/baseUrl";
import CloudinaryUploader from "./CloudinaryUploader";
import { reviewError } from "../assets/common/reviews";
import { getDatabaseNameFromStorage } from "../assets/common/databaseConfig";

export default function RideCustomerPhoto() {
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const region = useRef("");
  const running = useRef(false);
  const ensureRegion = async () => {
    const database = await getDatabaseNameFromStorage();
    if (region.current && region.current !== database) throw new Error("Region changed. Reopen this page before updating your photo.");
    region.current = database;
  };
  const run = async (action) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError("");
    try {
      await ensureRegion();
      const result = await action();
      await ensureRegion();
      if (mounted.current && result) setProfile(result);
    } catch (failure) { if (mounted.current) setError(reviewError(failure)); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  };
  const load = () => run(() => rideRequest("me/customer-profile"));
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);
  const photo = (camera) => run(async () => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error("Allow photo access, or skip for now.");
    const options = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 };
    const result = camera ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front }) :
      await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const image = result.assets?.[0];
    if (!image?.uri) throw new Error("No photo was returned. Please retry.");
    if (image.fileSize > 5 * 1024 * 1024) throw new Error("Customer photos must be 5 MB or smaller.");
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Sign in again before uploading a photo.");
    const signature = await CloudinaryUploader.getSignature(`${baseUrl}cloudinary/sign`, { folder: "customer_profiles" }, { token });
    const upload = await CloudinaryUploader.uploadToCloudinary(image.uri, signature, {
      folder: "customer_profiles", fileName: "ride-customer.jpg", fileType: image.mimeType || "image/jpeg",
    });
    if (!upload.secure_url) throw new Error("Photo upload failed to return an image URL.");
    await ensureRegion();
    return rideRequest("me/customer-profile", { method: "put", data: { profilePhotoUrl: upload.secure_url } });
  });
  return <View style={{ gap: 8 }}>
    {error ? <><Text accessibilityRole="alert" style={{ color: "#b91c1c" }}>{error}</Text><Button disabled={busy} onPress={load}>Retry photo profile</Button></> : null}
    {profile ? <>
      <Text>{profile.prompted ? "Your ride photo (optional)" : "Add your photo so your assigned driver can recognize you. You may skip."}</Text>
      {profile.profilePhotoUrl ? <Image source={{ uri: profile.profilePhotoUrl }} accessibilityLabel="Your ride photo"
        style={{ width: 64, height: 64, borderRadius: 32 }} /> : null}
      <Button disabled={busy} onPress={() => photo(true)}>Take photo</Button>
      <Button disabled={busy} onPress={() => photo(false)}>Choose photo</Button>
      {!profile.prompted ? <Button disabled={busy} onPress={() => run(() =>
        rideRequest("me/customer-profile", { method: "put", data: { skip: true } }))}>Skip for now</Button> : null}
      <Text>Your photo, joined date and ride rating are shared only with your assigned driver.</Text>
    </> : null}
  </View>;
}
