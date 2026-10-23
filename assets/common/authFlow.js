export const authErrorMessage = (error) => {
  const data = error?.response?.data;
  return (typeof data === "string" && data) ||
    (typeof data?.message === "string" && data.message) ||
    (typeof error?.message === "string" && error.message) ||
    "Authentication is unavailable. Please try again.";
};

export const classifyAuthResponse = (data) => {
  if (!data || typeof data !== "object") {
    throw new Error("The server returned an invalid sign-in response.");
  }
  if (data.requiresTwoFactor === true) {
    if (data.token || typeof data.challengeId !== "string" || !data.challengeId ||
        !["authenticator", "email"].includes(data.method)) {
      throw new Error("The server returned an invalid verification challenge.");
    }
    return { challenge: data };
  }
  const { token, ...profile } = data;
  const user = profile.user || profile.profile || profile.data || profile;
  if (typeof token !== "string" || !token || (!user?._id && !user?.id)) {
    throw new Error("The server returned an incomplete sign-in response.");
  }
  return { token, user };
};

export const parseSocialCallback = (callbackUrl, redirectUri) => {
  const callback = new URL(callbackUrl);
  const expected = new URL(redirectUri);
  if (callback.protocol !== expected.protocol || callback.host !== expected.host ||
      callback.pathname !== expected.pathname) {
    throw new Error("The sign-in callback did not match this app.");
  }
  if (callback.searchParams.has("error")) {
    throw new Error("Social sign-in was not completed. Check your provider configuration or try email sign-in.");
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("The sign-in provider did not return an authorization code.");
  return code;
};

export const resendSecondsRemaining = (availableAt, now = Date.now()) =>
  Math.max(0, Math.ceil((availableAt - now) / 1000));
