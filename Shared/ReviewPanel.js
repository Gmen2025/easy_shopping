import React, { useCallback, useContext, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { getDatabaseNameFromStorage } from "../assets/common/databaseConfig";
import { ReviewAvailabilityContext, reviewRequest, reviewFeature, reviewError, reviewQuery } from "../assets/common/reviews";

export default function ReviewPanel({ kind = "product", transaction, product, title = "Product reviews" }) {
  const { settings } = useContext(ReviewAvailabilityContext);
  const [enabled, setEnabled] = useState(false);
  const [data, setData] = useState(null);
  const [opened, setOpened] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const submitting = useRef(false);
  const region = useRef("");
  const ensureRegion = useCallback(async () => {
    const database = await getDatabaseNameFromStorage();
    if (region.current && region.current !== database) throw new Error("Region changed. Reopen this page before reviewing.");
    region.current = database;
  }, []);
  const load = useCallback(async () => {
    if (submitting.current) return;
    const current = ++sequence.current;
    try {
      await ensureRegion();
      const available = settings?.[reviewFeature[kind]] === true;
      const result = available && opened ? await reviewRequest(transaction
        ? reviewQuery(kind, transaction, product) : `products/${product}`) : null;
      await ensureRegion();
      if (current === sequence.current) { setEnabled(available); setData(result); setError(""); setBusy(false); }
    } catch (failure) {
      if (current === sequence.current) { setEnabled(false); setData(null); setError(reviewError(failure)); setBusy(false); }
    }
  }, [kind, transaction, product, opened, ensureRegion, settings]);
  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => { ++sequence.current; clearInterval(timer); };
  }, [load]));
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    const current = ++sequence.current;
    setBusy(true); setError("");
    try {
      await ensureRegion();
      const result = await reviewRequest("", { method: "post",
        data: { kind, transaction, ...(product ? { product } : {}), rating, comment } });
      await ensureRegion();
      if (current === sequence.current) { setData(result); setRating(0); setComment(""); }
    } catch (failure) {
      if (current === sequence.current) {
        setError(reviewError(failure));
        if (failure.response?.status === 403) { setEnabled(false); setData(null); }
      }
    } finally { submitting.current = false; if (current === sequence.current) setBusy(false); }
  };
  if (settings?.[reviewFeature[kind]] !== true) return null;
  if (!enabled && !error) return null;
  return <View style={{ paddingVertical: 12, gap: 8 }}>
    {error ? <><Text accessibilityRole="alert" style={{ color: "#b91c1c" }}>{error}</Text>
      <Button onPress={load} disabled={busy}>Retry reviews</Button></> : null}
    {enabled ? <>
      <Button onPress={() => setOpened((value) => !value)}>{title}</Button>
      {opened ? <>
        {busy ? <ActivityIndicator /> : null}
        {data?.review ? <>
          <Text>Your review: {data.review.rating}/5</Text>
          <Text>{data.review.comment}</Text>
          <Text>Submitted {new Date(data.review.dateCreated).toLocaleDateString()}</Text>
        </> : transaction && data ? <>
          <Text>Rate your completed experience (1-5 stars)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((value) => <Button key={value} disabled={busy}
              accessibilityLabel={`${value} stars`} mode={rating === value ? "contained" : "outlined"}
              onPress={() => setRating(value)}>{value}</Button>)}
          </View>
          <TextInput label="Review (optional)" multiline maxLength={2000} value={comment} onChangeText={setComment} disabled={busy} />
          <Button disabled={busy || !rating} onPress={submit}>Submit review</Button>
        </> : null}
        {!transaction && data ? <>
          <Text>{data.rating.count ? `${data.rating.average.toFixed(1)}/5 (${data.rating.count} reviews)` : "No reviews yet."}</Text>
          {data.reviews.map((review) => <View key={review._id}>
            <Text>{review.rating}/5 - {new Date(review.dateCreated).toLocaleDateString()}</Text>
            <Text>{review.comment}</Text>
          </View>)}
        </> : null}
      </> : null}
    </> : null}
  </View>;
}
