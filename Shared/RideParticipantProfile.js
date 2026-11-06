import React, { useContext } from "react";
import { Image, Text, View } from "react-native";
import { ReviewAvailabilityContext } from "../assets/common/reviews";

export default function RideParticipantProfile({ profile }) {
  const { settings } = useContext(ReviewAvailabilityContext);
  if (!profile) return null;
  return <View style={{ gap: 6, paddingVertical: 8 }}>
    {profile.profilePhotoUrl ? <Image source={{ uri: profile.profilePhotoUrl }}
      accessibilityLabel={`${profile.name}'s ride profile photo`} style={{ width: 64, height: 64, borderRadius: 32 }} /> : <Text>No photo provided</Text>}
    <Text>{profile.name}</Text>
    <Text>{profile.joinedAt ? `Joined ${new Date(profile.joinedAt).toLocaleDateString()}` : "Joined date unavailable"}</Text>
    {settings?.rides && profile.rating ? <Text>{profile.rating.count ? `${profile.rating.average.toFixed(1)}/5 (${profile.rating.count} reviews)` : "No reviews yet"}</Text> : null}
    {settings?.rides ? profile.reviews?.map((review) => <Text key={review._id}>{review.rating}/5: {review.comment}</Text>) : null}
  </View>;
}
